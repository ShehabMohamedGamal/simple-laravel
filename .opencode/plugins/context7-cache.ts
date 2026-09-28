// context7-cache (v2 rewrite). Persistent TTL cache in front of the Context7
// HTTP API. Registers context7_resolve / context7_docs / context7_stats /
// context7_clear. Repeat resolves and docs calls are served from disk, so
// they cost no API quota.
//
// Ported from AE packages/context7-cache (v1) plus the Context7 SDK wire
// format. Errors are never cached. Quota (429) errors rotate to the next
// configured key: CONTEXT7_API_KEY, then CONTEXT7_API_KEY1..50.

import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

const DAY_MS = 24 * 60 * 60 * 1000;
const BASE_URL = "https://context7.com/api";
const STATS_FILE = "stats.json";

// ---------------------------------------------------------------------------
// Types

interface CacheEntry<T = unknown> {
  key: string;
  data: T;
  fetchedAt: number;
  ttlMs: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  writes: number;
  savedCalls: number;
}

interface ToolEditor {
  namespace(options: { name: string; description: string }): void;
  add(tool: {
    name: string;
    description: string;
    input: Record<string, unknown>;
    options?: { namespace?: string; codemode?: boolean };
    execute(args: Record<string, unknown>): Promise<{ content: string }>;
  }): void;
}

interface PluginContextV2 {
  tool: {
    transform(callback: (editor: ToolEditor) => void): Promise<unknown>;
  };
}

// ---------------------------------------------------------------------------
// Key normalization (port of AE normalize.ts)

function normalizeText(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeLibraryId(id: string): string {
  let out = id.trim();
  const atIdx = out.lastIndexOf("@");
  const slashIdx = out.lastIndexOf("/");
  if (atIdx > 0 && atIdx > slashIdx) {
    out = `${out.slice(0, atIdx)}/${out.slice(atIdx + 1)}`;
  }
  out = out.replace(/\/+/g, "/");
  return out.toLowerCase();
}

// ---------------------------------------------------------------------------
// Cache location (port of AE cacheDir.ts, plus the documented fallback chain)

function firstWritableDir(candidates: string[]): string {
  for (const dir of candidates) {
    try {
      mkdirSync(dir, { recursive: true });
      const probe = join(dir, ".probe");
      writeFileSync(probe, "");
      unlinkSync(probe);
      return dir;
    } catch {}
  }
  return join(tmpdir(), "context7-cache");
}

function defaultCacheDir(): string {
  if (process.env.CTX7_CACHE_DIR) return process.env.CTX7_CACHE_DIR;
  const xdg = process.env.XDG_CACHE_HOME;
  return firstWritableDir([
    xdg ? join(xdg, "context7-cache") : "",
    join(homedir(), ".cache", "context7-cache"),
    join(process.cwd(), ".opencode", "context7-cache"),
    join(process.cwd(), ".context7-cache"),
  ].filter(Boolean));
}

// ---------------------------------------------------------------------------
// File cache store (port of AE cacheStore.ts)

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

class FileCacheStore {
  readonly dir: string;

  constructor(dir?: string) {
    this.dir = dir ?? defaultCacheDir();
    mkdirSync(this.dir, { recursive: true });
  }

  private pathFor(filename: string): string {
    return join(this.dir, filename);
  }

  get<T>(filename: string, now = Date.now()): T | null {
    try {
      const raw = readFileSync(this.pathFor(filename), "utf8");
      const entry = JSON.parse(raw) as CacheEntry<T>;
      if (now - entry.fetchedAt > entry.ttlMs) {
        try {
          unlinkSync(this.pathFor(filename));
        } catch {}
        return null;
      }
      return entry.data;
    } catch {
      return null;
    }
  }

  set<T>(filename: string, data: T, ttlMs: number): void {
    const entry: CacheEntry<T> = {
      key: filename,
      data,
      fetchedAt: Date.now(),
      ttlMs,
    };
    writeFileSync(this.pathFor(filename), JSON.stringify(entry));
  }

  clear(pattern?: string): number {
    let removed = 0;
    for (const f of readdirSync(this.dir)) {
      if (f === STATS_FILE) continue;
      if (f.endsWith(".tmp")) continue;
      if (pattern && !f.includes(pattern)) continue;
      try {
        unlinkSync(this.pathFor(f));
        removed++;
      } catch {}
    }
    return removed;
  }

  record(hit: boolean): CacheStats {
    const stats = this.stats();
    if (hit) {
      stats.hits++;
      stats.savedCalls++;
    } else {
      stats.misses++;
    }
    writeFileSync(this.pathFor(STATS_FILE), JSON.stringify(stats));
    return stats;
  }

  recordWrite(): void {
    const stats = this.stats();
    stats.writes++;
    writeFileSync(this.pathFor(STATS_FILE), JSON.stringify(stats));
  }

  stats(): CacheStats {
    try {
      return JSON.parse(readFileSync(this.pathFor(STATS_FILE), "utf8")) as CacheStats;
    } catch {
      return { hits: 0, misses: 0, writes: 0, savedCalls: 0 };
    }
  }
}

// ---------------------------------------------------------------------------
// Context7 HTTP client (wire format ported from @upstash/context7-sdk)

interface HttpError extends Error {
  status?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function apiKeys(): string[] {
  const keys: string[] = [];
  const main = process.env.CONTEXT7_API_KEY;
  if (main) keys.push(main);
  for (let i = 1; i <= 50; i++) {
    const key = process.env[`CONTEXT7_API_KEY${i}`];
    if (key) keys.push(key);
  }
  return keys;
}

async function fetchJson(path: string, params: Record<string, string>, key: string): Promise<unknown> {
  const url = `${BASE_URL}/${path}?${new URLSearchParams(params).toString()}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${key}`, accept: "application/json" },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const error = new Error(
      `HTTP ${res.status} for ${path}${body ? `: ${body.slice(0, 200)}` : ""}`,
    ) as HttpError;
    error.status = res.status;
    throw error;
  }
  return res.json();
}

