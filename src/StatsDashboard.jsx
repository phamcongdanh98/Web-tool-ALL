import { useEffect, useMemo, useState, useCallback } from 'react'
import { useLanguage } from './i18n.jsx'

export const formatRelativeTime = (isoString, tx) => {
  if (!isoString) return '—'
  const diff = Date.now() - new Date(isoString).getTime()
  if (diff < 0) return tx('Vừa xong', 'Just now')
  const sec = Math.floor(diff / 1000)
  if (sec < 45) return tx('Vừa xong', 'Just now')
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} ${tx('phút trước', 'min ago')}`
  const hour = Math.floor(min / 60)
  if (hour < 24) return `${hour} ${tx('giờ trước', 'hr ago')}`
  const day = Math.floor(hour / 24)
  if (day < 30) return `${day} ${tx('ngày trước', 'days ago')}`
  return new Date(isoString).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
}

export const parseDeviceAndBrowser = (ua = '') => {
  if (!ua) return { icon: '💻', label: 'Desktop', browser: 'Browser' }
  const lower = String(ua).toLowerCase()

  let deviceIcon = '💻'
  let deviceLabel = 'Desktop'
  if (/mobile|iphone|ipod|android.*mobile|windows phone/i.test(lower)) {
    deviceIcon = '📱'
    deviceLabel = 'Mobile'
  } else if (/ipad|tablet|android(?!.*mobile)/i.test(lower)) {
    deviceIcon = '📟'
    deviceLabel = 'Tablet'
  }

  let browser = 'Web'
  if (/edg\//i.test(lower)) browser = 'Edge'
  else if (/opr\/|opera/i.test(lower)) browser = 'Opera'
  else if (/chrome|crios/i.test(lower)) browser = 'Chrome'
  else if (/firefox|fxios/i.test(lower)) browser = 'Firefox'
  else if (/safari/i.test(lower)) browser = 'Safari'
  else if (/curl|python|wget|postman/i.test(lower)) browser = 'Bot/CLI'

  return { icon: deviceIcon, label: deviceLabel, browser }
}

export const formatBytes = (bytes) => {
  const n = Number(bytes)
  if (!n || n <= 0) return '0 B'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`
}

