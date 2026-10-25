import { profile } from '../content.js'
import { useLang, useT } from '../i18n.jsx'

export default function Header() {
  const t = useT()
  const { lang, setLang } = useLang()

  return (
    <header className="header">
      <div className="lang-switch" role="group" aria-label="Language">
        {['en', 'vi'].map((code) => (
          <button
            key={code}
            className={code === lang ? 'active' : ''}
            aria-pressed={code === lang}
            onClick={() => setLang(code)}
          >
            {code.toUpperCase()}
          </button>
        ))}
      </div>
      <h1>{profile.name}</h1>
      <p className="role">
        {t(profile.role)} · {t(profile.location)}
      </p>
      <p className="intro">{t(profile.intro)}</p>
      <nav className="links">
        {profile.links.map((link) => (
          <a key={link.label} href={link.href} target="_blank" rel="noreferrer">
            {link.label}
          </a>
        ))}
      </nav>
    </header>
  )
}
