import { projects } from '../content.js'
import { useT } from '../i18n.jsx'

export default function Projects() {
  const t = useT()

  return (
    <ul className="entries">
      {projects.map((p) => (
        <li key={p.title} className="entry">
          <div className="entry-head">
            <h3>{p.title}</h3>
            <span className="meta">{p.year}</span>
          </div>
          <p>{t(p.description)}</p>
          <div className="entry-foot">
            <span className="tags">{p.tags.join(' · ')}</span>
            <span className="entry-links">
              {p.links.map((link) => (
                <a key={link.label} href={link.href} target="_blank" rel="noreferrer">
                  {link.label} ↗
                </a>
              ))}
            </span>
          </div>
        </li>
      ))}
    </ul>
  )
}
