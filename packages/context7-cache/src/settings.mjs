import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, win32, posix } from "node:path";

export function platformPaths(platform = process.platform, env = process.env, home = homedir()) {
  const path = platform === "win32" ? win32 : posix;
  const configBase = platform === "win32" ? env.APPDATA || path.join(home, "AppData", "Roaming") : platform === "darwin" ? path.join(home, "Library", "Application Support") : env.XDG_CONFIG_HOME || path.join(home, ".config");
  const cacheBase = platform === "win32" ? env.LOCALAPPDATA || path.join(home, "AppData", "Local") : platform === "darwin" ? path.join(home, "Library", "Caches") : env.XDG_CACHE_HOME || path.join(home, ".cache");
  return { config: env.CTX7_CONFIG_DIR || path.join(configBase, "context7-cache"), cache: env.CTX7_CACHE_DIR || path.join(cacheBase, "context7-cache") };
}

export function readSettings(required = true) {
  const paths = platformPaths();
  const file = join(paths.config, "settings.json");
  if (!existsSync(file)) {
    if (required) throw new Error("Run context7-cache setup first");
    return {};
  }
  return JSON.parse(readFileSync(file, "utf8"));
}

export function saveSettings(settings) {
  const dir = platformPaths().config;
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  if (process.platform === "win32") {
    const identity = execFileSync("whoami", ["/user", "/fo", "csv", "/nh"], { encoding: "utf8" });
    const sid = identity.match(/S-\d+(?:-\d+)+/)?.[0];
    if (!sid) throw new Error("Cannot determine Windows user SID");
    execFileSync("icacls", [dir, "/inheritance:r", "/grant:r", `*${sid}:(OI)(CI)F`], { stdio: "pipe" });
  } else chmodSync(dir, 0o700);
  const file = join(dir, "settings.json");
  const temp = `${file}.${randomBytes(8).toString("hex")}.tmp`;
  writeFileSync(temp, `${JSON.stringify(settings, null, 2)}\n`, { mode: 0o600 });
  renameSync(temp, file);
}

export function runtimeSettings() {
  const settings = readSettings();
  const keys = ["CONTEXT7_API_KEY", ...Array.from({ length: 50 }, (_, i) => `CONTEXT7_API_KEY${i + 1}`)].map((name) => process.env[name]).filter(Boolean);
  const port = Number(process.env.CTX7_PORT ?? settings.port ?? 3777);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Port must be an integer between 1 and 65535");
  if (typeof settings.token !== "string" || settings.token.length < 32) throw new Error("Invalid settings token; run setup again");
  return {
    port, token: settings.token,
    apiKeys: keys.length ? keys : settings.apiKeys ?? [],
    cacheDir: process.env.CTX7_CACHE_DIR || settings.cacheDir || platformPaths().cache,
    searchTtl: Number(process.env.CTX7_CACHE_TTL_SEARCH_MS ?? settings.searchTtl ?? 30 * 86400000),
    docsTtl: Number(process.env.CTX7_CACHE_TTL_DOCS_MS ?? settings.docsTtl ?? 7 * 86400000),
    enabled: process.env.CTX7_CACHE_DISABLED !== undefined ? process.env.CTX7_CACHE_DISABLED !== "1" : settings.enabled ?? true,
  };
}
