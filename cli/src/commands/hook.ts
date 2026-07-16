import * as fs from "node:fs";
import * as path from "node:path";

import { downloadBundle } from "../lib/download.js";
import { resolveServerUrl } from "../lib/server-url.js";
import type { InstallResult } from "../lib/types.js";

/**
 * Installs one or more hooks by downloading their directories from the AWOS
 * server and copying them into `.claude/hooks/<name>/` in the current working
 * directory.
 *
 * Phase 1 (this slice): hook directory installation. Directories that already
 * exist are silently skipped (a skip is a SUCCESS, not a failure).
 *
 * Phase 2 (next slice) — settings injection into `.claude/settings.json` — will
 * slot in after file installation and must run for BOTH `"installed"` and
 * `"skipped"` hooks. The per-name results array below preserves each hook's
 * name and status so that phase can consume it without re-deriving anything.
 *
 * Exits with code 1 only when some requested hook has `"not-found"` status
 * (the `agent.ts` rule). Installed and skipped hooks exit normally.
 */
export async function installHooks(names: string[]): Promise<void> {
  const serverUrl = resolveServerUrl();

  const tempDir = await downloadBundle(
    `${serverUrl}/bundle/hooks`,
    names,
  );

  try {
    // --- Phase 1: Install hook directories -----------------------------------
    const results = processHooks(tempDir, names);

    // --- Phase 2 (next slice): settings injection ----------------------------
    // Runs here, after file installation, for both "installed" and "skipped"
    // hooks. Intentionally not implemented yet.

    printResults(results);

    const hasNotFound = results.some((r) => r.status === "not-found");
    if (hasNotFound) {
      process.exit(1);
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

/**
 * Compares requested names against what was extracted, copies found hook
 * directories into the target location, and returns per-item results.
 *
 * This is a pure function with no console I/O and no `process.exit` calls —
 * callers interpret the results and perform output. `fs.cpSync` preserves file
 * mode bits, so the entrypoint script stays executable end-to-end.
 */
export function processHooks(
  tempDir: string,
  requestedNames: string[],
): InstallResult[] {
  const extractedDirs = new Set(fs.readdirSync(tempDir));
  const results: InstallResult[] = [];

  const hooksBaseDir = path.join(process.cwd(), ".claude", "hooks");

  for (const name of requestedNames) {
    if (!extractedDirs.has(name)) {
      results.push({
        name,
        status: "not-found",
        message: `Error: hook '${name}' not found.`,
      });
      continue;
    }

    const targetDir = path.join(hooksBaseDir, name);

    if (fs.existsSync(targetDir)) {
      results.push({
        name,
        status: "skipped",
        message: `Skipped hook '${name}' — already installed.`,
      });
      continue;
    }

    fs.mkdirSync(hooksBaseDir, { recursive: true });
    const sourceDir = path.join(tempDir, name);
    fs.cpSync(sourceDir, targetDir, { recursive: true });

    results.push({
      name,
      status: "installed",
      message: `Installed hook '${name}' to .claude/hooks/${name}/`,
    });
  }

  return results;
}

/**
 * Prints each install result. Installed and skipped hooks go to stdout
 * (skips are a success); not-found errors go to stderr.
 */
function printResults(results: InstallResult[]): void {
  for (const result of results) {
    if (result.status === "not-found") {
      process.stderr.write(result.message + "\n");
    } else {
      process.stdout.write(result.message + "\n");
    }
  }
}
