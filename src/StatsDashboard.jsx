import { useEffect, useMemo, useState, useCallback } from 'react'
import { useLanguage } from './i18n.jsx'

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

  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('')
  const [activeTab, setActiveTab] = useState('events') // 'events' | 'tools' | 'ips'

  const fetchStats = useCallback(async (keyToUse) => {
    const key = keyToUse || adminPass
    if (!key) return
    setLoading(true)
    try {
      const res = await fetch(`/api/stats?limit=80&key=${encodeURIComponent(key)}`, {
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
  }, [adminPass, tx])

  useEffect(() => {
    if (adminPass) {
      fetchStats(adminPass)
    }
  }, [adminPass, fetchStats])

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
        await fetchStats(trimmed)
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

  const filteredEvents = useMemo(() => {
    if (!stats?.recentEvents) return []
    const q = filter.trim().toLowerCase()
    if (!q) return stats.recentEvents
    return stats.recentEvents.filter(ev =>
      (ev.ip && ev.ip.toLowerCase().includes(q)) ||
      (ev.tool && ev.tool.toLowerCase().includes(q)) ||
      (ev.action && ev.action.toLowerCase().includes(q)) ||
      (ev.type && ev.type.toLowerCase().includes(q))
    )
  }, [filter, stats?.recentEvents])

  const s = stats?.summary || {}

  return (
    <div className="modal-shade" role="dialog" aria-modal="true" aria-label={tx('Thống kê truy cập', 'Analytics')}>
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
                <div className="stats-badge"><span>●</span> ADMIN ANALYTICS</div>
                <h2>{tx('Thống kê truy cập & Sử dụng công cụ', 'Access & Tool Usage Analytics')}</h2>
                <p>{tx('Theo dõi thời gian thực địa chỉ IP, lượt truy cập web và lịch sử người dùng gọi công cụ.', 'Real-time monitoring of IP addresses, web visits, and tool invocation history.')}</p>
              </div>
              <div className="stats-header-actions">
                <button type="button" className="stats-refresh-btn" onClick={() => fetchStats()} disabled={loading}>
                  <span className={loading ? 'spinning' : ''}>↻</span> {tx('Làm mới', 'Refresh')}
                </button>
                <button type="button" className="stats-lock-btn" onClick={handleLock} title={tx('Khóa lại', 'Lock')}>
                  🔒 {tx('Đăng xuất', 'Lock')}
                </button>
              </div>
            </div>

            {/* 4 THẺ CHỈ SỐ KPI */}
            <div className="stats-kpi-grid">
              <div className="stats-kpi-card">
                <span className="kpi-icon">👁️</span>
                <div>
                  <small>{tx('Tổng lượt truy cập', 'Total Visits')}</small>
                  <strong>{(s.totalVisits || 0).toLocaleString()}</strong>
                  <em>{tx(`Hôm nay: ${s.todayVisits || 0}`, `Today: ${s.todayVisits || 0}`)}</em>
                </div>
              </div>
              <div className="stats-kpi-card">
                <span className="kpi-icon">🌐</span>
                <div>
                  <small>{tx('Địa chỉ IP duy nhất', 'Unique IPs')}</small>
                  <strong>{(s.uniqueIps || 0).toLocaleString()}</strong>
                  <em>{tx('Đã nhận diện', 'Identified')}</em>
                </div>
              </div>
              <div className="stats-kpi-card">
                <span className="kpi-icon">⚡</span>
                <div>
                  <small>{tx('Lượt dùng công cụ', 'Tool Uses')}</small>
                  <strong>{(s.totalToolUses || 0).toLocaleString()}</strong>
                  <em>{tx(`Hôm nay: ${s.todayToolUses || 0}`, `Today: ${s.todayToolUses || 0}`)}</em>
                </div>
              </div>
              <div className="stats-kpi-card">
                <span className="kpi-icon">📦</span>
                <div>
                  <small>{tx('Tổng sự kiện lưu trữ', 'Events Stored')}</small>
                  <strong>{(s.totalEventsRecorded || 0).toLocaleString()}</strong>
                  <em>{tx('Nhật ký an toàn', 'Safe logs')}</em>
                </div>
              </div>
            </div>

            {/* BỘ LỌC VÀ TABS */}
            <div className="stats-nav-bar">
              <div className="stats-tabs">
                <button type="button" className={activeTab === 'events' ? 'active' : ''} onClick={() => setActiveTab('events')}>
                  ⏱️ {tx('Nhật ký hoạt động', 'Activity Log')} ({filteredEvents.length})
                </button>
                <button type="button" className={activeTab === 'tools' ? 'active' : ''} onClick={() => setActiveTab('tools')}>
                  🏆 {tx('Top công cụ', 'Top Tools')} ({stats?.topTools?.length || 0})
                </button>
                <button type="button" className={activeTab === 'ips' ? 'active' : ''} onClick={() => setActiveTab('ips')}>
                  🌐 {tx('Top địa chỉ IP', 'Top IPs')} ({stats?.topIps?.length || 0})
                </button>
              </div>

              <div className="stats-search-box">
                <span>⌕</span>
                <input
                  type="text"
                  placeholder={tx('Lọc theo IP hoặc tên công cụ…', 'Filter by IP or tool name…')}
                  value={filter}
                  onChange={e => setFilter(e.target.value)}
                />
                {filter && <button type="button" onClick={() => setFilter('')}>×</button>}
              </div>
            </div>

            {/* TAB NỘI DUNG 1: NHẬT KÝ */}
            {activeTab === 'events' && (
              <div className="stats-table-container">
                {filteredEvents.length === 0 ? (
                  <div className="stats-empty">
                    <p>{filter ? tx('Không tìm thấy sự kiện nào khớp bộ lọc.', 'No matching events found.') : tx('Chưa có sự kiện nào được ghi nhận.', 'No events recorded yet.')}</p>
                  </div>
                ) : (
                  <table className="stats-table">
                    <thead>
                      <tr>
                        <th>{tx('Thời gian', 'Time')}</th>
                        <th>{tx('Địa chỉ IP', 'IP Address')}</th>
                        <th>{tx('Hoạt động / Công cụ', 'Activity / Tool')}</th>
                        <th>{tx('Nguồn', 'Source')}</th>
                        <th>{tx('Trạng thái', 'Status')}</th>
                        <th>{tx('Kích thước', 'Size')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEvents.map(ev => {
                        const isVisit = ev.type === 'visit'
                        const isSuccess = ev.status !== 'error'
                        const timeStr = new Date(ev.timestamp).toLocaleTimeString('vi-VN', {
                          hour: '2-digit', minute: '2-digit', second: '2-digit',
                        })
                        const dateStr = new Date(ev.timestamp).toLocaleDateString('vi-VN', {
                          day: '2-digit', month: '2-digit',
                        })

                        return (
                          <tr key={ev.id}>
                            <td className="stats-time-col">
                              <span>{timeStr}</span>
                              <small>{dateStr}</small>
                            </td>
                            <td>
                              <code>{ev.ip}</code>
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
                              <span className={`badge-source ${ev.source || 'api'}`}>
                                {ev.source === 'client' ? 'Client' : 'API'}
                              </span>
                            </td>
                            <td>
                              <span className={`badge-status ${isSuccess ? 'success' : 'error'}`}>
                                {isSuccess ? tx('Thành công', 'Success') : tx('Lỗi', 'Error')}
                              </span>
                            </td>
                            <td>
                              {ev.fileSize > 0 ? (
                                <span className="stats-filesize">
                                  {(ev.fileSize / 1024 / 1024).toFixed(2)} MB
                                </span>
                              ) : '—'}
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
                  <div className="stats-empty"><p>{tx('Chưa có thống kê công cụ.', 'No tool stats yet.')}</p></div>
                ) : (
                  <table className="stats-table">
                    <thead>
                      <tr>
                        <th>{tx('Công cụ', 'Tool')}</th>
                        <th>{tx('Tổng lượt dùng', 'Total Uses')}</th>
                        <th>{tx('Thành công', 'Successes')}</th>
                        <th>{tx('Lỗi', 'Errors')}</th>
                        <th>{tx('Lần cuối', 'Last Used')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.topTools.map(item => (
                        <tr key={item.tool}>
                          <td><strong>{item.tool}</strong></td>
                          <td><strong>{item.totalUses.toLocaleString()}</strong></td>
                          <td><span className="text-success">{item.successes.toLocaleString()}</span></td>
                          <td><span className={item.errors > 0 ? 'text-error' : 'text-muted'}>{item.errors.toLocaleString()}</span></td>
                          <td>{item.lastUsed ? new Date(item.lastUsed).toLocaleString('vi-VN') : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* TAB NỘI DUNG 3: TOP IP */}
            {activeTab === 'ips' && (
              <div className="stats-table-container">
                {(!stats?.topIps || stats.topIps.length === 0) ? (
                  <div className="stats-empty"><p>{tx('Chưa có thống kê IP.', 'No IP stats yet.')}</p></div>
                ) : (
                  <table className="stats-table">
                    <thead>
                      <tr>
                        <th>{tx('Địa chỉ IP', 'IP Address')}</th>
                        <th>{tx('Lượt truy cập', 'Visits')}</th>
                        <th>{tx('Lượt dùng công cụ', 'Tool Uses')}</th>
                        <th>{tx('Lần cuối hoạt động', 'Last Seen')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.topIps.map(item => (
                        <tr key={item.ip}>
                          <td><code>{item.ip}</code></td>
                          <td>{item.visits.toLocaleString()}</td>
                          <td><strong>{item.toolUses.toLocaleString()}</strong></td>
                          <td>{item.lastSeen ? new Date(item.lastSeen).toLocaleString('vi-VN') : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            <div className="stats-footer-note">
              <small>{tx('Dữ liệu được lưu trữ tự động trong bộ nhớ và file data/analytics.jsonl. Mật khẩu quản trị được bảo vệ.', 'Data is stored in memory and data/analytics.jsonl. Admin access is protected.')}</small>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
