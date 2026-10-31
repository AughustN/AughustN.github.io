import { navItems } from '../content.js'
import { useT } from '../i18n.jsx'

const widths = [48, 33, 21]

export default function SectionRail({ active }) {
  const t = useT()
  const activeIndex = navItems.findIndex((item) => item.id === active)

  return (
    <nav className="rail" aria-label="Sections on this page">
      {navItems.map(({ id, label }, i) => (
        <a
          key={id}
          href={`#${id}`}
          className={id === active ? 'rail-item active' : 'rail-item'}
          aria-current={id === active ? 'true' : undefined}
          aria-label={t(label)}
        >
          <span className="rail-tick" style={{ width: widths[Math.abs(i - activeIndex)] ?? 12 }} />
          <span className="rail-tip glass" aria-hidden="true">
            {t(label)}
          </span>
        </a>
      ))}
    </nav>
  )
}
