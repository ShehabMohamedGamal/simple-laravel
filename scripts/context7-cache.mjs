import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const DAY = 86_400_000;
const VERSIONS = ["2025-06-18", "2025-11-25"];
const normalize = (text) => text.trim().toLowerCase().replace(/\s+/g, " ");
const libraryId = (id) => id.trim().replace(/@([^/]+)$/, "/$1").replace(/\/+/g, "/").toLowerCase();
const hash = (text) => createHash("sha256").update(text).digest("hex");
const textResult = (data) => ({ content: [{ type: "text", text: JSON.stringify(data, null, 2) }] });

function readJson(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(path, data) {
  const temp = `${path}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temp, JSON.stringify(data), { mode: 0o600 });
    renameSync(temp, path);
  } finally {
    try { unlinkSync(temp); } catch {}
  }
}

function schema(properties, required = []) {
  return { type: "object", properties, required, additionalProperties: false };
}

const string = { type: "string", minLength: 1, maxLength: 10000 };
const TOOLS = [
  { name: "resolve-library-id", description: "Resolve a library name to a Context7 ID. Cached for 30 days. Resolve before querying docs.", inputSchema: schema({ libraryName: string, query: string }, ["libraryName", "query"]) },
  { name: "query-docs", description: "Get Context7 documentation for a library ID and one topic. Cached for 7 days.", inputSchema: schema({ libraryId: string, query: string }, ["libraryId", "query"]) },
  { name: "cache-stats", description: "Show shared cache hits, misses, writes and saved API calls.", inputSchema: schema({}) },
  { name: "cache-clear", description: "Clear cached entries. Optional pattern matches library IDs or entry metadata.", inputSchema: schema({ pattern: string }) },
];

class CachedContext7 {
  constructor(options) {
    this.dir = options.cacheDir ?? process.env.CTX7_CACHE_DIR ?? join(process.env.XDG_CACHE_HOME || join(homedir(), ".cache"), "context7-cache");
    mkdirSync(this.dir, { recursive: true, mode: 0o700 });
    this.apiUrl = options.apiUrl ?? "https://context7.com/api";
    this.keys = options.apiKeys ?? ["CONTEXT7_API_KEY", ...Array.from({ length: 50 }, (_, i) => `CONTEXT7_API_KEY${i + 1}`)].map((name) => process.env[name]).filter(Boolean);
    this.searchTtl = options.searchTtl ?? Number(process.env.CTX7_CACHE_TTL_SEARCH_MS ?? 30 * DAY);
    this.docsTtl = options.docsTtl ?? Number(process.env.CTX7_CACHE_TTL_DOCS_MS ?? 7 * DAY);
    this.enabled = options.enabled ?? process.env.CTX7_CACHE_DISABLED !== "1";
    this.pending = new Map();
    this.generation = 0;
    if (![this.searchTtl, this.docsTtl].every((ttl) => Number.isFinite(ttl) && ttl >= 0)) throw new Error("Cache TTLs must be finite nonnegative numbers");
    this.stats = readJson(join(this.dir, "stats.json"), { hits: 0, misses: 0, writes: 0, savedCalls: 0 });
  }

  record(field) {
    this.stats[field]++;
    if (field === "hits") this.stats.savedCalls++;
    writeJson(join(this.dir, "stats.json"), this.stats);
  }

  async request(path, params) {
    if (!this.keys.length) throw new Error("CONTEXT7_API_KEY is not set in the service environment");
    for (const key of this.keys) {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const response = await fetch(`${this.apiUrl}/${path}?${new URLSearchParams(params)}`, {
            headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
            signal: AbortSignal.timeout(15000),
          });
          if (response.status === 429) { await response.body?.cancel(); break; }
          if (!response.ok) {
            await response.body?.cancel();
            const error = new Error(`Context7 returned HTTP ${response.status}`);
            error.status = response.status;
            throw error;
          }
          return await response.json();
        } catch (err) {
          if (attempt === 2 || (err.status && err.status < 500)) throw err;
          await delay(50 * 2 ** attempt);
        }
      }
    }
    throw new Error("Context7 quota exhausted for all configured API keys");
  }

  async lookup(name, args) {
    const search = name === "resolve-library-id";
    const identity = search ? normalize(args.libraryName) : libraryId(args.libraryId);
    const filename = `${search ? "search" : "context"}-${hash(`${identity}|${normalize(args.query)}|json`)}.json`;
    const path = join(this.dir, filename);
    const entry = this.enabled ? readJson(path, null) : null;
    if (entry && Number.isFinite(entry.fetchedAt) && Number.isFinite(entry.ttlMs) && Date.now() - entry.fetchedAt < entry.ttlMs) {
      this.record("hits");
      return entry.data;
    }
    if (this.enabled && this.pending.has(filename)) {
      const data = await this.pending.get(filename);
      this.record("hits");
      return data;
    }
    const pending = this.load(search, args, identity, filename, path);
    if (this.enabled) this.pending.set(filename, pending);
    try { return await pending; }
    finally { if (this.pending.get(filename) === pending) this.pending.delete(filename); }
  }

  async load(search, args, identity, filename, path) {
    const generation = this.generation;
    const raw = await this.request(search ? "v2/libs/search" : "v2/context", search ? { libraryName: args.libraryName, query: args.query } : { libraryId: args.libraryId, query: args.query, type: "json" });
    const data = search ? (raw.results ?? []).map((r) => ({ id: r.id, name: r.title ?? "", description: r.description ?? "", totalSnippets: r.totalSnippets ?? 0, trustScore: r.trustScore ?? 0, benchmarkScore: r.benchmarkScore ?? 0, versions: r.versions })) : [
      ...(raw.codeSnippets ?? []).map((s) => ({ title: s.codeTitle ?? "", content: [s.codeDescription, ...(s.codeList ?? []).map((c) => `\`\`\`${c.language ?? ""}\n${c.code ?? ""}\n\`\`\``)].filter(Boolean).join("\n\n"), source: s.codeId ?? "" })),
      ...(raw.infoSnippets ?? []).map((s) => ({ title: s.breadcrumb || "Documentation", content: s.content ?? "", source: s.pageId ?? "" })),
    ];
    if (this.enabled && generation === this.generation) {
      writeJson(path, { key: filename, library: identity, query: normalize(args.query), data, fetchedAt: Date.now(), ttlMs: search ? this.searchTtl : this.docsTtl });
      this.record("misses");
      this.record("writes");
    }
    return data;
  }

  clear(pattern) {
    this.generation++;
    this.pending.clear();
    let removed = 0;
    for (const filename of readdirSync(this.dir)) {
      if (!/^(search|context)-[a-f0-9]{64}\.json$/.test(filename)) continue;
      const entry = readJson(join(this.dir, filename), {});
      const metadata = entry.library ? `${entry.library} ${entry.query ?? ""}` : JSON.stringify(entry);
      if (pattern && !normalize(metadata).includes(normalize(pattern))) continue;
      unlinkSync(join(this.dir, filename));
      removed++;
    }
    return { removed };
  }

  async call(name, args) {
    if (name === "cache-stats") return this.stats;
    if (name === "cache-clear") return this.clear(args.pattern);
    return this.lookup(name, args);
  }
}

