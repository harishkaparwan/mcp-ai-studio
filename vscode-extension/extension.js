const fs = require("node:fs");
const path = require("node:path");
const vscode = require("vscode");

const COMMAND_OPEN = "mcpAiStudio.open";
const WEBVIEW_VIEW_ID = "mcpAiStudio.workbench";

let activePanel;

function activate(context) {
  const openCommand = vscode.commands.registerCommand(COMMAND_OPEN, () => {
    openWorkbenchPanel(context);
  });

  const sidebarProvider = new McpAiStudioViewProvider(context);

  context.subscriptions.push(
    openCommand,
    vscode.window.registerWebviewViewProvider(WEBVIEW_VIEW_ID, sidebarProvider, {
      webviewOptions: {
        retainContextWhenHidden: true,
      },
    }),
  );
}

class McpAiStudioViewProvider {
  constructor(context) {
    this.context = context;
  }

  resolveWebviewView(webviewView) {
    webviewView.webview.options = webviewOptions(this.context);
    webviewView.webview.html = getWebviewHtml(this.context, webviewView.webview);
  }
}

function openWorkbenchPanel(context) {
  if (activePanel) {
    activePanel.reveal(vscode.ViewColumn.One);
    return;
  }

  activePanel = vscode.window.createWebviewPanel(
    "mcpAiStudio",
    "MCP AI Studio",
    vscode.ViewColumn.One,
    {
      ...webviewOptions(context),
      retainContextWhenHidden: true,
    },
  );

  activePanel.onDidDispose(() => {
    activePanel = undefined;
  });

  activePanel.webview.html = getWebviewHtml(context, activePanel.webview);
}

function webviewOptions(context) {
  return {
    enableScripts: true,
    localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, "media"))],
  };
}

function getWebviewHtml(context, webview) {
  const mediaRoot = path.join(context.extensionPath, "media");
  const indexPath = path.join(mediaRoot, "index.html");

  if (!fs.existsSync(indexPath)) {
    return [
      "<!doctype html>",
      '<html lang="en">',
      "<body>",
      "<h1>MCP AI Studio assets are missing.</h1>",
      "<p>Run npm run extension:package from the project root, then reinstall the generated VSIX.</p>",
      "</body>",
      "</html>",
    ].join("");
  }

  const nonce = getNonce();
  let html = fs.readFileSync(indexPath, "utf8");

  // Read VS Code settings and inject as window.__MCP_CONFIG__ so the
  // generic React app picks them up without any build-time env vars.
  const cfg = vscode.workspace.getConfiguration("mcpAiStudio");
  const mcpConfig = { source: "vscode" };
  if (cfg.get("serverUrl")) mcpConfig.defaultEndpoint = cfg.get("serverUrl");
  if (cfg.get("title")) mcpConfig.title = cfg.get("title");
  if (cfg.get("subtitle")) mcpConfig.subtitle = cfg.get("subtitle");
  if (cfg.get("clientName")) mcpConfig.clientName = cfg.get("clientName");
  if (cfg.get("clientVersion")) mcpConfig.clientVersion = cfg.get("clientVersion");

  html = html.replace(/(src|href)="([^"]+)"/g, (match, attribute, assetPath) => {
    if (/^(https?:|data:|#)/.test(assetPath)) {
      return match;
    }

    const normalizedPath = assetPath.replace(/^\.\//, "").replace(/^\//, "");
    const assetUri = webview.asWebviewUri(vscode.Uri.file(path.join(mediaRoot, normalizedPath)));
    return `${attribute}="${assetUri}"`;
  });

  // Inject CSP and __MCP_CONFIG__ before other scripts so the app reads
  // the config on first render.
  html = html.replace(
    "<head>",
    `<head>` +
    `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} data:; font-src ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; connect-src ${webview.cspSource} http://localhost:* http://127.0.0.1:* https:;">` +
    `<script nonce="${nonce}">window.__MCP_CONFIG__ = ${JSON.stringify(mcpConfig)};</script>`,
  );

  html = html.replace(/<script /g, `<script nonce="${nonce}" `);
  // The __MCP_CONFIG__ script already has a nonce; undo the double-nonce added above.
  html = html.replace(
    new RegExp(`<script nonce="${nonce}" nonce="${nonce}">`, "g"),
    `<script nonce="${nonce}">`,
  );
  return html;
}

function getNonce() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let value = "";
  for (let i = 0; i < 32; i += 1) {
    value += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return value;
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
