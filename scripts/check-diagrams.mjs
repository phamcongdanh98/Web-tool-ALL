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
const imageNames = extractNames('const imageTools = [', 'const utilityTools = [')
const utilityNames = extractNames('const utilityTools = [', 'const footerProducts = [')
const allNames = [...pdfNames, ...imageNames, ...utilityNames]
const unavailableCount = (appSource.match(/ready:\s*false/g) || []).length
const readyCount = allNames.length - unavailableCount

const expectedCounts = [
  `PDFTools · ${allNames.length} công cụ · ${readyCount} sẵn sàng`,
  `${pdfNames.length} công cụ PDF`,
  `${imageNames.length} công cụ ảnh`,
  `${utilityNames.length} công cụ tiện ích`,
]

for (const text of expectedCounts) {
  if (!diagrams.includes(text)) throw new Error(`DIAGRAMS.md chưa cập nhật số lượng: ${text}`)
}

for (const name of allNames) {
  if (!diagrams.includes(name)) throw new Error(`DIAGRAMS.md thiếu chức năng: ${name}`)
}

console.log(`Sơ đồ hợp lệ: ${pdfNames.length} PDF · ${imageNames.length} ảnh · ${utilityNames.length} tiện ích · ${readyCount} sẵn sàng.`)
