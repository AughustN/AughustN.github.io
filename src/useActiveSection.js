import { useEffect, useState } from 'react'

// Trả về id của mục đang đọc. Các section không nằm trong `ids` (ví dụ Experience)
// tự thuộc về mục đứng ngay trước nó.
export function useActiveSection(ids) {
  const [active, setActive] = useState(ids[0])

  useEffect(() => {
    let frame = 0

    function update() {
      frame = 0
      const atBottom = innerHeight + scrollY >= document.documentElement.scrollHeight - 2
      if (atBottom) {
        setActive(ids[ids.length - 1])
        return
      }
      const line = innerHeight * 0.4
      let current = ids[0]
      for (const id of ids) {
        const el = document.getElementById(id)
        if (el && el.getBoundingClientRect().top <= line) current = id
      }
      setActive(current)
    }

    function schedule() {
      if (!frame) frame = requestAnimationFrame(update)
    }

    update()
    addEventListener('scroll', schedule, { passive: true })
    addEventListener('resize', schedule)
    return () => {
      cancelAnimationFrame(frame)
      removeEventListener('scroll', schedule)
      removeEventListener('resize', schedule)
    }
  }, [ids])

  return active
}
