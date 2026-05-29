import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import type { Connect } from "vite";
import http from "node:http";
import https from "node:https";

// Dynamic pass-through proxy middleware.
// Intercepts /__proxy__/<target-url> and forwards to the real server.
// This lets the Configurator use any absolute URL without CORS errors in dev.
function dynamicProxyMiddleware(): Connect.NextHandleFunction {
  return (req, res, next) => {
    const PREFIX = "/__proxy__/";
    if (!req.url?.startsWith(PREFIX)) return next();

    const targetUrl = req.url.slice(PREFIX.length);
    let parsed: URL;
    try {
      parsed = new URL(targetUrl);
    } catch {
      res.writeHead(400);
      res.end("Invalid proxy target URL");
      return;
    }

    const lib = parsed.protocol === "https:" ? https : http;
    const options = {
      method: req.method,
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
      path: parsed.pathname + parsed.search,
      headers: {
        ...req.headers,
        host: parsed.host,
      },
    };

    const proxyReq = lib.request(options, (proxyRes) => {
      const headers = {
        ...proxyRes.headers,
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "*",
        "access-control-allow-methods": "*",
      };
      res.writeHead(proxyRes.statusCode ?? 200, headers);
      proxyRes.pipe(res);
    });

    proxyReq.on("error", (err) => {
      res.writeHead(502);
      res.end(`Proxy error: ${err.message}`);
    });

    req.pipe(proxyReq);
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  const mcpTarget = env.VITE_MCP_TARGET || "http://localhost:8080";
  const port = Number(env.VITE_PORT || 9001);

  return {
    base: "./",
    plugins: [
      react(),
      {
        name: "dynamic-proxy",
        configureServer(server) {
          server.middlewares.use(dynamicProxyMiddleware());
        },
      },
    ],
    build: {
      outDir: "dist",
    },
    server: {
      port,
      strictPort: true,
      proxy: {
        // Keep /mcp as a convenience proxy for relative-path local servers
        "/mcp": {
          target: mcpTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    preview: {
      port,
      strictPort: true,
    },
  };
});
