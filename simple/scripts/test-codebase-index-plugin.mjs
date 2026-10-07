import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, copyFile, writeFile, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { test } from "node:test";
import { promisify } from "node:util";

test("plugin builds at startup, follows outside edits, and exposes retrieval only", async () => {
  const { default: plugin } = await import("../.opencode/plugins/codebase-index.ts");
  const root = await mkdtemp(join(process.env.OPENCODE_TEST_TMP || (process.platform === "win32" ? tmpdir() : "/tmp/opencode"), "cbx-plugin-"));
  const hooks = new Map();
  let tool;
  let cleanup;
  try {
    await promisify(execFile)("git", ["init", "--quiet", root]);
    await mkdir(join(root, "scripts"));
    await copyFile(resolve("scripts/codebase-index.py"), join(root, "scripts/codebase-index.py"));
    await writeFile(join(root, "calculator.py"), "def add(a, b):\n    return a + b\n");
    cleanup = await plugin.setup({
      location: { directory: root },
      options: { debounce_ms: 20, poll_ms: 100 },
      tool: {
        async hook(name, callback) { hooks.set(name, callback); },
        async transform(callback) { callback({ add(definition) { tool = definition; } }); },
      },
    });
    assert.deepEqual(tool.input.properties.command.enum, ["symbol", "search", "refs", "explain", "describe", "path"]);
    const first = await tool.execute({ command: "symbol", query: "add" }, { signal: new AbortController().signal });
    assert.match(first.content, /"add"/);
    await writeFile(join(root, "calculator.py"), "def subtract(a, b):\n    return a - b\n");
    let found = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      await delay(100);
      const result = await tool.execute({ command: "symbol", query: "subtract" }, { signal: new AbortController().signal });
      if (result.content.includes('"name": "subtract"')) { found = true; break; }
    }
    assert.ok(found, "outside edits should refresh without an agent running maintenance");
    await assert.rejects(tool.execute({ command: "impact", query: "add" }, { signal: new AbortController().signal }));
    cleanup();
    cleanup = undefined;
    await delay(200);
    const db = join(root, ".claude/cache/codebase-index/index.sqlite");
    const before = await readFile(db);
    await writeFile(join(root, "calculator.py"), "def multiply(a, b):\n    return a * b\n");
    await delay(300);
    assert.deepEqual(await readFile(db), before, "cleanup must stop maintenance");
  } finally {
    cleanup?.();
    await delay(200);
    await rm(root, { recursive: true, force: true });
  }
});
