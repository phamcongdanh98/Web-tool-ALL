import { useEffect, useMemo, useRef, useState } from 'react'

const pdfTools = [
  { icon: '✎', name: 'Chỉnh sửa PDF', description: 'Thêm văn bản, hình ảnh, ký tên, ghi chú...', color: 'coral', mode: 'soon' },
  { icon: '✳', name: 'Nén PDF', description: 'Đặt dung lượng MB và tự động nén sát mục tiêu', color: 'red', mode: 'pdf-compress' },
  { icon: '⊕', name: 'Ghép PDF', description: 'Sắp xếp và ghép nhiều tệp PDF thành một', color: 'blue', mode: 'pdf-merge' },
  { icon: '◫', name: 'Tách PDF', description: 'Chọn trực tiếp thumbnail và tải kết quả dạng ZIP', color: 'purple', mode: 'pdf-split' },
  { icon: 'W', name: 'PDF sang Word', description: 'Chuyển đổi PDF sang file Word dễ dàng', color: 'blue', mode: 'soon' },
  { icon: 'X', name: 'PDF sang Excel', description: 'Chuyển đổi PDF sang file Excel', color: 'green', mode: 'soon' },
  { icon: 'P', name: 'PDF sang PowerPoint', description: 'Chuyển đổi PDF sang file PowerPoint', color: 'orange', mode: 'soon' },
]

const imageTools = [
  { icon: '♙', name: 'Xóa phông nền', description: 'AI xóa nền kèm preview trong suốt', color: 'blue', mode: 'remove-background' },
  { icon: '▣', name: 'Chuyển đổi định dạng', description: 'Xem trước và đổi JPG, PNG, WebP, AVIF', color: 'teal', mode: 'convert' },
  { icon: '⛶', name: 'Thay đổi kích thước', description: 'Nhập kích thước và xem kết quả trước khi tải', color: 'violet', mode: 'resize' },
  { icon: '⌗', name: 'Cắt ảnh', description: 'Kéo, thả và thu phóng khung cắt trực tiếp', color: 'pink', mode: 'crop' },
  { icon: '✳', name: 'Nén ảnh', description: 'Điều chỉnh chất lượng và so sánh dung lượng', color: 'yellow', mode: 'compress' },
  { icon: '☷', name: 'Chỉnh sửa ảnh', description: 'Điều chỉnh màu sắc, độ sáng, tương phản và hơn thế nữa', color: 'indigo', mode: 'soon' },
]

const labels = {
  'pdf-compress': 'Nén PDF',
  'pdf-merge': 'Ghép PDF',
  'pdf-split': 'Tách PDF',
  compress: 'Nén ảnh',
  convert: 'Chuyển đổi định dạng ảnh',
  resize: 'Thay đổi kích thước',
  crop: 'Cắt ảnh',
  'remove-background': 'Xóa phông nền',
}

