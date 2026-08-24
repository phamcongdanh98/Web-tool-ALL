import path from 'node:path'
import {
  AlignmentType,
  Document,
  LineRuleType,
  Packer,
  Paragraph,
  SectionType,
  Tab,
  TabStopType,
  TextRun,
} from 'docx'
import ExcelJS from '@excel.js/exceljs'
import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { createPowerPoint } from './pptx.js'

const standardFontDataUrl = path.resolve('node_modules/pdfjs-dist/standard_fonts') + path.sep
const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value))
const pointToTwip = value => Math.max(0, Math.round(value * 20))
const rasterImageOperations = new Set([
  OPS.paintImageMaskXObject,
  OPS.paintImageMaskXObjectGroup,
  OPS.paintImageXObject,
  OPS.paintImageXObjectRepeat,
  OPS.paintInlineImageXObject,
  OPS.paintInlineImageXObjectGroup,
].filter(Number.isFinite))

const percentile = (values, ratio) => {
  if (!values.length) return 0
  const sorted = [...values].sort((first, second) => first - second)
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * ratio)))]
}

const fontInformation = fontObject => {
  const originalName = String(fontObject?.name || fontObject?.fallbackName || '')
  const normalized = originalName.replace(/^[A-Z]{6}\+/, '').toLowerCase()
  const font = normalized.includes('calibri') ? 'Calibri'
    : normalized.includes('cambria') ? 'Cambria'
      : /times|serif/.test(normalized) ? 'Times New Roman'
        : /courier|mono|consolas/.test(normalized) ? 'Courier New'
          : /arial|helvetica|sans/.test(normalized) ? 'Arial'
            : 'Arial'
  return {
    font,
    originalName,
    bold: /bold|black|heavy|semibold|demi/.test(normalized),
    italics: /italic|oblique/.test(normalized),
  }
}

const groupTextLines = (items, styles, fontObjects) => {
  const positioned = items
    .filter(item => typeof item.str === 'string' && item.str.trim() && Array.isArray(item.transform))
    .map(item => {
      const font = fontInformation(fontObjects.get(item.fontName))
      return {
        text: item.str.replace(/\s+/g, ' ').trim(),
        x: Number(item.transform[4]) || 0,
        y: Number(item.transform[5]) || 0,
        width: Math.max(Number(item.width) || 0, 1),
        height: Math.max(Number(item.height) || Math.abs(Number(item.transform[3])) || 10, 1),
        font: font.font,
        originalFontName: font.originalName || styles[item.fontName]?.fontFamily || '',
        bold: font.bold,
        italics: font.italics,
      }
    })
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
    const runs = []
    let currentCell = ''
    let previousEnd = null
    const lineStart = line.items[0].x
    for (const item of line.items) {
      const averageCharacterWidth = item.width / Math.max(item.text.length, 1)
      const gap = previousEnd === null ? 0 : item.x - previousEnd
      const tabBefore = previousEnd !== null && gap > Math.max(12, averageCharacterWidth * 2.6)
      const spaceBefore = previousEnd !== null && !tabBefore && gap > Math.max(1.2, averageCharacterWidth * 0.28)
      if (tabBefore) {
        if (currentCell.trim()) cells.push(currentCell.trim())
        currentCell = item.text
      } else currentCell += `${currentCell && spaceBefore ? ' ' : ''}${item.text}`
      runs.push({ ...item, text: `${spaceBefore ? ' ' : ''}${item.text}`, tabBefore })
      previousEnd = item.x + item.width
    }
    if (currentCell.trim()) cells.push(currentCell.trim())
    return {
      text: cells.join('    '),
      cells,
      runs,
      x: lineStart,
      y: line.y,
      width: Math.max(...line.items.map(item => item.x + item.width)) - lineStart,
      height: Math.max(...line.items.map(item => item.height)),
    }
  })
}

