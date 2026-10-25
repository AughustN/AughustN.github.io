import { createContext, useContext, useEffect, useState } from 'react'

const LangContext = createContext({ lang: 'en', setLang: () => {} })

function initialLang() {
  try {
    const saved = localStorage.getItem('lang')
    if (saved === 'en' || saved === 'vi') return saved
  } catch {}
  return navigator.language?.startsWith('vi') ? 'vi' : 'en'
}

export function LangProvider({ children }) {
  const [lang, setLang] = useState(initialLang)

  useEffect(() => {
    document.documentElement.lang = lang
    try {
      localStorage.setItem('lang', lang)
    } catch {}
  }, [lang])

  return <LangContext.Provider value={{ lang, setLang }}>{children}</LangContext.Provider>
}

// Trả về hàm t(): nhận { en, vi } hoặc chuỗi thường.
export function useT() {
  const { lang } = useContext(LangContext)
  return (value) => (typeof value === 'string' ? value : value?.[lang])
}

export function useLang() {
  return useContext(LangContext)
}
