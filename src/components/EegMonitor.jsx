import { useEffect, useRef } from 'react'
import { ui } from '../content.js'
import { MONTAGE, SAMPLE_RATE, createEegModel } from '../eeg/model.js'
import { useT } from '../i18n.jsx'
import { mascotPose } from '../mascot/pose.js'

// Thang hiển thị lâm sàng: 30 mm/s và 7 µV/mm, 1 mm tính theo CSS.
const PX_PER_MM = 96 / 25.4
const PX_PER_SECOND = 30 * PX_PER_MM
const PX_PER_MICROVOLT = PX_PER_MM / 7
const PX_PER_SAMPLE = PX_PER_SECOND / SAMPLE_RATE

const LINES = [
  { channel: 'Fp1-F3', color: '#b9bcc2', phase: 0.18 },
  { channel: 'P3-O1', color: '#3987e5', phase: 0.64 },
  { channel: 'Fp2-F4', color: '#b9bcc2', phase: 0.88 },
  { channel: 'P4-O2', color: '#9085e9', phase: 0.4 },
]

const GRID_MINOR = 'rgb(255 255 255 / 0.035)'
const GRID_MAJOR = 'rgb(255 255 255 / 0.09)'
const LABEL_COLOR = '#7f8288'
const CALIBRATION_MICROVOLTS = 50

const LABEL_GUTTER = 58
const DRAW_STRIDE = 2
const BLEND_COLUMNS = 40 // Nối mượt đường mới vào đường cũ phía trước điểm chạy
const MAX_CATCH_UP_SECONDS = 0.25
const ATTENTION_DECAY_SECONDS = 1.5
const READOUT_INTERVAL_MS = 200
const ALPHA_FULL_SCALE = 30 // µV, đầy thanh đo

function smoothstep(value) {
  const t = Math.min(1, Math.max(0, value))
  return t * t * (3 - 2 * t)
}

function formatClock(seconds) {
  const whole = Math.floor(seconds)
  const part = (value) => String(value).padStart(2, '0')
  return `${part(Math.floor(whole / 3600))}:${part(Math.floor(whole / 60) % 60)}:${part(whole % 60)}`
}

