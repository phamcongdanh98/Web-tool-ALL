import { readFile } from 'node:fs/promises'

const appSource = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
const diagrams = await readFile(new URL('../DIAGRAMS.md', import.meta.url), 'utf8')

const extractNames = (start, end) => {
  const startIndex = appSource.indexOf(start)
  const endIndex = appSource.indexOf(end, startIndex + start.length)
  if (startIndex < 0 || endIndex < 0) throw new Error(`Không tìm thấy khối ${start}.`)
  const block = appSource.slice(startIndex, endIndex)
  return [...block.matchAll(/name:\s*'([^']+)'/g)].map(match => match[1])
}

const pdfNames = extractNames('const pdfTools = [', 'const imageTools = [')
const imageNames = extractNames('const imageTools = [', 'const footerProducts = [')
const allNames = [...pdfNames, ...imageNames]

const expectedCounts = [
  `PDFTools · ${allNames.length} công cụ`,
  `${pdfNames.length} công cụ PDF`,
  `${imageNames.length} công cụ ảnh`,
]

for (const text of expectedCounts) {
  if (!diagrams.includes(text)) throw new Error(`DIAGRAMS.md chưa cập nhật số lượng: ${text}`)
}

for (const name of allNames) {
  if (!diagrams.includes(name)) throw new Error(`DIAGRAMS.md thiếu chức năng: ${name}`)
}

console.log(`Sơ đồ hợp lệ: ${pdfNames.length} công cụ PDF · ${imageNames.length} công cụ ảnh.`)