const classifySource = ({ creator, producer, hasStructTree, pages, characterCount }) => {
  const metadataText = `${creator} ${producer}`.normalize('NFKD').replace(/[®™]/g, '')
  const hasWordMetadata = /(microsoft\s*(?:office\s*)?word|word\s+for\s+mac|acrobat\s+pdfmaker[^\n]*word)/i.test(metadataText)
  const textPageCount = pages.filter(page => page.characterCount > 0).length
  const imageOnlyPageCount = pages.filter(page => !page.characterCount && page.hasRasterImage).length
  const blankPageCount = pages.length - textPageCount - imageOnlyPageCount
  const kind = !characterCount ? 'scan'
    : imageOnlyPageCount ? 'mixed'
      : hasWordMetadata ? 'word-export'
        : 'digital'
  return {
    kind,
    creator,
    producer,
    hasStructTree,
    hasWordMetadata,
    textPageCount,
    imageOnlyPageCount,
    blankPageCount,
  }
}

export const extractPdfText = async (buffer, { includeFontDetails = false } = {}) => {
  const loadingTask = getDocument({ data: new Uint8Array(buffer), standardFontDataUrl })
  try {
    const pdf = await loadingTask.promise
    if (pdf.numPages > 100) {
      const error = new Error('PDF tối đa 100 trang cho chuyển đổi Office để tránh quá tải VPS.')
      error.statusCode = 413
      throw error
    }
    const metadata = await pdf.getMetadata().catch(() => ({ info: {} }))
    const pages = []
    let characterCount = 0
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber)
      const viewport = page.getViewport({ scale: 1 })
      const content = await page.getTextContent({ disableNormalization: false })
      const rawCharacterCount = content.items.reduce((sum, item) => sum + String(item.str || '').replace(/\s/g, '').length, 0)
      let operatorList
      if (includeFontDetails || !rawCharacterCount) operatorList = await page.getOperatorList()
      const fontObjects = new Map()
      if (includeFontDetails) {
        for (const item of content.items) {
          if (!item.fontName || fontObjects.has(item.fontName)) continue
          try { fontObjects.set(item.fontName, page.commonObjs.get(item.fontName)) }
          catch { fontObjects.set(item.fontName, null) }
        }
      }
      const lines = groupTextLines(content.items, content.styles || {}, fontObjects)
      const text = lines.map(line => line.text).join('\n')
      const pageCharacterCount = text.replace(/\s/g, '').length
      characterCount += pageCharacterCount
      pages.push({
        number: pageNumber,
        width: viewport.width,
        height: viewport.height,
        lines,
        text,
        characterCount: pageCharacterCount,
        hasRasterImage: Boolean(operatorList?.fnArray?.some(operation => rasterImageOperations.has(operation))),
      })
      page.cleanup?.()
    }
    const source = classifySource({
      creator: String(metadata.info?.Creator || ''),
      producer: String(metadata.info?.Producer || ''),
      hasStructTree: Boolean(metadata.hasStructTree),
      pages,
      characterCount,
    })
    if (!characterCount) {
      const error = new Error(source.imageOnlyPageCount
        ? 'PDF scan không có văn bản có thể chọn. Hãy OCR tệp trước rồi mới chuyển sang Word hoặc Office.'
        : 'PDF không có văn bản có thể chọn. Tệp scan cần OCR trước khi chuyển sang Office.')
      error.statusCode = 422
      error.pdfSource = source
      throw error
    }
    return { pages, characterCount, source }
  } finally {
    await loadingTask.destroy().catch(() => null)
  }
}

const pageLayout = page => {
  if (!page.lines.length) return { top: 36, right: 36, bottom: 36, left: 36 }
  const left = clamp(percentile(page.lines.map(line => line.x), 0.2), 36, 90)
  const rightEdges = page.lines.map(line => line.x + line.width)
  const right = clamp(page.width - percentile(rightEdges, 0.8), 36, 90)
  const topEdges = page.lines.map(line => page.height - line.y - line.height)
  const top = clamp(percentile(topEdges, 0.15), 30, 90)
  return { top, right, bottom: 36, left }
}

