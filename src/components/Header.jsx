import { profile } from '../content.js'
import EegMonitor from './EegMonitor.jsx'
import Headline from './Headline.jsx'

export default function Header({ feeling }) {
  return (
    <header id="home" className="hero">
      <EegMonitor feeling={feeling} />
      <div className="hero-main">
        <p className="hero-name">{profile.name}</p>
        <Headline items={profile.headlines} />
      </div>
    </header>
  )
}