const imageModes = ['compress', 'convert', 'resize', 'crop', 'remove-background']
const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
const formatBytes = (bytes = 0) => {
  if (!bytes) return '0 KB'
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** index).toFixed(index ? 2 : 0)} ${units[index]}`
}

let pdfJsPromise
let pdfPageId = 0
const thumbnailPdfCache = new Map()
const loadPdfJs = async () => {
  if (!pdfJsPromise) pdfJsPromise = Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]).then(([pdfjs, worker]) => {
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default
    return pdfjs
  })
  return pdfJsPromise
}

const loadThumbnailPdf = async url => {
  if (!thumbnailPdfCache.has(url)) {
    const promise = loadPdfJs().then(pdfjs => {
      const task = pdfjs.getDocument({ url })
      thumbnailPdfCache.set(url, { task, promise: task.promise })
      return task.promise
    })
    thumbnailPdfCache.set(url, { promise })
  }
  return thumbnailPdfCache.get(url).promise
}

const releaseThumbnailPdf = url => {
  const cached = thumbnailPdfCache.get(url)
  cached?.task?.destroy?.()
  thumbnailPdfCache.delete(url)
}

const makePageItems = (infos, firstFileIndex = 0) => infos.flatMap((info, infoIndex) =>
  Array.from({ length: info.pages || 0 }, (_, pageIndex) => ({
    id: `pdf-page-${++pdfPageId}`,
    fileIndex: firstFileIndex + infoIndex,
    pageIndex,
    rotation: 0,
  })))

const canvasToJpeg = (canvas, quality) => new Promise((resolve, reject) => {
  canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Không thể mã hóa trang PDF thành ảnh.')), 'image/jpeg', quality)
})

const encodeCanvasNearBudget = async (canvas, budget) => {
  const minimumQuality = 0.2
  const maximumQuality = 0.94
  const minimum = await canvasToJpeg(canvas, minimumQuality)
  if (minimum.size > budget) return { blob: minimum, quality: minimumQuality }
  const maximum = await canvasToJpeg(canvas, maximumQuality)
  if (maximum.size <= budget) return { blob: maximum, quality: maximumQuality }

  let best = minimum
  let bestQuality = minimumQuality
  let low = minimumQuality
  let high = maximumQuality
  for (let attempt = 0; attempt < 7; attempt++) {
    const quality = (low + high) / 2
    const candidate = await canvasToJpeg(canvas, quality)
    if (candidate.size <= budget) {
      best = candidate
      bestQuality = quality
      low = quality
    } else high = quality
  }
  return { blob: best, quality: bestQuality }
}

const renderPageNearBudget = async (page, budget) => {
  const base = page.getViewport({ scale: 1 })
  const basePixels = Math.max(1, base.width * base.height)
  const maximumScale = Math.min(3.25, 3600 / Math.max(base.width, base.height))
  let scale = clamp(Math.sqrt(budget / (basePixels * 0.42)), 0.45, maximumScale)
  let chosen

  for (let resolutionAttempt = 0; resolutionAttempt < 3; resolutionAttempt++) {
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.floor(viewport.width))
    canvas.height = Math.max(1, Math.floor(viewport.height))
    const context = canvas.getContext('2d', { alpha: false })
    context.fillStyle = '#fff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvasContext: context, viewport, background: '#fff' }).promise
    chosen = await encodeCanvasNearBudget(canvas, budget)
    canvas.width = 1
    canvas.height = 1

    const isTooLarge = chosen.blob.size > budget * 1.01 && scale > 0.46
    const hasRoomForMoreDetail = chosen.blob.size < budget * 0.84 && chosen.quality >= 0.93 && scale < maximumScale * 0.99
    if (!isTooLarge && !hasRoomForMoreDetail) break
    const correction = Math.sqrt(budget / Math.max(chosen.blob.size, 1))
    scale = clamp(scale * correction * (isTooLarge ? 0.94 : 0.97), 0.45, maximumScale)
  }

  return { ...chosen, width: base.width, height: base.height, scale }
}

const compressPdfToTarget = async (file, targetMb, reportProgress) => {
  const targetBytes = Math.floor(Number(targetMb) * 1024 * 1024)
  if (!Number.isFinite(targetBytes) || targetBytes <= 0) throw new Error('Dung lượng mục tiêu không hợp lệ.')
  if (targetBytes >= file.size) throw new Error('Mục tiêu phải nhỏ hơn dung lượng tệp gốc.')

  const sourceBytes = new Uint8Array(await file.arrayBuffer())
  const pdfjs = await loadPdfJs()
  const loadingTask = pdfjs.getDocument({ data: sourceBytes.slice() })
  const source = await loadingTask.promise
  const minimumUsefulSize = 64 * 1024 + source.numPages * 18 * 1024
  if (targetBytes < minimumUsefulSize) {
    await loadingTask.destroy()
    throw new Error(`Mục tiêu quá thấp cho ${source.numPages} trang. Hãy chọn ít nhất ${formatBytes(minimumUsefulSize)}.`)
  }

  const { PDFDocument } = await import('pdf-lib')
  const idealBytes = Math.floor(targetBytes * 0.975)
  const pageFacts = []
  for (let pageNumber = 1; pageNumber <= source.numPages; pageNumber++) {
    const page = await source.getPage(pageNumber)
    const viewport = page.getViewport({ scale: 1 })
    pageFacts.push({ page, area: viewport.width * viewport.height })
  }
  const totalArea = pageFacts.reduce((sum, fact) => sum + fact.area, 0)
  const pdfOverhead = 18 * 1024 + source.numPages * 1800
  let budgetScale = 1
  let closestUnderTarget = null

  try {
    for (let pass = 1; pass <= 4; pass++) {
      const imageBudget = Math.max(source.numPages * 10 * 1024, idealBytes * budgetScale - pdfOverhead)
      const output = await PDFDocument.create()
      for (let index = 0; index < pageFacts.length; index++) {
        reportProgress(`Lượt tối ưu ${pass}/4 · đang xử lý trang ${index + 1}/${source.numPages}…`)
        const fact = pageFacts[index]
        const pageBudget = Math.max(10 * 1024, imageBudget * fact.area / totalArea)
        const encoded = await renderPageNearBudget(fact.page, pageBudget)
        const jpg = await output.embedJpg(await encoded.blob.arrayBuffer())
        const outputPage = output.addPage([encoded.width, encoded.height])
        outputPage.drawImage(jpg, { x: 0, y: 0, width: encoded.width, height: encoded.height })
      }
      const bytes = await output.save({ useObjectStreams: true, addDefaultPage: false, objectsPerTick: 30 })
      if (bytes.length <= targetBytes && (!closestUnderTarget || bytes.length > closestUnderTarget.length)) closestUnderTarget = bytes
      const targetGap = Math.abs(bytes.length - idealBytes) / idealBytes
      if (bytes.length <= targetBytes && targetGap <= 0.035) break

      const reference = bytes.length > targetBytes ? targetBytes * 0.985 : idealBytes
      budgetScale = clamp(budgetScale * reference / Math.max(bytes.length, 1) * 0.99, 0.22, 2.8)
    }
  } finally {
    pageFacts.forEach(fact => fact.page.cleanup?.())
    await loadingTask.destroy()
  }

  if (!closestUnderTarget) throw new Error('Không thể đạt mức dung lượng này mà vẫn giữ trang có thể đọc. Hãy tăng mục tiêu một chút.')
  return new Blob([closestUnderTarget], { type: 'application/pdf' })
}

function ToolCard({ tool, open }) {
  const isReady = tool.mode !== 'soon'
  return <button className="tool-card" onClick={() => open(tool.mode)}>
    <span className={`tool-status ${isReady ? 'ready' : 'soon'}`}>{isReady ? 'Sẵn sàng' : 'Đang hoàn thiện'}</span>
    <span className={`tool-icon ${tool.color}`}>{tool.icon}</span>
    <strong>{tool.name}</strong>
    <small>{tool.description}</small>
    <span className="tool-action">{isReady ? 'Mở công cụ' : 'Xem thông tin'} <b>→</b></span>
  </button>
}

function ToolSection({ title, tools, id, open, query }) {
  const visible = tools.filter(tool => `${tool.name} ${tool.description}`.toLowerCase().includes(query.toLowerCase()))
  return <section className="tool-section" id={id}>
    <div className="section-heading">
      <div><span>{id === 'pdf' ? 'TÀI LIỆU' : 'HÌNH ẢNH'}</span><h2>{title}</h2><p>{id === 'pdf' ? 'Các tác vụ PDF thiết yếu, dễ dùng và an toàn.' : 'Tối ưu hình ảnh nhanh chóng ngay trên trình duyệt.'}</p></div>
      <a href={`#${id}`}>Khám phá tất cả <span>→</span></a>
    </div>
    <div className="tools-grid">{visible.map(tool => <ToolCard key={tool.name} tool={tool} open={open} />)}</div>
    {!visible.length && <p className="empty">Chưa tìm thấy công cụ phù hợp.</p>}
  </section>
}

