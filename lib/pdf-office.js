import path from 'node:path'
import sharp from 'sharp'
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeightRule,
  HorizontalPositionRelativeFrom,
  ImageRun,
  LineRuleType,
  Packer,
  Paragraph,
  SectionType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  TextWrappingType,
  UnderlineType,
  VerticalAlign,
  VerticalMergeType,
  VerticalPositionRelativeFrom,
  WidthType,
} from 'docx'
import ExcelJS from '@excel.js/exceljs'
import { getDocument, ImageKind, OPS, Util } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { createPowerPoint } from './pptx.js'

const standardFontDataUrl = path.resolve('node_modules/pdfjs-dist/standard_fonts') + path.sep
const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value))
const pointToTwip = value => Math.max(0, Math.round(value * 20))
const pointToEmu = value => Math.max(0, Math.round(value * 12700))
const pointToPixel = value => Math.max(1, value * 96 / 72)
const normalizedText = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/đ/g, 'd')
const noBorders = Object.fromEntries(['top', 'right', 'bottom', 'left', 'insideHorizontal', 'insideVertical'].map(side => [side, { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }]))
const tableBorders = Object.fromEntries(['top', 'right', 'bottom', 'left', 'insideHorizontal', 'insideVertical'].map(side => [side, { style: BorderStyle.SINGLE, size: 6, color: '000000' }]))
const rasterImageOperations = new Set([
  OPS.paintImageMaskXObject,
  OPS.paintImageMaskXObjectGroup,
  OPS.paintImageXObject,
  OPS.paintImageXObjectRepeat,
  OPS.paintInlineImageXObject,
  OPS.paintInlineImageXObjectGroup,
].filter(Number.isFinite))
const maximumEmbeddedGraphicsPerPage = 50
const maximumEmbeddedGraphicPixels = 20_000_000

const resolvePageObject = (page, name, timeoutMs = 4000) => {
  try {
    if (page.objs.has(name)) return Promise.resolve(page.objs.get(name))
  } catch {}
  return new Promise(resolve => {
    let settled = false
    const timeout = setTimeout(() => {
      settled = true
      resolve(null)
    }, timeoutMs)
    page.objs.get(name, value => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      resolve(value)
    })
  })
}

const applyMatrix = (matrix, x, y) => [
  matrix[0] * x + matrix[2] * y + matrix[4],
  matrix[1] * x + matrix[3] * y + matrix[5],
]

const makeGraphicPng = async image => {
  if (!image?.data || !Number.isFinite(image.width) || !Number.isFinite(image.height)) return null
  if (image.width <= 0 || image.height <= 0 || image.width * image.height > maximumEmbeddedGraphicPixels) return null
  const channels = image.kind === ImageKind.RGBA_32BPP ? 4 : image.kind === ImageKind.RGB_24BPP ? 3 : 0
  if (!channels) return null
  const data = Buffer.from(image.data.buffer, image.data.byteOffset, image.data.byteLength)
  return sharp(data, { raw: { width: image.width, height: image.height, channels } })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer()
}

