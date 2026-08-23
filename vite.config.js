import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const packageInfo = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))
const runGit = args => {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return ''
  }
}

const explicitRevision = process.env.PDFTOOLS_BUILD_REVISION?.trim()
const revision = (explicitRevision || runGit(['rev-parse', '--short=12', 'HEAD']) || 'local').slice(0, 12)
const dirtySuffix = !explicitRevision && runGit(['status', '--porcelain']) ? '-dev' : ''

export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(`v${packageInfo.version}`),
    'import.meta.env.VITE_APP_REVISION': JSON.stringify(`${revision}${dirtySuffix}`),
  },
  server: {
    port: 5175,
    proxy: { '/api': 'http://localhost:3001' },
  },
})