function PdfCanvasPreview({ info }) {
  const canvasRef = useRef(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [rendering, setRendering] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => { setPageNumber(1) }, [info.url])
  useEffect(() => {
    let cancelled = false
    let loadingTask
    const renderPage = async () => {
      setRendering(true); setError('')
      try {
        const pdfjs = await loadPdfJs()
        loadingTask = pdfjs.getDocument({ url: info.url })
        const pdf = await loadingTask.promise
        const page = await pdf.getPage(pageNumber)
        const viewport = page.getViewport({ scale: 1.35 })
        const canvas = canvasRef.current
        if (!canvas || cancelled) return
        const ratio = Math.min(globalThis.devicePixelRatio || 1, 2)
        canvas.width = Math.floor(viewport.width * ratio)
        canvas.height = Math.floor(viewport.height * ratio)
        canvas.style.aspectRatio = `${viewport.width} / ${viewport.height}`
        const context = canvas.getContext('2d')
        await page.render({ canvasContext: context, viewport, transform: ratio === 1 ? null : [ratio, 0, 0, ratio, 0, 0] }).promise
      } catch (renderError) {
        if (!cancelled) setError('Không thể hiển thị trang PDF này trong preview.')
      } finally { if (!cancelled) setRendering(false) }
    }
    renderPage()
    return () => { cancelled = true; loadingTask?.destroy?.() }
  }, [info.url, pageNumber])

  return <div className="pdf-canvas-preview">
    <div className="pdf-page-canvas">{rendering && <span>Đang dựng trang PDF…</span>}{error && <span>{error}</span>}<canvas ref={canvasRef} /></div>
    <div className="pdf-page-controls"><button type="button" disabled={pageNumber <= 1} onClick={() => setPageNumber(page => page - 1)}>←</button><b>Trang {pageNumber} / {info.pages}</b><button type="button" disabled={pageNumber >= info.pages} onClick={() => setPageNumber(page => page + 1)}>→</button></div>
  </div>
}

function PdfPageThumbnail({ item, info, number, selected, mode, onSelect, onDropPage, onDragPage, onDelete, onInsert }) {
  const canvasRef = useRef(null)
  const [rendering, setRendering] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    let renderTask
    const render = async () => {
      setRendering(true); setError(false)
      try {
        const pdf = await loadThumbnailPdf(info.url)
        const page = await pdf.getPage(item.pageIndex + 1)
        const base = page.getViewport({ scale: 1, rotation: page.rotate + item.rotation })
        const scale = Math.min(0.42, 210 / Math.max(base.width, 1))
        const viewport = page.getViewport({ scale, rotation: page.rotate + item.rotation })
        const canvas = canvasRef.current
        if (!canvas || cancelled) return
        const ratio = Math.min(globalThis.devicePixelRatio || 1, 2)
        canvas.width = Math.max(1, Math.floor(viewport.width * ratio))
        canvas.height = Math.max(1, Math.floor(viewport.height * ratio))
        canvas.style.aspectRatio = `${viewport.width} / ${viewport.height}`
        const context = canvas.getContext('2d', { alpha: false })
        renderTask = page.render({ canvasContext: context, viewport, background: '#fff', transform: ratio === 1 ? null : [ratio, 0, 0, ratio, 0, 0] })
        await renderTask.promise
      } catch (renderError) { if (!cancelled) setError(true) }
      finally { if (!cancelled) setRendering(false) }
    }
    render()
    return () => { cancelled = true; renderTask?.cancel?.() }
  }, [info.url, item.pageIndex, item.rotation])

  const pageLabel = info.pages > 1 ? `${info.name} · trang ${item.pageIndex + 1}` : info.name
  return <article className={`pdf-page-card ${selected ? 'selected' : ''}`} draggable onDragStart={() => onDragPage(item.id)} onDragOver={event => event.preventDefault()} onDrop={() => onDropPage(item.id)}>
    <button className="page-check" type="button" aria-label={`${selected ? 'Bỏ chọn' : 'Chọn'} trang ${number}`} aria-pressed={selected} onClick={() => onSelect(item.id)}>{selected ? '✓' : ''}</button>
    <button className="page-thumbnail" type="button" onClick={() => onSelect(item.id)}>
      <span className="page-paper">{rendering && <i>Đang tải…</i>}{error && <i>Không thể xem</i>}<canvas ref={canvasRef} /></span>
      <span className="page-name" title={pageLabel}>{pageLabel}</span>
      <small>Trang {number}</small>
    </button>
    {mode === 'pdf-merge' && <button className="page-delete" type="button" aria-label={`Xóa trang ${number}`} onClick={() => onDelete(item.id)}>×</button>}
    {mode === 'pdf-merge' && <label className="page-insert"><input type="file" accept=".pdf,application/pdf" multiple aria-label={`Chèn PDF sau trang ${number}`} onChange={event => { onInsert(event.target.files, number); event.target.value = '' }} /><span>+</span></label>}
  </article>
}