export default function EegMonitor({ feeling }) {
  const t = useT()
  const canvasRef = useRef(null)
  const clockRef = useRef(null)
  const alphaBarRef = useRef(null)
  const alphaValueRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const frameElement = canvas.closest('.hero-frame')
    const ctx = canvas.getContext('2d')
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const model = createEegModel()
    const sample = new Float32Array(MONTAGE.length)
    const lines = LINES.map((line) => ({
      ...line,
      index: MONTAGE.findIndex(([a, b]) => `${a}-${b}` === line.channel),
      values: null,
      head: 0,
    }))
    const alphaChannel = lines[1].index

    let width = 0
    let height = 0
    let columns = 2
    let ratio = 1
    let seenBlinks = 0
    let attention = 0

    let frame = 0
    let last = 0
    let owed = 0
    let elapsedTotal = 0
    let lastReadout = 0

    const xAt = (column) => LABEL_GUTTER + column * PX_PER_SAMPLE
    const baselineOf = (row) => (height * (row + 0.5)) / lines.length

    function paintGrid() {
      const drawLines = (spacing, color) => {
        ctx.strokeStyle = color
        ctx.lineWidth = 1
        ctx.beginPath()
        for (let x = LABEL_GUTTER; x < width; x += spacing) {
          ctx.moveTo(Math.round(x) + 0.5, 0)
          ctx.lineTo(Math.round(x) + 0.5, height)
        }
        for (let y = spacing; y < height; y += spacing) {
          ctx.moveTo(LABEL_GUTTER, Math.round(y) + 0.5)
          ctx.lineTo(width, Math.round(y) + 0.5)
        }
        ctx.stroke()
      }
      drawLines(PX_PER_SECOND / 5, GRID_MINOR)
      drawLines(PX_PER_SECOND, GRID_MAJOR)
    }

    function paintLabels() {
      ctx.font = "10px 'IBM Plex Mono', monospace"
      ctx.textBaseline = 'middle'
      ctx.fillStyle = LABEL_COLOR
      lines.forEach((line, row) => ctx.fillText(line.channel, 8, baselineOf(row)))
    }

    // Xung hiệu chuẩn như trên máy thật: cao đúng 50 µV, rộng 0.2 giây.
    function paintCalibration() {
      const pulse = CALIBRATION_MICROVOLTS * PX_PER_MICROVOLT
      const pulseWidth = PX_PER_SECOND / 5
      const x = 16
      const y = height / 2 + pulse / 2 - 6 // Giữa hai nhãn kênh, trong cột nhãn
      ctx.strokeStyle = LABEL_COLOR
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x - 6, y)
      ctx.lineTo(x, y)
      ctx.lineTo(x, y - pulse)
      ctx.lineTo(x + pulseWidth, y - pulse)
      ctx.lineTo(x + pulseWidth, y)
      ctx.lineTo(x + pulseWidth + 6, y)
      ctx.stroke()
      ctx.fillStyle = LABEL_COLOR
      ctx.fillText(`${CALIBRATION_MICROVOLTS} µV`, 8, y + 10)
    }

    function paintLine(line, row) {
      const baseline = baselineOf(row)
      const { head, values, color } = line
      const joinFrom = values[Math.max(head - 1, 0)]
      const yAt = (column) => {
        const ahead = column - head
        let value = values[column]
        if (ahead >= 0 && ahead < BLEND_COLUMNS) {
          value = joinFrom + (value - joinFrom) * smoothstep(ahead / BLEND_COLUMNS)
        }
        return baseline + value * PX_PER_MICROVOLT
      }

      ctx.strokeStyle = color
      ctx.lineWidth = 1.25
      ctx.beginPath()
      ctx.moveTo(xAt(0), yAt(0))
      for (let column = DRAW_STRIDE; column < columns; column += DRAW_STRIDE) {
        ctx.lineTo(xAt(column), yAt(column))
      }
      ctx.stroke()

      const dotColumn = Math.max(head - 1, 0)
      ctx.save()
      ctx.fillStyle = color
      ctx.shadowColor = color
      ctx.shadowBlur = 10
      ctx.beginPath()
      ctx.arc(xAt(dotColumn), yAt(dotColumn), 2.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }

    function paint() {
      ctx.clearRect(0, 0, width, height)
      paintGrid()
      paintLabels()
      lines.forEach(paintLine)
      if (height >= 240) paintCalibration() // Sân khấu dọc không đủ chỗ giữa hai nhãn
    }

    function updateReadout() {
      const level = model.alphaLevel(alphaChannel)
      if (clockRef.current) clockRef.current.textContent = formatClock(elapsedTotal)
      if (alphaValueRef.current) alphaValueRef.current.textContent = `${level.toFixed(1)} µV`
      if (alphaBarRef.current) {
        alphaBarRef.current.style.width = `${Math.min(level / ALPHA_FULL_SCALE, 1) * 100}%`
      }
    }

    function currentRatio() {
      const stageScale = canvas.getBoundingClientRect().width / canvas.clientWidth || 1
      return Math.min((window.devicePixelRatio || 1) * stageScale, 3)
    }

    function onWindowResize() {
      if (Math.abs(currentRatio() - ratio) > 0.01) resize()
    }

    function resize() {
      width = canvas.clientWidth
      height = canvas.clientHeight
      // Tính cả độ phóng của sân khấu để nét không bị mờ trên màn lớn.
      ratio = currentRatio()
      canvas.width = width * ratio
      canvas.height = height * ratio
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
      ctx.lineJoin = 'round'

      columns = Math.max(2, Math.ceil((width - LABEL_GUTTER) / PX_PER_SAMPLE) + 1)
      lines.forEach((line) => {
        line.values = new Float32Array(columns)
        line.head = Math.floor(columns * line.phase)
      })
      for (let column = 0; column < columns; column += 1) {
        model.step(sample)
        lines.forEach((line) => {
          line.values[column] = sample[line.index]
        })
      }
      paint()
      updateReadout()
    }

    function tick(now) {
      frame = requestAnimationFrame(tick)
      const elapsed = last ? Math.min((now - last) / 1000, MAX_CATCH_UP_SECONDS) : 0
      last = now
      owed += elapsed * SAMPLE_RATE
      elapsedTotal += elapsed

      attention *= Math.exp(-elapsed / ATTENTION_DECAY_SECONDS)
      model.setAttention(attention)

      // Nhân vật chớp mắt thì hai kênh trán có gợn tương ứng.
      if (mascotPose.blinks !== seenBlinks) {
        seenBlinks = mascotPose.blinks
        model.blink()
      }

      const count = Math.floor(owed)
      owed -= count
      for (let i = 0; i < count; i += 1) {
        model.step(sample)
        lines.forEach((line) => {
          line.values[line.head] = sample[line.index]
          line.head = (line.head + 1) % columns
        })
      }
      paint()

      if (now - lastReadout >= READOUT_INTERVAL_MS) {
        lastReadout = now
        updateReadout()
      }
    }

    function start() {
      if (reduced || frame) return
      last = 0
      frame = requestAnimationFrame(tick)
    }

    function stop() {
      cancelAnimationFrame(frame)
      frame = 0
    }

    function onPointerMove() {
      attention = 1
    }

    resize()

    const sizeObserver = new ResizeObserver(resize)
    sizeObserver.observe(canvas)

    // Ngừng chạy khi đã cuộn qua khung đầu.
    const viewObserver = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) start()
      else stop()
    })
    viewObserver.observe(canvas)

    addEventListener('resize', onWindowResize)
    if (!reduced) frameElement.addEventListener('pointermove', onPointerMove)

    return () => {
      stop()
      sizeObserver.disconnect()
      viewObserver.disconnect()
      removeEventListener('resize', onWindowResize)
      frameElement.removeEventListener('pointermove', onPointerMove)
    }
  }, [])

  return (
    <section className="monitor" aria-label="EEG monitor">
      <div className="monitor-screen">
        <div className="monitor-status">
          <span className="monitor-rec">REC</span>
          <span>EEG</span>
          <span>LB-18.1</span>
          <span>{SAMPLE_RATE} Hz</span>
          <span>30 mm/s</span>
          <span>7 µV/mm</span>
          <span ref={clockRef} className="monitor-clock">
            00:00:00
          </span>
        </div>

        <div className="monitor-body">
          <dl className="monitor-info">
            <div>
              <dt>{t(ui.state)}</dt>
              <dd>{t(ui.stateValue)}</dd>
            </div>
            <div>
              <dt>{t(ui.feeling)}</dt>
              <dd>{t(ui.feelings[feeling])}</dd>
            </div>
            <div>
              <dt>Alpha · P3-O1</dt>
              <dd ref={alphaValueRef}>0.0 µV</dd>
              <div className="monitor-meter">
                <span ref={alphaBarRef} />
              </div>
            </div>
          </dl>
          <canvas ref={canvasRef} className="monitor-trace" aria-hidden="true" />
        </div>
      </div>

      <div className="monitor-base">
        <span className="monitor-led" />
        <span className="monitor-brand">AK NEURO 18</span>
        <span className="monitor-jacks">
          <span className="monitor-jack" />
          <span className="monitor-jack" />
        </span>
      </div>
    </section>
  )
}
