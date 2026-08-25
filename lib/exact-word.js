import {
  AlignmentType,
  Document,
  HorizontalPositionRelativeFrom,
  ImageRun,
  LineRuleType,
  Packer,
  Paragraph,
  SectionType,
  TextRun,
  TextWrappingType,
  VerticalAnchor,
  VerticalPositionRelativeFrom,
  WpsShapeRun,
} from 'docx'

const pointsToTwips = points => Math.max(1, Math.round(points * 20))
const pointsToPixels = points => Math.max(1, Math.round(points * 96 / 72))
const pointsToEmus = points => Math.round(points * 12700)

const normalizeImageType = mimeType => mimeType === 'image/png' ? 'png' : 'jpg'

const makeBackgroundRun = (page, index, pageWidth, pageHeight) => {
  if (!page.background?.data) return null
  return new ImageRun({
    type: normalizeImageType(page.background.mimeType),
    data: page.background.data,
    transformation: {
      width: pointsToPixels(pageWidth),
      height: pointsToPixels(pageHeight),
    },
    floating: {
      horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, offset: 0 },
      verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, offset: 0 },
      wrap: { type: TextWrappingType.NONE },
      allowOverlap: true,
      behindDocument: true,
      layoutInCell: false,
      lockAnchor: true,
      zIndex: 0,
    },
    altText: {
      title: `Đồ họa trang PDF ${index + 1}`,
      description: 'Ảnh nền chỉ chứa đường kẻ, hình ảnh, con dấu và chữ ký; phần chữ PDF được dựng thành text box Word.',
      name: `pdf-graphics-${index + 1}`,
    },
  })
}

const makeTextBoxRun = (item, pageIndex, itemIndex) => {
  const fontSize = Math.max(4, Number(item.fontSize) || 10)
  const width = Math.max(Number(item.width) || fontSize, fontSize * 0.45)
  const height = Math.max(Number(item.height) || fontSize * 1.25, fontSize * 1.12)
  return new WpsShapeRun({
    type: 'wps',
    transformation: {
      width: pointsToPixels(width),
      height: pointsToPixels(height),
      rotation: Number(item.rotation) || 0,
    },
    floating: {
      horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, offset: pointsToEmus(Number(item.x) || 0) },
      verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, offset: pointsToEmus(Number(item.y) || 0) },
      wrap: { type: TextWrappingType.NONE },
      allowOverlap: true,
      behindDocument: false,
      layoutInCell: false,
      lockAnchor: true,
      zIndex: itemIndex + 1,
    },
    outline: { type: 'noFill' },
    bodyProperties: {
      margins: { top: 0, right: 0, bottom: 0, left: 0 },
      verticalAnchor: VerticalAnchor.TOP,
      noAutoFit: true,
    },
    nonVisualProperties: { txBox: '1' },
    altText: {
      title: `Văn bản PDF trang ${pageIndex + 1}, khối ${itemIndex + 1}`,
      description: 'Văn bản có thể chỉnh sửa được đặt theo tọa độ của PDF nguồn.',
      name: `pdf-text-${pageIndex + 1}-${itemIndex + 1}`,
    },
    children: [new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { before: 0, after: 0, line: pointsToTwips(height), lineRule: LineRuleType.EXACT },
      children: [new TextRun({
        text: String(item.text || ''),
        font: item.font || 'Arial',
        size: Math.max(8, Math.round(fontSize * 2)),
        bold: Boolean(item.bold),
        italics: Boolean(item.italics),
        color: item.color || '000000',
        scale: Math.max(20, Math.min(600, Math.round(Number(item.scale) || 100))),
        characterSpacing: Number.isFinite(item.characterSpacing) ? Math.round(item.characterSpacing * 20) : undefined,
        rightToLeft: item.direction === 'rtl',
      })],
    })],
  })
}

const makePageSection = (page, index) => {
  const pageWidth = Number(page.width)
  const pageHeight = Number(page.height)
  if (!(pageWidth > 0) || !(pageHeight > 0)) throw new Error(`Kích thước trang ${index + 1} không hợp lệ.`)
  if (!Array.isArray(page.textItems) || !page.textItems.length) throw new Error(`Trang ${index + 1} không có lớp chữ để tạo Word bố cục chính xác.`)
  const runs = [makeBackgroundRun(page, index, pageWidth, pageHeight), ...page.textItems.map((item, itemIndex) => makeTextBoxRun(item, index, itemIndex))].filter(Boolean)

  return {
    properties: {
      type: SectionType.NEXT_PAGE,
      page: {
        size: { width: pointsToTwips(pageWidth), height: pointsToTwips(pageHeight) },
        margin: { top: 0, right: 0, bottom: 0, left: 0, header: 0, footer: 0, gutter: 0 },
      },
    },
    children: [new Paragraph({ spacing: { before: 0, after: 0, line: 20 }, children: runs })],
  }
}

export const createExactWordDocument = pages => {
  if (!Array.isArray(pages) || !pages.length) throw new Error('Không có trang PDF để tạo Word.')
  return new Document({
    creator: 'PDFTools · Danh Phạm',
    title: 'PDF chuyển sang Word — bố cục chính xác',
    subject: 'Văn bản PDF được đặt trong các text box Word theo tọa độ trang nguồn',
    description: 'Đường kẻ, hình ảnh, con dấu và chữ ký được giữ ở nền; chữ PDF là text box Word có thể chỉnh sửa theo đúng vị trí, font, cỡ và độ rộng gần nhất.',
    compatibility: { ignoreVerticalAlignmentInTextboxes: true },
    sections: pages.map(makePageSection),
  })
}

export const createExactWordBlob = pages => Packer.toBlob(createExactWordDocument(pages))
export const createExactWordBuffer = pages => Packer.toBuffer(createExactWordDocument(pages))
