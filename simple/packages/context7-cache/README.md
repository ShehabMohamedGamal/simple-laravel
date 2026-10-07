# Context7 cache MCP

A shared local Context7 documentation cache for Windows, Linux, and macOS. One background HTTP server owns the cache. MCP clients connect through HTTP or a stdio bridge.

Requires Node.js 22 or newer and npm. There are no runtime dependencies. This package is not published to npm. The package name `context7-cache-mcp` is provisional, and the license is `UNLICENSED` until the owner chooses a distribution license.

## Install

### From a release tarball

Download `context7-cache-mcp-0.1.0.tgz` and run this in the download directory. The command works in PowerShell, macOS Terminal, and Linux terminals:

```sh
npm install --global ./context7-cache-mcp-0.1.0.tgz
context7-cache setup
context7-cache start
context7-cache status
```

`setup` prompts for the Context7 API key without displaying it. Get a key from <https://context7.com/dashboard>. Keys are saved in the current user's settings, not in MCP client configuration. Do not put a key in command-line arguments.

If Unix global installation reports a permission error, use a user-managed Node installation or install with `npm install --global --prefix "$HOME/.local" ./context7-cache-mcp-0.1.0.tgz` and add `$HOME/.local/bin` to your PATH. Do not install or run the service as root.

On Windows, npm creates a `context7-cache.cmd` launcher. If PowerShell blocks the npm script launcher, use `npm.cmd` and `context7-cache.cmd` instead of changing execution policy. Restart your terminal if npm's global executable directory was just added to PATH.

### Build a tarball from this repository

From the repository root:

```sh
cd packages/context7-cache
npm test
npm pack
```

Distribute the generated `.tgz` file. It contains the CLI, server modules, package metadata, and this README. It does not require the Laravel repository, PHP, Bash, systemd, or any npm runtime dependencies.

The GitHub Actions workflow runs tests on Windows, Linux, and macOS with Node 22 and 24 and uploads tarballs as build artifacts. It does not publish to npm. Native Windows and macOS checks run in CI; passing Linux tests alone does not establish that they passed.

### After npm publication

Once the owner confirms an available package name and publishes a release, installation can use `npm install --global context7-cache-mcp`. A foreground run can use `npx --package=context7-cache-mcp context7-cache serve` after setup. These registry commands will not install this unpublished package today.

## Connect MCP clients

### HTTP

Start the server once:

```sh
context7-cache start
```

Configure each client with the Streamable HTTP URL:

```text
http://127.0.0.1:3777/mcp
```

Replace the direct Context7 connection so requests use this cache. Client configuration formats differ. No API key or OAuth login is needed in the client.

For OpenCode V2, add the connection globally:

```sh
opencode mcp add context7 --global --url http://127.0.0.1:3777/mcp
opencode mcp list
```

Set `oauth: false` on the server in global `opencode.jsonc`:

```json
{
  "mcp": {
    "servers": {
      "context7": {
        "type": "remote",
        "url": "http://127.0.0.1:3777/mcp",
        "oauth": false
      }
    }
  }
}
```

Merge this entry with existing settings. Do not replace the whole configuration file.

### Stdio

For a client that launches MCP subprocesses, configure the installed command with the `stdio` argument. A common client format is:

```json
{
  "mcpServers": {
    "context7": {
      "command": "context7-cache",
      "args": ["stdio"]
    }
  }
}
```

The bridge starts or reuses the same HTTP server. Closing the client leaves the shared server running. stdout carries only MCP messages.

Some Windows clients cannot execute `.cmd` launchers directly. For these clients, use the absolute path to `node.exe` as `command`, and the absolute path to the installed `bin/context7-cache.mjs` followed by `stdio` as `args`. `npm root --global` shows the package directory's parent. This approach also works for desktop clients on macOS or Linux that do not inherit your shell's PATH.

The server supports protocol revisions `2025-06-18` and `2025-11-25`. It does not support legacy HTTP+SSE, batch-based revisions, or the 2026 discovery protocol.

## Use the tools

| Tool | Arguments | Result |
| --- | --- | --- |
| `resolve-library-id` | `libraryName`, `query` | Ranked library IDs, cached for 30 days |
| `query-docs` | `libraryId`, `query` | Documentation for one topic, cached for 7 days |
| `cache-stats` | None | Hits, misses, writes, saved API calls |
| `cache-clear` | Optional `pattern` | Number of removed entries |

Resolve the library before querying docs unless you already have its exact Context7 ID. In OpenCode Code Mode, call `tools.context7["resolve-library-id"]`, then `tools.context7["query-docs"]`.

