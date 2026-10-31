import { useEffect, useRef } from 'react'
import { skills } from '../content.js'
import { useTheme } from '../theme.jsx'

const HEIGHT = 300
const REPEL_RADIUS = 90
const REPEL_FORCE = 22

function buildNodes(width) {
  const nodes = []
  const links = []

  skills.forEach((group, g) => {
    const hub = {
      x: (width * (g + 0.5)) / skills.length,
      y: HEIGHT / 2 + (g % 2 ? 24 : -24),
      label: group.group.en,
      hub: true,
      phase: g * 2.1,
    }
    nodes.push(hub)

    const radius = Math.min(84, width / skills.length / 2.4)
    group.items.forEach((item, i) => {
      const angle = (i / group.items.length) * Math.PI * 2 - Math.PI / 2 + g * 0.5
      const leaf = {
        x: hub.x + Math.cos(angle) * radius,
        y: hub.y + Math.sin(angle) * radius,
        label: item,
        hub: false,
        phase: g + i * 1.3,
      }
      nodes.push(leaf)
      links.push([hub, leaf])
    })
  })

  return { nodes, links }
}

// Sơ đồ kỹ năng trang trí. Danh sách chữ bên dưới mới là nội dung chính.
export default function SkillGraph() {
  const { theme } = useTheme()
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const styles = getComputedStyle(document.documentElement)
    const text = styles.getPropertyValue('--text').trim()
    const muted = styles.getPropertyValue('--muted').trim()
    const border = styles.getPropertyValue('--border').trim()
    const font = styles.getPropertyValue('--font-mono').trim()

    let graph = { nodes: [], links: [] }
    let width = 0
    let frame = 0
    let visible = false
    const mouse = { x: -1000, y: -1000 }

    function position(node, time) {
      const dx = node.x - mouse.x
      const dy = node.y - mouse.y
      const distance = Math.hypot(dx, dy) || 1
      const push = Math.max(0, 1 - distance / REPEL_RADIUS) * REPEL_FORCE
      return {
        x: node.x + Math.sin(time / 1600 + node.phase) * 3 + (dx / distance) * push,
        y: node.y + Math.cos(time / 2000 + node.phase) * 3 + (dy / distance) * push,
      }
    }

    function draw(time) {
      ctx.clearRect(0, 0, width, HEIGHT)

      ctx.strokeStyle = border
      ctx.lineWidth = 1
      for (const [from, to] of graph.links) {
        const a = position(from, time)
        const b = position(to, time)
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        ctx.stroke()
      }

      ctx.textAlign = 'center'
      for (const node of graph.nodes) {
        const { x, y } = position(node, time)
        ctx.fillStyle = node.hub ? text : muted
        ctx.beginPath()
        ctx.arc(x, y, node.hub ? 4 : 2.5, 0, Math.PI * 2)
        ctx.fill()
        ctx.font = `${node.hub ? 500 : 400} 11px ${font}`
        ctx.fillText(node.label, x, y - (node.hub ? 11 : 9))
      }
    }

    function loop(time) {
      draw(time)
      frame = visible && !reduced ? requestAnimationFrame(loop) : 0
    }

    function start() {
      if (!frame) frame = requestAnimationFrame(loop)
    }

    function resize() {
      width = canvas.clientWidth
      const ratio = window.devicePixelRatio || 1
      canvas.width = width * ratio
      canvas.height = HEIGHT * ratio
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
      graph = buildNodes(width)
      draw(performance.now())
    }

    function onMove(event) {
      const rect = canvas.getBoundingClientRect()
      mouse.x = event.clientX - rect.left
      mouse.y = event.clientY - rect.top
    }

    function onLeave() {
      mouse.x = -1000
      mouse.y = -1000
    }

    const sizeObserver = new ResizeObserver(resize)
    sizeObserver.observe(canvas)

    const viewObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      if (visible) start()
    })
    viewObserver.observe(canvas)

    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerleave', onLeave)

    return () => {
      cancelAnimationFrame(frame)
      sizeObserver.disconnect()
      viewObserver.disconnect()
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerleave', onLeave)
    }
    // Đổi theme cần đọc lại màu.
  }, [theme])

  return <canvas ref={canvasRef} className="skill-graph" style={{ height: HEIGHT }} aria-hidden="true" />
}
