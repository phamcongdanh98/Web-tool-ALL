import path from 'node:path'
import { Document, PageBreak, Packer, Paragraph, TextRun } from 'docx'
import ExcelJS from '@excel.js/exceljs'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { createPowerPoint } from './pptx.js'

const standardFontDataUrl = path.resolve('node_modules/pdfjs-dist/standard_fonts') + path.sep

const groupTextLines = items => {
  const positioned = items
    .filter(item => typeof item.str === 'string' && item.str.trim() && Array.isArray(item.transform))
    .map(item => ({
      text: item.str.trim(),
      x: Number(item.transform[4]) || 0,
      y: Number(item.transform[5]) || 0,
      width: Math.max(Number(item.width) || 0, 1),
      height: Math.max(Number(item.height) || Math.abs(Number(item.transform[3])) || 10, 1),
    }))
    .sort((first, second) => Math.abs(second.y - first.y) > 2 ? second.y - first.y : first.x - second.x)

  const lines = []
  for (const item of positioned) {
    const previous = lines.at(-1)
    const tolerance = Math.max(2, item.height * 0.45)
    if (!previous || Math.abs(previous.y - item.y) > tolerance) lines.push({ y: item.y, items: [item] })
    else previous.items.push(item)
  }

  return lines.map(line => {
    line.items.sort((first, second) => first.x - second.x)
    const cells = []
    let current = ''
    let previousEnd = null
    let lineStart = line.items[0].x
    for (const item of line.items) {
      const averageCharacterWidth = item.width / Math.max(item.text.length, 1)
      const gap = previousEnd === null ? 0 : item.x - previousEnd
      if (current && gap > Math.max(12, averageCharacterWidth * 2.6)) {
        cells.push(current.trim())
        current = item.text
      } else current += `${current ? ' ' : ''}${item.text}`
      previousEnd = item.x + item.width
    }
    if (current.trim()) cells.push(current.trim())
    return {
      text: cells.join('    '),
      cells,
      x: lineStart,
      y: line.y,
      width: Math.max(...line.items.map(item => item.x + item.width)) - lineStart,
      height: Math.max(...line.items.map(item => item.height)),
    }
  })
}

export const extractPdfText = async buffer => {
  const loadingTask = getDocument({ data: new Uint8Array(buffer), standardFontDataUrl })
  try {
    const pdf = await loadingTask.promise
    if (pdf.numPages > 100) {
      const error = new Error('PDF tối đa 100 trang cho chuyển đổi Office để tránh quá tải VPS.')
      error.statusCode = 413
      throw error
    }
    const pages = []
    let characterCount = 0
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber)
      const viewport = page.getViewport({ scale: 1 })
      const content = await page.getTextContent({ disableNormalization: false })
      const lines = groupTextLines(content.items)
      const text = lines.map(line => line.text).join('\n')
      characterCount += text.replace(/\s/g, '').length
      pages.push({ number: pageNumber, width: viewport.width, height: viewport.height, lines, text })
      page.cleanup?.()
    }
    if (!characterCount) {
      const error = new Error('PDF không có văn bản có thể chọn. Tệp scan cần OCR trước khi chuyển sang Office.')
      error.statusCode = 422
      throw error
    }
    return { pages, characterCount }
  } finally {
    await loadingTask.destroy().catch(() => null)
  }
}

const createWord = async pages => {
  const children = []
  pages.forEach((page, pageIndex) => {
    if (pageIndex) children.push(new Paragraph({ children: [new PageBreak()] }))
    page.lines.forEach(line => children.push(new Paragraph({
      spacing: { after: 80 },
      children: [new TextRun({ text: line.text, size: Math.round(Math.max(9, Math.min(22, line.height)) * 2) })],
    })))
  })
  const document = new Document({
    creator: 'PDFTools · Danh Phạm',
    title: 'PDF chuyển sang Word',
    sections: [{ properties: {}, children }],
  })
  return Packer.toBuffer(document)
}

const createExcel = async pages => {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'PDFTools · Danh Phạm'
  workbook.created = new Date()
  pages.forEach(page => {
    const sheet = workbook.addWorksheet(`Trang ${page.number}`, { views: [{ state: 'frozen', ySplit: 1 }] })
    page.lines.forEach(line => sheet.addRow(line.cells.length ? line.cells : [line.text]))
    const columnCount = Math.max(1, ...page.lines.map(line => line.cells.length))
    for (let column = 1; column <= columnCount; column++) {
      let maximum = 10
      sheet.getColumn(column).eachCell({ includeEmpty: false }, cell => { maximum = Math.max(maximum, String(cell.value || '').length + 2) })
      sheet.getColumn(column).width = Math.min(60, maximum)
      sheet.getColumn(column).alignment = { vertical: 'top', wrapText: true }
    }
  })
  return Buffer.from(await workbook.xlsx.writeBuffer())
}

const createText = pages => Buffer.from(pages.map(page => `--- Trang ${page.number} ---\n${page.text}`).join('\n\n'), 'utf8')

export const convertPdfText = async (buffer, format) => {
  const { pages, characterCount } = await extractPdfText(buffer)
  if (format === 'word') return { buffer: await createWord(pages), extension: 'docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', pages: pages.length, characterCount }
  if (format === 'excel') return { buffer: await createExcel(pages), extension: 'xlsx', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', pages: pages.length, characterCount }
  if (format === 'powerpoint') return { buffer: await createPowerPoint(pages), extension: 'pptx', type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', pages: pages.length, characterCount }
  if (format === 'text') return { buffer: createText(pages), extension: 'txt', type: 'text/plain; charset=utf-8', pages: pages.length, characterCount }
  const error = new Error('Định dạng chuyển đổi không được hỗ trợ.')
  error.statusCode = 404
  throw error
}
