import { useEffect, useState } from 'react'
import { useT } from '../i18n.jsx'

const HOLD = 3600
const OUT = 450

// Tiêu đề đổi luân phiên: từng chữ tan ra như hơi nước rồi chữ mới tụ lại.
export default function Headline({ items }) {
  const t = useT()
  const [index, setIndex] = useState(0)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const delay = leaving ? OUT : HOLD
    const timer = setTimeout(() => {
      if (leaving) setIndex((i) => (i + 1) % items.length)
      setLeaving(!leaving)
    }, delay)
    return () => clearTimeout(timer)
  }, [leaving, items.length])

  const text = t(items[index])

  return (
    <h1 className="headline" aria-label={t(items[0])}>
      <span key={`${index}-${text}`} className={leaving ? 'vapor out' : 'vapor'} aria-hidden="true">
        {text.split(' ').map((word, w) => (
          <span key={w} className="vapor-word">
            {Array.from(word).map((char, c) => (
              <span
                key={c}
                className="vapor-char"
                style={{
                  animationDelay: `${(w * 4 + c) * 18}ms`,
                  '--vapor-x': `${((c % 3) - 1) * 0.15}em`,
                }}
              >
                {char}
              </span>
            ))}
          </span>
        ))}
      </span>
    </h1>
  )
}
