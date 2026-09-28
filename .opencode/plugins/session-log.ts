// Session log (v2). Appends one line per tool call, user message, and todo
// update to .opencode/logs/<root-session>/session.md, and maintains a
// `current` pointer file. AFK marks sessions that have a parentID chain
// (subagent runs); HITL marks top-level interactive sessions.

import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

function now(): string {
  return new Date().toISOString();
}

function gist(value: unknown, max: number): string {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? text.slice(0, max) + "…" : text;
}

interface SessionInfo {
  id?: string;
  parentID?: string;
  agent?: string;
}

interface PluginContextV2 {
  session: {
    get(input: { sessionID: string }): Promise<SessionInfo>;
  };
  tool: {
    hook(
      name: "execute.before" | "execute.after",
      callback: (event: never) => Promise<void> | void,
    ): Promise<unknown>;
  };
  event: {
    subscribe(options?: {
      signal?: AbortSignal;
    }): AsyncIterable<{ type: string; properties?: Record<string, unknown> }>;
  };
}

interface ToolExecuteAfterEvent {
  tool?: string;
  sessionID?: string;
  input?: Record<string, unknown>;
}

export default {
  id: "session-log",
  setup: async (ctx: PluginContextV2) => {
    const rootCache = new Map<string, { dir: string; afk: boolean; agent: string }>();
    const logsRoot = join(process.cwd(), ".opencode", "logs");

    async function inspect(
      sessionID: string,
    ): Promise<{ dir: string; afk: boolean; agent: string }> {
      const cached = rootCache.get(sessionID);
      if (cached) return cached;
      let root = sessionID;
      let afk = false;
      let agent = "";
      try {
        let id = sessionID;
        for (let hop = 0; hop < 8; hop++) {
          const info = await ctx.session.get({ sessionID: id });
          const parent = info?.parentID;
          if (!parent) break;
          afk = true;
          root = parent;
          id = parent;
        }
        const top = await ctx.session.get({ sessionID: root });
        agent = top?.agent ?? "";
      } catch {}
      const dir = join(logsRoot, root);
      const entry = { dir, afk, agent };
      rootCache.set(sessionID, entry);
      if (!afk) {
        try {
          mkdirSync(logsRoot, { recursive: true });
          writeFileSync(join(logsRoot, "current"), dir);
        } catch {}
      }
      return entry;
    }

    async function append(sessionID: string, line: string): Promise<void> {
      try {
        const { dir } = await inspect(sessionID);
        mkdirSync(dir, { recursive: true });
        appendFileSync(join(dir, "session.md"), "- " + now() + " " + line + "\n");
      } catch {}
    }

    await ctx.tool.hook("execute.after", (raw: unknown) => {
      const event = raw as ToolExecuteAfterEvent;
      try {
        const sessionID = String(event?.sessionID ?? "");
        if (!sessionID) return;
        const tool = String(event?.tool ?? "unknown");
        const args = (event?.input ?? {}) as Record<string, unknown>;
        const detail = gist(
          args.command ?? args.filePath ?? args.path ?? args.pattern ?? args.query ?? "",
          120,
        );
        return inspect(sessionID).then(({ afk, agent }) =>
          append(
            sessionID,
            "[" + (afk ? "AFK" : "HITL") + "]" + (agent ? " [" + agent + "]" : "") +
              " tool=" + tool + (detail ? ": " + detail : ""),
          ),
        );
      } catch {}
    });

    const controller = new AbortController();
    void (async () => {
      for await (const event of ctx.event.subscribe({ signal: controller.signal })) {
        try {
          const props = (event?.properties ?? {}) as Record<string, unknown>;
          if (event?.type === "message.updated") {
            const message = props.message as
              | { info?: { role?: string; sessionID?: string }; text?: string }
              | undefined;
            const info = message?.info ?? (props.info as SessionInfo | undefined);
            const sessionID = info?.sessionID ?? String(props.sessionID ?? "");
            if (!sessionID || (info?.role ?? message?.info?.role) !== "user") continue;
            const text = message?.text ?? (props.text as string | undefined) ?? "";
            await append(sessionID, "[HITL] user message (" + gist(text, 120).length + " chars)");
          } else if (event?.type === "todo.updated") {
            const todos = props.todos as Array<{ content?: string; status?: string }> | undefined;
            const sessionID = String(props.sessionID ?? "");
            if (!todos || todos.length === 0 || !sessionID) continue;
            await append(
              sessionID,
              "[todos] " + todos.length + " items, first: " +
                gist(todos[0]?.content, 80) + " (" + (todos[0]?.status ?? "?") + ")",
            );
          }
        } catch {}
      }
    })();

    return () => controller.abort();
  },
};