const extractPageGraphics = async (page, viewport, operatorList) => {
  if (!operatorList) return []
  let matrix = [1, 0, 0, 1, 0, 0]
  let annotationState = null
  const stack = []
  const paints = []
  for (let index = 0; index < operatorList.fnArray.length && paints.length < maximumEmbeddedGraphicsPerPage; index++) {
    const operation = operatorList.fnArray[index]
    const args = operatorList.argsArray[index]
    if (operation === OPS.beginAnnotation) {
      annotationState = { matrix: [...matrix], stack: stack.map(value => [...value]) }
      matrix = Util.transform(args?.[2] || [1, 0, 0, 1, 0, 0], args?.[3] || [1, 0, 0, 1, 0, 0])
      stack.length = 0
    } else if (operation === OPS.endAnnotation) {
      matrix = annotationState?.matrix || [1, 0, 0, 1, 0, 0]
      stack.splice(0, stack.length, ...(annotationState?.stack || []))
      annotationState = null
    } else if (operation === OPS.save) stack.push([...matrix])
    else if (operation === OPS.restore) matrix = stack.pop() || matrix
    else if (operation === OPS.transform) matrix = Util.transform(matrix, args)
    else if (operation === OPS.paintFormXObjectBegin) {
      stack.push([...matrix])
      if (args?.[0]) matrix = Util.transform(matrix, Array.from(args[0]))
    } else if (operation === OPS.paintFormXObjectEnd) matrix = stack.pop() || matrix
    else if (operation === OPS.paintImageXObject) paints.push({ name: args?.[0], matrix: [...matrix] })
    else if (operation === OPS.paintInlineImageXObject) paints.push({ image: args?.[0], matrix: [...matrix] })
  }

  const graphics = []
  for (const paint of paints) {
    const image = paint.image || await resolvePageObject(page, paint.name)
    const data = await makeGraphicPng(image).catch(() => null)
    if (!data) continue
    const viewportPoints = [
      applyMatrix(paint.matrix, 0, 0),
      applyMatrix(paint.matrix, 1, 0),
      applyMatrix(paint.matrix, 0, 1),
      applyMatrix(paint.matrix, 1, 1),
    ].map(([x, y]) => viewport.convertToViewportPoint(x, y))
    const xValues = viewportPoints.map(point => point[0])
    const yValues = viewportPoints.map(point => point[1])
    const x = Math.min(...xValues)
    const y = Math.min(...yValues)
    const width = Math.max(...xValues) - x
    const height = Math.max(...yValues) - y
    if (![x, y, width, height].every(Number.isFinite) || width < 2 || height < 2) continue
    graphics.push({ data, x, y, width, height })
  }
  return graphics
}

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

