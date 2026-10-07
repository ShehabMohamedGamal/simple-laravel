import assert from "node:assert/strict";
import { test } from "node:test";
import { platformPaths } from "../src/settings.mjs";
import { launchDefinition } from "../src/autostart.mjs";

test("settings and cache use native platform directories and allow overrides", () => {
  assert.deepEqual(platformPaths("win32", {}, "C:\\Users\\Ada"), { config: "C:\\Users\\Ada\\AppData\\Roaming\\context7-cache", cache: "C:\\Users\\Ada\\AppData\\Local\\context7-cache" });
  assert.deepEqual(platformPaths("darwin", {}, "/Users/ada"), { config: "/Users/ada/Library/Application Support/context7-cache", cache: "/Users/ada/Library/Caches/context7-cache" });
  assert.deepEqual(platformPaths("linux", { XDG_CONFIG_HOME: "/config", XDG_CACHE_HOME: "/cache" }, "/home/ada"), { config: "/config/context7-cache", cache: "/cache/context7-cache" });
  assert.deepEqual(platformPaths("linux", { CTX7_CONFIG_DIR: "/custom-settings", CTX7_CACHE_DIR: "/custom-cache" }), { config: "/custom-settings", cache: "/custom-cache" });
});

test("autostart definitions keep paths with spaces intact and contain no API keys", () => {
  const options = { node: "/Program Files/node", cli: "/User Files/cache.mjs", config: "/User Files/config & data", log: "/User Files/server.log", sid: "S-1-5-21-1" };
  const linux = launchDefinition("linux", options);
  assert.ok(linux.includes('ExecStart="/Program Files/node" "/User Files/cache.mjs" serve --config-dir "/User Files/config & data" --log-file'));
  const mac = launchDefinition("darwin", options);
  assert.ok(mac.includes("<string>/User Files/config &amp; data</string>"));
  const windows = launchDefinition("win32", options);
  assert.ok(windows.includes("<UserId>S-1-5-21-1</UserId>"));
  assert.ok(windows.includes("<LogonType>InteractiveToken</LogonType>"));
  assert.ok(windows.includes("<ExecutionTimeLimit>PT0S</ExecutionTimeLimit>"));
  for (const text of [linux, mac, windows]) assert.ok(!text.includes("CONTEXT7_API_KEY"));
});
