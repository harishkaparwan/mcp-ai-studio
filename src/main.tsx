import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { resolveConfig } from "./config";

const config = resolveConfig();

// Override localStorage serverUrl ONLY for VS Code/Windsurf (settings.json is authoritative).
// For web and Chrome: localStorage always wins — .env is just the initial default.
const overrideStoredServerUrl = config.source === "vscode";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App
      defaultEndpoint={config.defaultEndpoint}
      clientName={config.clientName}
      clientVersion={config.clientVersion}
      title={config.title}
      subtitle={config.subtitle}
      overrideStoredServerUrl={overrideStoredServerUrl}
    />
  </StrictMode>,
);
