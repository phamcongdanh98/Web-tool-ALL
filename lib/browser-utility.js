const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value))

export const formatBytes = (bytes = 0) => {
  if (!bytes) return '0 KB'
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** index).toFixed(index ? 2 : 0)} ${units[index]}`
}

export const splitFileName = name => {
  const normalized = String(name || '').normalize('NFKC')
  const dot = normalized.lastIndexOf('.')
  if (dot <= 0 || dot === normalized.length - 1) return { stem: normalized, extension: '' }
  return { stem: normalized.slice(0, dot), extension: normalized.slice(dot + 1) }
}

export const sanitizeFileSegment = (value, fallback = 'tep') => {
  const cleaned = String(value || '')
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/g, '-')
    .replace(/\.{2,}/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/g, '')
    .replace(/^[. ]+/g, '')
    .trim()
    .slice(0, 120)
  return cleaned || fallback
}

export const buildRenamedFileNames = (files, options = {}) => {
  const pattern = String(options.pattern || '{name}-{n}').trim() || '{name}-{n}'
  const prefix = sanitizeFileSegment(options.prefix || '', '')
  const suffix = sanitizeFileSegment(options.suffix || '', '')
  const start = Math.max(0, Math.trunc(Number(options.start) || 1))
  const digits = clamp(Math.trunc(Number(options.digits) || 2), 1, 6)
  const usedNames = new Set()

  return Array.from(files || []).map((file, index) => {
    const originalName = String(file?.name || `tep-${index + 1}`)
    const { stem, extension } = splitFileName(originalName)
    const safeStem = sanitizeFileSegment(stem)
    const safeExtension = sanitizeFileSegment(extension, '').replaceAll(' ', '-').slice(0, 16)
    const number = String(start + index).padStart(digits, '0')
    const rendered = pattern
      .replaceAll('{name}', safeStem)
      .replaceAll('{n}', number)
      .replaceAll('{ext}', safeExtension)
    const base = sanitizeFileSegment(`${prefix}${rendered}${suffix}`).slice(0, 120)
    const extensionSuffix = safeExtension && !pattern.includes('{ext}') ? `.${safeExtension}` : ''
    let nextName = `${base}${extensionSuffix}`
    let duplicate = 2
    while (usedNames.has(nextName.toLocaleLowerCase('vi-VN'))) {
      nextName = `${base}-${duplicate}${extensionSuffix}`
      duplicate += 1
    }
    usedNames.add(nextName.toLocaleLowerCase('vi-VN'))
    return { file, originalName, nextName }
  })
}

export const redactionToPixels = (region, width, height) => {
  const imageWidth = Math.max(1, Math.trunc(Number(width) || 1))
  const imageHeight = Math.max(1, Math.trunc(Number(height) || 1))
  const x = clamp(Number(region?.x) || 0, 0, 100)
  const y = clamp(Number(region?.y) || 0, 0, 100)
  const w = clamp(Number(region?.w) || 0, 0, 100 - x)
  const h = clamp(Number(region?.h) || 0, 0, 100 - y)
  const left = clamp(Math.floor(imageWidth * x / 100), 0, imageWidth - 1)
  const top = clamp(Math.floor(imageHeight * y / 100), 0, imageHeight - 1)
  const pixelWidth = clamp(Math.ceil(imageWidth * w / 100), 1, imageWidth - left)
  const pixelHeight = clamp(Math.ceil(imageHeight * h / 100), 1, imageHeight - top)
  return { left, top, width: pixelWidth, height: pixelHeight }
}

export const transformRedactionRegion = (region, handle, deltaX, deltaY) => {
  const start = {
    x: clamp(Number(region?.x) || 0, 0, 100),
    y: clamp(Number(region?.y) || 0, 0, 100),
    w: clamp(Number(region?.w) || 2, 2, 100),
    h: clamp(Number(region?.h) || 2, 2, 100),
  }
  const dx = Number(deltaX) || 0
  const dy = Number(deltaY) || 0
  const next = { ...region, ...start }
  if (handle === 'move') {
    next.x = clamp(start.x + dx, 0, 100 - start.w)
    next.y = clamp(start.y + dy, 0, 100 - start.h)
    return next
  }
  if (handle.includes('e')) next.w = clamp(start.w + dx, 2, 100 - start.x)
  if (handle.includes('s')) next.h = clamp(start.h + dy, 2, 100 - start.y)
  if (handle.includes('w')) { next.x = clamp(start.x + dx, 0, start.x + start.w - 2); next.w = start.w + start.x - next.x }
  if (handle.includes('n')) { next.y = clamp(start.y + dy, 0, start.y + start.h - 2); next.h = start.h + start.y - next.y }
  return next
}

export const parsePublicHttpUrl = value => {
  try {
    const url = new URL(String(value || '').trim())
    return ['http:', 'https:'].includes(url.protocol) ? url : null
  } catch {
    return null
  }
}

export const trackClientTool = (tool, metadata = {}) => {
  if (typeof window === 'undefined') return
  const payload = JSON.stringify({
    tool,
    action: metadata.action || 'use',
    status: metadata.status || 'success',
    fileSize: metadata.fileSize || 0,
    details: metadata.details || null,
  })
  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' })
      navigator.sendBeacon('/api/analytics/track', blob)
      return
    }
  } catch {}
  fetch('/api/analytics/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
    keepalive: true,
  }).catch(() => {})
}