const countDigitalSignatures = buffer => {
  const source = Buffer.from(buffer).toString('latin1')
  const byteRanges = source.match(/\/ByteRange\s*\[/g)?.length || 0
  const signatureFields = source.match(/\/FT\s*\/Sig\b/g)?.length || 0
  return Math.max(byteRanges, signatureFields)
}

const classifySource = ({ creator, producer, hasStructTree, pages, characterCount, signatureCount }) => {
  const metadataText = `${creator} ${producer}`.normalize('NFKD').replace(/[®™]/g, '')
  const hasWordMetadata = /(microsoft\s*(?:office\s*)?word|word\s+for\s+mac|acrobat\s+pdfmaker[^\n]*word)/i.test(metadataText)
  const textPageCount = pages.filter(page => page.characterCount > 0).length
  const imageOnlyPageCount = pages.filter(page => !page.characterCount && page.hasRasterImage).length
  const blankPageCount = pages.length - textPageCount - imageOnlyPageCount
  const kind = !characterCount ? 'scan'
    : imageOnlyPageCount ? 'mixed'
      : signatureCount ? 'signed-document'
      : hasWordMetadata ? 'word-export'
        : 'digital'
  return {
    kind,
    creator,
    producer,
    hasStructTree,
    hasWordMetadata,
    signatureCount,
    textPageCount,
    imageOnlyPageCount,
    blankPageCount,
  }
}

export const extractPdfText = async (buffer, { includeFontDetails = false, includeGraphics = false } = {}) => {
  const loadingTask = getDocument({ data: new Uint8Array(buffer), standardFontDataUrl })
  try {
    const pdf = await loadingTask.promise
    if (pdf.numPages > 100) {
      const error = new Error('PDF tối đa 100 trang cho chuyển đổi Office để tránh quá tải VPS.')
      error.statusCode = 413
      throw error
    }
    const metadata = await pdf.getMetadata().catch(() => ({ info: {} }))
    const signatures = await pdf.getSignatures().catch(() => null)
    const fieldObjects = signatures?.length ? null : await pdf.getFieldObjects().catch(() => null)
    const signatureFieldCount = fieldObjects
      ? Object.values(fieldObjects).flat().filter(field => field?.type === 'signature').length
      : 0
    const signatureCount = signatures?.length || signatureFieldCount || countDigitalSignatures(buffer)
    const pages = []
    let characterCount = 0
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber)
      const viewport = page.getViewport({ scale: 1 })
      const content = await page.getTextContent({ disableNormalization: false })
      const rawCharacterCount = content.items.reduce((sum, item) => sum + String(item.str || '').replace(/\s/g, '').length, 0)
      let operatorList
      if (includeFontDetails || includeGraphics || !rawCharacterCount) operatorList = await page.getOperatorList()
      const fontObjects = new Map()
      if (includeFontDetails) {
        for (const item of content.items) {
          if (!item.fontName || fontObjects.has(item.fontName)) continue
          try { fontObjects.set(item.fontName, page.commonObjs.get(item.fontName)) }
          catch { fontObjects.set(item.fontName, null) }
        }
      }
      const lines = groupTextLines(content.items, content.styles || {}, fontObjects)
      const graphics = includeGraphics ? await extractPageGraphics(page, viewport, operatorList) : []
      const text = lines.map(line => line.text).join('\n')
      const pageCharacterCount = text.replace(/\s/g, '').length
      characterCount += pageCharacterCount
      pages.push({
        number: pageNumber,
        width: viewport.width,
        height: viewport.height,
        lines,
        graphics,
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
      signatureCount,
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
  const left = clamp(Math.min(...page.lines.map(line => line.x)), 24, 90)
  const rightEdges = page.lines.map(line => line.x + line.width)
  const right = clamp(page.width - Math.max(...rightEdges), 24, 90)
  const topEdges = page.lines.map(line => page.height - line.y - line.height)
  const top = clamp(Math.min(...topEdges), 24, 72)
  return { top, right, bottom: 30, left }
}

const paragraphAlignment = (line, page, layout) => {
  const contentWidth = page.width - layout.left - layout.right
  const middleDistance = Math.abs(line.x + line.width / 2 - page.width / 2)
  if (line.width < contentWidth * 0.88 && middleDistance <= Math.max(10, page.width * 0.035)) return AlignmentType.CENTER
  const rightDistance = Math.abs(line.x + line.width - (page.width - layout.right))
  if (line.x > page.width * 0.45 && rightDistance <= 14) return AlignmentType.RIGHT
  return AlignmentType.LEFT
}

const makeTextRun = (run, text = run.text, { underline = false } = {}) => new TextRun({
  text,
  size: Math.round(clamp(run.height, 7, 42) * 2),
  font: run.font,
  bold: run.bold,
  italics: run.italics,
  underline: underline ? { type: UnderlineType.SINGLE } : undefined,
})

const joinedRuns = (lines, options = {}) => {
  const children = []
  lines.forEach((line, lineIndex) => {
    line.runs.forEach((run, runIndex) => {
      const value = run.text.replace(/\s+/g, ' ').trim()
      if (!value) return
      const prefix = children.length && (lineIndex > 0 || runIndex > 0) ? ' ' : ''
      children.push(makeTextRun(run, `${prefix}${value}`, options))
    })
  })
  return children
}

const splitRunGroups = line => {
  const groups = []
  for (const run of line.runs) {
    if (!groups.length || run.tabBefore) groups.push([])
    groups.at(-1).push(run)
  }
  return groups.filter(group => group.length)
}

const createCellParagraph = (runs, {
  alignment = AlignmentType.LEFT,
  bold = false,
  italics = false,
  underline = false,
  before = 0,
  after = 0,
  line = 240,
} = {}) => {
  const sourceRuns = Array.isArray(runs) ? runs : []
  const children = sourceRuns.length
    ? sourceRuns.map((run, index) => new TextRun({
        text: `${index ? ' ' : ''}${run.text.replace(/\s+/g, ' ').trim()}`,
        size: Math.round(clamp(run.height, 7, 42) * 2),
        font: run.font,
        bold: bold || run.bold,
        italics: italics || run.italics,
        underline: underline ? { type: UnderlineType.SINGLE } : undefined,
      }))
    : [new TextRun('')]
  return new Paragraph({
    alignment,
    spacing: { before: pointToTwip(before), after: pointToTwip(after), line, lineRule: LineRuleType.AUTO },
    children,
  })
}

const createHeaderTable = (lines, page, layout) => {
  if (!lines.length) return null
  const grouped = lines.map(splitRunGroups)
  const splitCandidates = grouped
    .filter(groups => groups.length > 1)
    .map(groups => {
      const leftEnd = Math.max(...groups[0].map(run => run.x + run.width))
      const rightStart = Math.min(...groups[1].map(run => run.x))
      return (leftEnd + rightStart) / 2
    })
  const contentWidth = page.width - layout.left - layout.right
  const split = splitCandidates.length ? percentile(splitCandidates, 0.5) : page.width / 2
  const leftWidth = clamp(split - layout.left, contentWidth * 0.34, contentWidth * 0.58)
  const widths = [pointToTwip(leftWidth), pointToTwip(contentWidth - leftWidth)]
  const rows = grouped.map((groups, index) => {
    const nextLine = lines[index + 1]
    const sourceGap = nextLine ? lines[index].y - nextLine.y : 18
    return new TableRow({
      height: { value: pointToTwip(clamp(sourceGap, 16, 42)), rule: HeightRule.ATLEAST },
      children: [0, 1].map(column => new TableCell({
        width: { size: widths[column], type: WidthType.DXA },
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 0, bottom: 0, left: pointToTwip(2), right: pointToTwip(2) },
        borders: noBorders,
        children: [createCellParagraph(groups[column] || [], {
          alignment: column === 1 && index >= 2 ? AlignmentType.RIGHT : AlignmentType.CENTER,
          underline: index === 1,
        })],
      })),
    })
  })
  return new Table({
    width: { size: pointToTwip(contentWidth), type: WidthType.DXA },
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    borders: noBorders,
    rows,
  })
}

const startsNewFlowBlock = (previous, current, page, layout) => {
  const gap = previous.y - current.y
  const previousText = previous.text.trim()
  const currentText = current.text.trim()
  const previousAlignment = paragraphAlignment(previous, page, layout)
  const currentAlignment = paragraphAlignment(current, page, layout)
  if (previousAlignment !== currentAlignment && (previousAlignment !== AlignmentType.LEFT || currentAlignment !== AlignmentType.LEFT)) return true
  if (/^(?:[+•·]|\d+[.)]\s)/u.test(currentText)) return true
  if (gap > Math.max(previous.height, current.height) * 1.55) return true
  if (/[.:;!?)]$/.test(previousText) && current.x > previous.x + 16) return true
  return false
}