function PdfPageBoard({ mode, pages, fileInfo, selectedPages, setSelectedPages, setPages, onAddFiles }) {
  const draggedPage = useRef(null)
  const selectedCount = selectedPages.size
  const allSelected = pages.length > 0 && selectedCount === pages.length
  const isMerge = mode === 'pdf-merge'

  const selectAll = () => setSelectedPages(allSelected ? new Set() : new Set(pages.map(page => page.id)))
  const selectPreset = preset => {
    if (preset === 'all') return setSelectedPages(new Set(pages.map(page => page.id)))
    setSelectedPages(new Set(pages.filter(page => (page.pageIndex + 1) % 2 === (preset === 'odd' ? 1 : 0)).map(page => page.id)))
  }
  const rotateSelected = delta => {
    if (!selectedCount) return
    setPages(current => current.map(page => selectedPages.has(page.id) ? { ...page, rotation: (page.rotation + delta + 360) % 360 } : page))
  }
  const deletePages = ids => {
    setPages(current => {
      if (ids.size >= current.length) return current
      return current.filter(page => !ids.has(page.id))
    })
    if (ids.size < pages.length) setSelectedPages(current => new Set([...current].filter(id => !ids.has(id))))
  }
  const moveSelected = direction => {
    if (!selectedCount) return
    setPages(current => {
      const next = [...current]
      const indexes = direction < 0 ? [...next.keys()] : [...next.keys()].reverse()
      indexes.forEach(index => {
        if (!selectedPages.has(next[index]?.id)) return
        const target = index + direction
        if (target < 0 || target >= next.length || selectedPages.has(next[target]?.id)) return
        ;[next[index], next[target]] = [next[target], next[index]]
      })
      return next
    })
  }
  const dropPage = targetId => {
    const sourceId = draggedPage.current
    if (!sourceId || sourceId === targetId) return
    setPages(current => {
      const next = [...current]
      const from = next.findIndex(page => page.id === sourceId)
      const to = next.findIndex(page => page.id === targetId)
      if (from < 0 || to < 0) return current
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
    draggedPage.current = null
  }

  return <section className="pdf-page-board">
    <div className="page-board-toolbar">
      <label className="select-all-pages"><input type="checkbox" checked={allSelected} onChange={selectAll} /><span>{allSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}</span></label>
      <span className="selection-count"><b>{selectedCount}</b> / {pages.length} trang được chọn</span>
      <div className="page-actions">
        {isMerge && <label className="add-pages-button"><input type="file" accept=".pdf,application/pdf" multiple aria-label="Thêm PDF vào cuối" onChange={event => { onAddFiles(event.target.files, pages.length); event.target.value = '' }} /><span>＋ Thêm PDF</span></label>}
        {!isMerge && <><button type="button" onClick={() => selectPreset('all')}>Tất cả</button><button type="button" onClick={() => selectPreset('odd')}>Trang lẻ</button><button type="button" onClick={() => selectPreset('even')}>Trang chẵn</button></>}
        <button type="button" disabled={!selectedCount} onClick={() => rotateSelected(-90)} aria-label="Xoay trái các trang đã chọn">↶ Xoay trái</button>
        <button type="button" disabled={!selectedCount} onClick={() => rotateSelected(90)} aria-label="Xoay phải các trang đã chọn">↷ Xoay phải</button>
        {isMerge && <><button type="button" disabled={!selectedCount} onClick={() => moveSelected(-1)}>← Dịch trái</button><button type="button" disabled={!selectedCount} onClick={() => moveSelected(1)}>Dịch phải →</button><button className="danger" type="button" disabled={!selectedCount || selectedCount === pages.length} onClick={() => deletePages(selectedPages)}>Xóa</button></>}
      </div>
    </div>
    <div className="page-board-tip"><span>{isMerge ? 'Giữ và kéo thumbnail để đổi thứ tự trang.' : 'Nhấp vào từng thumbnail để chọn trang cần tách.'}</span><b>{isMerge ? 'PDF kết quả theo thứ tự từ trái sang phải.' : 'Mỗi trang đã chọn sẽ được xuất thành một PDF trong tệp ZIP.'}</b></div>
    <div className="page-thumbnail-grid">
      {pages.map((item, index) => <PdfPageThumbnail key={item.id} item={item} info={fileInfo[item.fileIndex]} number={index + 1} selected={selectedPages.has(item.id)} mode={mode} onSelect={id => setSelectedPages(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next })} onDragPage={id => { draggedPage.current = id }} onDropPage={dropPage} onDelete={id => deletePages(new Set([id]))} onInsert={onAddFiles} />)}
      {isMerge && <label className="add-pdf-tile"><input type="file" accept=".pdf,application/pdf" multiple aria-label="Thêm PDF vào cuối tài liệu" onChange={event => { onAddFiles(event.target.files, pages.length); event.target.value = '' }} /><i>＋</i><b>Thêm PDF</b><small>Chèn thêm trang vào tài liệu</small></label>}
    </div>
  </section>
}

function MediaPreview({ info, title, checkerboard = false }) {
  if (!info) return null
  return <div className={`media-preview ${checkerboard ? 'checkerboard' : ''}`}>
    <div className="preview-label"><span>{title}</span><b>{formatBytes(info.size)}</b></div>
    {info.kind === 'image' && <img src={info.url} alt={title} />}
    {info.kind === 'pdf' && <PdfCanvasPreview info={info} />}
    {info.kind === 'archive' && <div className="archive-preview"><i>ZIP</i><strong>Kết quả đã sẵn sàng</strong><small>Các trang PDF được đóng gói trong một tệp ZIP.</small></div>}
  </div>
}

function FileFacts({ info }) {
  if (!info) return null
  return <div className="file-facts">
    <span><small>Dung lượng</small><b>{formatBytes(info.size)}</b></span>
    {info.width && <span><small>Kích thước</small><b>{info.width} × {info.height} px</b></span>}
    {info.pages && <span><small>Số trang</small><b>{info.pages} trang</b></span>}
    <span><small>Định dạng</small><b>{info.extension?.toUpperCase() || 'Tệp'}</b></span>
  </div>
}

function CropPreview({ info, crop, setCrop, cropStageRef }) {
  const drag = useRef(null)
  const pixels = info ? {
    left: Math.round(info.width * crop.x / 100),
    top: Math.round(info.height * crop.y / 100),
    width: Math.round(info.width * crop.w / 100),
    height: Math.round(info.height * crop.h / 100),
  } : null

  const begin = event => {
    event.preventDefault()
    const handle = event.target.dataset.handle || 'move'
    drag.current = { handle, x: event.clientX, y: event.clientY, crop: { ...crop } }
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }
  const move = event => {
    if (!drag.current || !cropStageRef.current) return
    const bounds = cropStageRef.current.getBoundingClientRect()
    const dx = (event.clientX - drag.current.x) / bounds.width * 100
    const dy = (event.clientY - drag.current.y) / bounds.height * 100
    const original = drag.current.crop
    const min = 8
    let next = { ...original }
    if (drag.current.handle === 'move') {
      next.x = clamp(original.x + dx, 0, 100 - original.w)
      next.y = clamp(original.y + dy, 0, 100 - original.h)
    } else {
      if (drag.current.handle.includes('e')) next.w = clamp(original.w + dx, min, 100 - original.x)
      if (drag.current.handle.includes('s')) next.h = clamp(original.h + dy, min, 100 - original.y)
      if (drag.current.handle.includes('w')) {
        next.x = clamp(original.x + dx, 0, original.x + original.w - min)
        next.w = original.w + original.x - next.x
      }
      if (drag.current.handle.includes('n')) {
        next.y = clamp(original.y + dy, 0, original.y + original.h - min)
        next.h = original.h + original.y - next.y
      }
    }
    setCrop(next)
  }
  const applyRatio = ratio => {
    if (!info || ratio === 'free') return setCrop({ x: 10, y: 10, w: 80, h: 80 })
    const imageRatio = info.width / info.height
    let w = 76
    let h = w * imageRatio / ratio
    if (h > 82) { h = 82; w = h * ratio / imageRatio }
    setCrop({ x: (100 - w) / 2, y: (100 - h) / 2, w, h })
  }

  return <div className="crop-workspace">
    <div className="crop-toolbar">
      <span>Tỷ lệ khung</span>
      <button type="button" onClick={() => applyRatio('free')}>Tự do</button>
      <button type="button" onClick={() => applyRatio(1)}>1:1</button>
      <button type="button" onClick={() => applyRatio(4 / 3)}>4:3</button>
      <button type="button" onClick={() => applyRatio(16 / 9)}>16:9</button>
    </div>
    <div className="crop-viewport">
      <div className="crop-canvas" ref={cropStageRef}>
        <img src={info.url} alt="Ảnh đang cắt" draggable="false" />
        <div className="crop-box" style={{ left: `${crop.x}%`, top: `${crop.y}%`, width: `${crop.w}%`, height: `${crop.h}%` }} onPointerDown={begin} onPointerMove={move} onPointerUp={() => { drag.current = null }} onPointerCancel={() => { drag.current = null }}>
          <span className="crop-grid vertical one" /><span className="crop-grid vertical two" /><span className="crop-grid horizontal one" /><span className="crop-grid horizontal two" />
          {['nw', 'ne', 'sw', 'se'].map(handle => <i key={handle} className={`crop-handle ${handle}`} data-handle={handle} />)}
          <b>{pixels?.width} × {pixels?.height}</b>
        </div>
      </div>
    </div>
    <p className="crop-help">Kéo bên trong khung để di chuyển · Kéo bốn góc để thu phóng</p>
  </div>
}

function ToolModal({ mode, close }) {
  const [files, setFiles] = useState([])
  const [fileInfo, setFileInfo] = useState([])
  const [format, setFormat] = useState('webp')
  const [quality, setQuality] = useState(82)
  const [width, setWidth] = useState('')
  const [height, setHeight] = useState('')
  const [lockRatio, setLockRatio] = useState(true)
  const [crop, setCrop] = useState({ x: 10, y: 10, w: 80, h: 80 })
  const [backgroundQuality, setBackgroundQuality] = useState('balanced')
  const [pdfCompression, setPdfCompression] = useState('target')
  const [targetMb, setTargetMb] = useState('4')
  const [pdfPages, setPdfPages] = useState([])
  const [selectedPages, setSelectedPages] = useState(new Set())
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const input = useRef(null)
  const cropStageRef = useRef(null)
  const urlPool = useRef(new Set())
  const isImage = imageModes.includes(mode)
  const isMerge = mode === 'pdf-merge'
  const isPdf = mode?.startsWith('pdf-')
  const fileAccept = mode === 'remove-background' ? '.png,.jpg,.jpeg,.webp' : isImage ? 'image/*' : '.pdf,application/pdf'

  useEffect(() => () => urlPool.current.forEach(url => { releaseThumbnailPdf(url); URL.revokeObjectURL(url) }), [])
  const makeUrl = blob => { const url = URL.createObjectURL(blob); urlPool.current.add(url); return url }

  const analyze = async (blob, name = blob.name || 'kết-quả') => {
    const url = makeUrl(blob)
    const extension = name.split('.').pop() || ''
    if (blob.type.startsWith('image/')) {
      const bitmap = await createImageBitmap(blob)
      const info = { url, name, size: blob.size, type: blob.type, kind: 'image', width: bitmap.width, height: bitmap.height, extension }
      bitmap.close()
      return info
    }
    if (blob.type === 'application/pdf' || extension.toLowerCase() === 'pdf') {
      const { PDFDocument } = await import('pdf-lib')
      const pdf = await PDFDocument.load(await blob.arrayBuffer(), { ignoreEncryption: true, updateMetadata: false })
      return { url, name, size: blob.size, type: 'application/pdf', kind: 'pdf', pages: pdf.getPageCount(), extension: 'pdf' }
    }
    return { url, name, size: blob.size, type: blob.type, kind: 'archive', extension }
  }

  const choose = async selected => {
    const picked = Array.from(selected || [])
    if (!picked.length) return
    const nextFiles = isMerge ? picked : picked.slice(0, 1)
    setLoading(true); setMessage('Đang đọc thông tin tệp…'); setResult(null)
    try {
      const nextInfo = await Promise.all(nextFiles.map(file => analyze(file)))
      setFiles(nextFiles); setFileInfo(nextInfo); setCrop({ x: 10, y: 10, w: 80, h: 80 })
      if (nextInfo[0]?.width) { setWidth(String(nextInfo[0].width)); setHeight(String(nextInfo[0].height)) }
      if (mode === 'pdf-merge' || mode === 'pdf-split') {
        const nextPages = makePageItems(nextInfo)
        setPdfPages(nextPages)
        setSelectedPages(mode === 'pdf-split' ? new Set(nextPages.map(page => page.id)) : new Set())
      }
      if (mode === 'pdf-compress' && nextInfo[0]?.size) {
        const sourceMb = nextInfo[0].size / 1024 / 1024
        const suggestedMb = Math.max(0.15, Math.floor(sourceMb * 0.6 * 10) / 10)
        setTargetMb(String(Math.min(suggestedMb, Math.max(0.1, sourceMb - 0.1)).toFixed(1)))
      }
      setMessage('')
    } catch (error) { setMessage(error.message || 'Không thể đọc tệp này.') }
    finally { setLoading(false) }
  }

  const addMergeFiles = async (selected, insertionIndex = pdfPages.length) => {
    const picked = Array.from(selected || [])
    if (!picked.length) return
    setLoading(true); setMessage('Đang thêm và dựng thumbnail PDF…'); setResult(null)
    try {
      const addedInfo = await Promise.all(picked.map(file => analyze(file)))
      const firstFileIndex = files.length
      const addedPages = makePageItems(addedInfo, firstFileIndex)
      const insertion = clamp(insertionIndex, 0, pdfPages.length)
      setFiles(current => [...current, ...picked])
      setFileInfo(current => [...current, ...addedInfo])
      setPdfPages(current => [...current.slice(0, insertion), ...addedPages, ...current.slice(insertion)])
      setMessage(`Đã thêm ${addedPages.length} trang. Kéo thumbnail để sắp xếp lại.`)
    } catch (error) { setMessage(error.message || 'Không thể thêm PDF này.') }
    finally { setLoading(false) }
  }

  const resizeValue = (field, value) => {
    const info = fileInfo[0]
    if (field === 'width') {
      setWidth(value)
      if (lockRatio && info?.width && value) setHeight(String(Math.max(1, Math.round(Number(value) * info.height / info.width))))
    } else {
      setHeight(value)
      if (lockRatio && info?.height && value) setWidth(String(Math.max(1, Math.round(Number(value) * info.width / info.height))))
    }
  }

  const submit = async event => {
    event.preventDefault()
    if (!files.length) return setMessage('Hãy chọn tệp trước khi xử lý.')
    if (mode === 'pdf-merge' && !pdfPages.length) return setMessage('Tài liệu phải còn ít nhất một trang.')
    if (mode === 'pdf-split' && !selectedPages.size) return setMessage('Hãy chọn ít nhất một trang cần tách.')
    setLoading(true); setMessage('Đang xử lý tệp…'); setResult(null)
    try {
      let blob, name
      if (mode === 'remove-background') {
        setMessage('Đang chuẩn bị AI xóa phông…')
        const { removeBackground } = await import('@imgly/background-removal')
        const options = {
          model: backgroundQuality === 'high' ? 'isnet_fp16' : 'isnet_quint8',
          output: { format: 'image/png', quality: .95, type: 'foreground' },
          progress: (_key, current, total) => total && setMessage(`Đang tải mô hình AI: ${Math.round(current / total * 100)}%…`),
        }
        const run = device => removeBackground(files[0], { ...options, device })
        try { blob = await run(globalThis.navigator?.gpu ? 'gpu' : 'cpu') }
        catch (gpuError) { if (!globalThis.navigator?.gpu) throw gpuError; setMessage('GPU không khả dụng, đang chuyển sang CPU…'); blob = await run('cpu') }
        name = `${files[0].name.replace(/\.[^/.]+$/, '')}-no-background.png`
      } else if (mode === 'pdf-compress' && pdfCompression === 'target') {
        blob = await compressPdfToTarget(files[0], targetMb, setMessage)
        name = `${files[0].name.replace(/\.[^/.]+$/, '')}-under-${String(targetMb).replace('.', '-')}-mb.pdf`
      } else {
        const form = new FormData()
        if (isMerge) files.forEach(file => form.append('files', file))
        else form.append('file', files[0])
        if (isMerge) form.append('pagePlan', JSON.stringify(pdfPages.map(page => ({ fileIndex: page.fileIndex, pageIndex: page.pageIndex, rotation: page.rotation }))))
        if (isImage) {
          const info = fileInfo[0]
          const cropValues = mode === 'crop' && info ? {
            left: Math.round(info.width * crop.x / 100), top: Math.round(info.height * crop.y / 100),
            cropWidth: Math.round(info.width * crop.w / 100), cropHeight: Math.round(info.height * crop.h / 100),
          } : {}
          Object.entries({ format, quality, width, height, ...cropValues }).forEach(([key, value]) => form.append(key, value))
        }
        if (mode === 'pdf-compress') form.append('level', 'balanced')
        if (mode === 'pdf-split') {
          const chosenPages = pdfPages.filter(page => selectedPages.has(page.id))
          form.append('pages', chosenPages.map(page => page.pageIndex + 1).join(','))
          form.append('pagePlan', JSON.stringify(chosenPages.map(page => ({ pageIndex: page.pageIndex, rotation: page.rotation }))))
        }
        const url = isImage ? `/api/tools/image/${mode}` : `/api/tools/pdf/${mode.replace('pdf-', '')}`
        const response = await fetch(url, { method: 'POST', body: form })
        if (!response.ok) throw new Error((await response.json().catch(() => ({}))).message || 'Không thể xử lý tệp.')
        blob = await response.blob()
        const disposition = response.headers.get('content-disposition') || ''
        name = /filename="?([^";]+)"?/i.exec(disposition)?.[1] || `pdftools-result.${blob.type.includes('pdf') ? 'pdf' : blob.type.includes('zip') ? 'zip' : format}`
      }
      const output = await analyze(blob, name)
      setResult({ ...output, blob })
      if (mode === 'pdf-compress' && pdfCompression === 'target') {
        const targetBytes = Number(targetMb) * 1024 * 1024
        const proximity = Math.max(0, (targetBytes - blob.size) / targetBytes * 100)
        setMessage(`Xử lý hoàn tất — tệp thấp hơn mục tiêu ${proximity.toFixed(1)}%. Hãy xem preview trước khi tải.`)
      } else setMessage('Xử lý hoàn tất — hãy xem preview và tải xuống khi đã hài lòng.')
    } catch (error) { setMessage(error.message || 'Không thể xử lý tệp này. Hãy thử lại.') }
    finally { setLoading(false) }
  }

  if (mode === 'soon') return <div className="modal-shade"><div className="tool-modal intro"><button className="close" onClick={close}>×</button><i>✦</i><h2>Tính năng đang hoàn thiện</h2><p>Công cụ này cần backend chuyên dụng để bảo toàn bố cục và nội dung. Chúng tôi chưa gắn nhãn hoạt động cho đến khi kiểm thử được toàn bộ luồng xử lý và tải xuống.</p><button className="primary" onClick={close}>Khám phá công cụ khác</button></div></div>

  const source = fileInfo[0]
  const reduction = result && files[0] ? Math.round((1 - result.size / files[0].size) * 100) : null
  const targetBytes = Number(targetMb) * 1024 * 1024
  const targetRatio = files[0]?.size && Number.isFinite(targetBytes) ? Math.round(targetBytes / files[0].size * 100) : 0

  return <div className="modal-shade" role="dialog" aria-modal="true">
    <form className={`tool-modal ${files.length ? 'tool-modal-wide' : ''}`} onSubmit={submit}>
      <button className="close" type="button" onClick={close}>×</button>
      <div className="modal-heading"><i>✦</i><div><p>CÔNG CỤ PDFTOOLS</p><h2>{labels[mode]}</h2></div></div>
      <p className="modal-copy">{isMerge ? 'Xem từng trang, kéo để sắp xếp và chèn thêm PDF vào đúng vị trí.' : mode === 'pdf-split' ? 'Chọn trực tiếp các thumbnail cần tách; không cần nhớ hay nhập số trang.' : mode === 'crop' ? 'Đặt khung trực tiếp trên ảnh; phần sáng bên trong là vùng sẽ được giữ lại.' : mode === 'pdf-compress' ? 'Nhập dung lượng cần đạt; PDFTools sẽ tự cân chỉnh nhiều lượt để tệp nằm ngay dưới mục tiêu.' : 'Tệp chỉ được tải xuống sau khi bạn đã xem preview kết quả.'}</p>

      {!files.length ? <div className="drop-zone" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); choose(event.dataTransfer.files) }}>
        <input ref={input} className="drop-file-input" aria-label="Chọn tệp từ máy tính" type="file" accept={fileAccept} multiple={isMerge} onChange={event => choose(event.target.files)} />
        <span>⇧</span><b>Kéo thả {isMerge ? 'các tệp' : 'tệp'} vào đây</b><small>hoặc nhấp để chọn từ máy tính · tối đa 25 MB mỗi tệp</small>
      </div> : <>
        <input ref={input} className="file-input" aria-label="Đổi tệp từ máy tính" type="file" accept={fileAccept} multiple={isMerge} onChange={event => choose(event.target.files)} />
        <div className="selected-file-bar"><div><i>{isPdf ? 'PDF' : 'IMG'}</i><span><b>{files.length > 1 ? `${files.length} tệp đã chọn` : files[0].name}</b><small>{files.length > 1 ? `${formatBytes(files.reduce((sum, file) => sum + file.size, 0))} tổng cộng` : formatBytes(files[0].size)}</small></span></div><button type="button" onClick={() => input.current?.click()}>Đổi tệp</button></div>

        {mode === 'pdf-split' && <FileFacts info={source} />}
        {(isMerge || mode === 'pdf-split') ? <PdfPageBoard mode={mode} pages={pdfPages} fileInfo={fileInfo} selectedPages={selectedPages} setSelectedPages={setSelectedPages} setPages={setPdfPages} onAddFiles={addMergeFiles} /> : <>
          <FileFacts info={source} />
          <div className="editor-layout">
          <div className="editor-preview">
            {mode === 'crop' ? <CropPreview info={source} crop={crop} setCrop={setCrop} cropStageRef={cropStageRef} /> : <MediaPreview info={source} title="Bản gốc" />}
          </div>
          <div className="editor-controls">
            {mode === 'remove-background' && <div className="control-group"><span>Chế độ AI</span><div className="option-cards"><button type="button" className={backgroundQuality === 'balanced' ? 'active' : ''} onClick={() => setBackgroundQuality('balanced')}><b>Nhanh</b><small>~40 MB · ảnh thông thường</small></button><button type="button" className={backgroundQuality === 'high' ? 'active' : ''} onClick={() => setBackgroundQuality('high')}><b>Chất lượng cao</b><small>~80 MB · viền tóc tốt hơn</small></button></div></div>}

            {isImage && mode !== 'remove-background' && <>
              <div className="control-group"><label>Định dạng kết quả<select value={format} onChange={event => setFormat(event.target.value)}><option value="webp">WebP — nhẹ, hiện đại</option><option value="jpeg">JPG — tương thích cao</option><option value="png">PNG — không mất dữ liệu</option><option value="avif">AVIF — dung lượng thấp</option></select></label></div>
              <div className="control-group"><div className="range-label"><span>Chất lượng</span><b>{quality}%</b></div><input type="range" min="20" max="100" value={quality} onChange={event => setQuality(event.target.value)} /><small>Chất lượng thấp hơn thường tạo tệp nhẹ hơn. PNG có thể ít thay đổi.</small></div>
              {mode === 'resize' && <div className="control-group"><div className="dimensions"><label>Rộng (px)<input inputMode="numeric" value={width} onChange={event => resizeValue('width', event.target.value)} /></label><label>Cao (px)<input inputMode="numeric" value={height} onChange={event => resizeValue('height', event.target.value)} /></label></div><button className={`ratio-lock ${lockRatio ? 'active' : ''}`} type="button" onClick={() => setLockRatio(!lockRatio)}>{lockRatio ? '🔗 Đang khóa tỷ lệ' : 'Mở khóa tỷ lệ'}</button></div>}
            </>}

            {mode === 'pdf-compress' && <>
              <div className="control-group"><span>Kiểu nén</span><div className="option-cards"><button type="button" className={pdfCompression === 'target' ? 'active' : ''} onClick={() => setPdfCompression('target')}><b>Đạt dung lượng mục tiêu</b><small>Nén ảnh từng trang, tự điều chỉnh để bám sát số MB</small></button><button type="button" className={pdfCompression === 'preserve' ? 'active' : ''} onClick={() => setPdfCompression('preserve')}><b>Bảo toàn văn bản</b><small>Giữ nội dung có thể chọn, nhưng không cam kết số MB</small></button></div></div>
              {pdfCompression === 'target' ? <div className="control-group target-size-control">
                <label>Dung lượng tối đa<input type="number" min="0.1" max={files[0] ? Math.max(0.1, files[0].size / 1024 / 1024 - 0.01).toFixed(2) : undefined} step="0.1" value={targetMb} onChange={event => setTargetMb(event.target.value)} /></label><b>MB</b>
                <div className="target-summary"><span>Mục tiêu tối ưu</span><strong>{Number(targetMb) > 0 ? `${(Number(targetMb) * 0.95).toFixed(2)}–${(Number(targetMb) * 0.99).toFixed(2)} MB` : '—'}</strong><small>{targetRatio > 0 ? `Khoảng ${targetRatio}% tệp gốc · luôn ưu tiên không vượt ${targetMb || 0} MB` : 'Nhập dung lượng cần đạt'}</small></div>
                <p>Chế độ này làm phẳng mỗi trang thành ảnh JPEG: hình thức được giữ, nhưng văn bản, liên kết và biểu mẫu sẽ không còn chỉnh sửa hoặc chọn được.</p>
              </div> : <div className="control-note"><b>Bảo toàn nội dung</b><span>Tối ưu cấu trúc PDF mà không biến trang thành ảnh. Kết quả phụ thuộc dữ liệu gốc và có thể giảm ít nếu ảnh/font đã được nén.</span></div>}
            </>}

          </div>
          </div>
        </>}
      </>}

      <button className="primary process" disabled={loading}>{loading ? 'Đang xử lý…' : !files.length ? 'Chọn tệp để bắt đầu' : isMerge ? `Ghép ${pdfPages.length} trang  →` : mode === 'pdf-split' ? `Tách ${selectedPages.size} trang  →` : 'Tạo bản xem trước kết quả  →'}</button>
      {message && <p className={`result ${message.includes('hoàn tất') ? 'success' : ''}`}>{message}</p>}

      {result && <div className="result-workspace">
        <div className="result-heading"><div><span>KẾT QUẢ</span><h3>{result.name}</h3></div><a className="primary download-result" href={result.url} download={result.name}>Tải xuống <b>↓</b></a></div>
        <div className="result-comparison"><MediaPreview info={fileInfo[0]} title="Trước xử lý" /><MediaPreview info={result} title="Sau xử lý" checkerboard={mode === 'remove-background'} /></div>
        <div className="result-stats"><span><small>Trước</small><b>{formatBytes(files[0]?.size)}</b></span><i>→</i><span><small>Sau</small><b>{formatBytes(result.size)}</b></span>{reduction !== null && <strong className={reduction >= 0 ? 'positive' : 'negative'}>{reduction >= 0 ? `Giảm ${reduction}%` : `Tăng ${Math.abs(reduction)}%`}</strong>}{result.width && <span><small>Kích thước mới</small><b>{result.width} × {result.height}px</b></span>}{result.pages && <span><small>Số trang</small><b>{result.pages} trang</b></span>}</div>
      </div>}
    </form>
  </div>
}

