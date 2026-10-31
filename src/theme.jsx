import { createContext, useContext, useState } from 'react'
import { flushSync } from 'react-dom'

const ThemeContext = createContext({ theme: 'light', toggleTheme: () => {} })

function currentTheme() {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

function applyTheme(theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  try {
    localStorage.setItem('theme', theme)
  } catch {}
}

export function ThemeProvider({ children }) {
  // index.html đã gắn class .dark trước khi render để tránh nháy màu.
  const [theme, setTheme] = useState(currentTheme)

  function toggleTheme(event) {
    const next = theme === 'dark' ? 'light' : 'dark'
    const commit = () => {
      applyTheme(next)
      flushSync(() => setTheme(next))
    }

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!document.startViewTransition || reduced) {
      commit()
      return
    }

    // Vòng tròn lan từ nút vừa bấm tới góc xa nhất của màn hình.
    const rect = event.currentTarget.getBoundingClientRect()
    const x = rect.left + rect.width / 2
    const y = rect.top + rect.height / 2
    const end = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))
    const root = document.documentElement
    root.style.setProperty('--theme-reveal-x', `${x}px`)
    root.style.setProperty('--theme-reveal-y', `${y}px`)
    root.style.setProperty('--theme-reveal-end', `${end / 0.65}px`)
    root.classList.add('theme-reveal')

    const transition = document.startViewTransition(commit)
    transition.finished.finally(() => root.classList.remove('theme-reveal'))
  }

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  return useContext(ThemeContext)
}
