#!/usr/bin/env node
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { appendFileSync, closeSync, mkdirSync, openSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { createMcpServer } from "../src/server.mjs";
import { platformPaths, readSettings, runtimeSettings, saveSettings } from "../src/settings.mjs";

const executable = fileURLToPath(import.meta.url);
const logFile = () => join(platformPaths().config, "server.log");
const endpoint = (settings) => `http://127.0.0.1:${settings.port}`;
const output = (data) => console.log(JSON.stringify(data));

async function hiddenKey() {
  if (!process.stdin.isTTY) throw new Error("Export CONTEXT7_API_KEY before setup, or run setup in a terminal");
  process.stderr.write("Context7 API key: ");
  process.stdin.setRawMode(true);
  process.stdin.resume();
  return new Promise((resolve, reject) => {
    let key = "";
    const finish = (error) => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.off("data", input);
      process.stderr.write("\n");
      error ? reject(error) : resolve(key.trim());
    };
    const input = (chunk) => {
      for (const char of chunk.toString()) {
        if (char === "\r" || char === "\n") return finish();
        if (char === "\u0003") return finish(new Error("Setup cancelled"));
        if (char === "\u007f" || char === "\b") key = key.slice(0, -1);
        else if (char >= " ") key += char;
      }
    };
    process.stdin.on("data", input);
  });
}

async function setup(args) {
  const existing = readSettings(false);
  const imported = {};
  if (args.length) {
    if (args.length !== 2 || args[0] !== "--import-env") throw new Error("Usage: context7-cache setup [--import-env PATH]");
    for (const line of readFileSync(args[1], "utf8").split("\n")) {
      const match = line.match(/^((?:CONTEXT7_API_KEY\d*|CTX7_[A-Z_]+))=(.*)$/);
      if (match) imported[match[1]] = match[2].startsWith('"') ? JSON.parse(match[2]) : match[2];
    }
  }
  const env = { ...imported, ...process.env };
  let apiKeys = ["CONTEXT7_API_KEY", ...Array.from({ length: 50 }, (_, i) => `CONTEXT7_API_KEY${i + 1}`)].map((name) => env[name]).filter(Boolean);
  if (!apiKeys.length) apiKeys = existing.apiKeys ?? [];
  if (!apiKeys.length) apiKeys = [await hiddenKey()];
  if (apiKeys.some((key) => typeof key !== "string" || !key.trim())) throw new Error("API keys must not be empty");
  const settings = {
    ...existing, apiKeys, token: existing.token || randomBytes(32).toString("hex"),
    port: Number(env.CTX7_PORT ?? existing.port ?? 3777),
    cacheDir: env.CTX7_CACHE_DIR || existing.cacheDir || platformPaths().cache,
    searchTtl: Number(env.CTX7_CACHE_TTL_SEARCH_MS ?? existing.searchTtl ?? 30 * 86400000),
    docsTtl: Number(env.CTX7_CACHE_TTL_DOCS_MS ?? existing.docsTtl ?? 7 * 86400000),
    enabled: env.CTX7_CACHE_DISABLED !== undefined ? env.CTX7_CACHE_DISABLED !== "1" : existing.enabled ?? true,
  };
  if (!Number.isInteger(settings.port) || settings.port < 1 || settings.port > 65535) throw new Error("Invalid port");
  if (![settings.searchTtl, settings.docsTtl].every((ttl) => Number.isFinite(ttl) && ttl >= 0)) throw new Error("Invalid cache TTL");
  saveSettings(settings);
  output({ configured: true, configDir: platformPaths().config, cacheDir: settings.cacheDir, url: `${endpoint(settings)}/mcp` });
}

async function health(settings) {
  let response;
  try {
    response = await fetch(`${endpoint(settings)}/health`, { headers: { Authorization: `Bearer ${settings.token}` }, signal: AbortSignal.timeout(1000) });
  } catch { return null; }
  if (!response.ok) throw new Error("Port is occupied by another service or a different Context7 configuration");
  const info = await response.json();
  if (info.name !== "context7-cache") throw new Error("Port is occupied by another service");
  return info;
}

