import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const cli = fileURLToPath(new URL("../bin/context7-cache.mjs", import.meta.url));
const exec = promisify(execFile);

async function fixture(t) {
  const dir = await mkdtemp(join(process.env.OPENCODE_TEST_TMP || tmpdir(), "context7-cli-"));
  const socket = createServer();
  await new Promise((resolve) => socket.listen(0, "127.0.0.1", resolve));
  const port = socket.address().port;
  await new Promise((resolve) => socket.close(resolve));
  const env = { ...process.env, CTX7_CONFIG_DIR: dir, CTX7_CACHE_DIR: join(dir, "cache"), CTX7_PORT: String(port), CONTEXT7_API_KEY: "test-key" };
  for (let i = 1; i <= 50; i++) delete env[`CONTEXT7_API_KEY${i}`];
  const run = (...args) => exec(process.execPath, [cli, ...args], { env, timeout: 15000 });
  t.after(async () => {
    await run("stop").catch(() => {});
    await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });
  return { run, env, dir, port };
}

test("portable CLI saves settings and shares one background server", async (t) => {
  const f = await fixture(t);
  await f.run("setup");
  const settings = JSON.parse(await readFile(join(f.dir, "settings.json"), "utf8"));
  assert.deepEqual(settings.apiKeys, ["test-key"]);
  assert.ok(settings.token.length >= 32);
  delete f.env.CONTEXT7_API_KEY;
  const first = JSON.parse((await f.run("start")).stdout);
  const second = JSON.parse((await f.run("start")).stdout);
  assert.equal(second.pid, first.pid);
  assert.equal(second.url, `http://127.0.0.1:${f.port}/mcp`);
  assert.equal(JSON.parse((await f.run("status")).stdout).running, true);
  const refused = await fetch(`http://127.0.0.1:${f.port}/shutdown`, { method: "POST" });
  assert.equal(refused.status, 403);
  await f.run("stop");
  assert.equal(JSON.parse((await f.run("status")).stdout).running, false);
});

test("stdio bridge starts the shared service and leaves it running after EOF", async (t) => {
  const f = await fixture(t);
  await f.run("setup");
  const bridge = spawn(process.execPath, [cli, "stdio"], { env: f.env, stdio: ["pipe", "pipe", "pipe"] });
  t.after(() => bridge.kill());
  let stdout = "";
  bridge.stdout.on("data", (chunk) => { stdout += chunk; });
  const exited = new Promise((resolve, reject) => { bridge.on("error", reject); bridge.on("exit", resolve); });
  bridge.stdin.end([
    { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "bridge-client", version: "1" } } },
    { jsonrpc: "2.0", method: "notifications/initialized" },
    { jsonrpc: "2.0", id: 2, method: "tools/list" },
  ].map((message) => JSON.stringify(message)).join("\n") + "\n");
  assert.equal(await exited, 0);
  const replies = stdout.trim().split("\n").map((line) => JSON.parse(line));
  assert.deepEqual(replies.map((reply) => reply.id), [1, 2]);
  assert.equal(replies[1].result.tools.length, 4);
  assert.equal(JSON.parse((await f.run("status")).stdout).running, true);
});

test("Windows settings grant access only to the current user", { skip: process.platform !== "win32" }, async (t) => {
  const f = await fixture(t);
  await f.run("setup");
  const script = '$acl = Get-Acl -LiteralPath $env:CTX7_TEST_SETTINGS_FILE; $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value; $rules = @($acl.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier]) | Where-Object { $_.AccessControlType -eq "Allow" } | ForEach-Object { $_.IdentityReference.Value }); @{ user = $sid; allowed = $rules } | ConvertTo-Json -Compress';
  const result = await exec("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], { env: { ...f.env, CTX7_TEST_SETTINGS_FILE: join(f.dir, "settings.json") }, timeout: 15000 });
  const acl = JSON.parse(result.stdout);
  assert.deepEqual(acl.allowed, [acl.user]);
});
