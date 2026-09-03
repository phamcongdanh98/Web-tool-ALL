/**
 * Tra cứu vị trí địa lý IP (Quốc gia, Thành phố, Cờ) với bộ nhớ đệm vĩnh viễn
 */

// Cache vị trí in-memory để mỗi IP chỉ tra cứu 1 lần duy nhất
const geoCache = new Map()

export const getCountryFlag = (countryCode) => {
  if (!countryCode || countryCode.length !== 2) return '🌐'
  try {
    const codePoints = countryCode
      .toUpperCase()
      .split('')
      .map(char => 127397 + char.charCodeAt(0))
    return String.fromCodePoint(...codePoints)
  } catch {
    return '🌐'
  }
}

export const isPrivateIp = (ip) => {
  if (!ip) return true
  const cleanIp = ip.replace(/^::ffff:/, '').trim()
  if (
    cleanIp === '127.0.0.1' ||
    cleanIp === 'localhost' ||
    cleanIp === '::1' ||
    cleanIp === '' ||
    cleanIp === 'unknown'
  ) {
    return true
  }
  // Dải IP Private: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
  if (cleanIp.startsWith('10.') || cleanIp.startsWith('192.168.')) return true
  if (cleanIp.startsWith('172.')) {
    const parts = cleanIp.split('.')
    const second = parseInt(parts[1], 10)
    if (second >= 16 && second <= 31) return true
  }
  return false
}

export const lookupGeoIp = async (ip) => {
  if (!ip) {
    return { ip: '127.0.0.1', country: 'Localhost', countryCode: 'LOCAL', flag: '🏠', city: 'Nội bộ', label: '🏠 Localhost' }
  }

  const cleanIp = ip.replace(/^::ffff:/, '').trim()

  if (geoCache.has(cleanIp)) {
    return geoCache.get(cleanIp)
  }

  if (isPrivateIp(cleanIp)) {
    const localData = {
      ip: cleanIp,
      country: 'Localhost',
      countryCode: 'LOCAL',
      flag: '🏠',
      city: 'Nội bộ',
      label: '🏠 Localhost',
    }
    geoCache.set(cleanIp, localData)
    return localData
  }

  // Tra cứu qua ip-api.com với timeout bảo vệ 1500ms
  try {
    const res = await fetch(`http://ip-api.com/json/${cleanIp}?fields=status,country,countryCode,regionName,city`, {
      signal: AbortSignal.timeout(1500),
    })
    if (res.ok) {
      const data = await res.json()
      if (data.status === 'success') {
        const flag = getCountryFlag(data.countryCode)
        const city = data.city || data.regionName || data.country || ''
        const geoInfo = {
          ip: cleanIp,
          country: data.country || '',
          countryCode: data.countryCode || '',
          flag,
          city,
          label: `${flag} ${city ? city + ', ' : ''}${data.countryCode || ''}`.trim(),
        }
        geoCache.set(cleanIp, geoInfo)
        return geoInfo
      }
    }
  } catch {}

  // Fallback nếu lỗi mạng hoặc timeout
  const fallback = {
    ip: cleanIp,
    country: '',
    countryCode: '',
    flag: '🌐',
    city: '',
    label: `🌐 ${cleanIp}`,
  }
  geoCache.set(cleanIp, fallback)
  return fallback
}
