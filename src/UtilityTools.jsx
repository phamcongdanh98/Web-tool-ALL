import { useEffect, useMemo, useRef, useState } from 'react'
import { buildRenamedFileNames, parsePublicHttpUrl, transformRedactionRegion } from '../lib/browser-utility.js'
import { useLanguage } from './i18n.jsx'

const megabyte = 1024 * 1024
const formatBytes = (bytes = 0) => {
  if (!bytes) return '0 KB'
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** index).toFixed(index ? 2 : 0)} ${units[index]}`
}

const colorLuminance = color => {
  const values = /^#([0-9a-f]{6})$/i.exec(color)?.[1].match(/.{2}/g)?.map(value => parseInt(value, 16) / 255) || [0, 0, 0]
  const [red, green, blue] = values.map(value => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

const contrastRatio = (first, second) => {
  const light = Math.max(colorLuminance(first), colorLuminance(second))
  const dark = Math.min(colorLuminance(first), colorLuminance(second))
  return (light + 0.05) / (dark + 0.05)
}

function ToolShell({ title, eyebrow, description, close, children, wide = false }) {
  const { tx } = useLanguage()
  return <div className="modal-shade" role="dialog" aria-modal="true" aria-label={title}>
    <section className={`tool-modal utility-modal ${wide ? 'tool-modal-wide' : ''}`}>
      <button className="close" type="button" aria-label={tx('Đóng công cụ', 'Close tool')} onClick={close}>×</button>
      <div className="modal-heading"><i>✦</i><div><p>{eyebrow}</p><h2>{title}</h2></div></div>
      <p className="modal-copy">{description}</p>
      {children}
    </section>
  </div>
}

function QrCreateTool({ close }) {
  const { locale, tx } = useLanguage()
  const canvasRef = useRef(null)
  const [kind, setKind] = useState('url')
  const [content, setContent] = useState('https://congcuweb.duckdns.org')
  const [size, setSize] = useState(512)
  const [errorLevel, setErrorLevel] = useState('M')
  const [darkColor, setDarkColor] = useState('#111827')
  const [lightColor, setLightColor] = useState('#ffffff')
  const [downloadUrl, setDownloadUrl] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => () => { if (downloadUrl) URL.revokeObjectURL(downloadUrl) }, [downloadUrl])
  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(async () => {
      setLoading(true)
      const normalized = content.trim()
      const bytes = new TextEncoder().encode(normalized).length
      if (!normalized) { setMessage(tx('Hãy nhập nội dung cần đưa vào mã QR.', 'Enter the content to encode in the QR code.')); setLoading(false); return }
      if (bytes > 1000) { setMessage(tx(`Nội dung đang có ${bytes} byte; giới hạn an toàn là 1.000 byte.`, `The content is ${bytes} bytes; the safe limit is 1,000 bytes.`)); setLoading(false); return }
      if (kind === 'url' && !parsePublicHttpUrl(normalized)) { setMessage(tx('Liên kết phải bắt đầu bằng http:// hoặc https://.', 'The link must start with http:// or https://.')); setLoading(false); return }
      if (contrastRatio(darkColor, lightColor) < 4.5) { setMessage(tx('Hai màu quá gần nhau. Hãy tăng tương phản để máy quét đọc ổn định.', 'These colors are too similar. Increase contrast for reliable scanning.')); setLoading(false); return }
      try {
        const [{ default: QRCode }, { default: jsQR }] = await Promise.all([import('qrcode'), import('jsqr')])
        if (cancelled || !canvasRef.current) return
        await QRCode.toCanvas(canvasRef.current, normalized, {
          width: size,
          margin: 4,
          errorCorrectionLevel: errorLevel,
          color: { dark: darkColor, light: lightColor },
        })
        const context = canvasRef.current.getContext('2d', { willReadFrequently: true })
        const image = context.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height)
        const verification = jsQR(image.data, image.width, image.height, { inversionAttempts: 'dontInvert' })
        if (verification?.data !== normalized) throw new Error(tx('Màu hoặc nội dung này chưa tạo được QR đọc ổn định.', 'These colors or this content did not produce a reliably readable QR code.'))
        const blob = await new Promise(resolve => canvasRef.current.toBlob(resolve, 'image/png'))
        if (!blob || cancelled) return
        const nextUrl = URL.createObjectURL(blob)
        setDownloadUrl(current => { if (current) URL.revokeObjectURL(current); return nextUrl })
        setMessage(tx(`Đã kiểm tra đọc lại thành công · ${bytes} byte · mức sửa lỗi ${errorLevel}.`, `Verified by reading it back · ${bytes} bytes · error correction ${errorLevel}.`))
      } catch (error) {
        if (!cancelled) setMessage(error.message || tx('Không thể tạo mã QR từ nội dung này.', 'Unable to create a QR code from this content.'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 220)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [content, darkColor, errorLevel, kind, lightColor, size, tx])

  return <ToolShell title={tx('Tạo mã QR', 'Create QR Code')} eyebrow={tx('TIỆN ÍCH QR', 'QR UTILITY')} description={tx('Tạo và kiểm tra QR ngay trong trình duyệt. Nội dung không được gửi lên máy chủ.', 'Create and verify a QR code in your browser. Its content is never sent to the server.')} close={close} wide>
    <div className="utility-grid qr-create-grid">
      <div className="utility-preview qr-preview-card">
        <span className="utility-label">{tx('BẢN XEM TRƯỚC', 'PREVIEW')}</span>
        <canvas ref={canvasRef} aria-label={tx('Bản xem trước mã QR', 'QR code preview')} />
        <p>{loading ? tx('Đang kiểm tra khả năng quét…', 'Verifying scan reliability…') : message}</p>
      </div>
      <div className="utility-controls">
        <div className="control-group"><span>{tx('Loại nội dung', 'Content type')}</span><div className="option-cards"><button type="button" className={kind === 'url' ? 'active' : ''} onClick={() => setKind('url')}><b>{tx('Liên kết', 'Link')}</b><small>{tx('Chỉ nhận HTTP/HTTPS', 'HTTP/HTTPS only')}</small></button><button type="button" className={kind === 'text' ? 'active' : ''} onClick={() => setKind('text')}><b>{tx('Văn bản', 'Text')}</b><small>{tx('Hỗ trợ tiếng Việt UTF-8', 'UTF-8 supported')}</small></button></div></div>
        <div className="control-group"><label>{tx('Nội dung', 'Content')}<textarea rows="5" maxLength="1000" value={content} onChange={event => setContent(event.target.value)} placeholder={kind === 'url' ? 'https://example.com' : tx('Nhập nội dung cần chia sẻ', 'Enter content to share')} /></label><small>{new TextEncoder().encode(content).length.toLocaleString(locale)} / 1,000 bytes</small></div>
        <div className="utility-control-row"><div className="control-group"><label>{tx('Kích thước', 'Size')}<select value={size} onChange={event => setSize(Number(event.target.value))}><option value="256">256 px</option><option value="512">512 px</option><option value="768">768 px</option></select></label></div><div className="control-group"><label>{tx('Sửa lỗi', 'Error correction')}<select value={errorLevel} onChange={event => setErrorLevel(event.target.value)}><option value="M">M — {tx('cân bằng', 'balanced')}</option><option value="Q">Q — {tx('bền hơn', 'more resilient')}</option><option value="H">H — {tx('cao nhất', 'highest')}</option></select></label></div></div>
        <div className="utility-control-row"><div className="control-group"><label className="color-control">{tx('Màu mã', 'Code color')}<input type="color" value={darkColor} onChange={event => setDarkColor(event.target.value)} /></label></div><div className="control-group"><label className="color-control">{tx('Màu nền', 'Background color')}<input type="color" value={lightColor} onChange={event => setLightColor(event.target.value)} /></label></div></div>
        <a className={`primary utility-download ${!downloadUrl || loading ? 'disabled' : ''}`} href={downloadUrl || undefined} download={tx('ma-qr.png', 'qr-code.png')} aria-disabled={!downloadUrl || loading}>{tx('Tải QR dạng PNG', 'Download QR as PNG')} <b>↓</b></a>
      </div>
    </div>
  </ToolShell>
}

function QrReadTool({ close }) {
  const { tx } = useLanguage()
  const canvasRef = useRef(null)
  const [file, setFile] = useState(null)
  const [decoded, setDecoded] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const safeLink = useMemo(() => parsePublicHttpUrl(decoded), [decoded])

  const readFile = async picked => {
    if (!picked) return
    if (picked.size > 15 * megabyte) return setMessage(tx('Ảnh QR không được vượt quá 15 MB.', 'The QR image must be 15 MB or smaller.'))
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(picked.type)) return setMessage(tx('Chỉ nhận ảnh JPG, PNG hoặc WebP.', 'Only JPG, PNG and WebP images are supported.'))
    setLoading(true); setMessage(tx('Đang đọc mã QR trên ảnh…', 'Reading the QR code from the image…')); setDecoded(''); setFile(picked)
    let bitmap
    try {
      try { bitmap = await createImageBitmap(picked, { imageOrientation: 'from-image' }) }
      catch { bitmap = await createImageBitmap(picked) }
      if (bitmap.width * bitmap.height > 30_000_000) throw new Error(tx('Ảnh vượt quá giới hạn 30 megapixel.', 'The image exceeds the 30-megapixel limit.'))
      const scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height))
      const width = Math.max(1, Math.round(bitmap.width * scale))
      const height = Math.max(1, Math.round(bitmap.height * scale))
      const canvas = canvasRef.current
      canvas.width = width; canvas.height = height
      const context = canvas.getContext('2d', { willReadFrequently: true })
      context.drawImage(bitmap, 0, 0, width, height)
      const image = context.getImageData(0, 0, width, height)
      const { default: jsQR } = await import('jsqr')
      const result = jsQR(image.data, width, height, { inversionAttempts: 'dontInvert' }) || jsQR(image.data, width, height, { inversionAttempts: 'onlyInvert' })
      if (!result) throw new Error(tx('Không tìm thấy mã QR rõ ràng trong ảnh. Hãy thử ảnh thẳng, đủ sáng và không bị cắt viền.', 'No clear QR code was found. Try a straight, well-lit image with the full border visible.'))
      const points = [result.location.topLeftCorner, result.location.topRightCorner, result.location.bottomRightCorner, result.location.bottomLeftCorner]
      context.beginPath(); context.moveTo(points[0].x, points[0].y)
      points.slice(1).forEach(point => context.lineTo(point.x, point.y))
      context.closePath(); context.lineWidth = Math.max(3, width / 180); context.strokeStyle = '#4f46e5'; context.stroke()
      setDecoded(result.data)
      setMessage(tx('Đã đọc thành công một mã QR. PDFTools không tự động mở liên kết để bảo vệ bạn.', 'QR code read successfully. PDFTools does not open links automatically, for your safety.'))
    } catch (error) {
      setMessage(error.message || tx('Không thể đọc mã QR từ ảnh này.', 'Unable to read a QR code from this image.'))
    } finally {
      bitmap?.close(); setLoading(false)
    }
  }

  const copy = async () => {
    try { await navigator.clipboard.writeText(decoded); setMessage(tx('Đã sao chép nội dung QR.', 'QR content copied.')) }
    catch { setMessage(tx('Trình duyệt không cho phép sao chép tự động. Hãy chọn nội dung và sao chép thủ công.', 'The browser blocked automatic copying. Select the content and copy it manually.')) }
  }

  return <ToolShell title={tx('Đọc mã QR', 'Read QR Code')} eyebrow={tx('TIỆN ÍCH QR', 'QR UTILITY')} description={tx('Tải ảnh QR để đọc cục bộ. Kết quả luôn được hiển thị trước và không tự mở đường dẫn.', 'Load a QR image and read it locally. The result is always shown first and links never open automatically.')} close={close} wide={Boolean(file)}>
    {!file ? <label className="drop-zone"><input className="drop-file-input" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" onChange={event => readFile(event.target.files?.[0])} /><span>⌗</span><b>{tx('Kéo thả hoặc chọn ảnh QR', 'Drop or choose a QR image')}</b><small>{tx('JPG, PNG, WebP · tối đa 15 MB và 30 megapixel', 'JPG, PNG, WebP · up to 15 MB and 30 megapixels')}</small></label> : <div className="utility-grid qr-reader-grid">
      <div className="utility-preview qr-reader-preview"><span className="utility-label">{tx('VÙNG QR ĐÃ NHẬN DIỆN', 'DETECTED QR AREA')}</span><canvas ref={canvasRef} /><button type="button" className="secondary-button" onClick={() => { setFile(null); setDecoded(''); setMessage('') }}>{tx('Chọn ảnh khác', 'Choose another image')}</button></div>
      <div className="utility-controls">
        <div className="utility-file-fact"><span><small>{tx('Tệp ảnh', 'Image file')}</small><b>{file.name}</b></span><span><small>{tx('Dung lượng', 'Size')}</small><b>{formatBytes(file.size)}</b></span></div>
        <div className="control-group"><label>{tx('Nội dung đã đọc', 'Decoded content')}<textarea className="decoded-output" readOnly rows="8" value={decoded} placeholder={loading ? tx('Đang nhận diện…', 'Detecting…') : tx('Chưa có kết quả', 'No result yet')} /></label></div>
        {safeLink && <div className="safe-link-card"><small>{tx('Liên kết HTTP/HTTPS', 'HTTP/HTTPS link')}</small><strong>{safeLink.hostname}</strong><span>{safeLink.href}</span><a href={safeLink.href} target="_blank" rel="noopener noreferrer">{tx('Mở sau khi kiểm tra', 'Open after checking')} <b>↗</b></a></div>}
        <button type="button" className="primary" disabled={!decoded || loading} onClick={copy}>{tx('Sao chép nội dung', 'Copy content')}</button>
      </div>
    </div>}
    {message && <p className={`result ${decoded ? 'success' : ''}`}>{message}</p>}
  </ToolShell>
}

function BatchRenameTool({ close }) {
  const { tx } = useLanguage()
  const [files, setFiles] = useState([])
  const [pattern, setPattern] = useState('{name}-{n}')
  const [prefix, setPrefix] = useState('')
  const [suffix, setSuffix] = useState('')
  const [start, setStart] = useState(1)
  const [digits, setDigits] = useState(2)
  const [progress, setProgress] = useState(0)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [downloadUrl, setDownloadUrl] = useState('')
  const mapping = useMemo(() => buildRenamedFileNames(files, { pattern, prefix, suffix, start, digits }), [digits, files, pattern, prefix, start, suffix])

  useEffect(() => () => { if (downloadUrl) URL.revokeObjectURL(downloadUrl) }, [downloadUrl])
  useEffect(() => { setDownloadUrl(current => { if (current) URL.revokeObjectURL(current); return '' }); setProgress(0) }, [digits, files, pattern, prefix, start, suffix])

  const choose = selected => {
    const picked = Array.from(selected || [])
    const total = picked.reduce((sum, file) => sum + file.size, 0)
    if (picked.length > 100) return setMessage(tx('Mỗi lượt chỉ đổi tên tối đa 100 tệp.', 'Up to 100 files can be renamed at once.'))
    if (total > 50 * megabyte) return setMessage(tx('Tổng dung lượng không được vượt quá 50 MB.', 'The total size must not exceed 50 MB.'))
    setFiles(picked); setMessage(picked.length ? tx('Hãy kiểm tra bảng tên mới trước khi tạo ZIP.', 'Review the new names before creating the ZIP.') : '')
  }

  const createZip = async () => {
    if (!mapping.length) return setMessage(tx('Hãy chọn tệp trước khi tạo ZIP.', 'Choose files before creating the ZIP.'))
    setLoading(true); setProgress(0); setMessage(tx('Đang đóng gói tệp với tên mới…', 'Packaging files with their new names…'))
    try {
      const { default: JSZip } = await import('jszip')
      const zip = new JSZip()
      mapping.forEach(item => zip.file(item.nextName, item.file, { binary: true, date: new Date(item.file.lastModified || Date.now()) }))
      const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE', streamFiles: true }, metadata => setProgress(Math.round(metadata.percent)))
      const nextUrl = URL.createObjectURL(blob)
      setDownloadUrl(current => { if (current) URL.revokeObjectURL(current); return nextUrl })
      setMessage(tx(`Hoàn tất ${mapping.length} tệp · nội dung không đổi, chỉ đổi tên trong ZIP.`, `${mapping.length} files completed · content unchanged; only names inside the ZIP were updated.`))
    } catch (error) {
      setMessage(error.message || tx('Không thể tạo tệp ZIP.', 'Unable to create the ZIP file.'))
    } finally { setLoading(false) }
  }

  return <ToolShell title={tx('Đổi tên file hàng loạt', 'Batch Rename Files')} eyebrow={tx('TIỆN ÍCH TỆP', 'FILE UTILITY')} description={tx('Xem trước tên mới rồi tải một tệp ZIP. Trình duyệt không thể tự đổi tên tệp gốc trên ổ đĩa của bạn.', 'Preview the new names and download one ZIP. Browsers cannot rename the original files on your drive.')} close={close} wide={Boolean(files.length)}>
    {!files.length ? <label className="drop-zone"><input className="drop-file-input" type="file" multiple onChange={event => choose(event.target.files)} /><span>⇧</span><b>{tx('Chọn nhiều tệp cần đổi tên', 'Choose files to rename')}</b><small>{tx('Tối đa 100 tệp · 50 MB tổng cộng · xử lý ngay trong trình duyệt', 'Up to 100 files · 50 MB total · processed in your browser')}</small></label> : <div className="utility-grid rename-grid">
      <div className="rename-preview">
        <div className="rename-preview-heading"><span><b>{tx(`${files.length} tệp`, `${files.length} files`)}</b><small>{formatBytes(files.reduce((sum, file) => sum + file.size, 0))}</small></span><button type="button" onClick={() => setFiles([])}>{tx('Chọn lại', 'Choose again')}</button></div>
        <div className="rename-table" role="table" aria-label={tx('Xem trước tên tệp', 'File name preview')}><div className="rename-row heading" role="row"><span>{tx('Tên cũ', 'Original name')}</span><span>{tx('Tên mới', 'New name')}</span></div>{mapping.map(item => <div className="rename-row" role="row" key={`${item.originalName}-${item.nextName}`}><span title={item.originalName}>{item.originalName}</span><b title={item.nextName}>{item.nextName}</b></div>)}</div>
      </div>
      <div className="utility-controls">
        <div className="control-group"><label>{tx('Mẫu tên', 'Name pattern')}<input value={pattern} onChange={event => setPattern(event.target.value)} placeholder="{name}-{n}" /></label><small>{tx('Dùng', 'Use')} <b>{'{name}'}</b> {tx('cho tên cũ,', 'for the original name,')} <b>{'{n}'}</b> {tx('cho số thứ tự,', 'for the sequence number, and')} <b>{'{ext}'}</b> {tx('nếu muốn đặt phần mở rộng trong mẫu.', 'to include the extension in the pattern.')}</small></div>
        <div className="utility-control-row"><div className="control-group"><label>{tx('Tiền tố', 'Prefix')}<input value={prefix} onChange={event => setPrefix(event.target.value)} placeholder={tx('du-an-', 'project-')} /></label></div><div className="control-group"><label>{tx('Hậu tố', 'Suffix')}<input value={suffix} onChange={event => setSuffix(event.target.value)} placeholder="-2026" /></label></div></div>
        <div className="utility-control-row"><div className="control-group"><label>{tx('Số bắt đầu', 'Starting number')}<input type="number" min="0" max="999999" value={start} onChange={event => setStart(event.target.value)} /></label></div><div className="control-group"><label>{tx('Số chữ số', 'Number of digits')}<select value={digits} onChange={event => setDigits(event.target.value)}><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option></select></label></div></div>
        <button type="button" className="primary" disabled={loading} onClick={createZip}>{loading ? tx(`Đang tạo ZIP ${progress}%…`, `Creating ZIP ${progress}%…`) : tx('Tạo ZIP với tên mới  →', 'Create ZIP with new names  →')}</button>
        {downloadUrl && <a className="primary utility-download" href={downloadUrl} download={tx('tep-da-doi-ten.zip', 'renamed-files.zip')}>{tx('Tải tệp ZIP', 'Download ZIP')} <b>↓</b></a>}
        {message && <p className={`result ${downloadUrl ? 'success' : ''}`}>{message}</p>}
      </div>
    </div>}
    {!files.length && message && <p className="result">{message}</p>}
  </ToolShell>
}

const makeRegion = index => ({ id: `${Date.now()}-${index}`, x: 10 + index * 3, y: 12 + index * 3, w: 34, h: 14 })

function ImageRedactTool({ close }) {
  const { language, tx } = useLanguage()
  const stageRef = useRef(null)
  const dragRef = useRef(null)
  const [file, setFile] = useState(null)
  const [sourceUrl, setSourceUrl] = useState('')
  const [dimensions, setDimensions] = useState(null)
  const [regions, setRegions] = useState([makeRegion(0)])
  const [selectedId, setSelectedId] = useState(null)
  const [color, setColor] = useState('#111827')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => () => { if (sourceUrl) URL.revokeObjectURL(sourceUrl) }, [sourceUrl])
  useEffect(() => () => { if (result?.url) URL.revokeObjectURL(result.url) }, [result?.url])

  const invalidateResult = () => setResult(null)
  const choose = async picked => {
    if (!picked) return
    if (picked.size > 25 * megabyte) return setMessage(tx('Ảnh không được vượt quá 25 MB.', 'The image must be 25 MB or smaller.'))
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(picked.type)) return setMessage(tx('Chỉ nhận ảnh JPG, PNG hoặc WebP.', 'Only JPG, PNG and WebP images are supported.'))
    let bitmap
    try {
      try { bitmap = await createImageBitmap(picked, { imageOrientation: 'from-image' }) }
      catch { bitmap = await createImageBitmap(picked) }
      if (bitmap.width * bitmap.height > 30_000_000) throw new Error(tx('Ảnh vượt quá giới hạn 30 megapixel.', 'The image exceeds the 30-megapixel limit.'))
      const nextUrl = URL.createObjectURL(picked)
      setSourceUrl(current => { if (current) URL.revokeObjectURL(current); return nextUrl })
      setFile(picked); setDimensions({ width: bitmap.width, height: bitmap.height })
      setRegions([makeRegion(0)]); setSelectedId(null); setResult(null)
      setMessage(tx('Kéo vùng che tới vị trí cần ẩn; kéo bốn góc để thay đổi kích thước.', 'Drag a redaction block over the area to hide; drag its corners to resize.'))
    } catch (error) { setMessage(error.message || tx('Không thể đọc ảnh này.', 'Unable to read this image.')) }
    finally { bitmap?.close() }
  }

  const updateRegion = (id, transform) => {
    invalidateResult()
    setRegions(current => current.map(region => region.id === id ? transform(region) : region))
  }
  const beginRegion = (event, region, forcedHandle) => {
    event.preventDefault(); event.stopPropagation(); setSelectedId(region.id)
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { x: event.clientX, y: event.clientY, region, handle: forcedHandle || event.target.dataset.handle || 'move' }
  }
  const moveRegion = (event, id) => {
    const drag = dragRef.current
    const bounds = stageRef.current?.getBoundingClientRect()
    if (!drag || !bounds || drag.region.id !== id) return
    const dx = (event.clientX - drag.x) / bounds.width * 100
    const dy = (event.clientY - drag.y) / bounds.height * 100
    const next = transformRedactionRegion(drag.region, drag.handle, dx, dy)
    updateRegion(id, () => next)
  }
  const addRegion = () => {
    if (regions.length >= 20) return setMessage(tx('Mỗi ảnh chỉ được tạo tối đa 20 vùng che.', 'Each image supports up to 20 redaction areas.'))
    const next = makeRegion(regions.length)
    invalidateResult(); setRegions(current => [...current, next]); setSelectedId(next.id)
  }
  const removeRegion = id => {
    invalidateResult(); setRegions(current => current.filter(region => region.id !== id)); setSelectedId(null)
  }
  const process = async () => {
    if (!file || !regions.length) return setMessage(tx('Hãy chọn ảnh và tạo ít nhất một vùng che.', 'Choose an image and create at least one redaction area.'))
    setLoading(true); setResult(null); setMessage(tx('Đang làm phẳng các vùng che và xóa metadata ảnh…', 'Flattening redactions and removing image metadata…'))
    try {
      const form = new FormData()
      form.append('file', file); form.append('regions', JSON.stringify(regions)); form.append('redactionColor', color); form.append('format', 'png')
      const response = await fetch('/api/tools/image/redact', { method: 'POST', body: form })
      if (!response.ok) {
        const serverMessage = (await response.json().catch(() => ({}))).message
        throw new Error(language === 'en' ? 'The server could not redact this image.' : (serverMessage || 'Không thể che thông tin trên ảnh.'))
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      setResult({ url, size: blob.size, name: `${file.name.replace(/\.[^/.]+$/, '')}-${tx('da-che', 'redacted')}.png` })
      setMessage(tx(`Hoàn tất ${regions.length} vùng che đặc · ảnh đã làm phẳng và loại metadata EXIF/GPS.`, `${regions.length} solid redactions completed · the image was flattened and EXIF/GPS metadata removed.`))
    } catch (error) { setMessage(error.message || tx('Không thể xử lý ảnh này.', 'Unable to process this image.')) }
    finally { setLoading(false) }
  }

  return <ToolShell title={tx('Che thông tin trên ảnh', 'Redact Information in an Image')} eyebrow={tx('BẢO VỆ RIÊNG TƯ', 'PRIVACY PROTECTION')} description={tx('Đặt các khối màu đặc lên số điện thoại, địa chỉ hoặc dữ liệu nhạy cảm. Kết quả được làm phẳng thật, không chỉ che bằng CSS.', 'Place solid color blocks over phone numbers, addresses or sensitive data. The result is genuinely flattened—not merely hidden with CSS.')} close={close} wide={Boolean(file)}>
    {!file ? <label className="drop-zone"><input className="drop-file-input" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" onChange={event => choose(event.target.files?.[0])} /><span>▰</span><b>{tx('Chọn ảnh cần che thông tin', 'Choose an image to redact')}</b><small>{tx('JPG, PNG, WebP · tối đa 25 MB và 30 megapixel', 'JPG, PNG, WebP · up to 25 MB and 30 megapixels')}</small></label> : <>
      <div className="selected-file-bar"><div><i>IMG</i><span><b>{file.name}</b><small>{formatBytes(file.size)} · {dimensions?.width} × {dimensions?.height}px</small></span></div><label className="file-change-button">{tx('Đổi ảnh', 'Replace image')}<input type="file" accept=".jpg,.jpeg,.png,.webp" onChange={event => choose(event.target.files?.[0])} /></label></div>
      <div className="utility-grid redact-grid">
        <div className="redact-workspace">
          <div className="redact-toolbar"><button type="button" onClick={addRegion}>＋ {tx('Thêm vùng che', 'Add redaction')}</button><button type="button" disabled={!selectedId} onClick={() => removeRegion(selectedId)}>{tx('Xóa vùng chọn', 'Delete selected')}</button><button type="button" onClick={() => { invalidateResult(); setRegions([]); setSelectedId(null) }}>{tx('Xóa tất cả', 'Delete all')}</button><span>{tx(`${regions.length}/20 vùng`, `${regions.length}/20 areas`)}</span></div>
          <div className="redact-viewport"><div className="redact-stage" ref={stageRef}><img src={sourceUrl} alt={tx('Ảnh đang chọn vùng cần che', 'Image with redaction areas')} draggable="false" />{regions.map((region, index) => <div key={region.id} className={`redact-region ${selectedId === region.id ? 'selected' : ''}`} style={{ left: `${region.x}%`, top: `${region.y}%`, width: `${region.w}%`, height: `${region.h}%`, background: color }} onPointerDown={event => beginRegion(event, region)} onPointerMove={event => moveRegion(event, region.id)} onPointerUp={() => { dragRef.current = null }} onPointerCancel={() => { dragRef.current = null }}><b>{index + 1}</b>{['nw', 'ne', 'sw', 'se'].map(handle => <i key={handle} className={`redact-handle ${handle}`} data-handle={handle} onPointerDown={event => beginRegion(event, region, handle)} onPointerMove={event => moveRegion(event, region.id)} onPointerUp={() => { dragRef.current = null }} onPointerCancel={() => { dragRef.current = null }} />)}</div>)}</div></div>
          <p className="crop-help">{tx('Kéo khối để di chuyển · kéo bốn góc để thu phóng · khối màu sẽ được ghi vĩnh viễn vào ảnh kết quả', 'Drag a block to move it · drag the corners to resize · the solid color is permanently written into the result')}</p>
        </div>
        <div className="utility-controls">
          <div className="control-group"><label className="color-control">{tx('Màu che đặc', 'Solid redaction color')}<input type="color" value={color} onChange={event => { invalidateResult(); setColor(event.target.value) }} /></label><small>{tx('Màu đặc an toàn hơn blur/pixel hóa đối với dữ liệu riêng tư.', 'Solid color is safer than blur or pixelation for private data.')}</small></div>
          <div className="control-note"><b>{tx('Che thật, không thể chọn lại nội dung', 'Permanent redaction')}</b><span>{tx('Máy chủ dùng Sharp làm phẳng vùng che vào pixel PNG và không giữ metadata EXIF/GPS. Hãy luôn xem lại ảnh kết quả trước khi chia sẻ.', 'The server uses Sharp to flatten redactions into PNG pixels and removes EXIF/GPS metadata. Always review the result before sharing.')}</span></div>
          <button type="button" className="primary" disabled={loading || !regions.length} onClick={process}>{loading ? tx('Đang xử lý…', 'Processing…') : tx(`Tạo ảnh đã che ${regions.length} vùng  →`, `Create image with ${regions.length} redactions  →`)}</button>
          {message && <p className={`result ${result ? 'success' : ''}`}>{message}</p>}
          {result && <div className="redact-result"><span className="utility-label">{tx('KẾT QUẢ ĐÃ LÀM PHẲNG', 'FLATTENED RESULT')}</span><img src={result.url} alt={tx('Ảnh sau khi che thông tin', 'Redacted image')} /><div><span><small>{tx('Dung lượng', 'Size')}</small><b>{formatBytes(result.size)}</b></span><a className="primary" href={result.url} download={result.name}>{tx('Tải ảnh PNG', 'Download PNG')} <b>↓</b></a></div></div>}
        </div>
      </div>
    </>}
    {!file && message && <p className="result">{message}</p>}
  </ToolShell>
}

function LinkShortenerInfo({ close }) {
  const { tx } = useLanguage()
  return <ToolShell title={tx('Rút gọn liên kết', 'Shorten Link')} eyebrow={tx('ĐANG NGHIÊN CỨU', 'IN RESEARCH')} description={tx('Tính năng chưa được mở công khai để tránh tạo liên kết mất sau mỗi lần deploy hoặc bị lợi dụng cho spam và lừa đảo.', 'This feature is not public yet, preventing links from disappearing after deploys or being abused for spam and phishing.')} close={close}>
    <div className="planned-tool-card"><i>↗</i><h3>{tx('Chưa gắn nhãn “Sẵn sàng”', 'Not marked “Ready” yet')}</h3><p>{tx('Một dịch vụ rút gọn link đáng tin cậy cần cơ sở dữ liệu bền vững, sao lưu, ngày hết hạn, giới hạn tần suất và cơ chế báo cáo/chặn liên kết nguy hiểm.', 'A trustworthy link shortener needs durable storage, backups, expiration, rate limits, and reporting and blocking for dangerous links.')}</p><ul><li>{tx('QR vẫn tạo được từ liên kết đầy đủ ngay bây giờ.', 'You can already create a QR code from the full link.')}</li><li>{tx('Phiên bản sau chỉ mở khi link không mất qua restart/deploy.', 'A future version will launch only when links survive restarts and deploys.')}</li><li>{tx('Chỉ chuyển hướng HTTP/HTTPS và không tự mở link cho người dùng.', 'It will redirect only HTTP/HTTPS links and never open them automatically.')}</li></ul><button type="button" className="primary" onClick={close}>{tx('Đã hiểu', 'Got it')}</button></div>
  </ToolShell>
}

export default function UtilityToolModal({ mode, close }) {
  if (mode === 'qr-create') return <QrCreateTool close={close} />
  if (mode === 'qr-read') return <QrReadTool close={close} />
  if (mode === 'batch-rename') return <BatchRenameTool close={close} />
  if (mode === 'image-redact') return <ImageRedactTool close={close} />
  return <LinkShortenerInfo close={close} />
}
