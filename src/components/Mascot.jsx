import { useEffect, useLayoutEffect, useRef } from 'react'
import {
  BODY_X,
  CENTER_Y,
  FRAGMENT_SHADER,
  HEAD_Y,
  VERTEX_SHADER,
  WORLD_SIZE,
} from '../mascot/shader.js'
import { mascotPose } from '../mascot/pose.js'
import { useTheme } from '../theme.jsx'

const PIXEL_SIZE = 2 // Một ô dither bằng 2 CSS px

// Hai điện cực trên tóc, toạ độ đầu (x, y, z). Dây nối từ đây vào cổng trên máy đo.
const ELECTRODES = [
  [0.36, 0.86, 0.5],
  [0.76, 0.5, 0.5],
]
const NECK_PIVOT = [0, -0.75, 0]
const CABLE_RATE = 5 // Dây bám theo chậm hơn đầu để có độ lắc
const MAX_DELTA = 0.05
const HOP_VELOCITY = 3.5 // Vận tốc nảy lên, lò xo tự kéo về
const HAPPY_SECONDS = 1.2
const GREET_AT_SECONDS = 3.2 // Ngay sau màn hình tải

// Tốc độ bám đích: càng nhỏ càng từ tốn. Mắt đi trước, đầu theo sau.
const HEAD_RATE = 3
const EYE_RATE = 6.5
const FACE_RATE = 5

const MAX_YAW = 0.5
const MAX_LOOK_UP = 0.3
const MAX_LOOK_DOWN = 0.14 // Giữ cằm trên áo
const STILL_SECONDS = 0.8 // Chuột đứng yên bao lâu thì cười
const EXPRESSION_SECONDS = 1.8
const BLINK_RATE = 26 // Chớp mắt phải nhanh dù mọi chuyển động khác từ tốn

// Tầm dịch của mắt trên mặt.
const PUPIL_RANGE_X = 0.06
const PUPIL_RANGE_Y = 0.04

function compile(gl, type, source) {
  const shader = gl.createShader(type)
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader))
  }
  return shader
}

function createProgram(gl) {
  const program = gl.createProgram()
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER))
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER))
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program))
  }
  return program
}

function approach(current, target, rate, delta) {
  return current + (target - current) * (1 - Math.exp(-rate * delta))
}

function clamp(value, low, high) {
  return Math.min(high, Math.max(low, value))
}

function multiply(a, b) {
  return a.map((row) => b[0].map((_, c) => row.reduce((sum, value, k) => sum + value * b[k][c], 0)))
}

// R = Rz * Ry * Rx. Yaw dương quay mặt sang +x, pitch dương cúi xuống.
// Đọc các hàng của R như các cột cho ra R nghịch đảo, đúng thứ shader cần.
function headRotation(yaw, pitch, roll) {
  const [cy, sy] = [Math.cos(yaw), Math.sin(yaw)]
  const [cp, sp] = [Math.cos(pitch), Math.sin(pitch)]
  const [cr, sr] = [Math.cos(roll), Math.sin(roll)]
  const ry = [[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]]
  const rx = [[1, 0, 0], [0, cp, -sp], [0, sp, cp]]
  const rz = [[cr, -sr, 0], [sr, cr, 0], [0, 0, 1]]
  return new Float32Array(multiply(rz, multiply(ry, rx)).flat())
}

