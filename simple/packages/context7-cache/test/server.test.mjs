import assert from "node:assert/strict";
import { createServer, request } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";
import { createMcpServer } from "../src/server.mjs";

async function listen(server) {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${server.address().port}`;
}

async function fixture(t, options = {}) {
  const cacheDir = await mkdtemp(join(process.env.OPENCODE_TEST_TMP || tmpdir(), "context7-test-"));
  let calls = 0;
  const upstream = createServer((req, res) => {
    calls++;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ results: [{ id: "/example/library", title: "Example" }] }));
  });
  const apiUrl = await listen(upstream);
  const config = { cacheDir, apiUrl, apiKeys: ["test-key"], ...options };
  let server = createMcpServer(config);
  let url = `${await listen(server)}/mcp`;
  t.after(async () => {
    await Promise.all([server.closeAsync(), new Promise((resolve) => upstream.close(resolve))]);
    await rm(cacheDir, { recursive: true, force: true });
  });
  return {
    upstream,
    url: () => url,
    calls: () => calls,
    async restart(overrides = {}) {
      await server.closeAsync();
      Object.assign(config, overrides);
      server = createMcpServer(config);
      url = `${await listen(server)}/mcp`;
    },
    async rpc(method, params = {}, headers = {}) {
      return new Promise((resolve, reject) => {
        const req = request(url, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", ...headers } }, (res) => {
          let body = "";
          res.on("data", (chunk) => { body += chunk; });
          res.on("end", () => { resolve({ status: res.statusCode, body: JSON.parse(body) }); });
        });
        req.on("error", reject);
        req.end(JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }));
      });
    },
  };
}

const resolveArgs = { libraryName: "Example", query: "Setup" };
const call = (f, name, args = {}) => f.rpc("tools/call", { name, arguments: args });
const data = (result) => JSON.parse(result.body.result.content[0].text);

test("independent MCP clients share normalized cache entries across restarts", async (t) => {
  const f = await fixture(t);
  const init = await f.rpc("initialize", { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "test", version: "1" } });
  assert.equal(init.body.result.protocolVersion, "2025-11-25");
  const catalog = await f.rpc("tools/list");
  assert.deepEqual(catalog.body.result.tools.map((tool) => tool.name), ["resolve-library-id", "query-docs", "cache-stats", "cache-clear"]);
  const first = await call(f, "resolve-library-id", resolveArgs);
  assert.equal(data(first)[0].id, "/example/library");
  await f.restart();
  const second = await call(f, "resolve-library-id", { libraryName: " example ", query: " setup " });
  assert.deepEqual(data(second), data(first));
  assert.equal(f.calls(), 1);
  assert.equal(data(await call(f, "cache-stats")).hits, 1);
});

test("simultaneous clients make one upstream request for the same query", async (t) => {
  const f = await fixture(t);
  const results = await Promise.all(Array.from({ length: 12 }, () => call(f, "resolve-library-id", resolveArgs)));
  assert.ok(results.every((result) => data(result)[0].id === "/example/library"));
  assert.equal(f.calls(), 1);
  assert.equal(data(await call(f, "cache-stats")).savedCalls, 11);
});

test("service rejects browser origins, rebound hosts and unsupported protocol versions", async (t) => {
  const f = await fixture(t);
  assert.equal((await f.rpc("tools/list", {}, { Origin: "https://untrusted.example" })).status, 403);
  assert.equal((await f.rpc("tools/list", {}, { Host: "untrusted.example" })).status, 403);
  assert.equal((await f.rpc("tools/list", {}, { "MCP-Protocol-Version": "2099-01-01" })).status, 400);
  assert.equal((await fetch(f.url())).status, 405);
  const notification = await fetch(f.url(), { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) });
  assert.equal(notification.status, 202);
  assert.equal(await notification.text(), "");
  const invalid = await call(f, "resolve-library-id", { libraryName: "Example" });
  assert.equal(invalid.body.error.code, -32602);
  assert.equal(f.calls(), 0);
});

test("expired entries refetch and selective clear matches library metadata", async (t) => {
  const f = await fixture(t, { searchTtl: 0 });
  await call(f, "resolve-library-id", resolveArgs);
  await call(f, "resolve-library-id", resolveArgs);
  assert.equal(f.calls(), 2);
  await call(f, "resolve-library-id", { libraryName: "Other", query: "Setup" });
  assert.deepEqual(data(await call(f, "cache-clear", { pattern: "example" })), { removed: 1 });
  assert.deepEqual(data(await call(f, "cache-clear")), { removed: 1 });
});

test("docs normalize version IDs and remain available without API keys on restart", async (t) => {
  const f = await fixture(t);
  let calls = 0;
  f.upstream.removeAllListeners("request");
  f.upstream.on("request", (req, res) => {
    calls++;
    assert.ok(req.url.startsWith("/v2/context?"));
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ infoSnippets: [{ breadcrumb: "Setup", content: "Install the package.", pageId: "https://example.com/setup" }] }));
  });
  const first = await call(f, "query-docs", { libraryId: "/example/library@v1", query: "Setup" });
  assert.deepEqual(data(first), [{ title: "Setup", content: "Install the package.", source: "https://example.com/setup" }]);
  await f.restart({ apiKeys: [] });
  const second = await call(f, "query-docs", { libraryId: "/example/library/v1", query: "Setup" });
  assert.deepEqual(data(second), data(first));
  assert.equal(calls, 1);
});

test("quota rotates keys and upstream errors never enter the cache", async (t) => {
  const f = await fixture(t, { apiKeys: ["expired-key", "working-key"] });
  const keys = [];
  let fail = true;
  f.upstream.removeAllListeners("request");
  f.upstream.on("request", (req, res) => {
    keys.push(req.headers.authorization);
    res.setHeader("Content-Type", "application/json");
    if (req.headers.authorization === "Bearer expired-key") res.writeHead(429).end("{}");
    else if (fail) res.writeHead(401).end("{}");
    else res.end(JSON.stringify({ results: [{ id: "/example/library", title: "Example" }] }));
  });
  const failed = await call(f, "resolve-library-id", resolveArgs);
  assert.equal(failed.body.result.isError, true);
  assert.equal(data(await call(f, "cache-stats")).writes, 0);
  fail = false;
  assert.equal(data(await call(f, "resolve-library-id", resolveArgs))[0].id, "/example/library");
  assert.deepEqual(keys, ["Bearer expired-key", "Bearer working-key", "Bearer expired-key", "Bearer working-key"]);
});

test("transient upstream failures retry before caching a successful result", async (t) => {
  const f = await fixture(t);
  let calls = 0;
  f.upstream.removeAllListeners("request");
  f.upstream.on("request", (req, res) => {
    res.setHeader("Content-Type", "application/json");
    if (++calls < 3) res.writeHead(503).end("{}");
    else res.end(JSON.stringify({ results: [{ id: "/example/library", title: "Example" }] }));
  });
  assert.equal(data(await call(f, "resolve-library-id", resolveArgs))[0].id, "/example/library");
  assert.equal(calls, 3);
  await call(f, "resolve-library-id", resolveArgs);
  assert.equal(calls, 3);
});

test("server negotiates only supported single-message protocol revisions", async (t) => {
  const f = await fixture(t);
  const old = await f.rpc("initialize", { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "old-client", version: "1" } });
  assert.equal(old.body.result.protocolVersion, "2025-11-25");
  assert.equal((await f.rpc("ping", {}, { "MCP-Protocol-Version": "2025-03-26" })).status, 400);
  for (const version of ["2025-06-18", "2025-11-25"]) {
    const init = await f.rpc("initialize", { protocolVersion: version, capabilities: {}, clientInfo: { name: "client", version: "1" } });
    assert.equal(init.body.result.protocolVersion, version);
    assert.deepEqual((await f.rpc("ping", {}, { "MCP-Protocol-Version": version })).body.result, {});
  }
});