export default function App() {
  const [dark, setDark] = useState(() => localStorage.getItem('pdftools-theme') === 'dark')
  const [modal, setModal] = useState(null)
  const [query, setQuery] = useState('')
  const [mail, setMail] = useState('')
  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; localStorage.setItem('pdftools-theme', dark ? 'dark' : 'light') }, [dark])
  const count = useMemo(() => [...pdfTools, ...imageTools].filter(tool => tool.name.toLowerCase().includes(query.toLowerCase())).length, [query])
  const subscribe = async event => { event.preventDefault(); const email = new FormData(event.currentTarget).get('email'); await fetch('/api/newsletter', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) }).catch(() => null); setMail('Đăng ký thành công!') }

  return <div className="app redesigned"><header className="header"><a className="brand" href="#home"><span>P</span>PDFTools</a><nav><a className="active" href="#home">Trang chủ</a><a href="#pdf">PDF Tools</a><a href="#images">Image Tools</a><a href="#benefits">Vì sao chọn chúng tôi</a></nav><div className="header-actions"><button className="theme-toggle" aria-label="Đổi chế độ màu" onClick={() => setDark(!dark)}>{dark ? '☀' : '☾'}</button><button className="language">VI</button><a className="header-cta" href="#pdf">Dùng miễn phí <span>→</span></a></div></header><main id="home"><section className="hero"><div className="hero-copy"><div className="hero-kicker"><span>✦</span> Bộ công cụ tài liệu trực tuyến</div><h1>Làm việc với<br /><em>PDF &amp; hình ảnh</em><br />nhẹ nhàng hơn.</h1><p className="hero-text">Nén, chuyển đổi và xử lý tệp trong vài bước.<br />Nhanh chóng, rõ ràng và luôn tôn trọng dữ liệu của bạn.</p><label className="search"><span>⌕</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Bạn muốn làm gì với tệp của mình?" /><small>{query && `${count} công cụ`}</small></label><div className="hero-trust"><span>✓ Không cần đăng ký</span><span>✓ Giao diện tiếng Việt</span><span>✓ Preview trước khi tải</span></div></div><div className="hero-illustration"><div className="document"><div className="doc-dots">●　●　●</div><div className="doc-sidebar" /><div className="doc-lines"><b /><b /><b /><b /><div /><b /></div></div><span className="hero-chip pdf">PDF</span><span className="hero-chip word">W</span><span className="hero-chip image">▣</span><span className="hero-chip add">＋</span><i className="spark s1">✦</i><i className="spark s2">✦</i></div></section><div className="content"><ToolSection title="Công cụ PDF" tools={pdfTools} id="pdf" open={setModal} query={query} /><ToolSection title="Công cụ Ảnh" tools={imageTools} id="images" open={setModal} query={query} /><section className="benefits" id="benefits"><Benefit icon="♢" title="Bảo mật tuyệt đối" text="File của bạn được xử lý an toàn và tự động xóa sau 1 giờ." /><Benefit icon="ϟ" title="Xử lý nhanh chóng" text="Công nghệ hiện đại giúp xử lý file trong tích tắc." /><Benefit icon="☁" title="Hỗ trợ mọi thiết bị" text="Sử dụng dễ dàng trên mọi thiết bị, mọi nền tảng." /><Benefit icon="✪" title="Hoàn toàn miễn phí" text="Nhiều công cụ miễn phí 100%, không giới hạn lượt sử dụng." /></section></div></main><footer><div className="footer-top"><div className="footer-brand"><a className="brand" href="#home"><span>P</span>PDFTools</a><p>Một nơi đơn giản để xử lý mọi tài liệu và hình ảnh của bạn.</p></div><Footer title="Sản phẩm" items={['PDF Tools', 'Image Tools', 'Công cụ khác']} /><Footer title="Công ty" items={['Giới thiệu', 'Blog', 'Liên hệ']} /><div className="newsletter"><p>NHẬN MẸO HAY MỖI TUẦN</p><h3>Không bỏ lỡ điều thú vị</h3><form onSubmit={subscribe}><input name="email" required type="email" placeholder="Email của bạn" /><button>→</button></form>{mail && <small>{mail}</small>}</div></div><p className="copyright">© 2026 PDFTools · Làm việc thông minh hơn, mỗi ngày.</p></footer>{modal && <ToolModal mode={modal} close={() => setModal(null)} />}</div>
}

function Benefit({ icon, title, text }) { return <div><i>{icon}</i><span><strong>{title}</strong><small>{text}</small></span></div> }
function Footer({ title, items }) { return <div className="footer-column"><h3>{title}</h3>{items.map(item => <a href="#home" key={item}>{item}</a>)}</div> }
