import Blog from './components/Blog.jsx'
import Header from './components/Header.jsx'
import Loader from './components/Loader.jsx'
import Mascot from './components/Mascot.jsx'
import Nav from './components/Nav.jsx'
import Projects from './components/Projects.jsx'
import Publications from './components/Publications.jsx'
import Section from './components/Section.jsx'
import SectionRail from './components/SectionRail.jsx'
import SkillGraph from './components/SkillGraph.jsx'
import Timeline from './components/Timeline.jsx'
import { about, education, experience, navItems, profile, skills, ui } from './content.js'
import { useState } from 'react'
import { useT } from './i18n.jsx'
import { ThemeProvider } from './theme.jsx'
import { useActiveSection } from './useActiveSection.js'
import { useStageScale } from './useStageScale.js'

const sectionIds = navItems.map((item) => item.id)

function Page() {
  const t = useT()
  const active = useActiveSection(sectionIds)
  const [feeling, setFeeling] = useState('happy')
  useStageScale()

  return (
    <>
      <Loader />
      <Nav active={active} />
      <SectionRail active={active} />

      <div className="hero-frame">
        <div className="hero-stage">
          <Mascot onFeelingChange={setFeeling} />
          <div className="container">
            <Header feeling={feeling} />
          </div>
        </div>
      </div>

      <main className="container">
        <Section id="work" title={t(ui.projects)}>
          <Projects />
        </Section>

        <Section id="experience" title={t(ui.experience)}>
          <Timeline items={experience} />
        </Section>

        <Section id="publication" title={t(ui.publication)}>
          <Publications />
        </Section>

        <Section id="about" title={t(ui.about)}>
          {t(about).map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </Section>

        <Section id="education" title={t(ui.education)}>
          <Timeline items={education} />
        </Section>

        <Section id="skills" title={t(ui.skills)}>
          <SkillGraph />
          <dl className="skills">
            {skills.map((s) => (
              <div key={s.group.en}>
                <dt>{t(s.group)}</dt>
                <dd>{s.items.join(', ')}</dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section id="blog" title={t(ui.blog)}>
          <Blog />
        </Section>

        <footer className="footer">
          <span className="signature">{profile.name}</span>
          <span>
            © {new Date().getFullYear()}. {t(ui.footer)}
          </span>
        </footer>
      </main>
    </>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <Page />
    </ThemeProvider>
  )
}
