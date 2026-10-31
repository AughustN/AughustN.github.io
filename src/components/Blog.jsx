import { posts } from '../content.js'
import { useT } from '../i18n.jsx'

export default function Blog() {
  const t = useT()

  return (
    <ul className="entries">
      {posts.map((post) => (
        <li key={post.title.en} className="entry">
          <div className="entry-head">
            <h3>
              <a href={post.href}>{t(post.title)}</a>
            </h3>
            <span className="meta">{post.date}</span>
          </div>
          <p>{t(post.description)}</p>
        </li>
      ))}
    </ul>
  )
}