export default function Mascot({ onFeelingChange }) {
  const { theme } = useTheme()
  const canvasRef = useRef(null)
  const cablesRef = useRef(null)
  const applyThemeRef = useRef(() => {})
  const feelingRef = useRef(onFeelingChange)
  feelingRef.current = onFeelingChange
  const themeRef = useRef(theme)
  themeRef.current = theme

  useEffect(() => {
    const canvas = canvasRef.current
    const frameElement = canvas.closest('.hero-frame')
    const stage = canvas.closest('.hero-stage')
    const gl = canvas.getContext('webgl2', { alpha: true, antialias: false, powerPreference: 'low-power' })
    if (!gl) {
      canvas.style.display = 'none'
      return undefined
    }

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let program
    try {
      program = createProgram(gl)
    } catch (error) {
      console.error(error)
      canvas.style.display = 'none'
      return undefined
    }
    gl.useProgram(program)

    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const position = gl.getAttribLocation(program, 'aPosition')
    gl.enableVertexAttribArray(position)
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)

    const uniform = (name) => gl.getUniformLocation(program, name)
    const u = Object.fromEntries(
      [
        'uResolution', 'uBody', 'uLean', 'uBreath', 'uHeadRotation', 'uEye', 'uEyeHeight', 'uEyeWidth', 'uMouthOpen',
        'uMouthWide', 'uSmile', 'uMouthRound', 'uBrow', 'uDark',
      ].map((name) => [name, uniform(name)]),
    )

    // Trạng thái hiện tại, được làm mượt về đích mỗi khung hình.
    const state = {
      yaw: 0,
      pitch: 0,
      eyeX: 0,
      eyeY: 0,
      bodyX: 0,
      bodyY: 0,
      velocityX: 0,
      velocityY: 0,
      lean: 0,
      eyeHeight: 1,
      eyeWidth: 1,
      mouthOpen: 0.5,
      mouthWide: 1,
      mouthRound: 0,
      smile: 1,
      brow: 0,
    }

    const cablesCanvas = cablesRef.current
    const cablesContext = cablesCanvas.getContext('2d')
    const cables = ELECTRODES.map(() => ({ bend: null, sag: null }))
    let jacks = []
    let rotation = headRotation(0, 0, 0)

    const pointer = { x: 0, y: 0, lastMove: -Infinity, known: false }
    let dragging = null
    let happyUntil = -1
    let expression = null
    let expressionUntil = -1
    let feeling = 'happy'
    let greetAt = reduced ? Infinity : GREET_AT_SECONDS
    let blinkAt = 2
    let blinkEnd = -1
    let lastScroll = window.scrollY
    let scrollKick = 0

    let frame = 0
    let last = 0
    let time = 0
    let lastDelta = 1

    function resize() {
      canvas.width = Math.round(canvas.clientWidth / PIXEL_SIZE)
      canvas.height = Math.round(canvas.clientHeight / PIXEL_SIZE)
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.uniform2f(u.uResolution, canvas.width, canvas.height)

      cablesCanvas.width = Math.ceil(stage.offsetWidth / PIXEL_SIZE)
      cablesCanvas.height = Math.ceil(stage.offsetHeight / PIXEL_SIZE)

      // Đổi vị trí đo trên màn hình về toạ độ sân khấu, vì sân khấu đang được phóng.
      const stageRect = stage.getBoundingClientRect()
      const scale = stageRect.width / stage.offsetWidth || 1
      jacks = [...stage.querySelectorAll('.monitor-jack')].map((jack) => {
        const rect = jack.getBoundingClientRect()
        return {
          x: (rect.left + rect.width / 2 - stageRect.left) / scale,
          y: (rect.top + rect.height / 2 - stageRect.top) / scale,
        }
      })
      draw()
    }

    // Chiếu điện cực từ toạ độ đầu ra CSS px trong khung hero, có tính cả góc xoay đầu.
    function electrodePosition([x, y, z]) {
      const localX = x - NECK_PIVOT[0]
      const localY = y - NECK_PIVOT[1]
      const localZ = z - NECK_PIVOT[2]
      const worldX = rotation[0] * localX + rotation[1] * localY + rotation[2] * localZ + NECK_PIVOT[0]
      const worldY = rotation[3] * localX + rotation[4] * localY + rotation[5] * localZ + NECK_PIVOT[1]
      return {
        x: canvas.offsetLeft + (0.5 + (state.bodyX + worldX + BODY_X) / WORLD_SIZE) * canvas.clientWidth,
        y:
          canvas.offsetTop +
          (0.5 - (state.bodyY + HEAD_Y + worldY - CENTER_Y) / WORLD_SIZE) * canvas.clientWidth,
      }
    }

    function drawCables(delta) {
      const ctx = cablesContext
      ctx.setTransform(1 / PIXEL_SIZE, 0, 0, 1 / PIXEL_SIZE, 0, 0)
      ctx.clearRect(0, 0, stage.offsetWidth, stage.offsetHeight)
      ctx.lineCap = 'round'
      const follow = 1 - Math.exp(-CABLE_RATE * delta)

      ELECTRODES.forEach((electrode, index) => {
        const jack = jacks[index]
        if (!jack) return
        const start = electrodePosition(electrode)
        const cable = cables[index]

        // Dây rời đầu chếch sang phải rồi vòng vào cổng ở cạnh phải của máy.
        const rightLimit = stage.offsetWidth - 8
        const bendTarget = {
          x: Math.min(start.x + 60 + index * 30, rightLimit),
          y: start.y - 30 + index * 20,
        }
        const sagTarget = { x: Math.min(jack.x + 96 - index * 14, rightLimit), y: jack.y + 14 }
        cable.bend ??= bendTarget
        cable.sag ??= sagTarget
        cable.bend = {
          x: cable.bend.x + (bendTarget.x - cable.bend.x) * follow,
          y: cable.bend.y + (bendTarget.y - cable.bend.y) * follow,
        }
        cable.sag = {
          x: cable.sag.x + (sagTarget.x - cable.sag.x) * follow,
          y: cable.sag.y + (sagTarget.y - cable.sag.y) * follow,
        }

        const trace = () => {
          ctx.beginPath()
          ctx.moveTo(start.x, start.y)
          ctx.bezierCurveTo(cable.bend.x, cable.bend.y, cable.sag.x, cable.sag.y, jack.x, jack.y)
          ctx.stroke()
        }
        // Vỏ đen lõi trắng để dây nổi trên cả nền trắng, nền đen và thân máy.
        ctx.strokeStyle = '#000'
        ctx.lineWidth = 6
        trace()
        ctx.strokeStyle = '#fff'
        ctx.lineWidth = 2
        trace()

        // Đầu cắm ở cổng.
        ctx.fillStyle = '#000'
        ctx.fillRect(jack.x - 2, jack.y - 6, 16, 12)
        ctx.fillStyle = '#fff'
        ctx.fillRect(jack.x, jack.y - 4, 12, 8)

        // Núm điện cực trên tóc.
        ctx.fillStyle = '#000'
        ctx.beginPath()
        ctx.arc(start.x, start.y, 9, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#fff'
        ctx.beginPath()
        ctx.arc(start.x, start.y, 5, 0, Math.PI * 2)
        ctx.fill()
      })
    }

    function toWorld(clientX, clientY) {
      const rect = canvas.getBoundingClientRect()
      return {
        x: ((clientX - rect.left) / rect.width - 0.5) * WORLD_SIZE - BODY_X,
        y: (0.5 - (clientY - rect.top) / rect.width) * WORLD_SIZE + CENTER_Y,
      }
    }

    function isOnMascot(clientX, clientY) {
      const { x, y } = toWorld(clientX, clientY)
      const localX = x - state.bodyX
      const localY = y - state.bodyY
      const onHead = Math.hypot(localX, localY - HEAD_Y) < 1.2
      const onChest = Math.abs(localX) < 1.4 && localY < -0.6
      return onHead || onChest
    }

    // Má và đầu là hai vùng chạm riêng, tính quanh tâm đầu.
    function touchedPart(clientX, clientY) {
      const { x, y } = toWorld(clientX, clientY)
      const localX = x - state.bodyX
      const localY = y - state.bodyY - HEAD_Y
      if (Math.hypot(localX, localY) > 1.25) return 'other'
      if (localY > 0.42) return 'head'
      if (Math.abs(localX) > 0.32 && localY < 0.1 && localY > -0.8) return 'cheek'
      return 'other'
    }

    function reactTo(part) {
      if (part === 'cheek' || part === 'head') {
        expression = part === 'cheek' ? 'surprised' : 'annoyed'
        expressionUntil = time + EXPRESSION_SECONDS
      } else {
        celebrate()
      }
    }

    function celebrate() {
      happyUntil = time + HAPPY_SECONDS
      state.velocityY += HOP_VELOCITY
    }

    function update(delta) {
      time += delta
      if (time > greetAt) {
        greetAt = Infinity
        celebrate()
      }

      // Đầu và mắt nhìn theo chuột; để yên lâu thì đầu lắc nhẹ.
      const idle = time - pointer.lastMove > 3 || !pointer.known
      let dx = Math.sin(time * 0.4) * 0.5
      let dy = Math.sin(time * 0.3) * 0.2
      if (!idle) {
        const target = toWorld(pointer.x, pointer.y)
        dx = target.x - state.bodyX
        dy = target.y - state.bodyY - HEAD_Y
      }

      state.yaw = approach(state.yaw, clamp(dx / 4.5, -MAX_YAW, MAX_YAW), HEAD_RATE, delta)
      state.pitch = approach(state.pitch, clamp(-dy / 4.5, -MAX_LOOK_UP, MAX_LOOK_DOWN), HEAD_RATE, delta)

      // Con ngươi đi đúng hướng con trỏ, chạm mép tròng trắng khi con trỏ ở xa.
      const distance = Math.hypot(dx, dy) || 1
      const directionX = dx / distance
      const directionY = dy / distance
      const edge = 1 / Math.hypot(directionX / PUPIL_RANGE_X, directionY / PUPIL_RANGE_Y)
      const reach = edge * clamp(distance / 2.2, 0, 1)
      state.eyeX = approach(state.eyeX, directionX * reach, EYE_RATE, delta)
      state.eyeY = approach(state.eyeY, directionY * reach, EYE_RATE, delta)

      // Chớp mắt ngẫu nhiên, đôi khi chớp hai lần.
      if (time > blinkAt) {
        blinkEnd = time + 0.13
        mascotPose.blinks += 1
        blinkAt = time + (Math.random() < 0.2 ? 0.26 : 2 + Math.random() * 3.5)
      }
      const blinking = time < blinkEnd

      // Kéo thả: nhân vật bám theo con trỏ, thả ra thì lò xo đưa về chỗ cũ.
      if (dragging) {
        const target = toWorld(pointer.x, pointer.y)
        const nextX = approach(state.bodyX, target.x - dragging.x, 9, delta)
        const nextY = approach(state.bodyY, target.y - dragging.y, 9, delta)
        state.velocityX = (nextX - state.bodyX) / delta
        state.velocityY = (nextY - state.bodyY) / delta
        state.bodyX = nextX
        state.bodyY = nextY
      } else {
        const stiffness = 36
        const damping = 6.5
        state.velocityX += (-stiffness * state.bodyX - damping * state.velocityX) * delta
        state.velocityY += (-stiffness * state.bodyY - damping * state.velocityY) * delta
        state.bodyX += state.velocityX * delta
        state.bodyY += state.velocityY * delta
      }
      scrollKick = approach(scrollKick, 0, 5, delta)
      const leanTarget = clamp(state.velocityX * -0.05, -0.32, 0.32) + scrollKick
      state.lean = approach(state.lean, leanTarget, 5, delta)

      const happy = time < happyUntil
      const carried = Boolean(dragging)
      const still = time - pointer.lastMove > STILL_SECONDS
      const reacting = time < expressionUntil ? expression : null
      const surprised = carried || reacting === 'surprised'
      const annoyed = reacting === 'annoyed'
      const smiling = !surprised && !annoyed

      let eyeHeight = 1
      if (surprised) eyeHeight = 1.2
      if (annoyed) eyeHeight = 0.1
      if (blinking) eyeHeight = 0.06
      state.eyeHeight = approach(state.eyeHeight, eyeHeight, BLINK_RATE, delta)
      state.eyeWidth = approach(state.eyeWidth, annoyed ? 1.35 : surprised ? 1.1 : 1, FACE_RATE, delta)

      let mouthOpen = still || happy ? 0.5 : 0.14
      if (surprised) mouthOpen = 0.6
      if (annoyed) mouthOpen = 0
      state.smile = approach(state.smile, smiling ? 1 : 0, FACE_RATE, delta)
      state.mouthOpen = approach(state.mouthOpen, mouthOpen, FACE_RATE, delta)
      state.mouthWide = approach(state.mouthWide, surprised ? 0.5 : annoyed ? 0.65 : 1, FACE_RATE, delta)
      state.mouthRound = approach(state.mouthRound, surprised ? 1 : 0, FACE_RATE, delta)
      state.brow = approach(state.brow, surprised ? 0.1 : annoyed ? -0.05 : happy ? 0.04 : 0, FACE_RATE, delta)

      const nextFeeling = surprised ? 'surprised' : annoyed ? 'annoyed' : 'happy'
      if (nextFeeling !== feeling) {
        feeling = nextFeeling
        feelingRef.current?.(feeling)
      }

      gl.uniform2f(u.uBody, state.bodyX, state.bodyY)
      gl.uniform1f(u.uLean, state.lean + Math.sin(time * 0.9) * 0.008)
      gl.uniform1f(u.uBreath, Math.sin(time * 1.1) * 0.02)
      rotation = headRotation(state.yaw, state.pitch, state.lean * 0.6 + state.yaw * -0.12)
      gl.uniformMatrix3fv(u.uHeadRotation, false, rotation)
      gl.uniform2f(u.uEye, state.eyeX, state.eyeY)
      gl.uniform1f(u.uEyeHeight, state.eyeHeight)
      gl.uniform1f(u.uEyeWidth, state.eyeWidth)
      gl.uniform1f(u.uMouthOpen, state.mouthOpen)
      gl.uniform1f(u.uMouthWide, state.mouthWide)
      gl.uniform1f(u.uSmile, state.smile)
      gl.uniform1f(u.uMouthRound, state.mouthRound)
      gl.uniform1f(u.uBrow, state.brow)
    }

    function draw() {
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      drawCables(lastDelta)
    }

    function tick(now) {
      frame = requestAnimationFrame(tick)
      const delta = last ? Math.min((now - last) / 1000, MAX_DELTA) : 0.016
      last = now
      lastDelta = delta
      update(delta)
      draw()
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

    function onPointerMove(event) {
      pointer.x = event.clientX
      pointer.y = event.clientY
      pointer.lastMove = time
      pointer.known = true
      if (event.pointerType !== 'mouse') return
      const hovering = !event.target.closest('a, button') && isOnMascot(event.clientX, event.clientY)
      frameElement.style.cursor = dragging ? 'grabbing' : hovering ? 'grab' : ''
    }

    function onPointerDown(event) {
      if (event.target.closest('a, button') || !isOnMascot(event.clientX, event.clientY)) return

      pointer.x = event.clientX
      pointer.y = event.clientY
      pointer.lastMove = time
      pointer.known = true
      const part = touchedPart(event.clientX, event.clientY)
      const press = { x: event.clientX, y: event.clientY, part }

      if (event.pointerType === 'mouse') {
        const world = toWorld(event.clientX, event.clientY)
        dragging = { x: world.x - state.bodyX, y: world.y - state.bodyY, press }
        frameElement.setPointerCapture(event.pointerId)
        event.preventDefault()
      } else {
        reactTo(part)
      }
    }

    function onPointerUp() {
      if (!dragging) return
      const { press } = dragging
      const travelled = Math.hypot(pointer.x - press.x, pointer.y - press.y)
      dragging = null
      frameElement.style.cursor = ''
      if (travelled < 6) reactTo(press.part)
    }

    function onScroll() {
      const next = window.scrollY
      scrollKick = clamp((next - lastScroll) * 0.002, -0.2, 0.2)
      lastScroll = next
    }

    if (!reduced) {
      frameElement.addEventListener('pointermove', onPointerMove)
      frameElement.addEventListener('pointerdown', onPointerDown)
      frameElement.addEventListener('pointerup', onPointerUp)
      frameElement.addEventListener('pointercancel', onPointerUp)
      window.addEventListener('scroll', onScroll, { passive: true })
    }

    applyThemeRef.current = () => {
      gl.uniform1f(u.uDark, themeRef.current === 'dark' ? 1 : 0)
      draw()
    }

    update(0.016)
    resize()
    applyThemeRef.current()

    const sizeObserver = new ResizeObserver(resize)
    sizeObserver.observe(canvas)
    sizeObserver.observe(stage)

    const viewObserver = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) start()
      else stop()
    })
    viewObserver.observe(frameElement)

    return () => {
      stop()
      applyThemeRef.current = () => {}
      sizeObserver.disconnect()
      viewObserver.disconnect()
      frameElement.removeEventListener('pointermove', onPointerMove)
      frameElement.removeEventListener('pointerdown', onPointerDown)
      frameElement.removeEventListener('pointerup', onPointerUp)
      frameElement.removeEventListener('pointercancel', onPointerUp)
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  // Chạy đồng bộ để ảnh chụp của hiệu ứng đổi theme có sẵn viền mới.
  useLayoutEffect(() => {
    applyThemeRef.current()
  }, [theme])

  return (
    <>
      <canvas ref={canvasRef} className="mascot" aria-hidden="true" />
      <canvas ref={cablesRef} className="cables" aria-hidden="true" />
    </>
  )
}
