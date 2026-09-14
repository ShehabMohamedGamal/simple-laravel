import type { Plugin } from "@opencode-ai/plugin";

const BANNED_BD = /\bbd\s+(memory|remember)\b/i;
const MEMORY_TOOL = /memory/i;

export const NoMemory: Plugin = async () => {
  return {
    "tool.execute.before": async (input, output) => {
      const tool = (input as { tool?: string }).tool ?? "";
      if (MEMORY_TOOL.test(tool)) {
        throw new Error(
          "BLOCKED: memory tools are banned in this repo. Record durable knowledge in beads issues instead: bd create / bd update <id> --notes.",
        );
      }
      if (tool !== "bash") return;
      const command = String(
        (output as { args?: { command?: unknown } }).args?.command ?? "",
      );
      if (BANNED_BD.test(command)) {
        throw new Error(
          "BLOCKED: bd memory/remember are banned in this repo. Record durable knowledge in beads issues instead: bd create / bd update <id> --notes.",
        );
      }
    },
  };
};
