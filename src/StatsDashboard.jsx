import { useEffect, useMemo, useState } from 'react'
import { useLanguage } from './i18n.jsx'

export default function StatsDashboardModal({ close }) {
  const { language, tx } = useLanguage()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [activeTab, setActiveTab] = useState('events') // 'events' | 'tools' | 'ips'

  const fetchStats = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/stats?limit=60')
      if (res.ok) {
        const data = await res.json()
        setStats(data)
      }
    } catch {}
    finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [])

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

        <div className="stats-modal-header">
          <div>
            <div className="stats-badge"><span>●</span> LIVE ANALYTICS</div>
            <h2>{tx('Thống kê truy cập & Sử dụng công cụ', 'Access & Tool Usage Analytics')}</h2>
            <p>{tx('Theo dõi thời gian thực địa chỉ IP, lượt truy cập web và lịch sử người dùng gọi công cụ.', 'Real-time monitoring of IP addresses, web visits, and tool invocation history.')}</p>
          </div>
          <div className="stats-header-actions">
            <button type="button" className="stats-refresh-btn" onClick={fetchStats} disabled={loading}>
              <span className={loading ? 'spinning' : ''}>↻</span> {tx('Làm mới', 'Refresh')}
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

        {/* TAB NỘI DUNG 1: NHẬT KÝ HOẠT ĐỘNG */}
        {activeTab === 'events' && (
          <div className="stats-table-container">
            {filteredEvents.length === 0 ? (
              <div className="stats-empty">
                <p>{loading ? tx('Đang tải dữ liệu…', 'Loading data…') : tx('Chưa có dữ liệu hoạt động nào phù hợp.', 'No matching activity records found.')}</p>
              </div>
            ) : (
              <table className="stats-table">
                <thead>
                  <tr>
                    <th>{tx('Thời gian', 'Timestamp')}</th>
                    <th>{tx('Địa chỉ IP', 'IP Address')}</th>
                    <th>{tx('Hoạt động / Công cụ', 'Activity / Tool')}</th>
                    <th>{tx('Nguồn', 'Source')}</th>
                    <th>{tx('Trạng thái', 'Status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEvents.map(ev => {
                    const date = new Date(ev.timestamp)
                    const timeStr = date.toLocaleTimeString('vi-VN') + ' ' + date.toLocaleDateString('vi-VN', { month: '2-digit', day: '2-digit' })
                    const isVisit = ev.type === 'visit'
                    const isSuccess = ev.status !== 'error'
                    return (
                      <tr key={ev.id || `${ev.timestamp}-${ev.ip}-${Math.random()}`}>
                        <td className="stats-time-col" title={date.toLocaleString('vi-VN')}>{timeStr}</td>
                        <td className="stats-ip-col">
                          <code>{ev.ip}</code>
                        </td>
                        <td className="stats-activity-col">
                          {isVisit ? (
                            <span className="tag-visit">👁️ {tx('Truy cập trang', 'Web Visit')}</span>
                          ) : (
                            <span className="tag-tool">🔧 <b>{ev.tool}</b> {ev.action && <small>({ev.action})</small>}</span>
                          )}
                        </td>
                        <td>
                          <span className={`stats-badge-source ${ev.source || (isVisit ? 'web' : 'api')}`}>
                            {ev.source || (isVisit ? 'web' : 'api')}
                          </span>
                        </td>
                        <td>
                          <span className={`stats-badge-status ${isSuccess ? 'success' : 'error'}`}>
                            {isSuccess ? '✓ OK' : '✕ ' + tx('Lỗi', 'Error')}
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

        {/* TAB NỘI DUNG 2: TOP CÔNG CỤ */}
        {activeTab === 'tools' && (
          <div className="stats-table-container">
            {(!stats?.topTools || stats.topTools.length === 0) ? (
              <div className="stats-empty"><p>{tx('Chưa có thống kê công cụ.', 'No tool stats yet.')}</p></div>
            ) : (
              <table className="stats-table">
                <thead>
                  <tr>
                    <th>{tx('Tên công cụ', 'Tool Name')}</th>
                    <th>{tx('Tổng lượt dùng', 'Total Uses')}</th>
                    <th>{tx('Thành công', 'Successes')}</th>
                    <th>{tx('Lỗi', 'Errors')}</th>
                    <th>{tx('Lần dùng gần nhất', 'Last Used')}</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.topTools.map(item => (
                    <tr key={item.tool}>
                      <td><b>🔧 {item.tool}</b></td>
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
          <small>{tx('Dữ liệu được lưu trữ tự động trong bộ nhớ và file data/analytics.jsonl. Chạy lệnh', 'Data is stored in memory and data/analytics.jsonl. Run')} <code>npm run stats</code> {tx('trên Terminal để xem trực tiếp.', 'on Terminal to view directly.')}</small>
        </div>
      </section>
    </div>
  )
}
