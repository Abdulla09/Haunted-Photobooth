// Copies the MediaPipe tasks-vision WASM runtime into public/ so it is served locally.
import { cpSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const src = resolve(root, 'node_modules/@mediapipe/tasks-vision/wasm')
const dest = resolve(root, 'public/mediapipe/wasm')

if (!existsSync(src)) {
  console.error(`copy-mediapipe: source not found: ${src} (run npm install)`)
  process.exit(1)
}
mkdirSync(dest, { recursive: true })
cpSync(src, dest, { recursive: true })
console.log('copy-mediapipe: copied WASM to public/mediapipe/wasm')
