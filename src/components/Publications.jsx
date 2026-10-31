import { publications } from '../content.js'
import { useT } from '../i18n.jsx'

export default function Publications() {
  const t = useT()

  return (
    <ul className="entries">
      {publications.map((p) => (
        <li key={p.title} className="entry">
          <div className="entry-head">
            <h3>
              <a href={p.href} target="_blank" rel="noreferrer">
                {p.title} ↗
              </a>
            </h3>
            <span className="meta">{p.year}</span>
          </div>
          <p className="org">{t(p.venue)}</p>
          <p>{t(p.description)}</p>
        </li>
      ))}
    </ul>
  )
}
