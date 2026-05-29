import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  ChevronDown,
  ChevronRight,
  Copy,
  DatabaseZap,
  LoaderCircle,
  MoreHorizontal,
  Play,
  RotateCcw,
  Save,
  Settings,
  X,
  Zap,
} from "./icons";
import { useMemo, useRef, useState, type ReactNode } from "react";
import "./styles.css";

// Internal-only constants — branding/endpoint defaults live in src/config.ts
const CONFIG_STORAGE_KEY = "mcp-ai-studio:config";
const DEFAULT_REQUEST_HEADERS = JSON.stringify({}, null, 2);
const DEFAULT_ARGUMENTS = JSON.stringify({}, null, 2);

type McpTool = {
  name: string;
  description?: string;
  inputSchema: {
    type: "object";
    properties?: Record<string, object>;
    required?: string[];
    [key: string]: unknown;
  };
};

type Status = "idle" | "connecting" | "connected" | "calling" | "error";

type WorkbenchConfig = {
  serverUrl: string;
  clientName: string;
  clientVersion: string;
  title: string;
  subtitle: string;
  transport: "streamable-http";
  requestHeaders: string;
  defaultArguments: string;
};

export type McpConsoleProps = {
  title?: string;
  subtitle?: string;
  defaultEndpoint?: string;
  clientName?: string;
  clientVersion?: string;
  /** When true (VS Code/Windsurf), defaultEndpoint wins over any saved localStorage value. */
  overrideStoredServerUrl?: boolean;
};

