import { useT } from '../i18n.jsx'

export default function Timeline({ items }) {
  const t = useT()

  return (
    <ul className="entries">
      {items.map((item) => (
        <li key={item.period + item.title.en} className="entry timeline">
          <span className="meta">{item.period}</span>
          <div>
            <h3>
              {t(item.title)} <span className="org">· {t(item.org)}</span>
            </h3>
            <p>{t(item.description)}</p>
          </div>
        </li>
      ))}
    </ul>
  )
}
