import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const commands = ["symbol", "search", "refs", "explain", "describe", "path"];

interface ToolEvent {
  tool?: string;
  status?: string;
}

interface Query {
  command: string;
  query: string;
  target?: string;
  mode?: string;
}

interface Context {
  location: { directory: string };
  options?: Record<string, unknown>;
  tool: {
    hook(name: "execute.after", callback: (event: ToolEvent) => void): Promise<unknown>;
    transform(callback: (editor: { add(definition: unknown): void }) => void): Promise<unknown>;
  };
}

export default {
  id: "codebase-index",
  setup: async (ctx: Context) => {
    const { stdout } = await run("git", ["-C", ctx.location.directory, "rev-parse", "--show-toplevel"]);
    const root = stdout.trim();
    const script = join(root, "scripts", "codebase-index.py");
    if (!existsSync(script)) {
      console.warn("[codebase-index] control script missing; automatic indexing disabled");
      return;
    }
    const python = process.env.CBX_PYTHON || (process.platform === "win32" ? "python" : "python3");
    const debounce = Number(ctx.options?.debounce_ms ?? 1500);
    const poll = Number(ctx.options?.poll_ms ?? 30000);
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let active: Promise<void> | undefined;
    let dirty = false;
    let stopped = false;
    let lastWarning = "";

    const execute = (args: string[], signal: AbortSignal) => run(python, [script, "--root", root, ...args], {
      cwd: root,
      signal,
      env: { ...process.env, CBX_NO_SKILL_AUTO_UPDATE: "1" },
      maxBuffer: 8 * 1024 * 1024,
    });

    const drain = (): Promise<void> => {
      if (active) return active;
      active = (async () => {
        dirty = false;
        try {
          const result = await execute(["refresh", "--automatic"], controller.signal);
          lastWarning = "";
          if (result.stderr.trim()) console.warn(`[codebase-index] ${result.stderr.trim()}`);
        } catch (error) {
          if (stopped) return;
          const failure = error as { stderr?: string; message?: string };
          const warning = failure.stderr?.trim() || failure.message || String(error);
          if (warning !== lastWarning) console.warn(`[codebase-index] ${warning}`);
          lastWarning = warning;
        }
      })().finally(() => {
        active = undefined;
        if (dirty && !stopped) schedule();
      });
      return active;
    };

    const schedule = () => {
      if (stopped) return;
      dirty = true;
      if (timer) clearTimeout(timer);
      if (active) return;
      timer = setTimeout(() => { timer = undefined; void drain(); }, debounce);
    };

    await ctx.tool.hook("execute.after", (event) => {
      if (event.status === "error") return;
      if (["edit", "write", "patch", "apply_patch", "multiedit", "bash", "shell"].includes(String(event.tool).toLowerCase())) {
        schedule();
      }
    });

    await ctx.tool.transform((editor) => {
      editor.add({
        name: "codebase_index",
        description: "Find and trace repository evidence. Automatic indexing runs separately; this tool only retrieves.",
        input: {
          type: "object",
          properties: {
            command: { type: "string", enum: commands },
            query: { type: "string", description: "Topic, symbol, or file to find" },
            target: { type: "string", description: "Second symbol for path queries" },
            mode: { type: "string", enum: ["hybrid", "fts", "symbol", "vector"] },
          },
          required: ["command", "query"],
          additionalProperties: false,
        },
        options: { codemode: true },
        execute: async (input: Query, context: { signal: AbortSignal }) => {
          if (!commands.includes(input.command)) throw new Error("Unsupported retrieval command.");
          if (input.command === "path" && !input.target) throw new Error("Path queries require a target.");
          if (input.target && input.command !== "path") throw new Error("Only path queries accept a target.");
          if (input.mode && input.command !== "search") throw new Error("Only search accepts a mode.");
          await active;
          const args = ["query", input.command, input.query];
          if (input.target) args.push(input.target);
          if (input.mode) args.push("--mode", input.mode);
          args.push("--json");
          const result = await execute(args, context.signal);
          if (result.stderr.trim()) console.warn(`[codebase-index] ${result.stderr.trim()}`);
          return { content: result.stdout };
        },
      });
    });

    void drain();
    const interval = setInterval(schedule, poll);
    interval.unref();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      clearInterval(interval);
      controller.abort();
    };
  },
};
