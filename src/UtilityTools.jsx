import { useEffect, useMemo, useRef, useState } from 'react'
import { buildRenamedFileNames, parsePublicHttpUrl, transformRedactionRegion } from '../lib/browser-utility.js'

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
  return <div className="modal-shade" role="dialog" aria-modal="true" aria-label={title}>
    <section className={`tool-modal utility-modal ${wide ? 'tool-modal-wide' : ''}`}>
      <button className="close" type="button" aria-label="Đóng công cụ" onClick={close}>×</button>
      <div className="modal-heading"><i>✦</i><div><p>{eyebrow}</p><h2>{title}</h2></div></div>
      <p className="modal-copy">{description}</p>
      {children}
    </section>
  </div>
}

function QrCreateTool({ close }) {
  const canvasRef = useRef(null)
  const [kind, setKind] = useState('url')
  const [content, setContent] = useState('https://congcuweb.duckdns.org')
  const [size, setSize] = useState(512)
  const [errorLevel, setErrorLevel] = useState('M')
  const [darkColor, setDarkColor] = useState('#111827')
  const [lightColor, setLightColor] = useState('#ffffff')
  const [downloadUrl, setDownloadUrl] = useState('')
  const [message, setMessage] = useState('Đang tạo bản xem trước…')
  const [loading, setLoading] = useState(true)

  useEffect(() => () => { if (downloadUrl) URL.revokeObjectURL(downloadUrl) }, [downloadUrl])
  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(async () => {
      setLoading(true)
      const normalized = content.trim()
      const bytes = new TextEncoder().encode(normalized).length
      if (!normalized) { setMessage('Hãy nhập nội dung cần đưa vào mã QR.'); setLoading(false); return }
      if (bytes > 1000) { setMessage(`Nội dung đang có ${bytes} byte; giới hạn an toàn là 1.000 byte.`); setLoading(false); return }
      if (kind === 'url' && !parsePublicHttpUrl(normalized)) { setMessage('Liên kết phải bắt đầu bằng http:// hoặc https://.'); setLoading(false); return }
      if (contrastRatio(darkColor, lightColor) < 4.5) { setMessage('Hai màu quá gần nhau. Hãy tăng tương phản để máy quét đọc ổn định.'); setLoading(false); return }
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
        if (verification?.data !== normalized) throw new Error('Màu hoặc nội dung này chưa tạo được QR đọc ổn định.')
        const blob = await new Promise(resolve => canvasRef.current.toBlob(resolve, 'image/png'))
        if (!blob || cancelled) return
        const nextUrl = URL.createObjectURL(blob)
        setDownloadUrl(current => { if (current) URL.revokeObjectURL(current); return nextUrl })
        setMessage(`Đã kiểm tra đọc lại thành công · ${bytes} byte · mức sửa lỗi ${errorLevel}.`)
      } catch (error) {
        if (!cancelled) setMessage(error.message || 'Không thể tạo mã QR từ nội dung này.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 220)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [content, darkColor, errorLevel, kind, lightColor, size])

  return <ToolShell title="Tạo mã QR" eyebrow="TIỆN ÍCH QR" description="Tạo và kiểm tra QR ngay trong trình duyệt. Nội dung không được gửi lên máy chủ." close={close} wide>
    <div className="utility-grid qr-create-grid">
      <div className="utility-preview qr-preview-card">
        <span className="utility-label">BẢN XEM TRƯỚC</span>
        <canvas ref={canvasRef} aria-label="Bản xem trước mã QR" />
        <p>{loading ? 'Đang kiểm tra khả năng quét…' : message}</p>
      </div>
      <div className="utility-controls">
        <div className="control-group"><span>Loại nội dung</span><div className="option-cards"><button type="button" className={kind === 'url' ? 'active' : ''} onClick={() => setKind('url')}><b>Liên kết</b><small>Chỉ nhận HTTP/HTTPS</small></button><button type="button" className={kind === 'text' ? 'active' : ''} onClick={() => setKind('text')}><b>Văn bản</b><small>Hỗ trợ tiếng Việt UTF-8</small></button></div></div>
        <div className="control-group"><label>Nội dung<textarea rows="5" maxLength="1000" value={content} onChange={event => setContent(event.target.value)} placeholder={kind === 'url' ? 'https://example.com' : 'Nhập nội dung cần chia sẻ'} /></label><small>{new TextEncoder().encode(content).length.toLocaleString('vi-VN')} / 1.000 byte</small></div>
        <div className="utility-control-row"><div className="control-group"><label>Kích thước<select value={size} onChange={event => setSize(Number(event.target.value))}><option value="256">256 px</option><option value="512">512 px</option><option value="768">768 px</option></select></label></div><div className="control-group"><label>Sửa lỗi<select value={errorLevel} onChange={event => setErrorLevel(event.target.value)}><option value="M">M — cân bằng</option><option value="Q">Q — bền hơn</option><option value="H">H — cao nhất</option></select></label></div></div>
        <div className="utility-control-row"><div className="control-group"><label className="color-control">Màu mã<input type="color" value={darkColor} onChange={event => setDarkColor(event.target.value)} /></label></div><div className="control-group"><label className="color-control">Màu nền<input type="color" value={lightColor} onChange={event => setLightColor(event.target.value)} /></label></div></div>
        <a className={`primary utility-download ${!downloadUrl || loading ? 'disabled' : ''}`} href={downloadUrl || undefined} download="ma-qr.png" aria-disabled={!downloadUrl || loading}>Tải QR dạng PNG <b>↓</b></a>
      </div>
    </div>
  </ToolShell>
}

function QrReadTool({ close }) {
  const canvasRef = useRef(null)
  const [file, setFile] = useState(null)
  const [decoded, setDecoded] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const safeLink = useMemo(() => parsePublicHttpUrl(decoded), [decoded])

  const readFile = async picked => {
    if (!picked) return
    if (picked.size > 15 * megabyte) return setMessage('Ảnh QR không được vượt quá 15 MB.')
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(picked.type)) return setMessage('Chỉ nhận ảnh JPG, PNG hoặc WebP.')
    setLoading(true); setMessage('Đang đọc mã QR trên ảnh…'); setDecoded(''); setFile(picked)
    let bitmap
    try {
      try { bitmap = await createImageBitmap(picked, { imageOrientation: 'from-image' }) }
      catch { bitmap = await createImageBitmap(picked) }
      if (bitmap.width * bitmap.height > 30_000_000) throw new Error('Ảnh vượt quá giới hạn 30 megapixel.')
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
      if (!result) throw new Error('Không tìm thấy mã QR rõ ràng trong ảnh. Hãy thử ảnh thẳng, đủ sáng và không bị cắt viền.')
      const points = [result.location.topLeftCorner, result.location.topRightCorner, result.location.bottomRightCorner, result.location.bottomLeftCorner]
      context.beginPath(); context.moveTo(points[0].x, points[0].y)
      points.slice(1).forEach(point => context.lineTo(point.x, point.y))
      context.closePath(); context.lineWidth = Math.max(3, width / 180); context.strokeStyle = '#4f46e5'; context.stroke()
      setDecoded(result.data)
      setMessage('Đã đọc thành công một mã QR. PDFTools không tự động mở liên kết để bảo vệ bạn.')
    } catch (error) {
      setMessage(error.message || 'Không thể đọc mã QR từ ảnh này.')
    } finally {
      bitmap?.close(); setLoading(false)
    }
  }

  const copy = async () => {
    try { await navigator.clipboard.writeText(decoded); setMessage('Đã sao chép nội dung QR.') }
    catch { setMessage('Trình duyệt không cho phép sao chép tự động. Hãy chọn nội dung và sao chép thủ công.') }
  }

  return <ToolShell title="Đọc mã QR" eyebrow="TIỆN ÍCH QR" description="Tải ảnh QR để đọc cục bộ. Kết quả luôn được hiển thị trước và không tự mở đường dẫn." close={close} wide={Boolean(file)}>
    {!file ? <label className="drop-zone"><input className="drop-file-input" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" onChange={event => readFile(event.target.files?.[0])} /><span>⌗</span><b>Kéo thả hoặc chọn ảnh QR</b><small>JPG, PNG, WebP · tối đa 15 MB và 30 megapixel</small></label> : <div className="utility-grid qr-reader-grid">
      <div className="utility-preview qr-reader-preview"><span className="utility-label">VÙNG QR ĐÃ NHẬN DIỆN</span><canvas ref={canvasRef} /><button type="button" className="secondary-button" onClick={() => { setFile(null); setDecoded(''); setMessage('') }}>Chọn ảnh khác</button></div>
      <div className="utility-controls">
        <div className="utility-file-fact"><span><small>Tệp ảnh</small><b>{file.name}</b></span><span><small>Dung lượng</small><b>{formatBytes(file.size)}</b></span></div>
        <div className="control-group"><label>Nội dung đã đọc<textarea className="decoded-output" readOnly rows="8" value={decoded} placeholder={loading ? 'Đang nhận diện…' : 'Chưa có kết quả'} /></label></div>
        {safeLink && <div className="safe-link-card"><small>Liên kết HTTP/HTTPS</small><strong>{safeLink.hostname}</strong><span>{safeLink.href}</span><a href={safeLink.href} target="_blank" rel="noopener noreferrer">Mở sau khi kiểm tra <b>↗</b></a></div>}
        <button type="button" className="primary" disabled={!decoded || loading} onClick={copy}>Sao chép nội dung</button>
      </div>
    </div>}
    {message && <p className={`result ${decoded ? 'success' : ''}`}>{message}</p>}
  </ToolShell>
}

function BatchRenameTool({ close }) {
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
    if (picked.length > 100) return setMessage('Mỗi lượt chỉ đổi tên tối đa 100 tệp.')
    if (total > 50 * megabyte) return setMessage('Tổng dung lượng không được vượt quá 50 MB.')
    setFiles(picked); setMessage(picked.length ? 'Hãy kiểm tra bảng tên mới trước khi tạo ZIP.' : '')
  }

  const createZip = async () => {
    if (!mapping.length) return setMessage('Hãy chọn tệp trước khi tạo ZIP.')
    setLoading(true); setProgress(0); setMessage('Đang đóng gói tệp với tên mới…')
    try {
      const { default: JSZip } = await import('jszip')
      const zip = new JSZip()
      mapping.forEach(item => zip.file(item.nextName, item.file, { binary: true, date: new Date(item.file.lastModified || Date.now()) }))
      const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE', streamFiles: true }, metadata => setProgress(Math.round(metadata.percent)))
      const nextUrl = URL.createObjectURL(blob)
      setDownloadUrl(current => { if (current) URL.revokeObjectURL(current); return nextUrl })
      setMessage(`Hoàn tất ${mapping.length} tệp · nội dung không đổi, chỉ đổi tên trong ZIP.`)
    } catch (error) {
      setMessage(error.message || 'Không thể tạo tệp ZIP.')
    } finally { setLoading(false) }
  }

  return <ToolShell title="Đổi tên file hàng loạt" eyebrow="TIỆN ÍCH TỆP" description="Xem trước tên mới rồi tải một tệp ZIP. Trình duyệt không thể tự đổi tên tệp gốc trên ổ đĩa của bạn." close={close} wide={Boolean(files.length)}>
    {!files.length ? <label className="drop-zone"><input className="drop-file-input" type="file" multiple onChange={event => choose(event.target.files)} /><span>⇧</span><b>Chọn nhiều tệp cần đổi tên</b><small>Tối đa 100 tệp · 50 MB tổng cộng · xử lý ngay trong trình duyệt</small></label> : <div className="utility-grid rename-grid">
      <div className="rename-preview">
        <div className="rename-preview-heading"><span><b>{files.length} tệp</b><small>{formatBytes(files.reduce((sum, file) => sum + file.size, 0))}</small></span><button type="button" onClick={() => setFiles([])}>Chọn lại</button></div>
        <div className="rename-table" role="table" aria-label="Xem trước tên tệp"><div className="rename-row heading" role="row"><span>Tên cũ</span><span>Tên mới</span></div>{mapping.map(item => <div className="rename-row" role="row" key={`${item.originalName}-${item.nextName}`}><span title={item.originalName}>{item.originalName}</span><b title={item.nextName}>{item.nextName}</b></div>)}</div>
      </div>
      <div className="utility-controls">
        <div className="control-group"><label>Mẫu tên<input value={pattern} onChange={event => setPattern(event.target.value)} placeholder="{name}-{n}" /></label><small>Dùng <b>{'{name}'}</b> cho tên cũ, <b>{'{n}'}</b> cho số thứ tự, <b>{'{ext}'}</b> nếu muốn đặt phần mở rộng trong mẫu.</small></div>
        <div className="utility-control-row"><div className="control-group"><label>Tiền tố<input value={prefix} onChange={event => setPrefix(event.target.value)} placeholder="du-an-" /></label></div><div className="control-group"><label>Hậu tố<input value={suffix} onChange={event => setSuffix(event.target.value)} placeholder="-2026" /></label></div></div>
        <div className="utility-control-row"><div className="control-group"><label>Số bắt đầu<input type="number" min="0" max="999999" value={start} onChange={event => setStart(event.target.value)} /></label></div><div className="control-group"><label>Số chữ số<select value={digits} onChange={event => setDigits(event.target.value)}><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option></select></label></div></div>
        <button type="button" className="primary" disabled={loading} onClick={createZip}>{loading ? `Đang tạo ZIP ${progress}%…` : 'Tạo ZIP với tên mới  →'}</button>
        {downloadUrl && <a className="primary utility-download" href={downloadUrl} download="tep-da-doi-ten.zip">Tải tệp ZIP <b>↓</b></a>}
        {message && <p className={`result ${downloadUrl ? 'success' : ''}`}>{message}</p>}
      </div>
    </div>}
    {!files.length && message && <p className="result">{message}</p>}
  </ToolShell>
}

const makeRegion = index => ({ id: `${Date.now()}-${index}`, x: 10 + index * 3, y: 12 + index * 3, w: 34, h: 14 })

function ImageRedactTool({ close }) {
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
    if (picked.size > 25 * megabyte) return setMessage('Ảnh không được vượt quá 25 MB.')
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(picked.type)) return setMessage('Chỉ nhận ảnh JPG, PNG hoặc WebP.')
    let bitmap
    try {
      try { bitmap = await createImageBitmap(picked, { imageOrientation: 'from-image' }) }
      catch { bitmap = await createImageBitmap(picked) }
      if (bitmap.width * bitmap.height > 30_000_000) throw new Error('Ảnh vượt quá giới hạn 30 megapixel.')
      const nextUrl = URL.createObjectURL(picked)
      setSourceUrl(current => { if (current) URL.revokeObjectURL(current); return nextUrl })
      setFile(picked); setDimensions({ width: bitmap.width, height: bitmap.height })
      setRegions([makeRegion(0)]); setSelectedId(null); setResult(null)
      setMessage('Kéo vùng che tới vị trí cần ẩn; kéo bốn góc để thay đổi kích thước.')
    } catch (error) { setMessage(error.message || 'Không thể đọc ảnh này.') }
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
    if (regions.length >= 20) return setMessage('Mỗi ảnh chỉ được tạo tối đa 20 vùng che.')
    const next = makeRegion(regions.length)
    invalidateResult(); setRegions(current => [...current, next]); setSelectedId(next.id)
  }
  const removeRegion = id => {
    invalidateResult(); setRegions(current => current.filter(region => region.id !== id)); setSelectedId(null)
  }
  const process = async () => {
    if (!file || !regions.length) return setMessage('Hãy chọn ảnh và tạo ít nhất một vùng che.')
    setLoading(true); setResult(null); setMessage('Đang làm phẳng các vùng che và xóa metadata ảnh…')
    try {
      const form = new FormData()
      form.append('file', file); form.append('regions', JSON.stringify(regions)); form.append('redactionColor', color); form.append('format', 'png')
      const response = await fetch('/api/tools/image/redact', { method: 'POST', body: form })
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).message || 'Không thể che thông tin trên ảnh.')
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      setResult({ url, size: blob.size, name: `${file.name.replace(/\.[^/.]+$/, '')}-da-che.png` })
      setMessage(`Hoàn tất ${regions.length} vùng che đặc · ảnh đã làm phẳng và loại metadata EXIF/GPS.`)
    } catch (error) { setMessage(error.message || 'Không thể xử lý ảnh này.') }
    finally { setLoading(false) }
  }

  return <ToolShell title="Che thông tin trên ảnh" eyebrow="BẢO VỆ RIÊNG TƯ" description="Đặt các khối màu đặc lên số điện thoại, địa chỉ hoặc dữ liệu nhạy cảm. Kết quả được làm phẳng thật, không chỉ che bằng CSS." close={close} wide={Boolean(file)}>
    {!file ? <label className="drop-zone"><input className="drop-file-input" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" onChange={event => choose(event.target.files?.[0])} /><span>▰</span><b>Chọn ảnh cần che thông tin</b><small>JPG, PNG, WebP · tối đa 25 MB và 30 megapixel</small></label> : <>
      <div className="selected-file-bar"><div><i>IMG</i><span><b>{file.name}</b><small>{formatBytes(file.size)} · {dimensions?.width} × {dimensions?.height}px</small></span></div><label className="file-change-button">Đổi ảnh<input type="file" accept=".jpg,.jpeg,.png,.webp" onChange={event => choose(event.target.files?.[0])} /></label></div>
      <div className="utility-grid redact-grid">
        <div className="redact-workspace">
          <div className="redact-toolbar"><button type="button" onClick={addRegion}>＋ Thêm vùng che</button><button type="button" disabled={!selectedId} onClick={() => removeRegion(selectedId)}>Xóa vùng chọn</button><button type="button" onClick={() => { invalidateResult(); setRegions([]); setSelectedId(null) }}>Xóa tất cả</button><span>{regions.length}/20 vùng</span></div>
          <div className="redact-viewport"><div className="redact-stage" ref={stageRef}><img src={sourceUrl} alt="Ảnh đang chọn vùng cần che" draggable="false" />{regions.map((region, index) => <div key={region.id} className={`redact-region ${selectedId === region.id ? 'selected' : ''}`} style={{ left: `${region.x}%`, top: `${region.y}%`, width: `${region.w}%`, height: `${region.h}%`, background: color }} onPointerDown={event => beginRegion(event, region)} onPointerMove={event => moveRegion(event, region.id)} onPointerUp={() => { dragRef.current = null }} onPointerCancel={() => { dragRef.current = null }}><b>{index + 1}</b>{['nw', 'ne', 'sw', 'se'].map(handle => <i key={handle} className={`redact-handle ${handle}`} data-handle={handle} onPointerDown={event => beginRegion(event, region, handle)} onPointerMove={event => moveRegion(event, region.id)} onPointerUp={() => { dragRef.current = null }} onPointerCancel={() => { dragRef.current = null }} />)}</div>)}</div></div>
          <p className="crop-help">Kéo khối để di chuyển · kéo bốn góc để thu phóng · khối màu sẽ được ghi vĩnh viễn vào ảnh kết quả</p>
        </div>
        <div className="utility-controls">
          <div className="control-group"><label className="color-control">Màu che đặc<input type="color" value={color} onChange={event => { invalidateResult(); setColor(event.target.value) }} /></label><small>Màu đặc an toàn hơn blur/pixel hóa đối với dữ liệu riêng tư.</small></div>
          <div className="control-note"><b>Che thật, không thể chọn lại nội dung</b><span>Máy chủ dùng Sharp làm phẳng vùng che vào pixel PNG và không giữ metadata EXIF/GPS. Hãy luôn xem lại ảnh kết quả trước khi chia sẻ.</span></div>
          <button type="button" className="primary" disabled={loading || !regions.length} onClick={process}>{loading ? 'Đang xử lý…' : `Tạo ảnh đã che ${regions.length} vùng  →`}</button>
          {message && <p className={`result ${result ? 'success' : ''}`}>{message}</p>}
          {result && <div className="redact-result"><span className="utility-label">KẾT QUẢ ĐÃ LÀM PHẲNG</span><img src={result.url} alt="Ảnh sau khi che thông tin" /><div><span><small>Dung lượng</small><b>{formatBytes(result.size)}</b></span><a className="primary" href={result.url} download={result.name}>Tải ảnh PNG <b>↓</b></a></div></div>}
        </div>
      </div>
    </>}
    {!file && message && <p className="result">{message}</p>}
  </ToolShell>
}