const groupFlowLines = (lines, page, layout) => {
  const blocks = []
  for (const line of lines) {
    const previousLine = blocks.at(-1)?.at(-1)
    if (!previousLine || startsNewFlowBlock(previousLine, line, page, layout)) blocks.push([line])
    else blocks.at(-1).push(line)
  }
  return blocks
}

const createFlowParagraph = (block, page, layout, blockIndex = 0, initialBefore = 5) => {
  const alignmentHint = paragraphAlignment(block[0], page, layout)
  const isCentered = block.length === 1 && alignmentHint === AlignmentType.CENTER
  const isRight = block.length === 1 && alignmentHint === AlignmentType.RIGHT
  const isList = /^(?:[+•·]|\d+[.)]\s)/u.test(block[0].text.trim())
  const minimumX = Math.min(...block.map(line => line.x))
  const firstLineOffset = Math.max(0, block[0].x - minimumX)
  const leftIndent = Math.max(0, minimumX - layout.left)
  return new Paragraph({
    alignment: isCentered ? AlignmentType.CENTER : isRight ? AlignmentType.RIGHT : block.length > 1 && !isList ? AlignmentType.JUSTIFIED : AlignmentType.LEFT,
    indent: !isCentered && !isRight ? {
      left: pointToTwip(leftIndent),
      firstLine: firstLineOffset > 8 ? pointToTwip(firstLineOffset) : undefined,
    } : undefined,
    spacing: {
      before: pointToTwip(blockIndex ? 7 : initialBefore),
      after: 0,
      line: 276,
      lineRule: LineRuleType.AUTO,
    },
    widowControl: false,
    children: joinedRuns(block),
  })
}

