import Header from './components/Header.jsx'
import Section from './components/Section.jsx'
import Projects from './components/Projects.jsx'
import Timeline from './components/Timeline.jsx'
import { about, education, experience, profile, skills, ui } from './content.js'
import { LangProvider, useT } from './i18n.jsx'

function Page() {
  const t = useT()

  return (
    <main className="container">
      <Header />

      <Section id="about" title={t(ui.about)}>
        {t(about).map((para, i) => (
          <p key={i}>{para}</p>
        ))}
      </Section>

      <Section id="projects" title={t(ui.projects)}>
        <Projects />
      </Section>

      <Section id="experience" title={t(ui.experience)}>
        <Timeline items={experience} />
      </Section>

      <Section id="education" title={t(ui.education)}>
        <Timeline items={education} />
      </Section>

      <Section id="skills" title={t(ui.skills)}>
        <dl className="skills">
          {skills.map((s) => (
            <div key={s.group.en}>
              <dt>{t(s.group)}</dt>
              <dd>{s.items.join(', ')}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <footer className="footer">
        © {new Date().getFullYear()} {profile.name}. {t(ui.footer)}
      </footer>
    </main>
  )
}

export default function App() {
  return (
    <LangProvider>
      <Page />
    </LangProvider>
  )
}
