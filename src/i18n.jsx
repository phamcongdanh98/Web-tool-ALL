import { createContext, useContext, useEffect, useMemo, useState } from 'react'

const LanguageContext = createContext(null)

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => localStorage.getItem('pdftools-language') === 'en' ? 'en' : 'vi')

  useEffect(() => {
    localStorage.setItem('pdftools-language', language)
    document.documentElement.lang = language
    document.title = language === 'en'
      ? 'PDFTools by Danh Pham — Online PDF & image tools'
      : 'PDFTools by Danh Phạm — Công cụ PDF & hình ảnh trực tuyến'
    document.querySelector('meta[name="description"]')?.setAttribute('content', language === 'en'
      ? 'Free online tools for PDFs, images, QR codes and everyday files, with clear previews before downloading.'
      : 'Bộ công cụ PDF, hình ảnh, QR và tệp trực tuyến miễn phí, có bản xem trước rõ ràng trước khi tải xuống.')
  }, [language])

  const value = useMemo(() => ({
    language,
    locale: language === 'en' ? 'en-US' : 'vi-VN',
    setLanguage,
    toggleLanguage: () => setLanguage(current => current === 'vi' ? 'en' : 'vi'),
    tx: (vietnamese, english) => language === 'en' ? english : vietnamese,
  }), [language])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) throw new Error('useLanguage must be used inside LanguageProvider')
  return context
}