async function requestJson(path: string, params: Record<string, string>): Promise<unknown> {
  const keys = apiKeys();
  if (keys.length === 0) {
    throw new Error(
      "CONTEXT7_API_KEY is not set. Get one at https://context7.com/dashboard and export CONTEXT7_API_KEY=ctx7sk-...",
    );
  }
  let lastError: unknown;
  for (const key of keys) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        return await fetchJson(path, params, key);
      } catch (error) {
        lastError = error;
        const status = (error as HttpError).status;
        if (status === 429) break; // quota — rotate to the next key
        const retryable = status === undefined || status >= 500;
        if (!retryable || attempt === 3) throw error;
        await sleep(50 * 2 ** (attempt - 1));
      }
    }
  }
  throw lastError;
}

interface Library {
  id: string;
  name: string;
  description: string;
  totalSnippets: number;
  trustScore: number;
  benchmarkScore: number;
  versions?: string[];
}

interface Documentation {
  title: string;
  content: string;
  source: string;
}

interface RawLibrary {
  id: string;
  title?: string;
  description?: string;
  totalSnippets?: number;
  trustScore?: number;
  benchmarkScore?: number;
  versions?: string[];
}

interface RawCodeSnippet {
  codeTitle?: string;
  codeDescription?: string;
  codeList?: Array<{ language?: string; code?: string }>;
  codeId?: string;
}

interface RawInfoSnippet {
  breadcrumb?: string;
  content?: string;
  pageId?: string;
}

function formatLibrary(r: RawLibrary): Library {
  return {
    id: r.id,
    name: r.title ?? "",
    description: r.description ?? "",
    totalSnippets: r.totalSnippets ?? 0,
    trustScore: r.trustScore ?? 0,
    benchmarkScore: r.benchmarkScore ?? 0,
    versions: r.versions,
  };
}

function formatCodeSnippet(snippet: RawCodeSnippet): Documentation {
  const codeBlocks = (snippet.codeList ?? [])
    .map((c) => `\`\`\`${c.language ?? ""}\n${c.code ?? ""}\n\`\`\``)
    .join("\n\n");
  const content = snippet.codeDescription
    ? `${snippet.codeDescription}\n\n${codeBlocks}`
    : codeBlocks;
  return { title: snippet.codeTitle ?? "", content, source: snippet.codeId ?? "" };
}

function formatInfoSnippet(snippet: RawInfoSnippet): Documentation {
  return {
    title: snippet.breadcrumb || "Documentation",
    content: snippet.content ?? "",
    source: snippet.pageId ?? "",
  };
}

async function searchLibrary(query: string, libraryName: string): Promise<Library[]> {
  const result = (await requestJson("v2/libs/search", { query, libraryName })) as {
    results?: RawLibrary[];
  };
  return (result.results ?? []).map(formatLibrary);
}

async function getContext(query: string, libraryId: string): Promise<Documentation[]> {
  const result = (await requestJson("v2/context", { query, libraryId, type: "json" })) as {
    codeSnippets?: RawCodeSnippet[];
    infoSnippets?: RawInfoSnippet[];
  };
  const codeDocs = (result.codeSnippets ?? []).map(formatCodeSnippet);
  const infoDocs = (result.infoSnippets ?? []).map(formatInfoSnippet);
  return [...codeDocs, ...infoDocs];
}

// ---------------------------------------------------------------------------
// Cached client (port of AE cachedClient.ts)

