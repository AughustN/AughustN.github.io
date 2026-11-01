import { useEffect, useMemo, useState } from 'react'
import { ui } from '../content.js'
import { MONTAGE, SAMPLE_RATE, createEegModel } from '../eeg/model.js'
import { useT } from '../i18n.jsx'

const DURATION = 900
const FADE = 400

// Đoạn sóng lấy từ chính mô phỏng EEG, cùng thang 30 mm/s và 7 µV/mm với màn hình.
const TRACE_WIDTH = 240
const TRACE_HEIGHT = 56
const PX_PER_MM = 96 / 25.4
const PX_PER_MICROVOLT = PX_PER_MM / 7
const PX_PER_SAMPLE = (30 * PX_PER_MM) / SAMPLE_RATE
const SETTLE_SAMPLES = SAMPLE_RATE // Bỏ đoạn đầu khi mô phỏng chưa ổn định

function buildTrace() {
  const model = createEegModel()
  const channel = MONTAGE.findIndex(([a, b]) => `${a}-${b}` === 'P3-O1')
  const sample = new Float32Array(MONTAGE.length)
  for (let i = 0; i < SETTLE_SAMPLES; i += 1) model.step(sample)

  const points = []
  const count = Math.ceil(TRACE_WIDTH / PX_PER_SAMPLE)
  for (let i = 0; i <= count; i += 1) {
    model.step(sample)
    const y = TRACE_HEIGHT / 2 + sample[channel] * PX_PER_MICROVOLT
    points.push(`${(i * PX_PER_SAMPLE).toFixed(1)} ${Math.min(TRACE_HEIGHT, Math.max(0, y)).toFixed(1)}`)
  }
  return `M${points.join('L')}`
}

function shouldShow() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false
  try {
    return !sessionStorage.getItem('loaded')
  } catch {
    return true
  }
}

export default function Loader() {
  const t = useT()
  const [visible, setVisible] = useState(shouldShow)
  const [progress, setProgress] = useState(0)
  const trace = useMemo(() => (visible ? buildTrace() : ''), [visible])

  useEffect(() => {
    if (!visible) return

    let frame = 0
    let timer = 0
    const start = performance.now()

    function tick(now) {
      const value = Math.min((now - start) / DURATION, 1)
      setProgress(value)
      if (value < 1) {
        frame = requestAnimationFrame(tick)
      } else {
        try {
          sessionStorage.setItem('loaded', '1')
        } catch {}
        timer = setTimeout(() => setVisible(false), FADE)
      }
    }

    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(timer)
    }
  }, [visible])

  if (!visible) return null

  return (
    <div className={progress === 1 ? 'loader done' : 'loader'} aria-hidden="true">
      <svg className="loader-trace" viewBox={`0 0 ${TRACE_WIDTH} ${TRACE_HEIGHT}`}>
        <path className="loader-trace-track" d={trace} />
        <path
          className="loader-trace-line"
          d={trace}
          pathLength="1"
          strokeDasharray="1"
          strokeDashoffset={1 - progress}
        />
      </svg>
      <div className="loader-text">
        <span>{t(ui.loading)}</span>
        <span>{Math.round(progress * 100)}</span>
      </div>
    </div>
  )
}