const paragraphAlignment = (line, page, layout) => {
  const contentWidth = page.width - layout.left - layout.right
  const middleDistance = Math.abs(line.x + line.width / 2 - page.width / 2)
  if (line.width < contentWidth * 0.88 && middleDistance <= Math.max(10, page.width * 0.035)) return AlignmentType.CENTER
  const rightDistance = Math.abs(line.x + line.width - (page.width - layout.right))
  if (line.x > page.width * 0.45 && rightDistance <= 14) return AlignmentType.RIGHT
  return AlignmentType.LEFT
}

const createWordParagraphs = (page, layout) => page.lines.length ? page.lines.map((line, lineIndex) => {
  const previous = page.lines[lineIndex - 1]
  const baselineGap = previous ? previous.y - line.y : 0
  const extraVerticalGap = previous ? clamp(baselineGap - Math.max(previous.height, line.height) * 1.12, 0, 48) : 0
  const alignment = paragraphAlignment(line, page, layout)
  const children = []
  for (const run of line.runs) {
    if (run.tabBefore) children.push(new TextRun({ children: [new Tab()] }))
    children.push(new TextRun({
      text: run.text,
      size: Math.round(clamp(run.height, 7, 42) * 2),
      font: run.font,
      bold: run.bold,
      italics: run.italics,
    }))
  }
  const tabStops = line.runs
    .filter(run => run.tabBefore)
    .map(run => ({ type: TabStopType.LEFT, position: pointToTwip(Math.max(0, run.x - layout.left)) }))
  return new Paragraph({
    alignment,
    indent: alignment === AlignmentType.LEFT ? { left: pointToTwip(Math.max(0, line.x - layout.left)) } : undefined,
    spacing: { before: pointToTwip(extraVerticalGap), after: 0, line: pointToTwip(Math.max(10, line.height * 1.22)), lineRule: LineRuleType.EXACT },
    tabStops: tabStops.length ? tabStops : undefined,
    keepNext: line.height >= 16,
    children: children.length ? children : [new TextRun(line.text)],
  })
}) : [new Paragraph({ text: '' })]

const createWord = async (pages, source) => {
  const sections = pages.map(page => {
    const layout = pageLayout(page)
    return {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: {
          size: { width: pointToTwip(page.width), height: pointToTwip(page.height) },
          margin: {
            top: pointToTwip(layout.top),
            right: pointToTwip(layout.right),
            bottom: pointToTwip(layout.bottom),
            left: pointToTwip(layout.left),
            header: pointToTwip(18),
            footer: pointToTwip(18),
          },
        },
      },
      children: createWordParagraphs(page, layout),
    }
  })
  const document = new Document({
    creator: 'PDFTools · Danh Phạm',
    title: 'PDF chuyển sang Word',
    subject: source.kind === 'word-export' ? 'Tái dựng gần đúng từ PDF có dấu hiệu xuất bởi Microsoft Word' : 'Tái dựng gần đúng từ PDF',
    description: 'DOCX có thể chỉnh sửa được tái dựng từ vị trí và kiểu chữ còn lưu trong PDF; không phải tệp Word gốc.',
    styles: {
      default: {
        document: {
          run: { font: 'Arial', size: 22 },
          paragraph: { spacing: { after: 0 } },
        },
      },
    },
    sections,
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
  const { pages, characterCount, source } = await extractPdfText(buffer, { includeFontDetails: format === 'word' })
  const common = { pages: pages.length, characterCount, source }
  if (format === 'word') return { buffer: await createWord(pages, source), extension: 'docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', layoutMode: 'adaptive-reflow', ...common }
  if (format === 'excel') return { buffer: await createExcel(pages), extension: 'xlsx', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ...common }
  if (format === 'powerpoint') return { buffer: await createPowerPoint(pages), extension: 'pptx', type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', ...common }
  if (format === 'text') return { buffer: createText(pages), extension: 'txt', type: 'text/plain; charset=utf-8', ...common }
  const error = new Error('Định dạng chuyển đổi không được hỗ trợ.')
  error.statusCode = 404
  throw error
}