function numEnv(name: string): number | undefined {
  const v = process.env[name];
  if (!v) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

class CachedContext7 {
  private store: FileCacheStore;
  private ttlSearchMs: number;
  private ttlDocsMs: number;
  private enabled: boolean;

  constructor() {
    this.store = new FileCacheStore();
    this.ttlSearchMs = numEnv("CTX7_CACHE_TTL_SEARCH_MS") ?? 30 * DAY_MS;
    this.ttlDocsMs = numEnv("CTX7_CACHE_TTL_DOCS_MS") ?? 7 * DAY_MS;
    this.enabled = process.env.CTX7_CACHE_DISABLED !== "1";
  }

  async resolve(query: string, libraryName: string): Promise<unknown> {
    const key = `search-${sha256(`${normalizeText(libraryName)}|${normalizeText(query)}|json`)}.json`;
    if (this.enabled) {
      const hit = this.store.get<unknown>(key);
      if (hit !== null) {
        this.store.record(true);
        return hit;
      }
    }
    const data = await searchLibrary(query, libraryName);
    if (this.enabled) {
      this.store.set(key, data, this.ttlSearchMs);
      this.store.record(false);
      this.store.recordWrite();
    }
    return data;
  }

  async docs(query: string, libraryId: string): Promise<unknown> {
    const key = `context-${sha256(`${normalizeLibraryId(libraryId)}|${normalizeText(query)}|json`)}.json`;
    if (this.enabled) {
      const hit = this.store.get<unknown>(key);
      if (hit !== null) {
        this.store.record(true);
        return hit;
      }
    }
    const data = await getContext(query, libraryId);
    if (this.enabled) {
      this.store.set(key, data, this.ttlDocsMs);
      this.store.record(false);
      this.store.recordWrite();
    }
    return data;
  }

  stats(): CacheStats {
    return this.store.stats();
  }

  clear(pattern?: string): number {
    return this.store.clear(pattern);
  }
}

// ---------------------------------------------------------------------------
// Plugin

function fmt(data: unknown): string {
  return typeof data === "string" ? data : JSON.stringify(data, null, 2);
}

async function withKeyError(fn: () => Promise<unknown>): Promise<string> {
  if (!process.env.CONTEXT7_API_KEY) {
    return "CONTEXT7_API_KEY is not set. Get one at https://context7.com/dashboard and export CONTEXT7_API_KEY=ctx7sk-...";
  }
  try {
    return fmt(await fn());
  } catch (err) {
    return `Context7 request failed: ${err instanceof Error ? err.message : String(err)}`;
  }
}

const client = new CachedContext7();

export default {
  id: "context7-cache",
  setup: async (ctx: PluginContextV2) => {
    await ctx.tool.transform((editor) => {
      editor.namespace({
        name: "context7",
        description: "Context7 library docs with a persistent local cache",
      });
      editor.add({
        name: "resolve",
        description:
          "Resolve a library name to a Context7 library ID (cached, 30d TTL). Prefer this over repeated resolve-library-id calls.",
        input: {
          type: "object",
          properties: {
            libraryName: { type: "string", description: "Library name, e.g. react, Next.js" },
            query: { type: "string", description: "What you want docs for (ranks results)" },
          },
          required: ["libraryName", "query"],
          additionalProperties: false,
        },
        options: { namespace: "context7", codemode: true },
        execute: async (args) => ({
          content: await withKeyError(() =>
            client.resolve(String(args.query ?? ""), String(args.libraryName ?? "")),
          ),
        }),
      });
      editor.add({
        name: "docs",
        description: "Get Context7 docs for a library ID (cached, 7d TTL). One topic per call.",
        input: {
          type: "object",
          properties: {
            libraryId: { type: "string", description: "Context7 ID, e.g. /facebook/react" },
            query: { type: "string", description: "Single-topic question" },
          },
          required: ["libraryId", "query"],
          additionalProperties: false,
        },
        options: { namespace: "context7", codemode: true },
        execute: async (args) => ({
          content: await withKeyError(() =>
            client.docs(String(args.query ?? ""), String(args.libraryId ?? "")),
          ),
        }),
      });
      editor.add({
        name: "stats",
        description: "Show context7-cache hits/misses/saved API calls.",
        input: { type: "object", properties: {}, additionalProperties: false },
        options: { namespace: "context7", codemode: true },
        execute: async () => ({ content: fmt(client.stats()) }),
      });
      editor.add({
        name: "clear",
        description: "Clear cached Context7 entries. Omit pattern to clear all.",
        input: {
          type: "object",
          properties: {
            pattern: { type: "string", description: "Substring filter, e.g. next.js" },
          },
          additionalProperties: false,
        },
        options: { namespace: "context7", codemode: true },
        execute: async (args) => {
          const pattern = args.pattern ? String(args.pattern) : undefined;
          const removed = client.clear(pattern);
          return {
            content: `Removed ${removed} cached entr${removed === 1 ? "y" : "ies"}.`,
          };
        },
      });
    });
  },
};