export default function StatsDashboardModal({ close }) {
  const { tx } = useLanguage()
  const [adminPass, setAdminPass] = useState(() => {
    return localStorage.getItem('pdftools_admin_pass') || sessionStorage.getItem('pdftools_admin_pass') || ''
  })
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [inputPass, setInputPass] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [authError, setAuthError] = useState('')
  const [isCheckingAuth, setIsCheckingAuth] = useState(false)

  const [range, setRange] = useState('7days') // 'today' | '7days' | '30days' | 'all'
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('')
  const [quickFilter, setQuickFilter] = useState('all') // 'all' | 'errors' | 'visits' | 'tools' | 'blocked'
  const [activeTab, setActiveTab] = useState('events') // 'events' | 'tools' | 'ips' | 'blocked'
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [copied, setCopied] = useState(false)

  // Toast notification state
  const [toast, setToast] = useState(null)
  const showToast = useCallback((type, message) => {
    setToast({ type, message })
    const t = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(t)
  }, [])

  // Thao tác chặn IP thủ công modal state
  const [showManualBlock, setShowManualBlock] = useState(false)
  const [manualIp, setManualIp] = useState('')
  const [manualReason, setManualReason] = useState('')
  const [actionLoadingIp, setActionLoadingIp] = useState('')

  const fetchStats = useCallback(async (keyToUse, rangeToUse) => {
    const key = keyToUse || adminPass
    const currentRange = rangeToUse || range
    if (!key) return
    setLoading(true)
    try {
      const res = await fetch(`/api/stats?limit=100&range=${currentRange}&key=${encodeURIComponent(key)}`, {
        headers: { 'x-admin-key': key },
      })
      if (res.ok) {
        const data = await res.json()
        setStats(data)
        setIsUnlocked(true)
      } else if (res.status === 401) {
        setIsUnlocked(false)
        setStats(null)
        setAuthError(tx('Mật khẩu quản trị đã thay đổi hoặc không hợp lệ.', 'Admin passcode has changed or is invalid.'))
      }
    } catch {
      // Network error
    } finally {
      setLoading(false)
    }
  }, [adminPass, range, tx])

  useEffect(() => {
    if (adminPass) {
      fetchStats(adminPass, range)
    }
  }, [adminPass, range, fetchStats])

  useEffect(() => {
    if (!autoRefresh || !adminPass || !isUnlocked) return
    const timer = setInterval(() => {
      fetchStats(adminPass, range)
    }, 15000)
    return () => clearInterval(timer)
  }, [autoRefresh, adminPass, range, isUnlocked, fetchStats])

  const handleExport = () => {
    if (!stats) return
    const text = JSON.stringify(stats, null, 2)
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true)
      showToast('success', tx('Đã sao chép toàn bộ dữ liệu thống kê JSON!', 'Copied raw stats JSON to clipboard!'))
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {
      showToast('error', tx('Không thể sao chép dữ liệu.', 'Could not copy data.'))
    })
  }

  const handleCopyIp = (ip) => {
    if (!ip) return
    navigator.clipboard?.writeText(ip).then(() => {
      showToast('info', `📋 ${tx('Đã sao chép IP', 'Copied IP')}: ${ip}`)
    }).catch(() => {})
  }

  const handleBlockIp = async (targetIp, customReason) => {
    if (!targetIp) return
    const clean = targetIp.trim().toLowerCase()
    const reasonToUse = (customReason || manualReason || tx('Chặn bởi Quản trị viên', 'Blocked by Administrator')).trim()

    if (!customReason && !showManualBlock) {
      const confirmed = window.confirm(
        tx(`Bạn có chắc chắn muốn chặn địa chỉ IP ${clean}?\n\nIP này sẽ bị từ chối truy cập mọi công cụ xử lý tệp API.`,
           `Are you sure you want to block IP ${clean}?\n\nThis IP will be denied access to all file processing APIs.`)
      )
      if (!confirmed) return
    }

    setActionLoadingIp(clean)
    try {
      const res = await fetch('/api/admin/block-ip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminPass,
        },
        body: JSON.stringify({ ip: clean, reason: reasonToUse, key: adminPass }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        showToast('success', `🚫 ${data.message || tx(`Đã chặn IP ${clean} thành công.`, `Blocked IP ${clean} successfully.`)}`)
        setShowManualBlock(false)
        setManualIp('')
        setManualReason('')
        await fetchStats(adminPass, range)
      } else {
        showToast('error', `⚠️ ${data.message || tx('Không thể chặn IP này.', 'Could not block this IP.')}`)
      }
    } catch {
      showToast('error', tx('Lỗi kết nối tới máy chủ.', 'Network connection error.'))
    } finally {
      setActionLoadingIp('')
    }
  }

  const handleUnblockIp = async (targetIp) => {
    if (!targetIp) return
    const clean = targetIp.trim().toLowerCase()
    const confirmed = window.confirm(
      tx(`Bạn có chắc muốn bỏ chặn IP ${clean}?`, `Are you sure you want to unblock IP ${clean}?`)
    )
    if (!confirmed) return

    setActionLoadingIp(clean)
    try {
      const res = await fetch('/api/admin/unblock-ip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminPass,
        },
        body: JSON.stringify({ ip: clean, key: adminPass }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        showToast('success', `✅ ${data.message || tx(`Đã gỡ chặn IP ${clean} thành công.`, `Unblocked IP ${clean} successfully.`)}`)
        await fetchStats(adminPass, range)
      } else {
        showToast('error', `⚠️ ${data.message || tx('Không thể gỡ chặn IP này.', 'Could not unblock this IP.')}`)
      }
    } catch {
      showToast('error', tx('Lỗi kết nối tới máy chủ.', 'Network connection error.'))
    } finally {
      setActionLoadingIp('')
    }
  }

  const handleRangeChange = (newRange) => {
    setRange(newRange)
    if (adminPass) {
      fetchStats(adminPass, newRange)
    }
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    const trimmed = inputPass.trim()
    if (!trimmed) return

    setIsCheckingAuth(true)
    setAuthError('')

    try {
      const res = await fetch('/api/stats/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: trimmed }),
      })
      const data = await res.json()

      if (res.ok && data.ok) {
        if (rememberMe) {
          localStorage.setItem('pdftools_admin_pass', trimmed)
        } else {
          sessionStorage.setItem('pdftools_admin_pass', trimmed)
        }
        setAdminPass(trimmed)
        setInputPass('')
        await fetchStats(trimmed, range)
      } else {
        setAuthError(data.message || tx('Mật khẩu quản trị không chính xác.', 'Incorrect admin passcode.'))
      }
    } catch {
      setAuthError(tx('Không thể kết nối máy chủ.', 'Cannot connect to server.'))
    } finally {
      setIsCheckingAuth(false)
    }
  }

  const handleLock = () => {
    localStorage.removeItem('pdftools_admin_pass')
    sessionStorage.removeItem('pdftools_admin_pass')
    setAdminPass('')
    setIsUnlocked(false)
    setStats(null)
    setInputPass('')
    setAuthError('')
  }

  const blockedIpSet = useMemo(() => {
    return new Set((stats?.blockedIps || []).map(b => String(b.ip).toLowerCase()))
  }, [stats?.blockedIps])

  const filteredEvents = useMemo(() => {
    if (!stats?.recentEvents) return []
    let list = stats.recentEvents

    if (quickFilter === 'errors') {
      list = list.filter(ev => ev.status === 'error')
    } else if (quickFilter === 'visits') {
      list = list.filter(ev => ev.type === 'visit')
    } else if (quickFilter === 'tools') {
      list = list.filter(ev => ev.type === 'tool_use')
    } else if (quickFilter === 'blocked') {
      list = list.filter(ev => ev.ip && blockedIpSet.has(ev.ip.toLowerCase()))
    }

    const q = filter.trim().toLowerCase()
    if (!q) return list
    return list.filter(ev =>
      (ev.ip && ev.ip.toLowerCase().includes(q)) ||
      (ev.tool && ev.tool.toLowerCase().includes(q)) ||
      (ev.action && ev.action.toLowerCase().includes(q)) ||
      (ev.type && ev.type.toLowerCase().includes(q)) ||
      (ev.geo?.city && ev.geo.city.toLowerCase().includes(q)) ||
      (ev.geo?.countryCode && ev.geo.countryCode.toLowerCase().includes(q))
    )
  }, [filter, quickFilter, stats?.recentEvents, blockedIpSet])

  const s = stats?.summary || {}
  const dailyTrend = stats?.dailyTrend || []
  const maxTrendTotal = Math.max(...dailyTrend.map(d => d.total), 1)

  const desktopCount = s.deviceBreakdown?.desktop || 0
  const mobileCount = (s.deviceBreakdown?.mobile || 0) + (s.deviceBreakdown?.tablet || 0)
  const totalDevices = desktopCount + mobileCount
  const desktopPct = totalDevices > 0 ? Math.round((desktopCount / totalDevices) * 100) : 50
  const mobilePct = totalDevices > 0 ? (100 - desktopPct) : 50

  return (
    <div className="modal-shade" role="dialog" aria-modal="true" aria-label={tx('Thống kê truy cập', 'Analytics')}>
      {/* TOAST THÔNG BÁO NỔI */}
      {toast && (
        <div className={`stats-toast-popup ${toast.type}`}>
          <span>{toast.message}</span>
          <button type="button" onClick={() => setToast(null)}>×</button>
        </div>
      )}

      <section className="tool-modal stats-modal">
        <button className="close" type="button" aria-label={tx('Đóng', 'Close')} onClick={close}>×</button>

        {/* MÀN HÌNH KHÓA QUẢN TRỊ VIÊN */}
        {!isUnlocked ? (
          <div className="stats-admin-gate">
            <div className="admin-gate-icon">🔐</div>
            <h2>{tx('Xác thực Quản trị viên', 'Admin Authentication')}</h2>
            <p>
              {tx(
                'Bảng điều khiển thống kê IP và dữ liệu truy cập chỉ dành cho Quản trị viên. Vui lòng nhập mật khẩu để mở khóa.',
                'The IP analytics and access logs dashboard is restricted to Administrators. Please enter the passcode to unlock.'
              )}
            </p>

            <form onSubmit={handleLogin} className="admin-gate-form">
              <div className="admin-input-wrap">
                <input
                  type={showPass ? 'text' : 'password'}
                  placeholder={tx('Nhập mật khẩu quản trị…', 'Enter admin passcode…')}
                  value={inputPass}
                  onChange={e => { setInputPass(e.target.value); setAuthError('') }}
                  autoFocus
                  disabled={isCheckingAuth}
                />
                <button
                  type="button"
                  className="admin-toggle-eye"
                  onClick={() => setShowPass(!showPass)}
                  title={showPass ? 'Ẩn' : 'Hiện'}
                >
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>

              {authError && <div className="admin-gate-error">⚠️ {authError}</div>}

              <label className="admin-remember-label">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                />
                <span>{tx('Ghi nhớ đăng nhập trên thiết bị này', 'Remember login on this device')}</span>
              </label>

              <button
                type="submit"
                className="admin-unlock-btn"
                disabled={isCheckingAuth || !inputPass.trim()}
              >
                {isCheckingAuth ? tx('Đang kiểm tra…', 'Verifying…') : tx('Mở khóa Thống kê', 'Unlock Dashboard')}
              </button>
            </form>
          </div>
        ) : (
          /* NỘI DUNG THỐNG KÊ ĐÃ MỞ KHÓA */
          <>
            <div className="stats-modal-header">
              <div>
                <div className="stats-badge"><span>●</span> ADMIN ANALYTICS & SECURITY</div>
                <h2>{tx('Thống kê truy cập & Quản lý bảo mật IP', 'Access Analytics & IP Security Control')}</h2>
                <p>{tx('Theo dõi thời gian thực địa chỉ IP, thời gian truy cập, thiết bị và kiểm soát danh sách chặn.', 'Real-time monitoring of IP addresses, access timestamps, devices, and blacklist management.')}</p>
              </div>
              <div className="stats-header-actions">
                <button
                  type="button"
                  className={`stats-auto-btn ${autoRefresh ? 'active' : ''}`}
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  title={tx('Tự động cập nhật mỗi 15 giây', 'Auto refresh every 15s')}
                >
                  ⏱️ {autoRefresh ? tx('Live (15s)', 'Live (15s)') : tx('Tự động', 'Auto')}
                </button>
                <button
                  type="button"
                  className="stats-block-manual-btn"
                  onClick={() => setShowManualBlock(true)}
                  title={tx('Thêm IP vào danh sách chặn thủ công', 'Manually block an IP')}
                >
                  🚫 {tx('Chặn IP thủ công', 'Block IP')}
                </button>
                <button
                  type="button"
                  className="stats-export-btn"
                  onClick={handleExport}
                  title={tx('Sao chép toàn bộ dữ liệu JSON', 'Copy raw JSON data')}
                >
                  {copied ? '✓ ' + tx('Đã chép!', 'Copied!') : '📋 ' + tx('Xuất JSON', 'Export JSON')}
                </button>
                <button type="button" className="stats-refresh-btn" onClick={() => fetchStats(adminPass, range)} disabled={loading}>
                  <span className={loading ? 'spinning' : ''}>↻</span> {tx('Làm mới', 'Refresh')}
                </button>
                <button type="button" className="stats-lock-btn" onClick={handleLock} title={tx('Khóa lại', 'Lock')}>
                  🔒 {tx('Đăng xuất', 'Lock')}
                </button>
              </div>
            </div>

            {/* MODAL / KHỐI CHẶN IP THỦ CÔNG */}
            {showManualBlock && (
              <div className="stats-manual-block-box">
                <div className="manual-block-header">
                  <h4>🚫 {tx('Thêm địa chỉ IP vào danh sách chặn', 'Block IP Address Manually')}</h4>
                  <button type="button" onClick={() => setShowManualBlock(false)}>×</button>
                </div>
                <p className="manual-block-desc">
                  {tx('IP bị chặn sẽ bị từ chối truy cập vào toàn bộ các API công cụ xử lý tệp (HTTP 403 Forbidden).',
                      'Blocked IPs will be rejected from calling all file processing APIs (HTTP 403 Forbidden).')}
                </p>
                <form
                  onSubmit={e => {
                    e.preventDefault()
                    if (manualIp.trim()) handleBlockIp(manualIp, manualReason)
                  }}
                  className="manual-block-form"
                >
                  <div className="manual-inputs-grid">
                    <input
                      type="text"
                      placeholder={tx('Nhập địa chỉ IP (vd: 14.161.x.x, 2001:…)', 'Enter IP address (e.g. 14.161.x.x)…')}
                      value={manualIp}
                      onChange={e => setManualIp(e.target.value)}
                      autoFocus
                      required
                    />
                    <input
                      type="text"
                      placeholder={tx('Lý do chặn (vd: Spam request, Nghi vấn quét bảo mật…)', 'Reason for block…')}
                      value={manualReason}
                      onChange={e => setManualReason(e.target.value)}
                    />
                  </div>
                  <div className="manual-form-actions">
                    <button type="button" className="cancel-btn" onClick={() => setShowManualBlock(false)}>
                      {tx('Hủy', 'Cancel')}
                    </button>
                    <button
                      type="submit"
                      className="confirm-block-btn"
                      disabled={!manualIp.trim() || actionLoadingIp === manualIp.trim()}
                    >
                      {actionLoadingIp === manualIp.trim() ? tx('Đang xử lý…', 'Processing…') : tx('🚫 Xác nhận Chặn IP', 'Confirm Block IP')}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* BỘ CHỌN CHU KỲ THỜI GIAN */}
            <div className="stats-range-bar">
              <span className="stats-range-title">⏳ {tx('Chu kỳ thống kê:', 'Time Period:')}</span>
              <div className="stats-range-buttons">
                <button
                  type="button"
                  className={range === 'today' ? 'active' : ''}
                  onClick={() => handleRangeChange('today')}
                >
                  📅 {tx('Hôm nay', 'Today')}
                </button>
                <button
                  type="button"
                  className={range === '7days' ? 'active' : ''}
                  onClick={() => handleRangeChange('7days')}
                >
                  🗓️ {tx('7 ngày qua', 'Last 7 days')}
                </button>
                <button
                  type="button"
                  className={range === '30days' ? 'active' : ''}
                  onClick={() => handleRangeChange('30days')}
                >
                  📆 {tx('30 ngày qua', 'Last 30 days')}
                </button>
                <button
                  type="button"
                  className={range === 'all' ? 'active' : ''}
                  onClick={() => handleRangeChange('all')}
                >
                  ♾️ {tx('Tất cả thời gian', 'All Time')}
                </button>
              </div>
            </div>

            {/* 8 THẺ CHỈ SỐ KPI MỞ RỘNG */}
            <div className="stats-kpi-grid">
              {/* Card 1: Lượt truy cập */}
              <div className="stats-kpi-card">
                <span className="kpi-icon">👁️</span>
                <div>
                  <small>{tx('Lượt truy cập Web', 'Web Visits')}</small>
                  <strong>{(s.totalVisits || 0).toLocaleString()}</strong>
                  <em>{tx(`Hôm nay: ${s.todayVisits || 0}`, `Today: ${s.todayVisits || 0}`)}</em>
                </div>
              </div>

              {/* Card 2: IP duy nhất */}
              <div className="stats-kpi-card">
                <span className="kpi-icon">🌐</span>
                <div>
                  <small>{tx('Địa chỉ IP duy nhất', 'Unique IPs')}</small>
                  <strong>{(s.uniqueIps || 0).toLocaleString()}</strong>
                  <em>{tx(`Vừa hoạt động (15p): ${s.recentlyActiveCount || 0}`, `Active recently: ${s.recentlyActiveCount || 0}`)}</em>
                </div>
              </div>

              {/* Card 3: Lượt dùng công cụ */}
              <div className="stats-kpi-card">
                <span className="kpi-icon">⚡</span>
                <div>
                  <small>{tx('Lượt dùng công cụ', 'Tool Uses')}</small>
                  <strong>{(s.totalToolUses || 0).toLocaleString()}</strong>
                  <em>{tx(`Hôm nay: ${s.todayToolUses || 0}`, `Today: ${s.todayToolUses || 0}`)}</em>
                </div>
              </div>

              {/* Card 4: Tỷ lệ thành công */}
              <div className="stats-kpi-card">
                <span className="kpi-icon">🎯</span>
                <div>
                  <small>{tx('Tỷ lệ thành công', 'Success Rate')}</small>
                  <strong className="kpi-highlight-success">
                    {s.successRate !== undefined ? `${s.successRate}%` : '100%'}
                  </strong>
                  <em>{tx(`Thành công: ${s.successCount || 0} · Lỗi: ${s.errorCount || 0}`, `OK: ${s.successCount || 0} · Err: ${s.errorCount || 0}`)}</em>
                </div>
              </div>

              {/* Card 5: Độ trễ trung bình */}
              <div className="stats-kpi-card">
                <span className="kpi-icon">⏱️</span>
                <div>
                  <small>{tx('Thời gian xử lý TB', 'Avg Latency')}</small>
                  <strong>{s.avgDurationMs ? `${s.avgDurationMs} ms` : '—'}</strong>
                  <em>{tx('Độ trễ API công cụ', 'Tool API response time')}</em>
                </div>
              </div>

              {/* Card 6: Dung lượng xử lý */}
              <div className="stats-kpi-card">
                <span className="kpi-icon">💾</span>
                <div>
                  <small>{tx('Dung lượng tệp xử lý', 'Data Processed')}</small>
                  <strong>{formatBytes(s.totalBytesProcessed)}</strong>
                  <em>{tx('Tổng tệp tải lên', 'Total uploaded bytes')}</em>
                </div>
              </div>

              {/* Card 7: Số IP đang bị chặn */}
              <div className="stats-kpi-card">
                <span className="kpi-icon">🚫</span>
                <div>
                  <small>{tx('IP đang bị chặn', 'Active Blocked IPs')}</small>
                  <strong className={(s.totalBlockedIps || 0) > 0 ? 'text-blocked-count' : ''}>
                    {(s.totalBlockedIps || 0).toLocaleString()} IP
                  </strong>
                  <em>{tx('Bảo vệ chống spam/DDoS', 'Spam/DDoS blacklist')}</em>
                </div>
              </div>

              {/* Card 8: Phân bố thiết bị */}
              <div className="stats-kpi-card">
                <span className="kpi-icon">📱</span>
                <div>
                  <small>{tx('Phân loại Thiết bị', 'Device Breakdown')}</small>
                  <strong>{desktopPct}% 💻 · {mobilePct}% 📱</strong>
                  <em>{tx(`Máy tính ${desktopCount} · Di động ${mobileCount}`, `Desktop ${desktopCount} · Mobile ${mobileCount}`)}</em>
                </div>
              </div>
            </div>

            {/* BIỂU ĐỒ CỘT XU HƯỚNG THEO NGÀY */}
            {dailyTrend.length > 0 && range !== 'today' && (
              <div className="stats-chart-card">
                <div className="stats-chart-header">
                  <div>
                    <h4>📊 {tx('Biểu đồ xu hướng hoạt động theo ngày', 'Daily Activity Trend')}</h4>
                    <small>{tx('Số lượt truy cập trang và số lần gọi công cụ mỗi ngày', 'Daily website visits and tool invocations')}</small>
                  </div>
                  <div className="stats-chart-legend">
                    <span className="legend-item"><span className="legend-dot legend-visits"></span> {tx('Truy cập web', 'Visits')}</span>
                    <span className="legend-item"><span className="legend-dot legend-tools"></span> {tx('Dùng công cụ', 'Tools')}</span>
                  </div>
                </div>

                <div className="stats-bar-chart">
                  {dailyTrend.map(d => {
                    const totalPct = Math.min(100, Math.max(d.total > 0 ? 12 : 2, Math.round((d.total / maxTrendTotal) * 100)))
                    const toolRatio = d.total > 0 ? (d.toolUses / d.total) * 100 : 0
                    const visitRatio = d.total > 0 ? (d.visits / d.total) * 100 : 100

                    return (
                      <div className="chart-col" key={d.dateKey}>
                        <div
                          className="chart-bar-wrap"
                          title={`${d.label} (${d.dateKey}): ${d.visits} truy cập · ${d.toolUses} dùng tool (Tổng: ${d.total})`}
                        >
                          <span className="chart-col-value">{d.total > 0 ? d.total : ''}</span>
                          <div className="chart-bar-stacked" style={{ height: `${totalPct}%` }}>
                            <div className="bar-part bar-tools" style={{ height: `${toolRatio}%` }}></div>
                            <div className="bar-part bar-visits" style={{ height: `${visitRatio}%` }}></div>
                          </div>
                        </div>
                        <span className="chart-col-label">{d.label}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* BỘ LỌC VÀ TABS */}
            <div className="stats-nav-bar">
              <div className="stats-tabs">
                <button
                  type="button"
                  className={activeTab === 'events' ? 'active' : ''}
                  onClick={() => setActiveTab('events')}
                >
                  ⏱️ {tx('Nhật ký hoạt động', 'Activity Log')} ({filteredEvents.length})
                </button>
                <button
                  type="button"
                  className={activeTab === 'tools' ? 'active' : ''}
                  onClick={() => setActiveTab('tools')}
                >
                  🏆 {tx('Top công cụ', 'Top Tools')} ({stats?.topTools?.length || 0})
                </button>
                <button
                  type="button"
                  className={activeTab === 'ips' ? 'active' : ''}
                  onClick={() => setActiveTab('ips')}
                >
                  🌐 {tx('Top địa chỉ IP', 'Top IPs')} ({stats?.topIps?.length || 0})
                </button>
                <button
                  type="button"
                  className={`tab-blocked ${activeTab === 'blocked' ? 'active' : ''}`}
                  onClick={() => setActiveTab('blocked')}
                >
                  🚫 {tx('IP đã chặn', 'Blocked IPs')} ({stats?.blockedIps?.length || 0})
                </button>
              </div>

              <div className="stats-search-box">
                <span>⌕</span>
                <input
                  type="text"
                  placeholder={tx('Lọc theo IP, công cụ, thành phố…', 'Filter by IP, tool, city…')}
                  value={filter}
                  onChange={e => setFilter(e.target.value)}
                />
                {filter && <button type="button" onClick={() => setFilter('')}>×</button>}
              </div>
            </div>

            {/* QUICK FILTER CHIPS (KHI Ở TAB NHẬT KÝ) */}
            {activeTab === 'events' && (
              <div className="stats-filter-chips">
                <span className="chip-label">{tx('Lọc nhanh:', 'Quick filter:')}</span>
                <button
                  type="button"
                  className={`filter-chip ${quickFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setQuickFilter('all')}
                >
                  {tx('Tất cả', 'All')}
                </button>
                <button
                  type="button"
                  className={`filter-chip chip-tools ${quickFilter === 'tools' ? 'active' : ''}`}
                  onClick={() => setQuickFilter('tools')}
                >
                  ⚡ {tx('Dùng công cụ', 'Tool Uses')}
                </button>
                <button
                  type="button"
                  className={`filter-chip chip-visits ${quickFilter === 'visits' ? 'active' : ''}`}
                  onClick={() => setQuickFilter('visits')}
                >
                  👁️ {tx('Truy cập Web', 'Web Visits')}
                </button>
                <button
                  type="button"
                  className={`filter-chip chip-errors ${quickFilter === 'errors' ? 'active' : ''}`}
                  onClick={() => setQuickFilter('errors')}
                >
                  ⚠️ {tx('Chỉ sự kiện lỗi', 'Errors only')}
                </button>
                <button
                  type="button"
                  className={`filter-chip chip-blocked ${quickFilter === 'blocked' ? 'active' : ''}`}
                  onClick={() => setQuickFilter('blocked')}
                >
                  🚫 {tx('IP đã bị chặn', 'Blocked IPs')}
                </button>
              </div>
            )}

            {/* TAB NỘI DUNG 1: NHẬT KÝ HOẠT ĐỘNG */}
            {activeTab === 'events' && (
              <div className="stats-table-container">
                {filteredEvents.length === 0 ? (
                  <div className="stats-empty">
                    <p>{filter || quickFilter !== 'all' ? tx('Không tìm thấy sự kiện nào khớp bộ lọc.', 'No matching events found.') : tx('Chưa có sự kiện nào trong chu kỳ đã chọn.', 'No events recorded in this period.')}</p>
                  </div>
                ) : (
                  <table className="stats-table">
                    <thead>
                      <tr>
                        <th>{tx('Thời gian truy cập', 'Access Time')}</th>
                        <th>{tx('Địa chỉ IP & Vị trí', 'IP & Location')}</th>
                        <th>{tx('Thiết bị', 'Device')}</th>
                        <th>{tx('Hoạt động / Công cụ', 'Activity / Tool')}</th>
                        <th>{tx('Độ trễ', 'Duration')}</th>
                        <th>{tx('Trạng thái', 'Status')}</th>
                        <th>{tx('Dung lượng', 'Size')}</th>
                        <th style={{ textAlign: 'center' }}>{tx('Thao tác', 'Action')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEvents.map(ev => {
                        const isVisit = ev.type === 'visit'
                        const isSuccess = ev.status !== 'error'
                        const relativeTime = formatRelativeTime(ev.timestamp, tx)
                        const exactTime = new Date(ev.timestamp).toLocaleTimeString('vi-VN', {
                          hour: '2-digit', minute: '2-digit', second: '2-digit',
                        })
                        const exactDate = new Date(ev.timestamp).toLocaleDateString('vi-VN', {
                          day: '2-digit', month: '2-digit', year: 'numeric',
                        })
                        const fullDateTime = `${exactTime} · ${exactDate}`

                        const device = parseDeviceAndBrowser(ev.userAgent)
                        const isIpBlocked = ev.ip && blockedIpSet.has(ev.ip.toLowerCase())
                        const isLoading = actionLoadingIp === ev.ip?.toLowerCase()

                        return (
                          <tr key={ev.id} className={isIpBlocked ? 'row-blocked' : ''}>
                            <td className="stats-time-col" title={fullDateTime}>
                              <strong className="time-relative">{relativeTime}</strong>
                              <small className="time-exact">{exactTime}</small>
                            </td>
                            <td>
                              <div className="stats-ip-cell">
                                <span className="ip-flag" title={ev.geo?.label || ''}>{ev.geo?.flag || '🌐'}</span>
                                <code
                                  className="ip-clickable"
                                  onClick={() => handleCopyIp(ev.ip)}
                                  title={tx('Bấm để sao chép IP', 'Click to copy IP')}
                                >
                                  {ev.ip}
                                </code>
                                {ev.geo?.city && <small className="ip-city">{ev.geo.city}</small>}
                                {isIpBlocked && (
                                  <span className="badge-blocked">🚫 {tx('ĐÃ CHẶN', 'BLOCKED')}</span>
                                )}
                              </div>
                            </td>
                            <td>
                              <div className="device-cell" title={ev.userAgent || ''}>
                                <span className="device-icon">{device.icon}</span>
                                <span className="device-browser">{device.browser}</span>
                              </div>
                            </td>
                            <td>
                              {isVisit ? (
                                <span className="badge-visit">👁️ {tx('Truy cập Web', 'Web Visit')}</span>
                              ) : (
                                <span className="badge-tool">
                                  🔧 <strong>{ev.tool}</strong>
                                  {ev.action && <small>({ev.action})</small>}
                                </span>
                              )}
                            </td>
                            <td>
                              {ev.durationMs > 0 ? (
                                <span className={`stats-duration ${ev.durationMs < 500 ? 'fast' : ev.durationMs < 2000 ? 'medium' : 'slow'}`}>
                                  {ev.durationMs < 1000 ? `${ev.durationMs}ms` : `${(ev.durationMs / 1000).toFixed(1)}s`}
                                </span>
                              ) : '—'}
                            </td>
                            <td>
                              <div className="status-cell">
                                <span className={`stats-badge-status ${isSuccess ? 'success' : 'error'}`}>
                                  {isSuccess ? tx('Thành công', 'Success') : tx('Lỗi', 'Error')}
                                </span>
                                <span className={`stats-badge-source ${ev.source || 'api'}`}>
                                  {ev.source === 'client' ? 'Client' : 'API'}
                                </span>
                              </div>
                            </td>
                            <td>
                              {ev.fileSize > 0 ? (
                                <span className="stats-filesize">{formatBytes(ev.fileSize)}</span>
                              ) : '—'}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <div className="stats-row-actions">
                                <button
                                  type="button"
                                  className="icon-action-btn"
                                  onClick={() => setFilter(ev.ip)}
                                  title={tx(`Lọc sự kiện của IP ${ev.ip}`, `Filter events for IP ${ev.ip}`)}
                                >
                                  ⌕
                                </button>
                                <button
                                  type="button"
                                  className="icon-action-btn"
                                  onClick={() => handleCopyIp(ev.ip)}
                                  title={tx('Sao chép địa chỉ IP', 'Copy IP address')}
                                >
                                  📋
                                </button>
                                {isIpBlocked ? (
                                  <button
                                    type="button"
                                    className="action-unblock-btn-mini"
                                    onClick={() => handleUnblockIp(ev.ip)}
                                    disabled={isLoading}
                                    title={tx('Bỏ chặn IP này', 'Unblock this IP')}
                                  >
                                    ✅
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    className="action-block-btn-mini"
                                    onClick={() => handleBlockIp(ev.ip)}
                                    disabled={isLoading}
                                    title={tx('Chặn IP này', 'Block this IP')}
                                  >
                                    🚫
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* TAB NỘI DUNG 2: TOP CÔNG CỤ */}
            {activeTab === 'tools' && (
              <div className="stats-table-container">
                {(!stats?.topTools || stats.topTools.length === 0) ? (
                  <div className="stats-empty"><p>{tx('Chưa có thống kê công cụ trong chu kỳ này.', 'No tool stats in this period.')}</p></div>
                ) : (
                  <table className="stats-table">
                    <thead>
                      <tr>
                        <th>{tx('Công cụ', 'Tool')}</th>
                        <th>{tx('Tổng lượt dùng', 'Total Uses')}</th>
                        <th>{tx('Thành công', 'Successes')}</th>
                        <th>{tx('Lỗi', 'Errors')}</th>
                        <th>{tx('Tỷ lệ thành công', 'Success Rate')}</th>
                        <th>{tx('Lần cuối gọi', 'Last Used')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.topTools.map(item => {
                        const total = item.totalUses || 0
                        const rate = total > 0 ? Math.round(((item.successes || 0) / total) * 100) : 100
                        return (
                          <tr key={item.tool}>
                            <td><strong>{item.tool}</strong></td>
                            <td><strong>{total.toLocaleString()}</strong></td>
                            <td><span className="text-success">{(item.successes || 0).toLocaleString()}</span></td>
                            <td><span className={item.errors > 0 ? 'text-error' : 'text-muted'}>{(item.errors || 0).toLocaleString()}</span></td>
                            <td>
                              <span className={`badge-success-rate ${rate >= 90 ? 'high' : rate >= 70 ? 'medium' : 'low'}`}>
                                {rate}%
                              </span>
                            </td>
                            <td>
                              <span title={item.lastUsed ? new Date(item.lastUsed).toLocaleString('vi-VN') : ''}>
                                {formatRelativeTime(item.lastUsed, tx)}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* TAB NỘI DUNG 3: TOP ĐỊA CHỈ IP */}
            {activeTab === 'ips' && (
              <div className="stats-table-container">
                {(!stats?.topIps || stats.topIps.length === 0) ? (
                  <div className="stats-empty"><p>{tx('Chưa có thống kê IP trong chu kỳ này.', 'No IP stats in this period.')}</p></div>
                ) : (
                  <table className="stats-table">
                    <thead>
                      <tr>
                        <th>{tx('Địa chỉ IP & Vị trí', 'IP Address & Location')}</th>
                        <th>{tx('Thiết bị', 'Device')}</th>
                        <th>{tx('Lần đầu truy cập', 'First Seen')}</th>
                        <th>{tx('Lần cuối hoạt động', 'Last Seen')}</th>
                        <th>{tx('Truy cập', 'Visits')}</th>
                        <th>{tx('Dùng tool', 'Tools')}</th>
                        <th>{tx('Tỷ lệ thành công', 'Success Rate')}</th>
                        <th>{tx('Hành động', 'Action')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.topIps.map(item => {
                        const device = parseDeviceAndBrowser(item.userAgent)
                        const isBlocked = item.isBlocked || blockedIpSet.has(item.ip?.toLowerCase())
                        const isLoading = actionLoadingIp === item.ip?.toLowerCase()

                        return (
                          <tr key={item.ip} className={isBlocked ? 'row-blocked' : ''}>
                            <td>
                              <div className="stats-ip-cell">
                                <span className="ip-flag" title={item.geo?.label || ''}>{item.geo?.flag || '🌐'}</span>
                                <code
                                  className="ip-clickable"
                                  onClick={() => handleCopyIp(item.ip)}
                                  title={tx('Bấm để sao chép IP', 'Click to copy IP')}
                                >
                                  {item.ip}
                                </code>
                                {item.geo?.city && <span className="ip-city-badge">{item.geo.city}</span>}
                                {isBlocked && <span className="badge-blocked">🚫 {tx('ĐÃ CHẶN', 'BLOCKED')}</span>}
                              </div>
                            </td>
                            <td>
                              <span className="device-badge" title={item.userAgent || ''}>
                                {device.icon} {device.label}
                              </span>
                            </td>
                            <td className="stats-time-col">
                              <span>{formatRelativeTime(item.firstSeen, tx)}</span>
                              <small>{item.firstSeen ? new Date(item.firstSeen).toLocaleDateString('vi-VN') : '—'}</small>
                            </td>
                            <td className="stats-time-col">
                              <strong>{formatRelativeTime(item.lastSeen, tx)}</strong>
                              <small>{item.lastSeen ? new Date(item.lastSeen).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '—'}</small>
                            </td>
                            <td>{(item.visits || 0).toLocaleString()}</td>
                            <td><strong>{(item.toolUses || 0).toLocaleString()}</strong></td>
                            <td>
                              <span className={`badge-success-rate ${(item.successRate ?? 100) >= 90 ? 'high' : 'medium'}`}>
                                {item.successRate ?? 100}%
                              </span>
                            </td>
                            <td>
                              <div className="ip-action-buttons">
                                <button
                                  type="button"
                                  className="icon-action-btn"
                                  onClick={() => {
                                    setFilter(item.ip)
                                    setActiveTab('events')
                                  }}
                                  title={tx(`Xem nhật ký của IP ${item.ip}`, `View activity logs for IP ${item.ip}`)}
                                >
                                  ⌕
                                </button>
                                {isBlocked ? (
                                  <button
                                    type="button"
                                    className="action-unblock-btn"
                                    onClick={() => handleUnblockIp(item.ip)}
                                    disabled={isLoading}
                                    title={tx('Mở chặn IP này', 'Unblock this IP')}
                                  >
                                    ✅ {tx('Bỏ chặn', 'Unblock')}
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    className="action-block-btn"
                                    onClick={() => handleBlockIp(item.ip)}
                                    disabled={isLoading}
                                    title={tx('Chặn IP này truy cập API', 'Block this IP')}
                                  >
                                    🚫 {tx('Chặn IP', 'Block')}
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* TAB NỘI DUNG 4: DANH SÁCH IP ĐÃ CHẶN (BLOCKED IPS) */}
            {activeTab === 'blocked' && (
              <div className="stats-table-container">
                <div className="blocked-list-top-bar">
                  <div>
                    <h4>🛡️ {tx('Danh sách IP bị từ chối truy cập (Blacklist)', 'Blocked IPs Blacklist')}</h4>
                    <p>{tx('Các địa chỉ IP dưới đây sẽ bị chặn mọi yêu cầu gọi API công cụ xử lý tệp.',
                           'The following IP addresses are rejected from all file processing API calls.')}</p>
                  </div>
                  <button
                    type="button"
                    className="add-block-btn"
                    onClick={() => setShowManualBlock(true)}
                  >
                    + {tx('Thêm IP chặn mới', 'Add Blocked IP')}
                  </button>
                </div>

                {(!stats?.blockedIps || stats.blockedIps.length === 0) ? (
                  <div className="stats-empty">
                    <div style={{ fontSize: '36px', marginBottom: '8px' }}>🛡️</div>
                    <p><strong>{tx('Danh sách đen đang trống', 'Blacklist is currently empty')}</strong></p>
                    <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
                      {tx('Chưa có địa chỉ IP nào bị chặn. Khi phát hiện IP có dấu hiệu spam, bạn có thể bấm "Chặn IP" tại đây.',
                          'No IP addresses are currently blocked. You can manually block suspicious IPs here.')}
                    </p>
                  </div>
                ) : (
                  <table className="stats-table">
                    <thead>
                      <tr>
                        <th>{tx('Địa chỉ IP', 'IP Address')}</th>
                        <th>{tx('Vị trí địa lý', 'Geo Location')}</th>
                        <th>{tx('Lý do chặn', 'Block Reason')}</th>
                        <th>{tx('Thời điểm chặn', 'Blocked At')}</th>
                        <th style={{ textAlign: 'center' }}>{tx('Hành động', 'Action')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.blockedIps.map(item => {
                        const isLoading = actionLoadingIp === item.ip?.toLowerCase()
                        const blockTime = item.blockedAt ? new Date(item.blockedAt).toLocaleString('vi-VN') : '—'
                        const relative = formatRelativeTime(item.blockedAt, tx)

                        return (
                          <tr key={item.ip} className="row-blocked">
                            <td>
                              <div className="stats-ip-cell">
                                <code
                                  className="ip-clickable"
                                  onClick={() => handleCopyIp(item.ip)}
                                  title={tx('Bấm để sao chép', 'Click to copy')}
                                >
                                  {item.ip}
                                </code>
                                <span className="badge-blocked">🚫 {tx('ĐÃ CHẶN', 'BLOCKED')}</span>
                              </div>
                            </td>
                            <td>{item.geoLabel || '🌐 Global'}</td>
                            <td>
                              <span className="blocked-reason-text">
                                {item.reason || tx('Chặn bởi Quản trị viên', 'Blocked by Administrator')}
                              </span>
                            </td>
                            <td className="stats-time-col">
                              <strong>{relative}</strong>
                              <small>{blockTime}</small>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <button
                                type="button"
                                className="action-unblock-btn"
                                onClick={() => handleUnblockIp(item.ip)}
                                disabled={isLoading}
                                title={tx('Gỡ bỏ IP khỏi danh sách chặn', 'Remove IP from blacklist')}
                              >
                                {isLoading ? tx('Đang xử lý…', 'Processing…') : `✅ ${tx('Gỡ chặn', 'Unblock')}`}
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            <div className="stats-footer-note">
              <small>{tx('Dữ liệu được lưu trữ vĩnh viễn trong thư mục shared data (.deploy/shared/data). Mật khẩu quản trị được bảo vệ an toàn.', 'Data is permanently stored in shared storage (.deploy/shared/data). Admin access protected.')}</small>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
