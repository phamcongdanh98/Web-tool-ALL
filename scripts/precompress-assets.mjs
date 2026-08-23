import { readdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import { brotliCompress, constants, gzip } from 'node:zlib'

const brotli = promisify(brotliCompress)
const gzipCompress = promisify(gzip)
const distDirectory = path.resolve('dist')
const compressibleExtensions = new Set(['.css', '.js', '.json', '.mjs', '.svg', '.wasm'])
const minimumBytes = 1024

const walk = async directory => {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const filePath = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await walk(filePath))
    else if (entry.isFile() && compressibleExtensions.has(path.extname(entry.name))) files.push(filePath)
  }
  return files
}

const files = await walk(distDirectory)
let sourceBytes = 0
let brotliBytes = 0
let gzipBytes = 0
let compressedFiles = 0

// Nén lần lượt để build ổn định trên VPS ít RAM, đặc biệt với model WASM lớn.
for (const filePath of files) {
  const { size } = await stat(filePath)
  if (size < minimumBytes) continue

  const source = await readFile(filePath)
  const brotliOutput = await brotli(source, {
    params: {
      [constants.BROTLI_PARAM_QUALITY]: 5,
      [constants.BROTLI_PARAM_SIZE_HINT]: source.length,
    },
  })
  const gzipOutput = await gzipCompress(source, { level: 6 })

  // Không tạo biến thể nếu nén tiết kiệm chưa tới 5%.
  if (brotliOutput.length <= source.length * 0.95) await writeFile(`${filePath}.br`, brotliOutput)
  if (gzipOutput.length <= source.length * 0.95) await writeFile(`${filePath}.gz`, gzipOutput)

  sourceBytes += source.length
  brotliBytes += brotliOutput.length
  gzipBytes += gzipOutput.length
  compressedFiles++
}

const percent = bytes => sourceBytes ? Math.round((1 - bytes / sourceBytes) * 100) : 0
console.log(`Precompress: ${compressedFiles} tệp · Brotli giảm ${percent(brotliBytes)}% · Gzip giảm ${percent(gzipBytes)}%.`)