Simultaneous identical requests share one upstream request. Errors are not cached. HTTP 429 responses rotate through configured fallback keys. Cache hits work when no live API key is available. Clear patterns match library/query metadata; old plugin entries match their stored content because they lack that metadata.

## Manage the server

```sh
context7-cache start
context7-cache status
context7-cache logs
context7-cache stop
context7-cache serve
```

`start` waits for readiness and reuses a healthy instance. `status` prints JSON, including `running` and the endpoint URL. `logs` prints the background server's log. `stop` uses an authenticated local control request, not an unverified PID. `serve` runs in the foreground; stop it with Ctrl+C. Do not run multiple servers against the same cache directory.

To start at user login:

```sh
context7-cache autostart enable
```

Registration takes effect at the next login. Run `start` to use the server now. The command uses a systemd user service on Linux, a launch agent on macOS, or an interactive per-user scheduled task on Windows. It does not register autostart during package installation. Linux needs an active systemd user manager; without it, use `start` or the stdio bridge.

```sh
context7-cache autostart disable
context7-cache stop
```

Disable removes the registration and stops managed jobs where supported. The separate `stop` command also stops a manually started instance. If Windows task registration is denied by local policy, use manual startup or the stdio bridge; the tool does not elevate privileges or request your Windows password.

After upgrading Node or moving the installation, disable and re-enable autostart to update its recorded executable paths. After changing API keys or cache settings, rerun setup, stop, and start the server. Settings changes do not modify an already running process.

## Settings and security

| Platform | Settings directory | Cache directory |
| --- | --- | --- |
| Windows | `%APPDATA%\context7-cache` | `%LOCALAPPDATA%\context7-cache` |
| macOS | `~/Library/Application Support/context7-cache` | `~/Library/Caches/context7-cache` |
| Linux | `$XDG_CONFIG_HOME/context7-cache`, default `~/.config/context7-cache` | `$XDG_CACHE_HOME/context7-cache`, default `~/.cache/context7-cache` |

The settings directory contains `settings.json` and `server.log`. Unix directories use mode 700 and settings use mode 600. Windows setup removes inherited settings-directory access and grants the current user full access. Keys are stored as plaintext protected by filesystem permissions, not encrypted in an OS keychain. Back up settings privately and never commit them.

`CTX7_CONFIG_DIR` overrides the settings directory. `CTX7_CACHE_DIR` overrides the cache directory. `--config-dir PATH` selects a settings directory for one invocation. Use an absolute path and the same settings directory in all clients.

Before setup, you can export `CONTEXT7_API_KEY` and `CONTEXT7_API_KEY1` through `CONTEXT7_API_KEY50` instead of answering the prompt. Setup saves these keys. If environment keys exist when the server starts, they override saved keys. Do not mix keys from different Context7 accounts in one shared cache.

`CTX7_PORT` defaults to 3777. `CTX7_CACHE_TTL_SEARCH_MS` and `CTX7_CACHE_TTL_DOCS_MS` override expiry in milliseconds. `CTX7_CACHE_DISABLED=1` bypasses caching. Setup saves these values for detached and login-managed use. Update client URLs if you change the port.

The HTTP MCP endpoint binds only to IPv4 loopback and trusts local processes. It rejects foreign browser origins and Host headers. The health and shutdown endpoints additionally require a random token from settings. This is not a network-facing or multi-user hosted service. Do not expose the port with a proxy or tunnel.

## Migrate the earlier Linux installer

Install this tarball first. Then import the old environment file without printing its keys:

```sh
context7-cache setup --import-env "$HOME/.config/context7-cache.env"
systemctl --user disable --now context7-cache.service
context7-cache autostart enable
context7-cache start
context7-cache status
```

The import preserves the configured cache directory and fallback keys. Existing cache files remain compatible. The old environment file remains on disk as a private migration backup and is no longer used. Keep it protected or remove it after verifying the migration. Existing MCP clients need no URL change if you retain port 3777.

## Troubleshooting

- If `start` reports an occupied port, stop the old service or choose another port. The CLI does not kill unrelated processes.
- If a client cannot find the command, use absolute Node and CLI paths in its stdio configuration.
- If API requests fail, check your key and quota. `cache-stats` can work even without a usable API key.
- If startup fails, inspect `context7-cache logs` or run `context7-cache serve` in a terminal.
- If setup fails on Windows filesystem permissions, do not save keys in a shared directory. Choose an owner-controlled directory and rerun setup.

The package has no installation hooks. Installing it does not register login tasks or start the server.
