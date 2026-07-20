import { afterEach, describe, expect, it } from "vitest";
import { resolveServerUrl } from "../server-url.js";
import { CliError } from "../errors.js";

describe("resolveServerUrl", () => {
  afterEach(() => {
    delete process.env.AWOS_SERVER_URL;
  });

  it("returns the https default when the env var is unset", () => {
    expect(resolveServerUrl()).toBe("https://recruitment.awos.provectus.pro");
  });

  it("accepts an https override", () => {
    process.env.AWOS_SERVER_URL = "https://staging.example.com";
    expect(resolveServerUrl()).toBe("https://staging.example.com");
  });

  it.each(["http://localhost:8000", "http://127.0.0.1:8000"])(
    "accepts loopback http: %s",
    (url) => {
      process.env.AWOS_SERVER_URL = url;
      expect(resolveServerUrl()).toBe(url);
    },
  );

  it("rejects non-loopback http", () => {
    process.env.AWOS_SERVER_URL = "http://evil.example.com";
    expect(() => resolveServerUrl()).toThrow(CliError);
  });

  it("rejects an unparseable URL", () => {
    process.env.AWOS_SERVER_URL = "not a url";
    expect(() => resolveServerUrl()).toThrow(CliError);
  });
});
