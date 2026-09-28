// RTK OpenCode plugin (v2) — rewrites bash/shell commands to use rtk for token savings.
// Requires: rtk >= 0.23.0 in PATH.
//
// This is a thin delegating plugin: all rewrite logic lives in `rtk rewrite`,
// which is the single source of truth (src/discover/registry.rs).
// To add or change rewrite rules, edit the Rust registry — not this file.

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

interface ToolExecuteBeforeEvent {
  tool?: string;
  input?: Record<string, unknown>;
  sessionID?: string;
}

interface PluginContextV2 {
  tool: {
    hook(
      name: "execute.before" | "execute.after",
      callback: (event: never) => Promise<void> | void,
    ): Promise<unknown>;
  };
}

export default {
  id: "rtk",
  setup: async (ctx: PluginContextV2) => {
    try {
      await run("which", ["rtk"]);
    } catch {
      console.warn("[rtk] rtk binary not found in PATH — plugin disabled");
      return;
    }

    await ctx.tool.hook("execute.before", (raw: unknown) => {
      const event = raw as ToolExecuteBeforeEvent;
      const tool = String(event?.tool ?? "").toLowerCase();
      if (tool !== "bash" && tool !== "shell") return;
      const input = event?.input;
      if (!input || typeof input !== "object") return;

      const command = input.command;
      if (typeof command !== "string" || !command) return;

      return run("rtk", ["rewrite", command])
        .catch((error: { stdout?: string }) => {
          // rtk rewrite exits non-zero even when it rewrites — use captured stdout
          return error;
        })
        .then((result) => {
          const rewritten = String(result?.stdout ?? "").trim();
          if (rewritten && rewritten !== command) {
            event.input = { ...input, command: rewritten };
          }
        })
        .catch(() => {
          // rtk rewrite failed — pass through unchanged
        });
    });
  },
};
