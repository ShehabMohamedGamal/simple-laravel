import type { Plugin } from "@opencode-ai/plugin";

declare function require(name: string): {
  mkdirSync(path: string, options: { recursive: boolean }): void;
  appendFileSync(path: string, data: string): void;
  writeFileSync(path: string, data: string): void;
};
declare const process: { cwd(): string };

const { mkdirSync, appendFileSync, writeFileSync } = require("node:fs");

interface SessionInfo {
  id?: string;
  parentID?: string;
  agent?: string;
}

function now(): string {
  return new Date().toISOString();
}

function gist(value: unknown, max: number): string {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? text.slice(0, max) + "…" : text;
}

export const SessionLog: Plugin = async (ctx) => {
  const dirs = new Map<string, string>();
  const rootCache = new Map<string, { dir: string; afk: boolean; agent: string }>();

  async function inspect(sessionID: string): Promise<{ dir: string; afk: boolean; agent: string }> {
    const cached = rootCache.get(sessionID);
    if (cached) return cached;
    let root = sessionID;
    let afk = false;
    let agent = "";
    try {
      const client = (ctx as unknown as { client?: { session: { get(args: { path: { id: string } } }): Promise<SessionInfo> } } }).client;
      if (client) {
        let id = sessionID;
        for (let hop = 0; hop < 8; hop++) {
          const info = await client.session.get({ path: { id } });
          const parent = info?.parentID;
          if (!parent) break;
          afk = true;
          root = parent;
          id = parent;
        }
        const top = await client.session.get({ path: { id: root } });
        agent = top?.agent ?? "";
      }
    } catch {}
    const dir = process.cwd() + "/.opencode/logs/" + root;
    const entry = { dir, afk, agent };
    rootCache.set(sessionID, entry);
    if (!afk) {
      try {
        mkdirSync(process.cwd() + "/.opencode/logs", { recursive: true });
        writeFileSync(process.cwd() + "/.opencode/logs/current", dir);
      } catch {}
    }
    return entry;
  }

  async function append(sessionID: string, line: string): Promise<void> {
    try {
      const { dir } = await inspect(sessionID);
      mkdirSync(dir, { recursive: true });
      appendFileSync(dir + "/session.md", "- " + now() + " " + line + "\n");
    } catch {}
  }

  return {
    "tool.execute.after": async (input, output) => {
      try {
        const tool = (input as { tool?: string }).tool ?? "unknown";
        const sessionID = (input as { sessionID?: string }).sessionID ?? "";
        if (!sessionID) return;
        const { afk, agent } = await inspect(sessionID);
        const args = (output as { args?: Record<string, unknown> }).args ?? {};
        const detail = gist(args.command ?? args.filePath ?? args.path ?? args.pattern ?? args.query ?? "", 120);
        const tags = "[" + (afk ? "AFK" : "HITL") + "]" + (agent ? " [" + agent + "]" : "");
        await append(sessionID, tags + " tool=" + tool + (detail ? ": " + detail : ""));
      } catch {}
    },
    "message.updated": async (input) => {
      try {
        const message = (input as { message?: { info?: { role?: string; sessionID?: string }; text?: string } }).message;
        const info = message?.info;
        if (!info?.sessionID || info.role !== "user") return;
        await append(info.sessionID, "[HITL] user message (" + gist(message?.text ?? "", 120).length + " chars)");
      } catch {}
    },
    "todo.updated": async (input) => {
      try {
        const todos = (input as { todos?: Array<{ content?: string; status?: string }> }).todos;
        if (!todos || todos.length === 0) return;
        const sessionID = (input as { sessionID?: string }).sessionID ?? "";
        if (!sessionID) return;
        await append(sessionID, "[todos] " + todos.length + " items, first: " + gist(todos[0]?.content, 80) + " (" + (todos[0]?.status ?? "?") + ")");
      } catch {}
    },
  };
};
