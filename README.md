# MCP AI Studio

**Connect, inspect, and operate any Streamable HTTP MCP server — from a browser tab, a Chrome extension, or directly inside VS Code / Windsurf.**

MCP AI Studio is a fully generic, zero-dependency UI template. One React build runs everywhere: as a standalone web app, a packaged Chrome extension, or an editor webview. Configure it entirely from the client side — no server changes required.

---

## Features

- 🔌 **Connect to any MCP server** — enter any URL in the Configurator panel; saved to `localStorage` and restored on next load
- 🛠 **Discover & call tools** — browse all tools exposed by the server, auto-generates input forms from JSON Schema
- 🔍 **Inspect responses** — formatted JSON output with copy-to-clipboard
- ⚙️ **Fully configurable from the UI** — MCP Server URL, transport, request headers, client name/version, title, and subtitle
- 🧩 **Extension template** — fork and brand it; inject config via `window.__MCP_CONFIG__` from any host (VS Code, Windsurf, Chrome)

---

## Project Structure

```
mcp-ai-studio/
├── src/                        # React app (shared across all targets)
│   ├── config.ts               # Generic config resolution (priority ladder)
│   ├── App.tsx                 # Workbench UI, accepts all config as props
│   └── main.tsx                # Calls resolveConfig() → passes props to <App />
├── dist/                       # Built web UI (output of npm run build)
├── vscode-extension/           # VS Code / Windsurf extension wrapper
│   ├── extension.js            # Reads settings, injects window.__MCP_CONFIG__
│   ├── package.json            # contributes.configuration keys
│   └── media/                  # Synced from dist/ at package time
├── chrome-extension/           # Chrome extension wrapper
│   ├── app-config.json         # Edit this to pre-configure the extension
│   ├── manifest.json
│   └── scripts/sync-ui.mjs    # Injects app-config.json → index.html at build
└── .env.example                # All supported VITE_ env vars
```

---

## Configuration — Priority Ladder

All config fields follow the same resolution order (highest wins):

| Priority | Mechanism | Use case |
|----------|-----------|----------|
| 1 | `window.__MCP_CONFIG__` | Extension host injects at load time |
| 2 | URL query params (`?mcp=`, `?title=`, …) | Shareable deep links |
| 3 | `VITE_` env vars | Baked-in build defaults |
| 4 | Hard-coded defaults | Fallback |

The user can always override any value via the **Configurator panel** in the UI — changes are persisted to `localStorage`.

---

## Run The Web App

```bash
npm install
npm run dev
```

Open `http://localhost:9001`. Click the ⚙️ icon and enter your MCP Server URL (e.g. `http://localhost:8080/mcp`).

### Configure via `.env`

Copy `.env.example` to `.env` and set your values:

```env
VITE_MCP_TARGET=http://localhost:8080    # Vite dev proxy target
VITE_MCP_ENDPOINT=/mcp                   # Default URL shown in the UI
VITE_TITLE=My MCP AI Studio             # Optional branding
VITE_CLIENT_NAME=my-client              # Optional client name
```

### Configure via URL params (no `.env` needed)

```
http://localhost:9001/?mcp=http://localhost:8080/mcp&title=My+Tools
```

---

## VS Code / Windsurf Extension

### Install

```bash
npm run extension:package
code --install-extension vscode-extension/mcp-ai-studio-*.vsix --force
```

> On macOS without `code` on PATH:
> ```bash
> /Applications/Visual\ Studio\ Code.app/Contents/Resources/app/bin/code \
>   --install-extension vscode-extension/mcp-ai-studio-*.vsix --force
> ```

### Configure

Open **Settings** (`Ctrl+,`) and search for **MCP AI Studio**, or add to your `settings.json`:

```json
// .vscode/settings.json  (workspace) or ~/settings.json (global)
{
  "mcpAiStudio.serverUrl": "http://localhost:8080/mcp",
  "mcpAiStudio.title": "My Project Tools",
  "mcpAiStudio.subtitle": "Powered by Spring AI MCP",
  "mcpAiStudio.clientName": "my-project",
  "mcpAiStudio.clientVersion": "1.0.0"
}
```

The extension reads these settings on load and injects them as `window.__MCP_CONFIG__` into the webview — no rebuild required.

### Open the workbench

- Click the **MCP AI Studio icon** in the Activity Bar, or
- Run `Ctrl+Shift+P` → **MCP AI Studio: Open Workbench**

---

## Chrome Extension

### Build & install

```bash
npm run chrome:build
```

Then in Chrome: `chrome://extensions` → **Load unpacked** → select `chrome-extension/build/`.

### Configure

Edit `chrome-extension/app-config.json` before building:

```json
{
  "defaultEndpoint": "http://localhost:8080/mcp",
  "title": "My MCP Tools",
  "subtitle": "Internal tooling workbench",
  "clientName": "my-chrome-ext",
  "clientVersion": "1.0.0"
}
```

The sync script injects this as `window.__MCP_CONFIG__` into `index.html` at build time.

---

## Use As A Template

Fork this repo, then for each target:

| Target | What to change |
|--------|---------------|
| **Web app** | `.env` file |
| **VS Code / Windsurf** | `vscode-extension/package.json` (`name`, `displayName`, `publisher`, command IDs) + `settings.json` keys in `extension.js` |
| **Chrome** | `chrome-extension/manifest.json` (`name`, `description`) + `app-config.json` |

The shared React app (`src/`) needs no changes — it reads from `window.__MCP_CONFIG__` at runtime.

---

## MCP Server Compatibility

Works with any server implementing the [MCP Streamable HTTP transport](https://spec.modelcontextprotocol.io/specification/basic/transports/#streamable-http):

- Spring AI MCP
- FastMCP (Python)
- `@modelcontextprotocol/sdk` (Node.js)
- Any custom server returning `tools/list` + `tools/call` over HTTP

### URL to enter in the Configurator

| Server | URL |
|--------|-----|
| Spring AI (local) | `http://localhost:8080/mcp` |
| Spring AI (custom port) | `http://localhost:8009/mcp` |
| FastMCP (local) | `http://localhost:8000/mcp` |
| Node.js SDK (local) | `http://localhost:3000/mcp` |
| Remote / production | `https://mcp.mycompany.com/mcp` |
| MCP Playground | `https://mcpplaygroundonline.com/mcp-echo-server` |

> Always enter the **full real URL** of your MCP server. In dev mode (`npm run dev`), absolute URLs are automatically routed through a server-side proxy to avoid CORS restrictions.

