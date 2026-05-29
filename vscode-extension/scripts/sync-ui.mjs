import { cp, mkdir, rm, stat } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const extensionDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const rootDir = resolve(extensionDir, '..')
const distDir = resolve(rootDir, 'dist')
const mediaDir = resolve(extensionDir, 'media')

try {
  await stat(distDir)
} catch {
  throw new Error('Missing root dist directory. Run `npm run build` before syncing the VS Code extension UI.')
}

await rm(mediaDir, { recursive: true, force: true })
await mkdir(mediaDir, { recursive: true })
await cp(distDir, mediaDir, { recursive: true })

console.log(`Synced ${distDir} to ${mediaDir}`)
