#!/usr/bin/env sh
set -eu

root=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
node --input-type=module - "$root/context7-cache.mjs" <<'NODE'
import { copyFileSync, chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const home = homedir();
const config = process.env.XDG_CONFIG_HOME || join(home, ".config");
const bin = join(home, ".local", "bin");
const units = join(config, "systemd", "user");
mkdirSync(bin, { recursive: true });
mkdirSync(units, { recursive: true });
copyFileSync(process.argv[2], join(bin, "context7-cache.mjs"));
const envFile = join(config, "context7-cache.env");
let lines = existsSync(envFile) ? readFileSync(envFile, "utf8").split("\n").filter(Boolean) : [];
const names = ["CONTEXT7_API_KEY", ...Array.from({ length: 50 }, (_, i) => `CONTEXT7_API_KEY${i + 1}`), "CTX7_CACHE_DIR", "CTX7_CACHE_TTL_SEARCH_MS", "CTX7_CACHE_TTL_DOCS_MS", "CTX7_CACHE_DISABLED", "CTX7_PORT"];
for (const name of names) {
  if (process.env[name] === undefined) continue;
  lines = lines.filter((line) => !line.startsWith(`${name}=`));
  lines.push(`${name}=${JSON.stringify(process.env[name])}`);
}
if (!lines.some((line) => /^CONTEXT7_API_KEY\d*=/.test(line))) throw new Error("Export CONTEXT7_API_KEY before installing the service");
const cacheDir = process.env.CTX7_CACHE_DIR || join(process.env.XDG_CACHE_HOME || join(home, ".cache"), "context7-cache");
mkdirSync(cacheDir, { recursive: true, mode: 0o700 });
if (!lines.some((line) => line.startsWith("CTX7_CACHE_DIR="))) lines.push(`CTX7_CACHE_DIR=${JSON.stringify(cacheDir)}`);
if (existsSync(envFile)) chmodSync(envFile, 0o600);
writeFileSync(envFile, `${lines.join("\n")}\n`, { mode: 0o600 });
writeFileSync(join(units, "context7-cache.service"), `[Unit]
Description=Shared Context7 cache MCP service
After=network.target

[Service]
ExecStart=${JSON.stringify(process.execPath)} ${JSON.stringify(join(bin, "context7-cache.mjs"))}
EnvironmentFile=${envFile.replaceAll("%", "%%").replaceAll(" ", "\\x20")}
Restart=on-failure
RestartSec=3
NoNewPrivileges=true
UMask=0077

[Install]
WantedBy=default.target
`);
NODE

systemctl --user daemon-reload
systemctl --user enable --now context7-cache.service
systemctl --user restart context7-cache.service
systemctl --user is-active context7-cache.service