export default function App({
  title = "MCP AI Studio",
  subtitle = "Connect, inspect, and operate any streamable HTTP MCP server from one professional interface.",
  defaultEndpoint = "/mcp",
  clientName = "mcp-workbench",
  clientVersion = "0.0.0",
  overrideStoredServerUrl = false,
}: McpConsoleProps) {
  const defaultConfig = useMemo(
    () => ({
      serverUrl: defaultEndpoint,
      clientName,
      clientVersion,
      title,
      subtitle,
      transport: "streamable-http" as const,
      requestHeaders: DEFAULT_REQUEST_HEADERS,
      defaultArguments: DEFAULT_ARGUMENTS,
    }),
    [clientName, clientVersion, defaultEndpoint, subtitle, title],
  );
  const [config, setConfig] = useState<WorkbenchConfig>(() => {
    const stored = readStoredConfig();
    const merged = { ...defaultConfig, ...stored };
    // VS Code/Windsurf: settings.json serverUrl always wins over localStorage.
    // Web/Chrome: localStorage (Configurator UI saves) wins — user is in control.
    if (overrideStoredServerUrl) {
      merged.serverUrl = defaultEndpoint;
    }
    return merged;
  });
  const [draftConfig, setDraftConfig] = useState<WorkbenchConfig>(config);
  const [isConfiguratorOpen, setIsConfiguratorOpen] = useState(true);
  const [status, setStatus] = useState<Status>("idle");
  const [tools, setTools] = useState<McpTool[]>([]);
  const [selectedToolName, setSelectedToolName] = useState("");
  const [argumentsText, setArgumentsText] = useState(config.defaultArguments);
  const [resultText, setResultText] = useState("{}");
  const [error, setError] = useState("");
  const [copyLabel, setCopyLabel] = useState("Copy");
  const clientRef = useRef<Client | null>(null);
  const transportRef = useRef<StreamableHTTPClientTransport | null>(null);

  const selectedTool = useMemo(
    () => tools.find((tool) => tool.name === selectedToolName),
    [selectedToolName, tools],
  );

  const schemaText = selectedTool
    ? JSON.stringify(selectedTool.inputSchema, null, 2)
    : "{}";

  async function connect() {
    setStatus("connecting");
    setError("");

    try {
      await transportRef.current?.close().catch(() => undefined);

      // In dev mode, route absolute URLs through the dynamic proxy to avoid CORS.
      // In VS Code/Windsurf/Chrome extensions, webviews bypass CORS — no proxy needed.
      const rawUrl = config.serverUrl.trim();
      const isAbsolute = /^https?:\/\//.test(rawUrl);
      const proxiedUrl =
        isAbsolute && import.meta.env.DEV
          ? `/__proxy__/${rawUrl}`
          : rawUrl;
      const endpoint = new URL(proxiedUrl, window.location.origin);
      const transport = new StreamableHTTPClientTransport(endpoint, {
        requestInit: {
          headers: parseHeaders(config.requestHeaders),
        },
      });
      const client = new Client({
        name: config.clientName,
        version: config.clientVersion,
      });

      await client.connect(transport);
      const list = await client.listTools();
      const nextTools = list.tools;
      const nextSelectedTool =
        nextTools.find((tool) => tool.name === selectedToolName) ?? nextTools[0];

      transportRef.current = transport;
      clientRef.current = client;
      setTools(nextTools);
      setSelectedToolName(nextSelectedTool?.name ?? "");
      setArgumentsText(
        nextSelectedTool
          ? stringifyPretty(sampleFromSchema(nextSelectedTool.inputSchema))
          : config.defaultArguments,
      );
      setStatus("connected");
    } catch (caughtError) {
      setStatus("error");
      setTools([]);
      setSelectedToolName("");
      setResultText("{}");
      setError(toErrorMessage(caughtError));
    }
  }

  async function callSelectedTool() {
    if (!clientRef.current || !selectedTool) return;

    setStatus("calling");
    setError("");

    try {
      const parsedArguments = JSON.parse(argumentsText) as Record<string, unknown>;
      const result = await clientRef.current.callTool({
        name: selectedTool.name,
        arguments: parsedArguments,
      });
      setResultText(JSON.stringify(result, null, 2));
      setStatus("connected");
    } catch (caughtError) {
      setStatus("error");
      setError(toErrorMessage(caughtError));
    }
  }

  function openConfigurator() {
    setDraftConfig(config);
    setIsConfiguratorOpen(true);
  }

  function toggleConfigurator() {
    if (isConfiguratorOpen) {
      setIsConfiguratorOpen(false);
      return;
    }

    setDraftConfig(config);
    setIsConfiguratorOpen(true);
  }

  function saveConfigurator() {
    const nextConfig = normalizeConfig(draftConfig, defaultConfig);
    setConfig(nextConfig);
    setArgumentsText(nextConfig.defaultArguments);
    writeStoredConfig(nextConfig);
    setIsConfiguratorOpen(false);
  }

  function resetConfigurator() {
    setDraftConfig(defaultConfig);
  }

  function updateServerUrl(serverUrl: string) {
    const nextConfig = { ...config, serverUrl };
    setConfig(nextConfig);
    writeStoredConfig(nextConfig);
  }

  function selectTool(toolName: string) {
    setSelectedToolName(toolName);
    const nextTool = tools.find((tool) => tool.name === toolName);
    setArgumentsText(
      nextTool ? stringifyPretty(sampleFromSchema(nextTool.inputSchema)) : config.defaultArguments,
    );
  }

  async function copyResponse() {
    const responseText = error ? "{}" : resultText;

    try {
      await navigator.clipboard.writeText(responseText);
      setCopyLabel("Copied");
      window.setTimeout(() => setCopyLabel("Copy"), 1600);
    } catch {
      setCopyLabel("Copy failed");
      window.setTimeout(() => setCopyLabel("Copy"), 1800);
    }
  }

  const isBusy = status === "connecting" || status === "calling";
  const canCall = status === "connected" && Boolean(selectedTool);
  const hasConnectedTheme = status === "connected" || status === "calling";
  const activeToolName = selectedTool?.name || selectedToolName || "No tool selected";

  return (
    <main
      className={
        hasConnectedTheme ? "blueprint-shell connected-theme" : "blueprint-shell"
      }
    >
      <ActivityRail />

      <section className="editor-shell" aria-label="MCP AI Studio">
        <header className="titlebar">
          <div className="titlebar-brand">
            <img src="/images/mcp_logo.svg" width="44" height="44" alt="MCP logo" aria-hidden="true" style={{ borderRadius: 8 }} />
            <strong>{config.title}</strong>
          </div>
          <div className="titlebar-actions">
            <button
              type="button"
              className={
                isConfiguratorOpen
                  ? "toolbar-button configurator-toggle active"
                  : "toolbar-button configurator-toggle"
              }
              onClick={toggleConfigurator}
              aria-expanded={isConfiguratorOpen}
              aria-pressed={isConfiguratorOpen}
              aria-label="Toggle configurator"
            >
              <Settings size={16} />
              <span>Configurator</span>
            </button>
            <button
              type="button"
              className="toolbar-button primary"
              disabled={isBusy}
              onClick={connect}
            >
              {status === "connecting" ? (
                <LoaderCircle className="spin" size={16} />
              ) : (
                <Play size={16} />
              )}
              <span>Connect</span>
            </button>
            <button type="button" className="icon-only" aria-label="More actions">
              <MoreHorizontal size={17} />
            </button>
          </div>
        </header>

        <div
          className={
            isConfiguratorOpen ? "universal-grid drawer-open" : "universal-grid"
          }
        >
          <section className="main-workbench" aria-label="Tool workspace">
            <Panel
              className="connection-panel"
              title="Connection"
              action={<StatusBadge status={status} />}
            >
              <div className="endpoint-row">
                <label className="endpoint-chip" htmlFor="server-url">
                  <span>URL:</span>
                  <input
                    id="server-url"
                    value={config.serverUrl}
                    onChange={(event) => updateServerUrl(event.target.value)}
                    spellCheck={false}
                  />
                </label>
                <button
                  type="button"
                  className="square-action"
                  onClick={connect}
                  disabled={isBusy}
                  aria-label="Connect to MCP server"
                >
                  {status === "connecting" ? (
                    <LoaderCircle className="spin" size={16} />
                  ) : (
                    <Play size={16} />
                  )}
                </button>
                <button
                  type="button"
                  className="square-action muted"
                  onClick={toggleConfigurator}
                  aria-expanded={isConfiguratorOpen}
                  aria-label="Toggle MCP configurator"
                >
                  <Settings size={16} />
                </button>
              </div>
            </Panel>

            <Panel className="tool-call-panel" title="Tool Call">
              <div className="tool-call-header">
                <div className="tool-name">
                  <Zap size={24} />
                  <div>
                    <strong>Tool: {activeToolName}</strong>
                    <span>
                      {selectedTool?.description ||
                        "Connect to an MCP server and select a tool."}
                    </span>
                  </div>
                </div>

                <label className="tool-picker" htmlFor="tool-select">
                  <span>Tool</span>
                  <select
                    id="tool-select"
                    value={selectedToolName}
                    onChange={(event) => selectTool(event.target.value)}
                    disabled={tools.length === 0}
                  >
                    <option value="">No tool selected</option>
                    {tools.map((tool) => (
                      <option key={tool.name} value={tool.name}>
                        {tool.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="code-split">
                <CodePane
                  label="Arguments (JSON)"
                  lineCount={3}
                  content={
                    <textarea
                      value={argumentsText}
                      onChange={(event) => setArgumentsText(event.target.value)}
                      spellCheck={false}
                      aria-label="Arguments JSON"
                    />
                  }
                />

                <CodePane
                  label="Input Schema"
                  lineCount={8}
                  content={<pre>{schemaText}</pre>}
                />
              </div>

              <div className="run-row">
                <button
                  type="button"
                  className="run-button"
                  disabled={!canCall || isBusy}
                  onClick={callSelectedTool}
                >
                  {status === "calling" ? (
                    <LoaderCircle className="spin" size={14} />
                  ) : (
                    <Play size={14} />
                  )}
                  <span>Run Tool</span>
                </button>
              </div>

              <div className="divider" />

              <div className="result-strip">
                <div>
                  <span>Latest response</span>
                  {error ? <strong className="error-text">{error}</strong> : null}
                </div>
                <pre>{error ? "{}" : resultText}</pre>
              </div>

              <div className="panel-actions">
                <button type="button" className="save-button" onClick={openConfigurator}>
                  <span>Save</span>
                </button>
                <button
                  type="button"
                  className="copy-button"
                  onClick={copyResponse}
                >
                  <Copy size={15} />
                  <span>{copyLabel}</span>
                </button>
                <button
                  type="button"
                  className="cancel-button"
                  onClick={() => setResultText("{}")}
                >
                  <span>Clear</span>
                </button>
              </div>
            </Panel>
          </section>

          {isConfiguratorOpen ? (
            <McpConfigurator
              config={draftConfig}
              status={status}
              onChange={setDraftConfig}
              onClose={() => setIsConfiguratorOpen(false)}
              onReset={resetConfigurator}
              onSave={saveConfigurator}
            />
          ) : null}

          <CompactVsCodePane
            config={config}
            status={status}
            tools={tools}
            selectedToolName={selectedToolName}
            onOpenConfigurator={openConfigurator}
          />
        </div>
      </section>
    </main>
  );
}

function ActivityRail() {
  return (
    <aside className="activity-rail" aria-label="Primary navigation">
     
    </aside>
  );
}

function Panel({
  title,
  action,
  className,
  children,
}: {
  title: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`workbench-panel ${className || ""}`}>
      <div className="panel-header">
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function CodePane({
  label,
  lineCount,
  content,
}: {
  label: string;
  lineCount: number;
  content: ReactNode;
}) {
  return (
    <div className="code-pane">
      <div className="code-label">{label}</div>
      <div className="code-editor">
        <ol aria-hidden="true">
          {Array.from({ length: lineCount }, (_, index) => (
            <li key={index}>{index + 1}</li>
          ))}
        </ol>
        <div className="code-content">{content}</div>
      </div>
    </div>
  );
}

function McpConfigurator({
  config,
  status,
  onChange,
  onClose,
  onReset,
  onSave,
}: {
  config: WorkbenchConfig;
  status: Status;
  onChange: (config: WorkbenchConfig) => void;
  onClose: () => void;
  onReset: () => void;
  onSave: () => void;
}) {
  function updateField<Key extends keyof WorkbenchConfig>(
    key: Key,
    value: WorkbenchConfig[Key],
  ) {
    onChange({ ...config, [key]: value });
  }

  return (
    <aside className="configurator-drawer" aria-labelledby="configurator-title">
      <div className="drawer-header">
        <div>
          <h2 id="configurator-title">MCP Configurator</h2>
          <p>Saved in this browser and reused when MCP AI Studio loads.</p>
        </div>
        <button
          type="button"
          className="icon-only"
          onClick={onClose}
          aria-label="Close MCP Configurator"
        >
          <X size={16} />
        </button>
      </div>

      <div className="drawer-form">
        <ConfiguratorField label="MCP Server URL" htmlFor="config-server-url">
          <input
            id="config-server-url"
            value={config.serverUrl}
            onChange={(event) => updateField("serverUrl", event.target.value)}
            spellCheck={false}
          />
        </ConfiguratorField>

        <ConfiguratorField label="Transport" htmlFor="config-transport">
          <select
            id="config-transport"
            value={config.transport}
            onChange={(event) =>
              updateField(
                "transport",
                event.target.value as WorkbenchConfig["transport"],
              )
            }
          >
            <option value="streamable-http">Streamable HTTP</option>
          </select>
        </ConfiguratorField>

        <ConfiguratorField label="Request Headers (JSON)" htmlFor="config-request-headers">
          <textarea
            id="config-request-headers"
            value={config.requestHeaders}
            onChange={(event) => updateField("requestHeaders", event.target.value)}
            spellCheck={false}
          />
        </ConfiguratorField>

        <div className="drawer-two-up">
          <ConfiguratorField label="Client Name" htmlFor="config-client-name">
            <input
              id="config-client-name"
              value={config.clientName}
              onChange={(event) => updateField("clientName", event.target.value)}
              spellCheck={false}
            />
          </ConfiguratorField>

          <ConfiguratorField label="Version" htmlFor="config-client-version">
            <input
              id="config-client-version"
              value={config.clientVersion}
              onChange={(event) => updateField("clientVersion", event.target.value)}
              spellCheck={false}
            />
          </ConfiguratorField>
        </div>

        <ConfiguratorField label="Interface Title" htmlFor="config-title">
          <input
            id="config-title"
            value={config.title}
            onChange={(event) => updateField("title", event.target.value)}
          />
        </ConfiguratorField>

        <ConfiguratorField label="Interface Subtitle" htmlFor="config-subtitle">
          <textarea
            id="config-subtitle"
            value={config.subtitle}
            onChange={(event) => updateField("subtitle", event.target.value)}
          />
        </ConfiguratorField>

        <ConfiguratorField label="Default Arguments (JSON)" htmlFor="config-default-arguments">
          <textarea
            id="config-default-arguments"
            value={config.defaultArguments}
            onChange={(event) => updateField("defaultArguments", event.target.value)}
            spellCheck={false}
          />
        </ConfiguratorField>
      </div>

      <div className="drawer-status">
        <StatusBadge status={status} />
        <span>{config.serverUrl}</span>
      </div>

      <div className="drawer-actions">
        <button type="button" className="secondary-action" onClick={onReset}>
          <RotateCcw size={15} />
          <span>Reset</span>
        </button>
        <button type="button" className="save-button" onClick={onSave}>
          <Save size={15} />
          <span>Save</span>
        </button>
      </div>
    </aside>
  );
}

function ConfiguratorField({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <label className="config-field" htmlFor={htmlFor}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function CompactVsCodePane({
  config,
  status,
  tools,
  selectedToolName,
  onOpenConfigurator,
}: {
  config: WorkbenchConfig;
  status: Status;
  tools: McpTool[];
  selectedToolName: string;
  onOpenConfigurator: () => void;
}) {
  const visibleTools = tools.length ? tools : [{ name: "chat" }, { name: "generate_questionnaires" }];

  return (
    <aside className="compact-pane" aria-label="Narrow VS Code view">
      <div className="compact-topbar">
        <span>MCP AI STUDIO</span>
        <div>
          <button type="button" className="mini-button" aria-label="Run">
            <Play size={13} />
          </button>
          <button type="button" className="mini-save" onClick={onOpenConfigurator}>
            Save
          </button>
          <button type="button" className="mini-button" aria-label="More">
            <MoreHorizontal size={13} />
          </button>
        </div>
      </div>

      <div className="compact-body">
        <TreeRow icon={<ChevronRight size={14} />} label="Connected" status={status} />

        <div className="tree-section">
          <TreeHeader label={`TOOLS (${tools.length || 2})`} />
          {visibleTools.map((tool) => (
            <div
              key={tool.name}
              className={
                tool.name === selectedToolName ? "tree-item active" : "tree-item"
              }
            >
              <Zap size={14} />
              <span>{tool.name}</span>
            </div>
          ))}
        </div>

        <div className="tree-section">
          <TreeHeader label="CONFIGURATOR" status={status} />
          <TreeRow icon={<ChevronDown size={14} />} label="Connected" />
          <TreeRow icon={<ChevronDown size={14} />} label="Server URL" indent />
          <div className="tree-input">{config.serverUrl}</div>
          <TreeRow icon={<ChevronDown size={14} />} label="Transport" indent />
          <div className="tree-input">Streamable HTTP</div>
          <TreeRow icon={<ChevronDown size={14} />} label="Request Headers (JSON)" indent />
          <div className="tree-code">{config.requestHeaders}</div>
        </div>
      </div>

      <div className="compact-statusbar">
        <span>mcp</span>
        <span>0 △ 0</span>
        <span>0</span>
      </div>
    </aside>
  );
}

function TreeHeader({ label, status }: { label: string; status?: Status }) {
  return (
    <div className="tree-header">
      <ChevronDown size={14} />
      <span>{label}</span>
      {status ? <StatusBadge status={status} compact /> : null}
    </div>
  );
}

function TreeRow({
  icon,
  label,
  status,
  indent = false,
}: {
  icon: ReactNode;
  label: string;
  status?: Status;
  indent?: boolean;
}) {
  return (
    <div className={indent ? "tree-row indent" : "tree-row"}>
      {icon}
      <DatabaseZap size={14} />
      <span>{label}</span>
      {status ? <StatusBadge status={status} compact /> : null}
    </div>
  );
}

function StatusBadge({
  status,
  compact = false,
}: {
  status: Status;
  compact?: boolean;
}) {
  const label =
    status === "connecting"
      ? "Connecting"
      : status === "connected"
        ? "Connected"
        : status === "calling"
          ? "Calling"
          : status === "error"
            ? "Error"
            : "Idle";

  return (
    <span className={`status-badge ${status} ${compact ? "compact" : ""}`}>
      <span aria-hidden="true" />
      {label}
    </span>
  );
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown MCP client error";
}

function readStoredConfig() {
  if (typeof window === "undefined" || !("localStorage" in window)) return {};

  try {
    // Migrate saved config from old storage key if new key is empty
    if (!window.localStorage.getItem(CONFIG_STORAGE_KEY)) {
      const legacy = window.localStorage.getItem("mcp-workbench:config");
      if (legacy) {
        window.localStorage.setItem(CONFIG_STORAGE_KEY, legacy);
        window.localStorage.removeItem("mcp-workbench:config");
      }
    }

    const storedConfig = window.localStorage.getItem(CONFIG_STORAGE_KEY);
    if (!storedConfig) return {};

    const parsedConfig = JSON.parse(storedConfig) as Partial<WorkbenchConfig>;
    const nextConfig: Partial<WorkbenchConfig> = {};

    if (parsedConfig.serverUrl) nextConfig.serverUrl = parsedConfig.serverUrl;
    if (parsedConfig.clientName) nextConfig.clientName = parsedConfig.clientName;
    if (parsedConfig.clientVersion) nextConfig.clientVersion = parsedConfig.clientVersion;
    if (parsedConfig.transport === "streamable-http") {
      nextConfig.transport = parsedConfig.transport;
    }
    if (typeof parsedConfig.requestHeaders === "string") {
      nextConfig.requestHeaders = parsedConfig.requestHeaders;
    }
    if (typeof parsedConfig.defaultArguments === "string") {
      nextConfig.defaultArguments = parsedConfig.defaultArguments;
    }

    return nextConfig;
  } catch {
    return {};
  }
}

function writeStoredConfig(config: WorkbenchConfig) {
  if (typeof window === "undefined" || !("localStorage" in window)) return;

  window.localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
}

function normalizeConfig(
  config: WorkbenchConfig,
  fallbackConfig: WorkbenchConfig,
): WorkbenchConfig {
  return {
    serverUrl: config.serverUrl.trim() || fallbackConfig.serverUrl,
    clientName: config.clientName.trim() || fallbackConfig.clientName,
    clientVersion: config.clientVersion.trim() || fallbackConfig.clientVersion,
    title: config.title.trim() || fallbackConfig.title,
    subtitle: config.subtitle.trim() || fallbackConfig.subtitle,
    transport: "streamable-http",
    requestHeaders: normalizeJsonObjectText(
      config.requestHeaders,
      fallbackConfig.requestHeaders,
    ),
    defaultArguments: normalizeJsonObjectText(
      config.defaultArguments,
      fallbackConfig.defaultArguments,
    ),
  };
}

function parseHeaders(headersText: string): Record<string, string> {
  const parsedHeaders = JSON.parse(headersText) as Record<string, unknown>;

  return Object.fromEntries(
    Object.entries(parsedHeaders)
      .filter(([, value]) => value !== null && value !== undefined)
      .map(([key, value]) => [key, String(value)]),
  );
}

function normalizeJsonObjectText(text: string, fallbackText: string) {
  const trimmedText = text.trim();
  if (!trimmedText) return fallbackText;

  try {
    const parsed = JSON.parse(trimmedText);
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
      return fallbackText;
    }

    return JSON.stringify(parsed, null, 2);
  } catch {
    return fallbackText;
  }
}

function stringifyPretty(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function sampleFromSchema(
  schema: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!schema || schema.type !== "object") {
    return {};
  }

  const properties = schema.properties;
  if (!properties || typeof properties !== "object" || Array.isArray(properties)) {
    return {};
  }

  return Object.entries(
    properties as Record<string, Record<string, unknown>>,
  ).reduce<Record<string, unknown>>((sample, [key, property]) => {
    sample[key] = sampleValue(key, property);
    return sample;
  }, {});
}

function sampleValue(key: string, schema: Record<string, unknown>): unknown {
  if (Array.isArray(schema.enum) && schema.enum.length > 0) {
    return schema.enum[0];
  }

  switch (schema.type) {
    case "string":
      return sampleStringValue(key, schema);
    case "number":
    case "integer":
      return 0;
    case "boolean":
      return true;
    case "array":
      return [];
    case "object":
      return sampleFromSchema(schema);
    default:
      return null;
  }
}

function sampleStringValue(
  key: string,
  schema: Record<string, unknown>,
): string {
  if (schema.format === "date-time") {
    return new Date().toISOString();
  }

  const normalizedKey = key.toLowerCase();
  if (normalizedKey === "provider") return "openai";
  if (normalizedKey === "message") return "Hello";
  if (normalizedKey === "query") return "Hello";
  if (normalizedKey.includes("prompt")) return "Hello";
  if (normalizedKey.includes("question")) return "Hello";

  return "";
}
