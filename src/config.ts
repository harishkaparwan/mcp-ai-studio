/**
 * Generic app config — resolved at runtime with context-aware priority:
 *
 *  Web browser / Chrome extension (Configurator UI is in control):
 *    window.__MCP_CONFIG__  >  URL ?params  >  hard-coded defaults
 *    localStorage (Configurator saves) wins over all of the above in App.tsx
 *
 *  VS Code / Windsurf (settings.json is authoritative for serverUrl):
 *    window.__MCP_CONFIG__ (source="vscode")  overrides localStorage in App.tsx
 *
 *  NOTE: VITE_ env vars are intentionally NOT used for app config.
 *  They only configure the Vite dev proxy (infrastructure, not app state).
 *  The Configurator UI is the only way for users to set the server URL.
 */

export type ConfigSource = "vscode" | "chrome" | "web";

export interface AppConfig {
  source: ConfigSource;
  defaultEndpoint: string;
  clientName: string;
  clientVersion: string;
  title: string;
  subtitle: string;
}

declare global {
  interface Window {
    __MCP_CONFIG__?: Partial<AppConfig>;
  }
}

const DEFAULTS: AppConfig = {
  source: "web",
  defaultEndpoint: "/mcp",
  clientName: "mcp-ai-studio",
  clientVersion: "0.0.0",
  title: "MCP AI Studio",
  subtitle:
    "Connect, inspect, and operate any streamable HTTP MCP server from one professional interface.",
};

export function resolveConfig(): AppConfig {
  const injected: Partial<AppConfig> =
    typeof window !== "undefined" ? (window.__MCP_CONFIG__ ?? {}) : {};

  const params: URLSearchParams =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search)
      : new URLSearchParams();

  const source: ConfigSource = injected.source ?? "web";

  return {
    source,

    // defaultEndpoint is only the fallback shown when localStorage is empty.
    // For web/Chrome: localStorage (Configurator) overrides this in App.tsx.
    // For VS Code: injected value from settings.json overrides localStorage.
    defaultEndpoint:
      injected.defaultEndpoint ??
      params.get("mcp") ??
      DEFAULTS.defaultEndpoint,

    clientName:
      injected.clientName ??
      params.get("clientName") ??
      DEFAULTS.clientName,

    clientVersion:
      injected.clientVersion ??
      params.get("clientVersion") ??
      DEFAULTS.clientVersion,

    title:
      injected.title ??
      params.get("title") ??
      DEFAULTS.title,

    subtitle:
      injected.subtitle ??
      params.get("subtitle") ??
      DEFAULTS.subtitle,
  };
}
