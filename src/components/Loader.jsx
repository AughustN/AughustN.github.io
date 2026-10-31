import { useEffect, useState } from 'react'
import { ui } from '../content.js'
import { useT } from '../i18n.jsx'

const DURATION = 900
const FADE = 400

function shouldShow() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false
  try {
    return !sessionStorage.getItem('loaded')
  } catch {
    return true
  }
}

export default function Loader() {
  const t = useT()
  const [visible, setVisible] = useState(shouldShow)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (!visible) return

    let frame = 0
    let timer = 0
    const start = performance.now()

    function tick(now) {
      const value = Math.min((now - start) / DURATION, 1)
      setProgress(value)
      if (value < 1) {
        frame = requestAnimationFrame(tick)
      } else {
        try {
          sessionStorage.setItem('loaded', '1')
        } catch {}
        timer = setTimeout(() => setVisible(false), FADE)
      }
    }

    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(timer)
    }
  }, [visible])

  if (!visible) return null

  return (
    <div className={progress === 1 ? 'loader done' : 'loader'} aria-hidden="true">
      <div className="loader-bar">
        <span style={{ width: `${progress * 100}%` }} />
      </div>
      <div className="loader-text">
        <span>{t(ui.loading)}</span>
        <span>{String(Math.round(progress * 100)).padStart(3, '0')}</span>
      </div>
    </div>
  )
}
