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
const explicitBuildNumber = process.env.PDFTOOLS_BUILD_NUMBER?.trim()
const revision = (explicitRevision || runGit(['rev-parse', '--short=12', 'HEAD']) || 'local').slice(0, 12)
const dirtySuffix = !explicitRevision && runGit(['status', '--porcelain']) ? '-dev' : ''
const buildNumber = explicitBuildNumber || runGit(['rev-list', '--count', 'HEAD']) || 'local'

export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(packageInfo.version),
    'import.meta.env.VITE_APP_BUILD_NUMBER': JSON.stringify(`${buildNumber}${dirtySuffix}`),
    'import.meta.env.VITE_APP_REVISION': JSON.stringify(revision),
  },
  server: {
    port: 5175,
    proxy: { '/api': 'http://localhost:3001' },
  },
})
