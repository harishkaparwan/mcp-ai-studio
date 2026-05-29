import { cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const extensionDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const rootDir = resolve(extensionDir, '..')
const distDir = resolve(rootDir, 'dist')
const buildDir = resolve(extensionDir, 'build')
const manifestPath = resolve(extensionDir, 'manifest.json')
const backgroundPath = resolve(extensionDir, 'background.js')
const iconsDir = resolve(extensionDir, 'icons')
const appConfigPath = resolve(extensionDir, 'app-config.json')

try {
  await stat(distDir)
} catch {
  throw new Error('Missing root dist directory. Run `npm run build` before syncing the Chrome extension UI.')
}

await rm(buildDir, { recursive: true, force: true })
await mkdir(buildDir, { recursive: true })
await cp(distDir, buildDir, { recursive: true })
await cp(manifestPath, resolve(buildDir, 'manifest.json'))
await cp(backgroundPath, resolve(buildDir, 'background.js'))
await cp(iconsDir, resolve(buildDir, 'icons'), { recursive: true })

// Inject window.__MCP_CONFIG__ from app-config.json into index.html.
// Edit app-config.json to pre-configure the extension for your MCP server.
const appConfig = JSON.parse(await readFile(appConfigPath, 'utf8'))
const mcpConfig = Object.fromEntries(
  Object.entries(appConfig).filter(([, v]) => v !== '' && v != null)
)
const indexPath = resolve(buildDir, 'index.html')
let html = await readFile(indexPath, 'utf8')
html = html.replace(
  '<head>',
  `<head><script>window.__MCP_CONFIG__ = ${JSON.stringify(mcpConfig)};</script>`
)
await writeFile(indexPath, html, 'utf8')

console.log(`Synced ${distDir} to ${buildDir}`)
console.log(`Injected __MCP_CONFIG__:`, mcpConfig)