async function start(settings) {
  const running = await health(settings);
  if (running) return running;
  mkdirSync(platformPaths().config, { recursive: true, mode: 0o700 });
  const fd = openSync(logFile(), "a", 0o600);
  let child;
  try {
    child = spawn(process.execPath, [executable, "serve"], { detached: true, stdio: ["ignore", fd, fd], windowsHide: true, env: process.env });
    child.unref();
  } finally { closeSync(fd); }
  let failure;
  child.on("error", (err) => { failure = err; });
  for (let attempt = 0; attempt < 80; attempt++) {
    if (failure) throw failure;
    await delay(100);
    const info = await health(settings);
    if (info) return info;
  }
  throw new Error(`Server did not start; inspect ${logFile()}`);
}

async function serve(settings) {
  if (process.env.CTX7_LOG_FILE) console.error = (...args) => appendFileSync(process.env.CTX7_LOG_FILE, `${args.join(" ")}\n`, { mode: 0o600 });
  const server = createMcpServer({ ...settings, control: { token: settings.token } });
  server.on("error", (err) => { console.error(err.message); process.exitCode = 1; });
  server.listen(settings.port, "127.0.0.1", () => console.error(`Context7 cache listening at ${endpoint(settings)}/mcp`));
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.close());
}

async function stop(settings) {
  if (!await health(settings)) return output({ stopped: true });
  const response = await fetch(`${endpoint(settings)}/shutdown`, { method: "POST", headers: { Authorization: `Bearer ${settings.token}` }, signal: AbortSignal.timeout(2000) });
  if (!response.ok) throw new Error("Server refused shutdown");
  for (let attempt = 0; attempt < 50; attempt++) {
    if (!await health(settings)) return output({ stopped: true });
    await delay(100);
  }
  throw new Error("Shutdown still pending; retry status after active requests complete");
}

async function stdio(settings) {
  await start(settings);
  const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
  let version = "2025-11-25";
  for await (const line of lines) {
    if (!line.trim()) continue;
    let message;
    try {
      if (Buffer.byteLength(line) > 65536) throw new Error("Message exceeds 64 KiB");
      message = JSON.parse(line);
      const response = await fetch(`${endpoint(settings)}/mcp`, {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", "MCP-Protocol-Version": version }, body: line,
      });
      if (response.status === 202) continue;
      const body = await response.json();
      if (message.method === "initialize" && body.result?.protocolVersion) version = body.result.protocolVersion;
      output(body);
    } catch (err) {
      if (message && !Object.hasOwn(message, "id")) continue;
      output({ jsonrpc: "2.0", id: message?.id ?? null, error: { code: -32603, message: err.message } });
    }
  }
}

try {
  const argumentsList = process.argv.slice(2);
  for (const [flag, name] of [["--config-dir", "CTX7_CONFIG_DIR"], ["--log-file", "CTX7_LOG_FILE"]]) {
    const index = argumentsList.indexOf(flag);
    if (index >= 0) {
      if (!argumentsList[index + 1]) throw new Error(`${flag} requires a path`);
      process.env[name] = argumentsList[index + 1];
      argumentsList.splice(index, 2);
    }
  }
  const [command = "help", ...args] = argumentsList;
  if (command === "help" || command === "--help") console.log("context7-cache setup [--import-env PATH]\ncontext7-cache start | stop | status | logs | serve | stdio\ncontext7-cache autostart enable | disable");
  else if (command === "setup") await setup(args);
  else {
    if (args.length && command !== "autostart") throw new Error("Unexpected arguments");
    const settings = runtimeSettings();
    if (command === "start") output({ running: true, ...await start(settings), url: `${endpoint(settings)}/mcp` });
    else if (command === "status") {
      const info = await health(settings);
      output({ running: Boolean(info), ...info, url: `${endpoint(settings)}/mcp` });
    } else if (command === "stop") await stop(settings);
    else if (command === "serve") await serve(settings);
    else if (command === "stdio") await stdio(settings);
    else if (command === "logs") console.log(readFileSync(logFile(), "utf8"));
    else if (command === "autostart") {
      const { autostart } = await import("../src/autostart.mjs");
      await autostart(args, executable);
    } else throw new Error(`Unknown command: ${command}`);
  }
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
}
