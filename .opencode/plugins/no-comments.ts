// No-comments gate (v2). Runs scripts/feedback/no-comments.sh after every
// edit/write tool call and fails the tool result when added comment lines
// are detected. If the script is missing the gate is skipped with a warning
// so a broken install cannot block every edit.

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { promisify } from "node:util";

const run = promisify(execFile);

const SCRIPT = "scripts/feedback/no-comments.sh";

interface ToolExecuteAfterEvent {
  tool?: string;
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
  id: "no-comments",
  setup: async (ctx: PluginContextV2) => {
    await ctx.tool.hook("execute.after", async (raw: unknown) => {
      const event = raw as ToolExecuteAfterEvent;
      const tool = String(event?.tool ?? "").toLowerCase();
      if (tool !== "edit" && tool !== "write") return;
      if (!existsSync(SCRIPT)) {
        console.warn(`[no-comments] ${SCRIPT} missing — gate skipped`);
        return;
      }
      let stdout: string;
      try {
        const result = await run("sh", [SCRIPT, "--config"], {
          cwd: process.cwd(),
          maxBuffer: 16 * 1024 * 1024,
        });
        stdout = result.stdout;
      } catch (error) {
        const detail =
          (error as { stdout?: string; stderr?: string }).stdout ??
          (error as { message?: string }).message ??
          "";
        throw new Error(
          `BLOCKED: added comment line(s). Zero comments allowed — delete them and re-run.\n${String(detail).trim()}`,
        );
      }
      return void stdout;
    });
  },
};