const findDetectedTable = (lines, page, layout) => {
  const sttIndex = lines.findIndex(line => normalizedText(line.text).split(/\s+/).includes('stt'))
  if (sttIndex < 0) return null
  const preceding = lines[sttIndex - 1]
  const startIndex = preceding && /dang giai quyet|tong so|ket qua/u.test(normalizedText(preceding.text)) ? sttIndex - 1 : sttIndex
  let endIndex = sttIndex
  for (let index = sttIndex + 1; index < lines.length; index++) {
    const groups = splitRunGroups(lines[index])
    const text = normalizedText(lines[index].text)
    if (groups.length < 2 && !/^tong\b/u.test(text) && !/con han|qua han/u.test(text)) break
    endIndex = index
  }
  if (endIndex - sttIndex < 2) return null

  const sourceLines = lines.slice(startIndex, endIndex + 1)
  const allRuns = sourceLines.flatMap(line => line.runs)
  const tableLeft = Math.max(layout.left, Math.min(...allRuns.map(run => run.x)) - 8)
  const tableRight = Math.min(page.width - layout.right, Math.max(...allRuns.map(run => run.x + run.width)) + 30, page.width - layout.right - 16)
  const tableWidth = tableRight - tableLeft
  const fractions = [0.1, 0.43, 0.25, 0.22]
  const widths = fractions.map(fraction => pointToTwip(tableWidth * fraction))
  const boundaries = [
    tableLeft + tableWidth * fractions[0],
    tableLeft + tableWidth * (fractions[0] + fractions[1]),
    tableLeft + tableWidth * (fractions[0] + fractions[1] + fractions[2]),
  ]
  const distribute = line => {
    const columns = [[], [], [], []]
    for (const run of line.runs) {
      const center = run.x + run.width / 2
      const column = center < boundaries[0] ? 0 : center < boundaries[1] ? 1 : center < boundaries[2] ? 2 : 3
      columns[column].push(run)
    }
    return columns
  }

  const sttLine = lines[sttIndex]
  const headerTop = startIndex < sttIndex ? lines[startIndex] : null
  const subHeader = lines.slice(sttIndex + 1, endIndex + 1).find(line => /con han|qua han/u.test(normalizedText(line.text)))
  const sttColumns = distribute(sttLine)
  const topColumns = headerTop ? distribute(headerTop) : [[], [], [], []]
  const subColumns = subHeader ? distribute(subHeader) : [[], [], [], []]
  const headerRows = [new TableRow({
    tableHeader: true,
    height: { value: pointToTwip(28), rule: HeightRule.ATLEAST },
    children: [
      new TableCell({ width: { size: widths[0], type: WidthType.DXA }, verticalMerge: VerticalMergeType.RESTART, verticalAlign: VerticalAlign.CENTER, borders: tableBorders, margins: { top: 80, bottom: 80, left: 20, right: 20 }, children: [createCellParagraph(sttColumns[0], { alignment: AlignmentType.CENTER, bold: true })] }),
      new TableCell({ width: { size: widths[1], type: WidthType.DXA }, verticalMerge: VerticalMergeType.RESTART, verticalAlign: VerticalAlign.CENTER, borders: tableBorders, margins: { top: 80, bottom: 80, left: 100, right: 100 }, children: [createCellParagraph(sttColumns[1], { alignment: AlignmentType.CENTER, bold: true })] }),
      new TableCell({ width: { size: widths[2] + widths[3], type: WidthType.DXA }, columnSpan: 2, verticalAlign: VerticalAlign.CENTER, borders: tableBorders, margins: { top: 80, bottom: 80, left: 80, right: 80 }, children: [createCellParagraph([...topColumns[2], ...topColumns[3]], { alignment: AlignmentType.CENTER, bold: true })] }),
    ],
  }), new TableRow({
    tableHeader: true,
    height: { value: pointToTwip(24), rule: HeightRule.ATLEAST },
    children: [
      new TableCell({ width: { size: widths[0], type: WidthType.DXA }, verticalMerge: VerticalMergeType.CONTINUE, verticalAlign: VerticalAlign.CENTER, borders: tableBorders, children: [createCellParagraph([])] }),
      new TableCell({ width: { size: widths[1], type: WidthType.DXA }, verticalMerge: VerticalMergeType.CONTINUE, verticalAlign: VerticalAlign.CENTER, borders: tableBorders, children: [createCellParagraph([])] }),
      new TableCell({ width: { size: widths[2], type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER, borders: tableBorders, margins: { top: 70, bottom: 70, left: 80, right: 80 }, children: [createCellParagraph(subColumns[2], { alignment: AlignmentType.CENTER, bold: true })] }),
      new TableCell({ width: { size: widths[3], type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER, borders: tableBorders, margins: { top: 70, bottom: 70, left: 80, right: 80 }, children: [createCellParagraph(subColumns[3], { alignment: AlignmentType.CENTER, bold: true })] }),
    ],
  })]

  const usedHeaderLines = new Set([headerTop, sttLine, subHeader].filter(Boolean))
  const dataRows = sourceLines.filter(line => !usedHeaderLines.has(line)).map(line => {
    const columns = distribute(line)
    const isTotal = /^tong\b/u.test(normalizedText(line.text))
    if (isTotal) {
      return new TableRow({
        height: { value: pointToTwip(24), rule: HeightRule.ATLEAST },
        children: [
          new TableCell({ width: { size: widths[0] + widths[1], type: WidthType.DXA }, columnSpan: 2, verticalAlign: VerticalAlign.CENTER, borders: tableBorders, margins: { top: 70, bottom: 70, left: 100, right: 100 }, children: [createCellParagraph([...columns[0], ...columns[1]], { alignment: AlignmentType.CENTER, bold: true })] }),
          new TableCell({ width: { size: widths[2], type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER, borders: tableBorders, margins: { top: 70, bottom: 70, left: 80, right: 80 }, children: [createCellParagraph(columns[2], { alignment: AlignmentType.CENTER })] }),
          new TableCell({ width: { size: widths[3], type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER, borders: tableBorders, margins: { top: 70, bottom: 70, left: 80, right: 80 }, children: [createCellParagraph(columns[3], { alignment: AlignmentType.CENTER })] }),
        ],
      })
    }
    return new TableRow({
      height: { value: pointToTwip(24), rule: HeightRule.ATLEAST },
      children: columns.map((runs, column) => new TableCell({
        width: { size: widths[column], type: WidthType.DXA },
        verticalAlign: VerticalAlign.CENTER,
        borders: tableBorders,
        margins: { top: 70, bottom: 70, left: 100, right: 100 },
        children: [createCellParagraph(runs, { alignment: column === 1 ? AlignmentType.LEFT : AlignmentType.CENTER })],
      })),
    })
  })

  return {
    startIndex,
    endIndex,
    element: new Table({
      width: { size: pointToTwip(tableWidth), type: WidthType.DXA },
      indent: { size: pointToTwip(Math.max(0, tableLeft - layout.left)), type: WidthType.DXA },
      columnWidths: widths,
      layout: TableLayoutType.FIXED,
      borders: tableBorders,
      rows: [...headerRows, ...dataRows],
    }),
  }
}

const createFooterTable = (lines, page, layout) => {
  if (!lines.length) return null
  const split = page.width / 2
  const leftLines = []
  const rightLines = []
  for (const line of lines) {
    const leftRuns = line.runs.filter(run => run.x + run.width / 2 < split)
    const rightRuns = line.runs.filter(run => run.x + run.width / 2 >= split)
    if (leftRuns.length) leftLines.push({ ...line, runs: leftRuns })
    if (rightRuns.length) rightLines.push({ ...line, runs: rightRuns })
  }
  const contentWidth = page.width - layout.left - layout.right
  const widths = [pointToTwip(contentWidth * 0.48), pointToTwip(contentWidth * 0.52)]
  const paragraphForFooterLine = (line, index, side) => {
    const previous = side === 'right' ? rightLines[index - 1] : null
    const sourceGap = previous ? Math.max(0, previous.y - line.y - previous.height - 4) : 0
    return createCellParagraph(line.runs, {
      alignment: side === 'right' ? AlignmentType.CENTER : AlignmentType.LEFT,
      before: sourceGap,
      line: 240,
    })
  }
  return new Table({
    width: { size: pointToTwip(contentWidth), type: WidthType.DXA },
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    borders: noBorders,
    rows: [new TableRow({ children: [
      new TableCell({ width: { size: widths[0], type: WidthType.DXA }, verticalAlign: VerticalAlign.TOP, borders: noBorders, margins: { top: 0, bottom: 0, left: pointToTwip(20), right: pointToTwip(4) }, children: leftLines.map((line, index) => paragraphForFooterLine(line, index, 'left')) }),
      new TableCell({ width: { size: widths[1], type: WidthType.DXA }, verticalAlign: VerticalAlign.TOP, borders: noBorders, margins: { top: 0, bottom: 0, left: pointToTwip(4), right: pointToTwip(4) }, children: rightLines.map((line, index) => paragraphForFooterLine(line, index, 'right')) }),
    ] })],
  })
}

const createGraphicsLayer = page => {
  if (!page.graphics?.length) return null
  return new Paragraph({
    spacing: { before: 0, after: 0, line: 1, lineRule: LineRuleType.EXACT },
    children: page.graphics.map((graphic, index) => new ImageRun({
      type: 'png',
      data: graphic.data,
      transformation: {
        width: pointToPixel(graphic.width),
        height: pointToPixel(graphic.height),
      },
      floating: {
        horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, offset: pointToEmu(graphic.x) },
        verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, offset: pointToEmu(graphic.y) },
        allowOverlap: true,
        behindDocument: false,
        layoutInCell: false,
        wrap: { type: TextWrappingType.NONE },
        zIndex: 1000 + index,
      },
    })),
  })
}

const createStructuredWordContent = (page, layout) => {
  const table = findDetectedTable(page.lines, page, layout)
  const salutationIndex = page.lines.findIndex(line => /^kinh gui\b/u.test(normalizedText(line.text)))
  const footerIndex = page.lines.findIndex((line, index) => index > (table?.endIndex ?? -1) && /noi nhan|giam doc|chu tich|pho giam doc/u.test(normalizedText(line.text)))
  const headerLines = salutationIndex > 0 ? page.lines.slice(0, salutationIndex) : []
  const contentStart = salutationIndex > 0 ? salutationIndex : 0
  const contentEnd = footerIndex >= 0 ? footerIndex : page.lines.length
  const children = []
  const graphicsLayer = createGraphicsLayer(page)
  if (graphicsLayer) children.push(graphicsLayer)
  const header = createHeaderTable(headerLines, page, layout)
  if (header) children.push(header)

  const addFlow = (lines, initialBefore = 5) => groupFlowLines(lines, page, layout).forEach((block, index) => children.push(createFlowParagraph(block, page, layout, index, initialBefore)))
  if (table) {
    addFlow(page.lines.slice(contentStart, table.startIndex), 10)
    children.push(new Paragraph({ spacing: { before: pointToTwip(6), after: 0, line: 1, lineRule: LineRuleType.EXACT }, children: [new TextRun('')] }))
    children.push(table.element)
    addFlow(page.lines.slice(table.endIndex + 1, contentEnd), 22)
  } else addFlow(page.lines.slice(contentStart, contentEnd))

  const footer = footerIndex >= 0 ? createFooterTable(page.lines.slice(footerIndex), page, layout) : null
  if (footer) {
    children.push(new Paragraph({ spacing: { before: pointToTwip(14), after: 0, line: 1, lineRule: LineRuleType.EXACT }, children: [new TextRun('')] }))
    children.push(footer)
  }
  return { children: children.length ? children : [new Paragraph({ text: '' })], detectedTables: table ? 1 : 0 }
}

const createWord = async (pages, source) => {
  let detectedTables = 0
  let embeddedGraphics = 0
  const sections = pages.map(page => {
    const layout = pageLayout(page)
    const structured = createStructuredWordContent(page, layout)
    detectedTables += structured.detectedTables
    embeddedGraphics += page.graphics?.length || 0
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
      children: structured.children,
    }
  })
  const document = new Document({
    creator: 'PDFTools · Danh Phạm',
    title: 'PDF chuyển sang Word',
    subject: source.kind === 'word-export' ? 'Tái dựng có cấu trúc từ PDF có dấu hiệu xuất bởi Microsoft Word' : 'Tái dựng có cấu trúc từ PDF',
    description: 'DOCX có đoạn văn và bảng chỉnh sửa được, đồng thời giữ ảnh, dấu và chữ ký nhìn thấy được từ PDF; không phải tệp Word gốc và không giữ hiệu lực chữ ký số.',
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
  return { buffer: await Packer.toBuffer(document), detectedTables, embeddedGraphics }
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
  const { pages, characterCount, source } = await extractPdfText(buffer, { includeFontDetails: format === 'word', includeGraphics: format === 'word' })
  const common = { pages: pages.length, characterCount, source }
  if (format === 'word') {
    const word = await createWord(pages, source)
    return { buffer: word.buffer, detectedTables: word.detectedTables, embeddedGraphics: word.embeddedGraphics, extension: 'docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', layoutMode: 'structured-reconstruction', ...common }
  }
  if (format === 'excel') return { buffer: await createExcel(pages), extension: 'xlsx', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ...common }
  if (format === 'powerpoint') return { buffer: await createPowerPoint(pages), extension: 'pptx', type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', ...common }
  if (format === 'text') return { buffer: createText(pages), extension: 'txt', type: 'text/plain; charset=utf-8', ...common }
  const error = new Error('Định dạng chuyển đổi không được hỗ trợ.')
  error.statusCode = 404
  throw error
}
