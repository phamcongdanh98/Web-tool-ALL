import {
  Document,
  HorizontalPositionRelativeFrom,
  ImageRun,
  Packer,
  Paragraph,
  SectionType,
  TextWrappingType,
  VerticalPositionRelativeFrom,
} from 'docx'

const pointsToTwips = points => Math.max(1, Math.round(points * 20))
const pointsToPixels = points => Math.max(1, Math.round(points * 96 / 72))

const normalizeImageType = mimeType => mimeType === 'image/png' ? 'png' : 'jpg'

const makePageSection = (page, index) => {
  const pageWidth = Number(page.width)
  const pageHeight = Number(page.height)
  if (!(pageWidth > 0) || !(pageHeight > 0)) throw new Error(`Kích thước trang ${index + 1} không hợp lệ.`)
  if (!page.data) throw new Error(`Trang ${index + 1} chưa có ảnh hiển thị.`)

  return {
    properties: {
      type: SectionType.NEXT_PAGE,
      page: {
        size: { width: pointsToTwips(pageWidth), height: pointsToTwips(pageHeight) },
        margin: { top: 0, right: 0, bottom: 0, left: 0, header: 0, footer: 0, gutter: 0 },
      },
    },
    children: [new Paragraph({
      spacing: { before: 0, after: 0, line: 20 },
      children: [new ImageRun({
        type: normalizeImageType(page.mimeType),
        data: page.data,
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
        },
        altText: {
          title: `Trang PDF ${index + 1}`,
          description: 'Ảnh toàn trang dùng để giữ nguyên hình thức của PDF trong Word.',
          name: `pdf-page-${index + 1}`,
        },
      })],
    })],
  }
}

export const createExactWordDocument = pages => {
  if (!Array.isArray(pages) || !pages.length) throw new Error('Không có trang PDF để tạo Word.')
  return new Document({
    creator: 'PDFTools · Danh Phạm',
    title: 'PDF chuyển sang Word — giữ nguyên hình thức',
    subject: 'Mỗi trang Word giữ nguyên hình thức của trang PDF nguồn',
    description: 'Trang PDF được kết xuất thành ảnh toàn trang để giữ dấu, chữ ký hiển thị, font, khoảng cách và lề. Nội dung chữ không thể chỉnh sửa riêng lẻ.',
    sections: pages.map(makePageSection),
  })
}

export const createExactWordBlob = pages => Packer.toBlob(createExactWordDocument(pages))
export const createExactWordBuffer = pages => Packer.toBuffer(createExactWordDocument(pages))