function validArguments(tool, args) {
  return args && typeof args === "object" && !Array.isArray(args)
    && tool.inputSchema.required.every((key) => Object.hasOwn(args, key))
    && Object.entries(args).every(([key, value]) => Object.hasOwn(tool.inputSchema.properties, key) && typeof value === "string" && value.trim().length > 0 && value.length <= 10000);
}

export function createMcpServer(options = {}) {
  const client = new CachedContext7(options);
  const server = createServer(async (req, res) => {
    const send = (status, body) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(body === undefined ? undefined : JSON.stringify(body));
    };
    let message;
    const error = (status, code, text) => send(status, { jsonrpc: "2.0", id: message?.id ?? null, error: { code, message: text } });
    try {
      const hosts = [`127.0.0.1:${server.address().port}`, `localhost:${server.address().port}`];
      if (!hosts.includes(req.headers.host)) return error(403, -32600, "Invalid Host");
      if (req.headers.origin && !hosts.map((host) => `http://${host}`).includes(req.headers.origin)) return error(403, -32600, "Invalid Origin");
      if (req.headers["mcp-protocol-version"] && !VERSIONS.includes(req.headers["mcp-protocol-version"])) return error(400, -32600, "Unsupported protocol version");
      if (req.url !== "/mcp") return send(404);
      if (req.method !== "POST") { res.setHeader("Allow", "POST"); return send(405); }
      if (req.headers["content-type"]?.split(";")[0].trim() !== "application/json") return error(415, -32600, "Expected application/json");
      if (!["application/json", "text/event-stream"].every((type) => req.headers.accept?.includes(type))) return error(406, -32600, "Accept must include application/json and text/event-stream");
      const chunks = [];
      let bytes = 0;
      for await (const chunk of req) {
        bytes += chunk.length;
        if (bytes > 65536) return error(413, -32600, "Request body exceeds 64 KiB");
        chunks.push(chunk);
      }
      try { message = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { return error(400, -32700, "Invalid JSON"); }
      if (!message || message.jsonrpc !== "2.0" || typeof message.method !== "string") return error(400, -32600, "Invalid request");
      if (Object.hasOwn(message, "id") && typeof message.id !== "string" && !Number.isInteger(message.id)) return error(400, -32600, "Invalid request ID");
      if (!Object.hasOwn(message, "id")) return send(202);
      let result;
      if (message.method === "initialize") {
        result = { protocolVersion: VERSIONS.includes(message.params?.protocolVersion) ? message.params.protocolVersion : VERSIONS.at(-1), capabilities: { tools: {} }, serverInfo: { name: "context7-cache", version: "1.0.0" } };
      } else if (message.method === "ping") result = {};
      else if (message.method === "tools/list") result = { tools: TOOLS };
      else if (message.method === "tools/call") {
        const tool = TOOLS.find((tool) => tool.name === message.params?.name);
        if (!tool) return error(200, -32602, "Unknown tool");
        const args = message.params.arguments ?? {};
        if (!validArguments(tool, args)) return error(200, -32602, "Invalid tool arguments");
        try { result = textResult(await client.call(tool.name, args)); }
        catch (err) { result = { content: [{ type: "text", text: err.message }], isError: true }; }
      } else return error(200, -32601, "Method not found");
      send(200, { jsonrpc: "2.0", id: message.id, result });
    } catch {
      if (!res.headersSent) error(500, -32603, "Internal server error");
      else res.end();
    }
  });
  server.closeAsync = () => new Promise((done, reject) => server.close((err) => err ? reject(err) : done()));
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const port = Number(process.env.CTX7_PORT ?? 3777);
  const server = createMcpServer();
  server.listen(port, "127.0.0.1", () => console.error(`Context7 cache MCP listening at http://127.0.0.1:${port}/mcp`));
  server.on("error", (err) => { console.error(err.message); process.exitCode = 1; });
  for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => server.close());
}
