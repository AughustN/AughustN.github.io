import { useLayoutEffect, useRef, useState } from 'react'
import { BriefcaseBusiness, FlaskConical, House, Layers, Moon, Sun, UserRound } from 'lucide-react'
import { navItems, profile, ui } from '../content.js'
import { useT } from '../i18n.jsx'
import { useTheme } from '../theme.jsx'

const icons = {
  home: House,
  work: BriefcaseBusiness,
  publication: FlaskConical,
  about: UserRound,
  blog: Layers,
}

const contactHref = profile.links.find((link) => link.label === 'Email')?.href

function DotMark() {
  const dots = [
    [7, 3, 1.3],
    [13, 7, 1.1],
    [4, 10, 1.1],
    [10, 11, 1.5],
    [15, 13, 1],
    [6, 16, 1.3],
  ]
  return (
    <svg className="cta-dots" viewBox="0 0 20 20" aria-hidden="true">
      {dots.map(([cx, cy, r]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} />
      ))}
    </svg>
  )
}

export default function Nav({ active }) {
  const t = useT()
  const { theme, toggleTheme } = useTheme()
  const [hovered, setHovered] = useState(null)
  const pillRef = useRef(null)
  const itemRefs = useRef({})

  // Pill nền chạy theo mục đang rê chuột, kể cả khi mục đó đang giãn nhãn.
  useLayoutEffect(() => {
    const item = itemRefs.current[hovered]
    const pill = pillRef.current
    if (!item || !pill) return

    const place = () => {
      pill.style.width = `${item.offsetWidth}px`
      pill.style.transform = `translateX(${item.offsetLeft}px)`
    }
    place()
    const observer = new ResizeObserver(place)
    observer.observe(item.parentElement)
    return () => observer.disconnect()
  }, [hovered])

  return (
    <div className="nav-bar">
      <nav aria-label="Primary" className="glass nav-pill" onPointerLeave={() => setHovered(null)}>
        <span
          ref={pillRef}
          className={hovered ? 'nav-highlight visible' : 'nav-highlight'}
          aria-hidden="true"
        />
        {navItems.map(({ id, label }) => {
          const Icon = icons[id]
          return (
            <a
              key={id}
              ref={(el) => (itemRefs.current[id] = el)}
              href={`#${id}`}
              className="nav-item"
              aria-current={id === active ? 'true' : undefined}
              onPointerEnter={() => setHovered(id)}
              aria-label={t(label)}
              title={t(label)}
            >
              <Icon size={16} aria-hidden="true" />
              <span className="nav-label">
                <span>{t(label)}</span>
              </span>
            </a>
          )
        })}
      </nav>

      <button
        type="button"
        className="glass nav-round"
        onClick={toggleTheme}
        aria-label={t(ui.toggleTheme)}
        title={t(ui.toggleTheme)}
      >
        {theme === 'dark' ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
      </button>

      {contactHref && (
        <a className="cta" href={contactHref} aria-label={t(ui.contact)}>
          <span className="cta-mark">
            <DotMark />
          </span>
          <span className="cta-label">{t(ui.contact)}</span>
        </a>
      )}
    </div>
  )
}
