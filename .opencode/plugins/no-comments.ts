import type { Plugin } from "@opencode-ai/plugin";

declare function require(name: string): {
  execSync(command: string, options?: { encoding?: string }): string;
};
declare const process: { cwd(): string };

const { execSync } = require("node:child_process");

export const NoComments: Plugin = async () => {
  return {
    "tool.execute.after": async (input, _output) => {
      const tool = (input as { tool?: string }).tool ?? "";
      if (tool !== "edit" && tool !== "write") return;
      let output: string;
      try {
        output = execSync("sh scripts/feedback/no-comments.sh --config", {
          encoding: "utf-8",
          cwd: process.cwd(),
        });
      } catch (error) {
        const detail = (error as { stdout?: string }).stdout ?? "";
        throw new Error(
          `BLOCKED: added comment line(s). Zero comments allowed — delete them and re-run.\n${detail.trim()}`,
        );
      }
      return void output;
    },
  };
};
