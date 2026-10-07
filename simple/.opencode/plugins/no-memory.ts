const BANNED_BD = /\bbd\s+(memory|remember)\b/i;
const MEMORY_TOOL = /memory/i;

interface ToolExecuteBeforeEvent {
  tool?: string;
  input?: { command?: unknown };
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
  id: "no-memory",
  setup: async (ctx: PluginContextV2) => {
    await ctx.tool.hook("execute.before", (raw: unknown) => {
      const event = raw as ToolExecuteBeforeEvent;
      const tool = String(event?.tool ?? "");
      if (MEMORY_TOOL.test(tool)) {
        throw new Error(
          "BLOCKED: memory tools are banned in this repo. Record durable knowledge in beads issues instead: bd create / bd update <id> --notes.",
        );
      }
      if (tool.toLowerCase() !== "bash" && tool.toLowerCase() !== "shell") return;
      const command = String(event?.input?.command ?? "");
      if (BANNED_BD.test(command)) {
        throw new Error(
          "BLOCKED: bd memory/remember are banned in this repo. Record durable knowledge in beads issues instead: bd create / bd update <id> --notes.",
        );
      }
    });
  },
};
