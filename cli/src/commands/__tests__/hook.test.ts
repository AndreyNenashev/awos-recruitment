import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

import { installHooks } from "../hook.js";

// ---------------------------------------------------------------------------
// Mock downloadBundle -- vi.hoisted ensures the variable is available
// inside the hoisted vi.mock factory.
// ---------------------------------------------------------------------------

const { mockDownloadBundle } = vi.hoisted(() => ({
  mockDownloadBundle: vi.fn<(url: string, names: string[]) => Promise<string>>(),
}));

vi.mock("../../lib/download.js", () => ({
  downloadBundle: mockDownloadBundle,
}));

// ---------------------------------------------------------------------------
// Shared state
// ---------------------------------------------------------------------------

/** Temp directories to clean up after each test. */
const tempDirs: string[] = [];

/** Helper: create a fresh temp dir and register it for cleanup. */
function makeTempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

/**
 * Helper: stage an extracted-bundle temp dir containing a single hook named
 * `protect-env-files` with a HOOK.md and an executable entrypoint script.
 * Returns the bundle dir path.
 */
function stageProtectEnvBundle(): string {
  const bundleDir = makeTempDir("bundle-");
  const hookSrc = path.join(bundleDir, "protect-env-files");
  fs.mkdirSync(hookSrc, { recursive: true });
  fs.writeFileSync(
    path.join(hookSrc, "HOOK.md"),
    "# Protect Env Files",
    "utf-8",
  );
  const scriptPath = path.join(hookSrc, "protect-env-files.sh");
  fs.writeFileSync(scriptPath, "#!/usr/bin/env bash\nexit 0\n", "utf-8");
  fs.chmodSync(scriptPath, 0o755);
  return bundleDir;
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

describe("installHooks", () => {
  beforeEach(() => {
    // Prevent process.exit from actually killing the test runner.
    vi.spyOn(process, "exit").mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      (_code?: string | number | null) => undefined as never,
    );

    // Silence stdout / stderr output from printResults.
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    for (const dir of tempDirs) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        // best-effort
      }
    }
    tempDirs.length = 0;
  });

  // -----------------------------------------------------------------------
  // 1. Successful install of a hook directory
  // -----------------------------------------------------------------------
  it("copies a found hook into .claude/hooks/<name>/", async () => {
    const bundleDir = stageProtectEnvBundle();
    mockDownloadBundle.mockResolvedValue(bundleDir);

    const fakeCwd = makeTempDir("cwd-");
    vi.spyOn(process, "cwd").mockReturnValue(fakeCwd);

    await installHooks(["protect-env-files"]);

    const installedDir = path.join(
      fakeCwd,
      ".claude",
      "hooks",
      "protect-env-files",
    );
    expect(
      fs.existsSync(path.join(installedDir, "HOOK.md")),
    ).toBe(true);
    expect(
      fs.existsSync(path.join(installedDir, "protect-env-files.sh")),
    ).toBe(true);

    // No failures -> process.exit not called.
    expect(process.exit).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // 2. .claude/hooks/ is created when absent
  // -----------------------------------------------------------------------
  it("creates .claude/hooks/ when it does not exist", async () => {
    const bundleDir = stageProtectEnvBundle();
    mockDownloadBundle.mockResolvedValue(bundleDir);

    const fakeCwd = makeTempDir("cwd-");
    vi.spyOn(process, "cwd").mockReturnValue(fakeCwd);

    // Sanity: .claude/hooks does not exist yet.
    expect(fs.existsSync(path.join(fakeCwd, ".claude", "hooks"))).toBe(
      false,
    );

    await installHooks(["protect-env-files"]);

    expect(fs.existsSync(path.join(fakeCwd, ".claude", "hooks"))).toBe(
      true,
    );
  });

  // -----------------------------------------------------------------------
  // 3. Silent skip on existing hook directory (success, exit not called with 1)
  // -----------------------------------------------------------------------
  it("silently skips an already-installed hook and leaves files untouched", async () => {
    const bundleDir = stageProtectEnvBundle();
    mockDownloadBundle.mockResolvedValue(bundleDir);

    // Pre-create the target dir with a marker file that must survive.
    const fakeCwd = makeTempDir("cwd-");
    const existingDir = path.join(
      fakeCwd,
      ".claude",
      "hooks",
      "protect-env-files",
    );
    fs.mkdirSync(existingDir, { recursive: true });
    const marker = path.join(existingDir, "HOOK.md");
    fs.writeFileSync(marker, "# Original", "utf-8");

    vi.spyOn(process, "cwd").mockReturnValue(fakeCwd);

    await installHooks(["protect-env-files"]);

    // Pre-existing marker file must be untouched.
    expect(fs.readFileSync(marker, "utf-8")).toBe("# Original");

    // A silent skip is a success -> exit(1) must NOT be called.
    expect(process.exit).not.toHaveBeenCalledWith(1);
  });

  // -----------------------------------------------------------------------
  // 4. Not-found -> stderr message + exit(1)
  // -----------------------------------------------------------------------
  it("calls process.exit(1) when a requested hook is not in the bundle", async () => {
    // Empty bundle -> the hook does not exist.
    const bundleDir = makeTempDir("bundle-");
    mockDownloadBundle.mockResolvedValue(bundleDir);

    const fakeCwd = makeTempDir("cwd-");
    vi.spyOn(process, "cwd").mockReturnValue(fakeCwd);

    await installHooks(["nonexistent"]);

    expect(process.stderr.write).toHaveBeenCalledWith(
      "Error: hook 'nonexistent' not found.\n",
    );
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  // -----------------------------------------------------------------------
  // 5. Exec-bit round-trip regression: staged 0o755 .sh keeps its exec bit
  //    through fs.cpSync into the installed location.
  // -----------------------------------------------------------------------
  it("preserves the executable bit on the installed entrypoint script", async () => {
    const bundleDir = stageProtectEnvBundle();
    mockDownloadBundle.mockResolvedValue(bundleDir);

    const fakeCwd = makeTempDir("cwd-");
    vi.spyOn(process, "cwd").mockReturnValue(fakeCwd);

    await installHooks(["protect-env-files"]);

    const installedScript = path.join(
      fakeCwd,
      ".claude",
      "hooks",
      "protect-env-files",
      "protect-env-files.sh",
    );
    const mode = fs.statSync(installedScript).mode;
    expect(mode & 0o111).not.toBe(0);
  });

  // -----------------------------------------------------------------------
  // 6. Mixed results: one installed, one not-found -> exit(1) but the
  //    installed hook is still present.
  // -----------------------------------------------------------------------
  it("installs found hooks and still exits 1 when another is not found", async () => {
    const bundleDir = stageProtectEnvBundle();
    mockDownloadBundle.mockResolvedValue(bundleDir);

    const fakeCwd = makeTempDir("cwd-");
    vi.spyOn(process, "cwd").mockReturnValue(fakeCwd);

    await installHooks(["protect-env-files", "nonexistent"]);

    // The found hook is installed.
    expect(
      fs.existsSync(
        path.join(
          fakeCwd,
          ".claude",
          "hooks",
          "protect-env-files",
          "HOOK.md",
        ),
      ),
    ).toBe(true);

    // The missing one triggers exit(1).
    expect(process.exit).toHaveBeenCalledWith(1);
  });
});