function LinkShortenerInfo({ close }) {
  return <ToolShell title="Rút gọn liên kết" eyebrow="ĐANG NGHIÊN CỨU" description="Tính năng chưa được mở công khai để tránh tạo liên kết mất sau mỗi lần deploy hoặc bị lợi dụng cho spam và lừa đảo." close={close}>
    <div className="planned-tool-card"><i>↗</i><h3>Chưa gắn nhãn “Sẵn sàng”</h3><p>Một dịch vụ rút gọn link đáng tin cậy cần cơ sở dữ liệu bền vững, sao lưu, ngày hết hạn, giới hạn tần suất và cơ chế báo cáo/chặn liên kết nguy hiểm.</p><ul><li>QR vẫn tạo được từ liên kết đầy đủ ngay bây giờ.</li><li>Phiên bản sau chỉ mở khi link không mất qua restart/deploy.</li><li>Chỉ chuyển hướng HTTP/HTTPS và không tự mở link cho người dùng.</li></ul><button type="button" className="primary" onClick={close}>Đã hiểu</button></div>
  </ToolShell>
}

export default function UtilityToolModal({ mode, close }) {
  if (mode === 'qr-create') return <QrCreateTool close={close} />
  if (mode === 'qr-read') return <QrReadTool close={close} />
  if (mode === 'batch-rename') return <BatchRenameTool close={close} />
  if (mode === 'image-redact') return <ImageRedactTool close={close} />
  return <LinkShortenerInfo close={close} />
}
