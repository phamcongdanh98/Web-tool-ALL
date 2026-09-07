import { useEffect, useState, useId } from 'react'
import { useLanguage } from './i18n.jsx'
import { formatBytes } from '../lib/browser-utility.js'

export default function AdminAddressModal({ close, inline = false }) {
  const { tx } = useLanguage()
  const [tab, setTab] = useState('lookup') // lookup | bulk | reverse | legal

  // Metadata CSDL
  const [meta, setMeta] = useState({
    oldProvinces: [],
    oldDistricts: [],
    oldWards: [],
    newProvinces: [],
    newWards: [],
    legalDocs: [],
  })
  const [loadingMeta, setLoadingMeta] = useState(true)

  // 1. Tab Tra cứu Cũ -> Mới (Mặc định chọn theo Tỉnh / Huyện / Xã trước)
  const [lookupMode, setLookupMode] = useState('cascade') // cascade | free
  const [freeAddress, setFreeAddress] = useState('')
  const [selOldProvince, setSelOldProvince] = useState('')
  const [selOldDistrict, setSelOldDistrict] = useState('')
  const [selOldWard, setSelOldWard] = useState('')
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupResult, setLookupResult] = useState(null)
  const [lookupError, setLookupError] = useState('')
  const [copied, setCopied] = useState(false)

  // 2. Tab Chuyển đổi Excel
  const [excelFile, setExcelFile] = useState(null)
  const [excelMode, setExcelMode] = useState('auto') // auto | single | columns
  const [colProvince, setColProvince] = useState('')
  const [colDistrict, setColDistrict] = useState('')
  const [colWard, setColWard] = useState('')
  const [colAddress, setColAddress] = useState('')
  const [excelLoading, setExcelLoading] = useState(false)
  const [excelResult, setExcelResult] = useState(null)
  const [excelError, setExcelError] = useState('')

  // 3. Tab Mới -> Cũ (Legacies)
  const [selNewProvince, setSelNewProvince] = useState('')
  const [selNewWard, setSelNewWard] = useState('')
  const [legacyLoading, setLegacyLoading] = useState(false)
  const [legacyResult, setLegacyResult] = useState(null)
  const [legacyError, setLegacyError] = useState('')

  // 4. Tab Căn cứ pháp lý & CSDL
  const [stats, setStats] = useState(null)
  const [candidates, setCandidates] = useState([])
  const [loadingCandidates, setLoadingCandidates] = useState(false)
  const [syncStatus, setSyncStatus] = useState(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')

  // Danh sách cascade cho dropdowns
  const [districtsList, setDistrictsList] = useState([])
  const [wardsList, setWardsList] = useState([])
  const [newWardsList, setNewWardsList] = useState([])
  const [loadingDistricts, setLoadingDistricts] = useState(false)
  const [loadingWards, setLoadingWards] = useState(false)
  const [loadingNewWards, setLoadingNewWards] = useState(false)

  // Load Metadata từ backend (Tỉnh cũ, Tỉnh mới, Legal docs)
  useEffect(() => {
    let active = true
    fetch('/api/admin-address/meta')
      .then(res => res.json())
      .then(data => {
        if (!active) return
        setMeta(data)
        setLoadingMeta(false)
      })
      .catch(err => {
        if (!active) return
        console.error('Lỗi tải metadata địa giới:', err)
        setLoadingMeta(false)
      })
    return () => { active = false }
  }, [])

  // Khi chọn Tỉnh cũ -> Tải danh sách Quận/Huyện cũ
  useEffect(() => {
    if (!selOldProvince) {
      setDistrictsList([])
      setWardsList([])
      setSelOldDistrict('')
      setSelOldWard('')
      return
    }
    let active = true
    setLoadingDistricts(true)
    fetch(`/api/admin-address/districts?province=${encodeURIComponent(selOldProvince)}`)
      .then(res => res.json())
      .then(data => {
        if (!active) return
        setDistrictsList(data.districts || [])
        setLoadingDistricts(false)
      })
      .catch(() => {
        if (active) setLoadingDistricts(false)
      })
    return () => { active = false }
  }, [selOldProvince])

  // Khi chọn Quận/Huyện cũ -> Tải danh sách Xã/Phường cũ
  useEffect(() => {
    if (!selOldProvince || !selOldDistrict) {
      setWardsList([])
      setSelOldWard('')
      return
    }
    let active = true
    setLoadingWards(true)
    fetch(`/api/admin-address/wards?province=${encodeURIComponent(selOldProvince)}&district=${encodeURIComponent(selOldDistrict)}`)
      .then(res => res.json())
      .then(data => {
        if (!active) return
        setWardsList(data.wards || [])
        setLoadingWards(false)
      })
      .catch(() => {
        if (active) setLoadingWards(false)
      })
    return () => { active = false }
  }, [selOldProvince, selOldDistrict])

  // Khi chọn Tỉnh mới -> Tải danh sách Xã mới (cho Tab Mới -> Cũ)
  useEffect(() => {
    if (!selNewProvince) {
      setNewWardsList([])
      setSelNewWard('')
      return
    }
    let active = true
    setLoadingNewWards(true)
    fetch(`/api/admin-address/new-wards?province=${encodeURIComponent(selNewProvince)}`)
      .then(res => res.json())
      .then(data => {
        if (!active) return
        setNewWardsList(data.wards || [])
        setLoadingNewWards(false)
      })
      .catch(() => {
        if (active) setLoadingNewWards(false)
      })
    return () => { active = false }
  }, [selNewProvince])

  // Khi chuyển sang tab legal, tải thêm stats, sync-status và candidates
  useEffect(() => {
    if (tab === 'legal') {
      fetch('/api/admin-address/stats')
        .then(res => res.json())
        .then(data => setStats(data))
        .catch(() => {})

      fetch('/api/admin-address/sync-status')
        .then(res => res.json())
        .then(data => setSyncStatus(data))
        .catch(() => {})

      setLoadingCandidates(true)
      fetch('/api/admin-address/candidates')
        .then(res => res.json())
        .then(data => {
          setCandidates(data?.candidates || [])
          setLoadingCandidates(false)
        })
        .catch(() => setLoadingCandidates(false))
    }
  }, [tab])

  const handleTriggerSync = async () => {
    setIsSyncing(true)
    setSyncMsg('')
    try {
      const res = await fetch('/api/admin-address/sync-trigger', { method: 'POST' })
      const data = await res.json()
      setSyncMsg(data.message || tx('Đã hoàn tất kiểm tra quét đồng bộ.', 'Sync check completed.'))
      const stRes = await fetch('/api/admin-address/sync-status')
      const stData = await stRes.json()
      setSyncStatus(stData)
      const statsRes = await fetch('/api/admin-address/stats')
      const statsData = await statsRes.json()
      setStats(statsData)
    } catch (e) {
      setSyncMsg(tx('Lỗi khi kích hoạt đồng bộ: ', 'Sync error: ') + e.message)
    } finally {
      setIsSyncing(false)
    }
  }

  // Xử lý tra cứu Cũ -> Mới
  const handleLookup = async (e) => {
    e?.preventDefault()
    setLookupLoading(true)
    setLookupError('')
    setLookupResult(null)
    setCopied(false)

    const payload = lookupMode === 'free'
      ? { addressString: freeAddress }
      : {
          province: selOldProvince,
          district: selOldDistrict,
          ward: selOldWard,
        }

    if (lookupMode === 'free' && !freeAddress.trim()) {
      setLookupError(tx('Vui lòng nhập chuỗi địa chỉ cần tra cứu.', 'Please enter an address to look up.'))
      setLookupLoading(false)
      return
    }

    try {
      const res = await fetch('/api/admin-address/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok || data.status === 'error') {
        throw new Error(data.message || tx('Lỗi tra cứu địa chỉ.', 'Address lookup failed.'))
      }
      setLookupResult(data)
    } catch (err) {
      setLookupError(err.message)
    } finally {
      setLookupLoading(false)
    }
  }

  // Xử lý tra cứu Mới -> Cũ
  const handleReverseLookup = async (e) => {
    e?.preventDefault()
    if (!selNewProvince || !selNewWard) {
      setLegacyError(tx('Vui lòng chọn Tỉnh/Thành phố mới và Xã/Phường mới.', 'Please select both new province and ward.'))
      return
    }
    setLegacyLoading(true)
    setLegacyError('')
    setLegacyResult(null)

    try {
      const query = new URLSearchParams({ province: selNewProvince, ward: selNewWard })
      const res = await fetch(`/api/admin-address/legacies?${query}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || tx('Lỗi tra cứu đơn vị cấu thành.', 'Lookup failed.'))
      setLegacyResult(data)
    } catch (err) {
      setLegacyError(err.message)
    } finally {
      setLegacyLoading(false)
    }
  }

  // Xử lý gửi file Excel
  const handleProcessExcel = async () => {
    if (!excelFile) {
      setExcelError(tx('Vui lòng chọn tệp Excel hoặc CSV.', 'Please select an Excel or CSV file.'))
      return
    }
    setExcelLoading(true)
    setExcelError('')
    setExcelResult(null)

    try {
      const formData = new FormData()
      formData.append('file', excelFile)
      formData.append('mode', excelMode)
      if (excelMode === 'columns') {
        formData.append('provinceCol', colProvince)
        formData.append('districtCol', colDistrict)
        formData.append('wardCol', colWard)
      } else if (excelMode === 'single') {
        formData.append('addressCol', colAddress)
      }

      const res = await fetch('/api/admin-address/bulk-convert', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.message || tx('Lỗi xử lý tệp Excel.', 'Excel processing failed.'))
      }
      setExcelResult(data)
    } catch (err) {
      setExcelError(err.message)
    } finally {
      setExcelLoading(false)
    }
  }

  // Tải file Excel kết quả
  const handleDownloadExcel = () => {
    if (!excelFile) return
    const formData = new FormData()
    formData.append('file', excelFile)
    formData.append('mode', excelMode)
    if (excelMode === 'columns') {
      formData.append('provinceCol', colProvince)
      formData.append('districtCol', colDistrict)
      formData.append('wardCol', colWard)
    } else if (excelMode === 'single') {
      formData.append('addressCol', colAddress)
    }

    fetch('/api/admin-address/bulk-convert?download=true', {
      method: 'POST',
      body: formData,
    })
      .then(res => res.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `chuyen-doi-dia-chi-moi-${Date.now()}.xlsx`
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
      })
      .catch(err => alert(tx('Lỗi tải file: ' + err.message, 'Download error: ' + err.message)))
  }

  // Nút sao chép địa chỉ
  const copyAddress = (text) => {
    if (!text) return
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  // Điền ví dụ mẫu
  const applySample = (text) => {
    setLookupMode('free')
    setFreeAddress(text)
    setLookupResult(null)
    setLookupError('')
  }

  const tabContent = (
    <>
      {/* Tab Navigation */}
      <div className="admin-nav-tabs">
        <button
          type="button"
          className={`admin-tab-btn ${tab === 'lookup' ? 'active' : ''}`}
          onClick={() => setTab('lookup')}
        >
          <span>🔍</span> {tx('Tra cứu Cũ → Mới', 'Lookup Old → New')}
        </button>
        <button
          type="button"
          className={`admin-tab-btn ${tab === 'reverse' ? 'active' : ''}`}
          onClick={() => setTab('reverse')}
        >
          <span>🔄</span> {tx('Mới → Cũ (Cấu thành)', 'New → Old (Legacies)')}
        </button>
        <button
          type="button"
          className={`admin-tab-btn ${tab === 'bulk' ? 'active' : ''}`}
          onClick={() => setTab('bulk')}
        >
          <span>📊</span> {tx('Excel hàng loạt', 'Batch Excel')}
        </button>
        <button
          type="button"
          className={`admin-tab-btn ${tab === 'legal' ? 'active' : ''}`}
          onClick={() => setTab('legal')}
        >
          <span>⚖️</span> {tx('Căn cứ pháp lý & CSDL', 'Legal Basis & DB')}
        </button>
      </div>

      {/* TAB 1: TRA CỨU CŨ -> MỚI */}
      {tab === 'lookup' && (
        <div className="admin-tab-content">
          <div className="lookup-mode-switch">
            <button
              type="button"
              className={`switch-chip ${lookupMode === 'cascade' ? 'active' : ''}`}
              onClick={() => setLookupMode('cascade')}
            >
              📑 {tx('Chọn theo Tỉnh / Huyện / Xã', 'Select by Province / District / Ward')}
            </button>
            <button
              type="button"
              className={`switch-chip ${lookupMode === 'free' ? 'active' : ''}`}
              onClick={() => setLookupMode('free')}
            >
              ✏️ {tx('Nhập nguyên chuỗi địa chỉ', 'Free text address')}
            </button>
          </div>

          {lookupMode === 'cascade' ? (
            <form onSubmit={handleLookup} className="admin-lookup-form">
              <div className="cascade-grid">
                <div className="cascade-col">
                  <div className="cascade-col-header">
                    <span className="step-badge">1</span>
                    <label>{tx('Tỉnh / Thành phố cũ', 'Legacy Province')}</label>
                  </div>
                  <select
                    value={selOldProvince}
                    onChange={(e) => {
                      setSelOldProvince(e.target.value)
                      setSelOldDistrict('')
                      setSelOldWard('')
                    }}
                    className="admin-select"
                  >
                    <option value="">{tx('-- Chọn Tỉnh/Thành cũ --', '-- Select Old Province --')}</option>
                    {meta.oldProvinces.map((p) => (
                      <option key={p.key} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div className="cascade-col">
                  <div className="cascade-col-header">
                    <span className="step-badge">2</span>
                    <label>{tx('Quận / Huyện cũ', 'Legacy District')}</label>
                  </div>
                  <select
                    value={selOldDistrict}
                    onChange={(e) => {
                      setSelOldDistrict(e.target.value)
                      setSelOldWard('')
                    }}
                    disabled={!selOldProvince || loadingDistricts}
                    className="admin-select"
                  >
                    <option value="">
                      {loadingDistricts
                        ? tx('-- Đang tải Quận/Huyện… --', '-- Loading Districts… --')
                        : tx('-- Chọn Quận/Huyện cũ --', '-- Select Old District --')}
                    </option>
                    {districtsList.map((d) => (
                      <option key={d.key || d.name} value={d.name}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div className="cascade-col">
                  <div className="cascade-col-header">
                    <span className="step-badge">3</span>
                    <label>{tx('Xã / Phường cũ', 'Legacy Ward')}</label>
                  </div>
                  <select
                    value={selOldWard}
                    onChange={(e) => setSelOldWard(e.target.value)}
                    disabled={!selOldDistrict || loadingWards}
                    className="admin-select"
                  >
                    <option value="">
                      {loadingWards
                        ? tx('-- Đang tải Xã/Phường… --', '-- Loading Wards… --')
                        : tx('-- Chọn Xã/Phường cũ --', '-- Select Old Ward --')}
                    </option>
                    {wardsList.map((w) => (
                      <option key={w.key || w.name} value={w.name}>{w.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="cascade-action-row">
                <button type="submit" className="primary featured-convert-btn" disabled={lookupLoading || !selOldProvince}>
                  {lookupLoading ? tx('Đang tra cứu…', 'Searching…') : tx('⚡ Tra cứu địa chỉ mới →', 'Convert to new address →')}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleLookup} className="admin-lookup-form">
              <div className="control-group">
                <label>
                  {tx('Nhập địa chỉ cũ (chứa Tỉnh/Thành phố, Quận/Huyện, Xã/Phường):', 'Enter legacy address:')}
                  <textarea
                    rows="3"
                    value={freeAddress}
                    onChange={(e) => setFreeAddress(e.target.value)}
                    placeholder={tx('Ví dụ: Xã Tam Thanh, TP Tam Kỳ, Quảng Nam hoặc 123 đường ABC, P. Bến Nghé, Q1, TP HCM', 'Example: Tam Thanh ward, Tam Ky city, Quang Nam')}
                    className="admin-input"
                  />
                </label>
                <div className="sample-chips">
                  <span className="sample-title">{tx('Ví dụ mẫu thử nhanh:', 'Quick samples:')}</span>
                  <button type="button" onClick={() => applySample('Xã Tam Thanh, Thành phố Tam Kỳ, Tỉnh Quảng Nam')}>
                    📍 Tam Thanh, Tam Kỳ (về Phường Quảng Phú, Đà Nẵng)
                  </button>
                  <button type="button" onClick={() => applySample('123 đường Lê Lợi, Phường Bến Nghé, Quận 1, TP.HCM')}>
                    📍 123 Lê Lợi, P. Bến Nghé, Q1, TP.HCM
                  </button>
                  <button type="button" onClick={() => applySample('Xã Phước Đồng, Thành phố Nha Trang, Tỉnh Khánh Hòa')}>
                    📍 Xã Phước Đồng, Nha Trang (về Phường Nam Nha Trang)
                  </button>
                  <button type="button" onClick={() => applySample('Xã Tam Thanh Tam Kỳ Quảng Nam')}>
                    🚀 Tam Thanh Tam Kỳ Quảng Nam (không cần dấu phẩy)
                  </button>
                  <button type="button" onClick={() => applySample('Phường Bến Nghé, Quận 1')}>
                    🔍 Phường Bến Nghé, Quận 1 (tự suy luận TP.HCM)
                  </button>
                  <button type="button" onClick={() => applySample('Phường Hiệp Thành, Thành phố Thủ Dầu Một, Tỉnh Bình Dương')}>
                    🏛️ Bình Dương (về TP. Hồ Chí Minh)
                  </button>
                </div>
              </div>

              <div className="cascade-action-row">
                <button type="submit" className="primary featured-convert-btn" disabled={lookupLoading || !freeAddress.trim()}>
                  {lookupLoading ? tx('Đang tra cứu…', 'Searching…') : tx('⚡ Tra cứu địa chỉ mới →', 'Convert to new address →')}
                </button>
              </div>
            </form>
          )}

            {lookupError && (
              <div className="admin-alert admin-alert-error">
                <span>❌</span> {lookupError}
              </div>
            )}

            {/* KẾT QUẢ TRA CỨU */}
            {lookupResult && (
              <div className="admin-result-box">
                {/* 🟢 TRƯỜNG HỢP CHÍNH XÁC (EXACT) */}
                {lookupResult.status === 'exact' && (
                  <div className="result-card result-card-exact">
                    <div className="result-card-header">
                      <span className="badge badge-exact">🟢 {tx('Chính xác', 'Exact')} (100%)</span>
                      <span className="mapping-tag">{lookupResult.mappingType}</span>
                    </div>

                    <div className="result-comparison-grid">
                      <div className="address-block legacy-block">
                        <span className="block-label">{tx('ĐỊA CHỈ CŨ (3 CẤP)', 'LEGACY ADDRESS')}</span>
                        <h4>
                          {lookupResult.oldAddress?.fullAddress ||
                           lookupResult.original?.fullAddress ||
                           [
                             lookupResult.oldAddress?.ward || lookupResult.original?.ward,
                             lookupResult.oldAddress?.district || lookupResult.original?.district,
                             lookupResult.oldAddress?.province || lookupResult.original?.province
                           ].filter(Boolean).join(', ')}
                        </h4>
                        <div className="unit-tags">
                          {(lookupResult.oldAddress?.ward || lookupResult.original?.ward) && <span>Xã: {lookupResult.oldAddress?.ward || lookupResult.original?.ward}</span>}
                          {(lookupResult.oldAddress?.district || lookupResult.original?.district) && <span>Huyện: {lookupResult.oldAddress?.district || lookupResult.original?.district}</span>}
                          {(lookupResult.oldAddress?.province || lookupResult.original?.province) && <span>Tỉnh: {lookupResult.oldAddress?.province || lookupResult.original?.province}</span>}
                        </div>
                      </div>

                      <div className="arrow-divider">➔</div>

                      <div className="address-block new-block">
                        <span className="block-label">{tx('ĐỊA CHỈ HIỆN NAY (MÔ HÌNH 2 CẤP)', 'CURRENT 2-TIER ADDRESS')}</span>
                        <h3 className="new-address-text">{lookupResult.newAddress?.fullAddress}</h3>
                        <div className="unit-tags highlight-tags">
                          {lookupResult.newAddress?.ward && <span><b>{lookupResult.newAddress.ward}</b></span>}
                          {lookupResult.newAddress?.province && <span><b>{lookupResult.newAddress.province}</b></span>}
                        </div>
                      </div>
                    </div>

                    {/* Căn cứ pháp lý */}
                    {lookupResult.legalBasis && (
                      <div className="legal-basis-box">
                        <div className="legal-meta">
                          <span>⚖️ <b>{tx('Căn cứ pháp lý:', 'Legal basis:')}</b> {lookupResult.legalBasis.documentNumber} — {lookupResult.legalBasis.title}</span>
                          <small>({lookupResult.legalBasis.authority} · {tx('Hiệu lực:', 'Effective:')} {lookupResult.legalBasis.effectiveDate || lookupResult.effectiveFrom || '01/07/2025'})</small>
                        </div>
                        {lookupResult.legalBasis.url && (
                          <a href={lookupResult.legalBasis.url} target="_blank" rel="noreferrer" className="legal-link">
                            {tx('Xem văn bản chính thức ↗', 'View official document ↗')}
                          </a>
                        )}
                      </div>
                    )}

                    <div className="result-action-bar">
                      <button
                        type="button"
                        className="copy-btn"
                        onClick={() => copyAddress(lookupResult.newAddress?.fullAddress)}
                      >
                        {copied ? '✅ ' + tx('Đã sao chép!', 'Copied!') : '📋 ' + tx('Sao chép địa chỉ mới', 'Copy new address')}
                      </button>
                    </div>
                  </div>
                )}

                {/* 🟡 TRƯỜNG HỢP PARTIAL / AMBIGUOUS (CẦN KIỂM TRA) */}
                {lookupResult.status === 'ambiguous' && (
                  <div className="result-card result-card-ambiguous">
                    <div className="result-card-header">
                      <span className="badge badge-ambiguous">🟡 {tx('Không thể xác định duy nhất (PARTIAL)', 'Ambiguous / Partial')}</span>
                      <span className="mapping-tag">{lookupResult.mappingType}</span>
                    </div>

                    <div className="ambiguous-warning">
                      <p className="warning-text">
                        {lookupResult.message || tx(
                          '⚠️ Không thể xác định duy nhất. Đơn vị hành chính cũ này được chia sang nhiều đơn vị mới. Vui lòng cung cấp thêm số nhà, tên đường, khu phố/tổ dân phố hoặc vị trí cụ thể.',
                          'Cannot uniquely determine new address. This legacy unit was divided into multiple new units.'
                        )}
                      </p>
                    </div>

                    <div className="candidates-list">
                      <h5>{tx('Các đơn vị hành chính mới có thể áp dụng:', 'Possible candidate units:')}</h5>
                      <div className="candidates-grid">
                        {lookupResult.candidates?.map((c, i) => (
                          <div key={i} className="candidate-card">
                            <span className="candidate-index">#{i + 1}</span>
                            <div className="candidate-info">
                              <strong>{c.newWard}</strong>
                              <span>{c.newProvince}</span>
                              {c.note && <small className="candidate-note">{c.note}</small>}
                            </div>
                            <button
                              type="button"
                              className="candidate-copy-btn"
                              onClick={() => copyAddress(`${c.newWard}, ${c.newProvince}`)}
                            >
                              📋
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {lookupResult.legalBasis && (
                      <div className="legal-basis-box">
                        <div className="legal-meta">
                          <span>⚖️ <b>{tx('Căn cứ pháp lý:', 'Legal basis:')}</b> {lookupResult.legalBasis.documentNumber}</span>
                          <small>({lookupResult.legalBasis.title})</small>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 🟡 TRƯỜNG HỢP CẦN KIỂM TRA CẤP XÃ (NEEDS_REVIEW / CHỈ NHẬN DIỆN ĐƯỢC TỈNH) */}
                {lookupResult.status === 'needs_review' && (
                  <div className="result-card result-card-ambiguous">
                    <div className="result-card-header">
                      <span className="badge badge-ambiguous">🟡 {tx('Cần xác minh cấp xã', 'Ward verification needed')}</span>
                    </div>
                    <p>{lookupResult.message}</p>
                    {lookupResult.newAddress && (
                      <div className="unit-tags">
                        <span>Tỉnh/Thành phố mới: <b>{lookupResult.newAddress.province}</b></span>
                      </div>
                    )}
                  </div>
                )}

                {/* 🔴 TRƯỜNG HỢP KHÔNG TÌM THẤY (NOT_FOUND) */}
                {lookupResult.status === 'not_found' && (
                  <div className="result-card result-card-notfound">
                    <div className="result-card-header">
                      <span className="badge badge-notfound">🔴 {tx('Không tìm thấy', 'Not found')}</span>
                    </div>
                    <p>{lookupResult.message || tx('Không tìm thấy đơn vị hành chính tương ứng trong CSDL. Vui lòng kiểm tra lại chính tả hoặc chọn từ danh sách gợi ý.', 'Unit not found in DB.')}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: TRA CỨU MỚI -> CŨ (LEGACIES) */}
        {tab === 'reverse' && (
          <div className="admin-tab-content">
            <p className="tab-instruction">
              {tx(
                'Tra cứu đơn vị hành chính mới được sáp nhập hoặc hình thành từ những xã, phường, thị trấn cũ nào trong lịch sử.',
                'Lookup which legacy wards and communes formed a new current administrative unit.'
              )}
            </p>

            <form onSubmit={handleReverseLookup} className="admin-lookup-form">
              <div className="cascade-row">
                <div className="control-group">
                  <label>{tx('Tỉnh / Thành phố mới (34 tỉnh/thành hiện hành)', 'New Province')}</label>
                  <select
                    value={selNewProvince}
                    onChange={(e) => {
                      setSelNewProvince(e.target.value)
                      setSelNewWard('')
                    }}
                    className="admin-select"
                  >
                    <option value="">{tx('-- Chọn Tỉnh/Thành mới --', '-- Select New Province --')}</option>
                    {meta.newProvinces.map((p) => (
                      <option key={p.key} value={p.key}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div className="control-group">
                  <label>{tx('Xã / Phường / Đặc khu mới', 'New Ward')}</label>
                  <select
                    value={selNewWard}
                    onChange={(e) => setSelNewWard(e.target.value)}
                    disabled={!selNewProvince || loadingNewWards}
                    className="admin-select"
                  >
                    <option value="">
                      {loadingNewWards
                        ? tx('-- Đang tải Xã/Phường mới… --', '-- Loading Wards… --')
                        : tx('-- Chọn Xã/Phường mới --', '-- Select New Ward --')}
                    </option>
                    {newWardsList.map((w) => (
                      <option key={w.key || w.name} value={w.name}>{w.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button type="submit" className="primary admin-btn" disabled={legacyLoading || !selNewProvince || !selNewWard}>
                {legacyLoading ? tx('Đang tra cứu…', 'Searching…') : tx('Xem các đơn vị cũ cấu thành →', 'Find legacy components →')}
              </button>
            </form>

            {legacyError && (
              <div className="admin-alert admin-alert-error">
                <span>❌</span> {legacyError}
              </div>
            )}

            {legacyResult && (
              <div className="legacy-result-box">
                <div className="legacy-header">
                  <h4>{tx('Đơn vị hiện hành:', 'Current unit:')} <b>{legacyResult.currentUnit?.ward}, {legacyResult.currentUnit?.province}</b></h4>
                  <span>{tx(`Được hình thành từ ${legacyResult.legacies?.length || 0} đơn vị cũ:`, `Formed from ${legacyResult.legacies?.length || 0} legacy units:`)}</span>
                </div>

                <div className="legacies-cards-list">
                  {legacyResult.legacies?.map((leg, idx) => (
                    <div key={idx} className="legacy-card">
                      <div className="legacy-badge">
                        <span className={`tag-${leg.mappingType?.toLowerCase()}`}>
                          {leg.mappingType === 'FULL' ? '🔵 Toàn bộ (FULL)' : '🟠 Một phần (PARTIAL)'}
                        </span>
                      </div>
                      <div className="legacy-detail">
                        <h4>{leg.oldWard}</h4>
                        <p>{leg.oldDistrict ? `${leg.oldDistrict}, ` : ''}{leg.oldProvince}</p>
                        {leg.note && <small className="leg-note">{leg.note}</small>}
                      </div>
                      {leg.legalBasis && (
                        <div className="leg-legal">
                          <small>⚖️ {leg.legalBasis.documentNumber}</small>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: CHUYỂN ĐỔI EXCEL HÀNG LOẠT */}
        {tab === 'bulk' && (
          <div className="admin-tab-content">
            <div className="excel-upload-zone">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                id="excel-file-input"
                className="file-hidden-input"
                onChange={(e) => {
                  setExcelFile(e.target.files?.[0] || null)
                  setExcelResult(null)
                  setExcelError('')
                }}
              />
              <label htmlFor="excel-file-input" className="excel-drop-label">
                <span>📊</span>
                <b>{excelFile ? excelFile.name : tx('Chọn hoặc kéo thả tệp Excel (.xlsx, .csv)', 'Select or drop Excel file')}</b>
                <small>{excelFile ? `${formatBytes(excelFile.size)} · ${tx('Nhấp để đổi tệp khác', 'Click to replace')}` : tx('Hỗ trợ danh sách hàng chục nghìn địa chỉ, bảo mật và xử lý cục bộ', 'Supports tens of thousands of rows safely')}</small>
              </label>
            </div>

            {excelFile && (
              <div className="excel-config-box">
                <div className="control-group">
                  <label>{tx('Dạng cấu trúc tệp Excel:', 'Excel data structure:')}</label>
                  <div className="option-cards">
                    <button
                      type="button"
                      className={excelMode === 'auto' ? 'active' : ''}
                      onClick={() => setExcelMode('auto')}
                    >
                      <b>⚡ {tx('Tự động phát hiện', 'Auto detect')}</b>
                      <small>{tx('Tự tìm cột Tỉnh, Huyện, Xã hoặc Địa chỉ', 'Finds Province, District, Ward columns automatically')}</small>
                    </button>
                    <button
                      type="button"
                      className={excelMode === 'single' ? 'active' : ''}
                      onClick={() => setExcelMode('single')}
                    >
                      <b>📝 {tx('Nguyên chuỗi địa chỉ', 'Single address column')}</b>
                      <small>{tx('Chỉ định cột chứa chuỗi địa chỉ đầy đủ', 'Specify full address text column')}</small>
                    </button>
                    <button
                      type="button"
                      className={excelMode === 'columns' ? 'active' : ''}
                      onClick={() => setExcelMode('columns')}
                    >
                      <b>📑 {tx('Chia theo 3 cột', 'Split into 3 columns')}</b>
                      <small>{tx('Cột Tỉnh, Cột Huyện, Cột Xã riêng biệt', 'Separate columns for Province, District, Ward')}</small>
                    </button>
                  </div>
                </div>

                {excelMode === 'single' && (
                  <div className="control-group">
                    <label>{tx('Tên tiêu đề cột chứa địa chỉ (hoặc để trống để tự đoán):', 'Address column header:')}</label>
                    <input
                      type="text"
                      value={colAddress}
                      onChange={(e) => setColAddress(e.target.value)}
                      placeholder="Ví dụ: Địa chỉ, Dia_chi, Address"
                      className="admin-input"
                    />
                  </div>
                )}

                {excelMode === 'columns' && (
                  <div className="cascade-row">
                    <div className="control-group">
                      <label>{tx('Cột Tỉnh cũ:', 'Province col:')}</label>
                      <input
                        type="text"
                        value={colProvince}
                        onChange={(e) => setColProvince(e.target.value)}
                        placeholder="Ví dụ: Tinh, Tỉnh"
                        className="admin-input"
                      />
                    </div>
                    <div className="control-group">
                      <label>{tx('Cột Huyện cũ:', 'District col:')}</label>
                      <input
                        type="text"
                        value={colDistrict}
                        onChange={(e) => setColDistrict(e.target.value)}
                        placeholder="Ví dụ: Huyen, Quận"
                        className="admin-input"
                      />
                    </div>
                    <div className="control-group">
                      <label>{tx('Cột Xã cũ:', 'Ward col:')}</label>
                      <input
                        type="text"
                        value={colWard}
                        onChange={(e) => setColWard(e.target.value)}
                        placeholder="Ví dụ: Xa, Phường"
                        className="admin-input"
                      />
                    </div>
                  </div>
                )}

                <div className="security-notice">
                  <span>🛡️ <b>{tx('Cam kết bảo mật dữ liệu:', 'Data privacy commitment:')}</b> {tx('Tệp chỉ được xử lý trong bộ nhớ tạm và xóa ngay khi trả kết quả. Không lưu trữ thông tin cá nhân (CCCD, họ tên, số điện thoại).', 'Processed strictly in volatile memory and removed immediately.')}</span>
                </div>

                <button
                  type="button"
                  className="primary admin-btn"
                  disabled={excelLoading}
                  onClick={handleProcessExcel}
                >
                  {excelLoading ? tx('Đang xử lý dữ liệu lớn…', 'Processing bulk data…') : tx('Bắt đầu chuyển đổi hàng loạt →', 'Start bulk conversion →')}
                </button>
              </div>
            )}

            {excelError && (
              <div className="admin-alert admin-alert-error">
                <span>❌</span> {excelError}
              </div>
            )}

            {/* KẾT QUẢ BÁO CÁO EXCEL */}
            {excelResult && (
              <div className="excel-result-report">
                <div className="report-summary-bar">
                  <div className="summary-item">
                    <small>{tx('Tổng số dòng đã xử lý', 'Total processed')}</small>
                    <b>{excelResult.stats.total.toLocaleString()}</b>
                  </div>
                  <div className="summary-item item-exact">
                    <small>🟢 {tx('Chính xác', 'Exact')}</small>
                    <b>{excelResult.stats.exact.toLocaleString()}</b>
                    <span>({Math.round((excelResult.stats.exact / (excelResult.stats.total || 1)) * 100)}%)</span>
                  </div>
                  <div className="summary-item item-ambiguous">
                    <small>🟡 {tx('Cần kiểm tra (PARTIAL)', 'Needs review')}</small>
                    <b>{(excelResult.stats.ambiguous + excelResult.stats.needs_review).toLocaleString()}</b>
                    <span>({Math.round(((excelResult.stats.ambiguous + excelResult.stats.needs_review) / (excelResult.stats.total || 1)) * 100)}%)</span>
                  </div>
                  <div className="summary-item item-notfound">
                    <small>🔴 {tx('Không tìm thấy', 'Not found')}</small>
                    <b>{excelResult.stats.not_found.toLocaleString()}</b>
                    <span>({Math.round((excelResult.stats.not_found / (excelResult.stats.total || 1)) * 100)}%)</span>
                  </div>
                </div>

                <div className="excel-download-cta">
                  <button
                    type="button"
                    className="primary download-excel-btn"
                    onClick={handleDownloadExcel}
                  >
                    📥 {tx('Tải tệp Excel kết quả (.xlsx)', 'Download Result Excel (.xlsx)')}
                  </button>
                  <p>{tx('File kết quả giữ nguyên tất cả cột ban đầu, bổ sung các cột: Tỉnh mới, Xã mới, Địa chỉ mới, Trạng thái, Căn cứ pháp lý.', 'Preserves original columns and appends new address, status, legal basis.')}</p>
                </div>

                {/* Bảng xem trước preview */}
                {excelResult.preview?.length > 0 && (
                  <div className="preview-table-container">
                    <h5>{tx('Bản xem trước 50 dòng đầu tiên:', 'Preview of first 50 rows:')}</h5>
                    <div className="table-responsive">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>{tx('Dòng', 'Row')}</th>
                            <th>{tx('Địa chỉ gốc', 'Original')}</th>
                            <th>{tx('Tỉnh/TP mới', 'New Province')}</th>
                            <th>{tx('Xã/Phường mới', 'New Ward')}</th>
                            <th>{tx('Trạng thái', 'Status')}</th>
                            <th>{tx('Độ tin cậy', 'Confidence')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {excelResult.preview.map((row, idx) => (
                            <tr key={idx} className={`row-${row.status}`}>
                              <td>#{row.rowNumber}</td>
                              <td>{row.original?.fullAddress || [row.original?.ward, row.original?.district, row.original?.province].filter(Boolean).join(', ')}</td>
                              <td><b>{row.newAddress?.province || '—'}</b></td>
                              <td><b>{row.newAddress?.ward || '—'}</b></td>
                              <td>
                                <span className={`status-pill pill-${row.status}`}>
                                  {row.status === 'exact' ? '🟢 Chính xác' : row.status === 'ambiguous' ? '🟡 Cần kiểm tra' : '🔴 Không thấy'}
                                </span>
                              </td>
                              <td>{Math.round((row.confidence || 0) * 100)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: CĂN CỨ PHÁP LÝ & CSDL */}
        {tab === 'legal' && (
          <div className="admin-tab-content">
            <div className="database-overview-card">
              <h4>📦 {tx('Thông tin Cơ sở dữ liệu Địa giới', 'Administrative DB Overview')}</h4>
              <div className="db-stats-grid">
                <div className="db-stat-item">
                  <small>{tx('Phiên bản CSDL', 'DB Version')}</small>
                  <b>{stats?.versions?.[0]?.version || 'v2025.07.01'}</b>
                </div>
                <div className="db-stat-item">
                  <small>{tx('Tổng số ánh xạ (Mappings)', 'Total Mappings')}</small>
                  <b>{stats?.totalMappings?.toLocaleString() || '120+'}</b>
                </div>
                <div className="db-stat-item">
                  <small>{tx('Số tỉnh mới hiện hành', 'Current Provinces')}</small>
                  <b>34</b>
                </div>
                <div className="db-stat-item">
                  <small>{tx('Văn bản pháp lý nguồn', 'Official Legal Sources')}</small>
                  <b>{meta.legalDocs.length}</b>
                </div>
              </div>
            </div>

            {/* Tự động đồng bộ TVPL hàng ngày */}
            <div className="sync-scheduler-section">
              <div className="sync-section-header">
                <div>
                  <h4>⏰ {tx('Tự động đồng bộ TVPL hàng ngày (Daily Auto-Sync)', 'TVPL Daily Auto-Sync Scheduler')}</h4>
                  <p className="sync-sub">
                    {tx(
                      'Hệ thống tự động kích hoạt kiểm tra và đồng bộ từ Cổng Thư Viện Pháp Luật & Công báo vào lúc 03:00 sáng hàng ngày. RAM Cache tự động làm mới ngay sau khi có dữ liệu mới.',
                      'System automatically checks and syncs from TVPL and Official Gazette daily at 03:00 AM. RAM Cache automatically refreshes with zero downtime.'
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  className="sync-trigger-btn"
                  onClick={handleTriggerSync}
                  disabled={isSyncing}
                >
                  {isSyncing ? '⏳ ' + tx('Đang quét TVPL…', 'Scanning…') : '🔄 ' + tx('Quét đồng bộ ngay', 'Sync Now')}
                </button>
              </div>

              {syncMsg && (
                <div className="sync-message-alert">
                  <span>ℹ️</span> {syncMsg}
                </div>
              )}

              <div className="sync-meta-grid">
                <div className="sync-meta-item">
                  <small>{tx('Lịch quét tự động', 'Schedule')}</small>
                  <b>{tx('03:00 AM hàng ngày', 'Daily at 03:00 AM')}</b>
                </div>
                <div className="sync-meta-item">
                  <small>{tx('Lần quét gần nhất', 'Last Sync')}</small>
                  <b>{syncStatus?.lastSyncTime ? new Date(syncStatus.lastSyncTime).toLocaleTimeString('vi-VN') + ' ' + new Date(syncStatus.lastSyncTime).toLocaleDateString('vi-VN') : tx('Chưa ghi nhận', 'Never')}</b>
                </div>
                <div className="sync-meta-item">
                  <small>{tx('Trạng thái CSDL', 'Database Status')}</small>
                  <span className="sync-badge">
                    {syncStatus?.lastStatus === 'UP_TO_DATE' ? '🟢 ' + tx('Đã đồng bộ mới nhất', 'Up to date')
                     : syncStatus?.lastStatus === 'WAF_PROTECTED' ? '🛡️ ' + tx('CSDL hoạt động ổn định', 'CSDL Active / Protected')
                     : syncStatus?.lastStatus === 'ERROR' ? '⚠️ ' + tx('Có lỗi kết nối', 'Error')
                     : '🟢 ' + tx('Sẵn sàng hoạt động', 'Ready')}
                  </span>
                </div>
                <div className="sync-meta-item">
                  <small>{tx('Lần quét kế tiếp', 'Next Scheduled Run')}</small>
                  <b>{syncStatus?.nextScheduledRun ? new Date(syncStatus.nextScheduledRun).toLocaleTimeString('vi-VN') + ' ' + new Date(syncStatus.nextScheduledRun).toLocaleDateString('vi-VN') : tx('03:00 AM ngày mai', 'Tomorrow at 03:00 AM')}</b>
                </div>
              </div>

              {syncStatus?.message && (
                <div className="sync-detail-note">
                  <small>📋 <b>{tx('Nhật ký quét:', 'Sync Log:')}</b> {syncStatus.message}</small>
                </div>
              )}
            </div>

            <div className="legal-documents-section">
              <h4>⚖️ {tx('Văn bản pháp luật chính thức làm căn cứ chân lý:', 'Official Legal Sources:')}</h4>
              <div className="legal-docs-list">
                {meta.legalDocs.map((doc, i) => (
                  <div key={i} className="legal-doc-item">
                    <div className="doc-number-badge">{doc.document_number}</div>
                    <div className="doc-info">
                      <h5>{doc.title}</h5>
                      <div className="doc-sub">
                        <span>{doc.issuing_authority}</span> · <span>{tx('Hiệu lực:', 'Effective:')} {doc.effective_date}</span>
                      </div>
                    </div>
                    {doc.source_url && (
                      <a href={doc.source_url} target="_blank" rel="noreferrer" className="doc-link-btn">
                        {tx('Công báo ↗', 'Official Gazette ↗')}
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Staging / Candidate changes */}
            <div className="candidate-staging-section">
              <h4>🛰️ {tx('Update Watcher & Thay đổi phát hiện (Staging)', 'Update Watcher & Candidate Changes')}</h4>
              <p className="staging-note">
                {tx(
                  'Cơ chế theo dõi các văn bản mới sau ngày 01/07/2025. Mọi thay đổi phát hiện tự động được lưu vào Staging và gắn cờ NEEDS_REVIEW, không tự ý publish vào production database.',
                  'Automated crawler puts detected changes into staging with NEEDS_REVIEW flag.'
                )}
              </p>

              {loadingCandidates ? (
                <p>{tx('Đang tải danh sách candidate…', 'Loading candidate list…')}</p>
              ) : candidates.length > 0 ? (
                <div className="candidates-staging-list">
                  {candidates.map((c) => (
                    <div key={c.id} className="staging-card">
                      <span className={`status-tag status-${c.validation_status.toLowerCase()}`}>
                        {c.validation_status}
                      </span>
                      <div className="staging-content">
                        <strong>{c.source_document}</strong>: {c.old_value} ➔ {c.new_value}
                        <small>{c.review_note}</small>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="no-candidates">{tx('Hiện tại CSDL đã đồng bộ đầy đủ với toàn bộ Nghị quyết có hiệu lực.', 'Database is fully synced with all active legal resolutions.')}</p>
              )}
            </div>
          </div>
        )}
    </>
  )

  if (inline) {
    return (
      <section className="hero-address-section" id="admin-address-converter" aria-label={tx('Chuyển đổi địa giới hành chính', 'Administrative Address Converter')}>
        <div className="hero-address-container">
          <div className="hero-address-header">
            <div className="hero-address-kicker">
              <span>✦</span> {tx('NGHỊ QUYẾT 202/2025/QH15 & UBTVQH · CƠ SỞ DỮ LIỆU ĐỘC LẬP 2025 - 2026', 'RESOLUTION 202/2025/QH15 & UBTVQH · INDEPENDENT DATABASE 2025 - 2026')}
            </div>
            <h1 className="hero-address-title">
              {tx('Chuyển đổi địa chỉ hành chính Việt Nam', 'Vietnam Administrative Address Converter')}{' '}
              <span className="hero-address-gradient">{tx('Cũ → Mới', 'Old → New')}</span>
            </h1>
            <p className="hero-address-subtitle">
              {tx(
                'Tra cứu tự động từ mô hình 3 cấp (Tỉnh / Huyện / Xã) sang 2 cấp (Tỉnh / Xã) hiện hành. Chuẩn hóa thông minh, truy nguyên căn cứ pháp lý và xuất Excel hàng loạt.',
                'Instant conversion from legacy 3-tier model to active 2-tier model. Smart address parsing, official legal traceability and batch Excel conversion.'
              )}
            </p>
          </div>

          <div className="hero-address-card">
            {tabContent}
          </div>

          <div className="hero-address-shortcuts">
            <span className="shortcuts-label">{tx('Khám phá nhanh các bộ công cụ bên dưới:', 'Quick jump to tools below:')}</span>
            <div className="shortcuts-chips">
              <a href="#pdf" className="shortcut-chip">
                <span>📄</span> {tx('9 Công cụ PDF', '9 PDF Tools')}
              </a>
              <a href="#image" className="shortcut-chip">
                <span>🖼️</span> {tx('7 Công cụ Xử lý ảnh', '7 Image Tools')}
              </a>
              <a href="#utility" className="shortcut-chip">
                <span>🛠️</span> {tx('4 Tiện ích số', '4 Digital Utilities')}
              </a>
            </div>
          </div>
        </div>
      </section>
    )
  }

  return (
    <div className="modal-shade" role="dialog" aria-modal="true" aria-label={tx('Chuyển đổi địa giới hành chính', 'Administrative Address Converter')}>
      <section className="tool-modal utility-modal tool-modal-wide admin-address-modal">
        <button className="close" type="button" aria-label={tx('Đóng', 'Close')} onClick={close}>×</button>
        <div className="modal-heading">
          <i>🗺️</i>
          <div>
            <p>{tx('ĐỊA GIỚI HÀNH CHÍNH VIỆT NAM', 'VIETNAM ADMINISTRATIVE UNITS')}</p>
            <h2>{tx('Chuyển đổi địa chỉ hành chính cũ → mới', 'Administrative Address Converter Old → New')}</h2>
          </div>
        </div>
        <p className="modal-copy">
          {tx(
            'Chuyển đổi từ mô hình 3 cấp cũ (Tỉnh/Huyện/Xã) sang mô hình 2 cấp hiện hành (Tỉnh/Xã) theo Nghị quyết 202/2025/QH15 và các Nghị quyết UBTVQH. CSDL độc lập, tra cứu thông minh và truy nguyên căn cứ pháp lý chính thức.',
            'Convert from 3-tier legacy model (Province/District/Ward) to 2-tier model (Province/Ward) pursuant to Resolution 202/2025/QH15. Fully local database with intelligent address parser and official legal traceability.'
          )}
        </p>
        {tabContent}
      </section>
    </div>
  )
}
