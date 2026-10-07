import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { platformPaths } from "./settings.mjs";

const xml = (text) => String(text).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char]);
const quote = (text) => JSON.stringify(text).replaceAll("%", "%%");
const windowsQuote = (text) => `"${text.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/, "$1$1")}"`;

export function launchDefinition(platform, { node, cli, config, log, sid }) {
  const args = [cli, "serve", "--config-dir", config, "--log-file", log];
  if (platform === "linux") return `[Unit]\nDescription=Shared Context7 cache MCP service\nAfter=network.target\n\n[Service]\nExecStart=${quote(node)} ${quote(cli)} serve --config-dir ${quote(config)} --log-file ${quote(log)}\nRestart=on-failure\nRestartSec=3\nNoNewPrivileges=true\nUMask=0077\n\n[Install]\nWantedBy=default.target\n`;
  if (platform === "darwin") return `<?xml version="1.0" encoding="UTF-8"?>\n<plist version="1.0"><dict><key>Label</key><string>io.context7-cache</string><key>ProgramArguments</key><array>${[node, ...args].map((arg) => `<string>${xml(arg)}</string>`).join("")}</array><key>RunAtLoad</key><true/><key>KeepAlive</key><dict><key>SuccessfulExit</key><false/></dict></dict></plist>\n`;
  if (platform === "win32") return `<?xml version="1.0" encoding="UTF-8"?>\n<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task"><Triggers><LogonTrigger><Enabled>true</Enabled><UserId>${xml(sid)}</UserId></LogonTrigger></Triggers><Principals><Principal id="User"><UserId>${xml(sid)}</UserId><LogonType>InteractiveToken</LogonType><RunLevel>LeastPrivilege</RunLevel></Principal></Principals><Settings><MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy><DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries><StopIfGoingOnBatteries>false</StopIfGoingOnBatteries><ExecutionTimeLimit>PT0S</ExecutionTimeLimit></Settings><Actions Context="User"><Exec><Command>${xml(node)}</Command><Arguments>${xml(args.map(windowsQuote).join(" "))}</Arguments></Exec></Actions></Task>\n`;
  throw new Error(`Unsupported autostart platform: ${platform}`);
}

export async function autostart(args, cli) {
  if (args.length !== 1 || !["enable", "disable"].includes(args[0])) throw new Error("Usage: context7-cache autostart enable|disable");
  const enable = args[0] === "enable";
  const config = platformPaths().config;
  let sid;
  if (process.platform === "win32") {
    sid = execFileSync("whoami", ["/user", "/fo", "csv", "/nh"], { encoding: "utf8" }).match(/S-\d+(?:-\d+)+/)?.[0];
    if (!sid) throw new Error("Cannot determine Windows user SID");
  }
  const file = process.platform === "linux" ? join(process.env.XDG_CONFIG_HOME || join(homedir(), ".config"), "systemd", "user", "context7-cache.service") : process.platform === "darwin" ? join(homedir(), "Library", "LaunchAgents", "io.context7-cache.plist") : join(config, "autostart.xml");
  const task = `Context7Cache-${sid}`;
  if (enable) {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, launchDefinition(process.platform, { node: process.execPath, cli, config, log: join(config, "server.log"), sid }), { mode: 0o600 });
    if (process.platform === "linux") {
      execFileSync("systemctl", ["--user", "daemon-reload"], { stdio: "pipe" });
      execFileSync("systemctl", ["--user", "enable", "context7-cache.service"], { stdio: "pipe" });
    } else if (process.platform === "win32") execFileSync("schtasks", ["/Create", "/TN", task, "/XML", file, "/F"], { stdio: "pipe" });
  } else {
    if (process.platform === "linux") execFileSync("systemctl", ["--user", "disable", "--now", "context7-cache.service"], { stdio: "pipe" });
    else if (process.platform === "darwin") {
      try { execFileSync("launchctl", ["bootout", `gui/${process.getuid()}/io.context7-cache`], { stdio: "pipe" }); } catch (err) { if (!String(err.stderr).includes("No such process")) throw err; }
    } else if (process.platform === "win32") execFileSync("schtasks", ["/Delete", "/TN", task, "/F"], { stdio: "pipe" });
    if (existsSync(file)) unlinkSync(file);
    if (process.platform === "linux") execFileSync("systemctl", ["--user", "daemon-reload"], { stdio: "pipe" });
  }
  console.log(JSON.stringify({ autostart: enable, effective: enable ? "next login" : "disabled" }));
}
