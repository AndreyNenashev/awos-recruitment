import { CliError } from "./errors.js";

const DEFAULT_SERVER_URL = "https://recruitment.awos.provectus.pro";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * Returns the AWOS server base URL.
 *
 * Uses `AWOS_SERVER_URL` env var if set, otherwise the production default.
 * The URL must be https; plain http is allowed only for loopback hosts
 * (local dev against `just serve`). Anything else throws — installed
 * artifacts include hook scripts that execute automatically, so a
 * downgradable origin is not acceptable.
 */
export function resolveServerUrl(): string {
  const url = process.env.AWOS_SERVER_URL || DEFAULT_SERVER_URL;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new CliError(`Error: AWOS_SERVER_URL is not a valid URL: ${url}`);
  }

  const isLoopbackHttp =
    parsed.protocol === "http:" && LOOPBACK_HOSTS.has(parsed.hostname);
  if (parsed.protocol !== "https:" && !isLoopbackHttp) {
    throw new CliError(
      "Error: AWOS_SERVER_URL must use https (http is allowed for localhost only).",
    );
  }

  return url;
}
