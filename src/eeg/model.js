// Mô phỏng EEG lúc nghỉ, chạy thuần JS để kiểm chứng được bằng Node (scripts/verify-eeg.mjs).
// Đây là tín hiệu tổng hợp, không phải bản ghi của người thật.
//
// Mỗi điện cực là tổng của:
//   - Nền aperiodic 1/f^χ: Donoghue et al. 2020, Nat Neurosci. χ ≈ 1.43 (người trẻ, EEG nghỉ).
//   - Alpha: dao động tắt dần do nhiễu kích thích, tương đương AR(2).
//     Evertz et al. 2022, PLoS Comput Biol. Đỉnh 10.7 Hz, độ rộng 1.9 Hz (Donoghue, kênh Oz).
//     Mở mắt làm tăng damping nên alpha tự giảm (alpha blocking), không gate biên độ.
//   - Beta biên độ thấp ở vùng trán: gradient trước-sau của EEG thức bình thường.
//   - Chớp mắt: lệch dương ở trán khi nhắm, âm khi mở (learningeeg.com/normal-awake).
//   - Đáp ứng gợi thị giác khi được kích thích: N75, P100, N145 ở chẩm, biên độ N75-P100 khoảng 5 µV.
//     Tín hiệu đơn lần vốn nhỏ hơn alpha nhiều, nên phần hiển thị dựa vào màu chứ không phóng đại.
//
// Kênh hiển thị là hiệu hai điện cực theo montage ACNS Guideline 3, LB-18.1.

export const SAMPLE_RATE = 256

// ACNS Guideline 3, bảng Standard Longitudinal Bipolar Montages, cột LB-18.1.
export const MONTAGE = [
  ['Fp1', 'F7'],
  ['F7', 'T7'],
  ['T7', 'P7'],
  ['P7', 'O1'],
  ['Fp1', 'F3'],
  ['F3', 'C3'],
  ['C3', 'P3'],
  ['P3', 'O1'],
  ['Fz', 'Cz'],
  ['Cz', 'Pz'],
  ['Fp2', 'F4'],
  ['F4', 'C4'],
  ['C4', 'P4'],
  ['P4', 'O2'],
  ['Fp2', 'F8'],
  ['F8', 'T8'],
  ['T8', 'P8'],
  ['P8', 'O2'],
]

// Số kênh của từng chuỗi, dùng để tạo khoảng cách nhóm khi vẽ.
export const CHAINS = [4, 4, 2, 4, 4]

// Toạ độ 10-20 chiếu phẳng: x trái âm phải dương, y trước dương sau âm, vòng ngoài bán kính 1.
const POSITIONS = {
  Fp1: [-0.31, 0.95],
  Fp2: [0.31, 0.95],
  F7: [-0.81, 0.59],
  F3: [-0.4, 0.5],
  Fz: [0, 0.5],
  F4: [0.4, 0.5],
  F8: [0.81, 0.59],
  T7: [-1, 0],
  C3: [-0.5, 0],
  Cz: [0, 0],
  C4: [0.5, 0],
  T8: [1, 0],
  P7: [-0.81, -0.59],
  P3: [-0.4, -0.5],
  Pz: [0, -0.5],
  P4: [0.4, -0.5],
  P8: [0.81, -0.59],
  O1: [-0.31, -0.95],
  O2: [0.31, -0.95],
}

export const ELECTRODES = Object.keys(POSITIONS)

// Nhãn của từng mẫu trên mỗi kênh, dùng để tô màu.
export const TAG = { NONE: 0, ALPHA: 1, BLINK: 2, EVOKED: 3 }

export const PARAMS = {
  aperiodicExponent: 1.43,
  aperiodicRms: 8, // µV
  alphaHz: 10.7,
  alphaBandwidthHz: 1.9,
  alphaRms: 15, // µV ở chẩm, cho đỉnh burst trong khoảng 15-45 µV của PDR người lớn
  alphaOpenDampingFactor: 6, // Lựa chọn thiết kế: Evertz chỉ nêu hướng thay đổi, không cho hệ số này
  betaHz: 20,
  betaBandwidthHz: 6,
  betaRms: 3, // µV ở trán
  waveSpeed: 0.5, // m/s, giữa khoảng 0.25-0.75 của Zhang et al. 2018 (đo ECoG)
  ringRadiusMeters: 0.144, // 40% của chu vi nasion-inion khoảng 36 cm
  blinkMicrovolts: 100,
  blinkSeconds: 0.12,
  blinksPerMinute: 13.8,
  evokedSeconds: 0.25,
  // [trễ ms, độ rộng ms, biên độ µV]. Hai đỉnh đầu chồng nhau nên biên độ đặt lớn hơn
  // để N75-P100 đo được khoảng 5 µV. Độ rộng và đỉnh N145 là lựa chọn thiết kế.
  evokedPeaks: [
    [75, 12, -2.9],
    [100, 15, 4],
    [145, 20, -2.7],
  ],
  // Lựa chọn thiết kế cho việc gắn nhãn tô màu, không phải giá trị đo.
  alphaTagRms: 9, // µV
  blinkTagMicrovolts: 18,
  envelopeSeconds: 0.3,
}

// Dải cực phải vượt xa vùng 2-40 Hz, nếu không đuôi phổ bị dốc hơn χ.
const APERIODIC_POLES_HZ = [0.1, 0.3, 0.84, 2.3, 6.5, 18, 50, 140, 400]
const HEMISPHERE_GAIN = { left: 0.9, right: 1 } // Bên trái thường thấp hơn nhẹ
const COMMON_ALPHA = 0.9
const LOCAL_ALPHA = Math.sqrt(1 - COMMON_ALPHA ** 2)

function createRandom(seed) {
  let state = seed >>> 0
  let spare = null

  function uniform() {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  function gaussian() {
    if (spare !== null) {
      const value = spare
      spare = null
      return value
    }
    const u = 1 - uniform()
    const radius = Math.sqrt(-2 * Math.log(u))
    const angle = 2 * Math.PI * uniform()
    spare = radius * Math.sin(angle)
    return radius * Math.cos(angle)
  }

  return { uniform, gaussian }
}

// Tổng các quá trình AR(1) tần số góc chia đều theo log cho phổ xấp xỉ 1/f^χ.
function createAperiodicBank(exponent, rms, random) {
  const poles = APERIODIC_POLES_HZ.map((hz) => {
    const rho = Math.exp((-2 * Math.PI * hz) / SAMPLE_RATE)
    const dcPower = hz ** -exponent
    const sigma = Math.sqrt(dcPower) * (1 - rho)
    return { rho, sigma, variance: (sigma * sigma) / (1 - rho * rho), value: 0 }
  })
  const scale = rms / Math.sqrt(poles.reduce((sum, pole) => sum + pole.variance, 0))

  return function next() {
    let total = 0
    for (const pole of poles) {
      pole.value = pole.rho * pole.value + pole.sigma * random.gaussian()
      total += pole.value
    }
    return total * scale
  }
}

// Dao động tắt dần do nhiễu kích thích. Phổ Lorentz có độ rộng FWHM = γ / π (Hz).
function createOscillator(hz, bandwidthHz, rms, random) {
  const theta = (2 * Math.PI * hz) / SAMPLE_RATE
  const baseGamma = Math.PI * bandwidthHz
  const unitVariance = (r) =>
    (1 + r * r) / ((1 - r * r) * (1 + r ** 4 - 2 * r * r * Math.cos(2 * theta)))
  const drive = rms / Math.sqrt(unitVariance(Math.exp(-baseGamma / SAMPLE_RATE)))
  let previous = 0
  let beforePrevious = 0

  return function next(dampingFactor = 1) {
    const r = Math.exp((-baseGamma * dampingFactor) / SAMPLE_RATE)
    const value =
      2 * r * Math.cos(theta) * previous - r * r * beforePrevious + drive * random.gaussian()
    beforePrevious = previous
    previous = value
    return value
  }
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value))
}

function alphaWeight(y) {
  return 0.05 + 0.95 * clamp01((0.6 - y) / 1.55) ** 2
}

function betaWeight(y) {
  return 0.15 + 0.85 * clamp01((y + 0.2) / 1.1)
}

function blinkWeight(y) {
  return clamp01((y - 0.1) / 0.85) ** 2
}

function evokedWeight(y) {
  return clamp01((-0.3 - y) / 0.65) ** 2
}

function evokedWave(seconds) {
  const ms = seconds * 1000
  return PARAMS.evokedPeaks.reduce(
    (sum, [latency, width, amplitude]) =>
      sum + amplitude * Math.exp(-((ms - latency) ** 2) / (2 * width ** 2)),
    0,
  )
}

// `rhythms: false` tắt alpha và beta, chỉ dùng để đo riêng nền aperiodic khi kiểm chứng.
export function createEegModel({ seed = 20261031, eyes = 'auto', rhythms = true } = {}) {
  const random = createRandom(seed)
  const p = PARAMS

  // Nguồn nền phân bố trên da đầu, trộn theo khoảng cách để mô phỏng dẫn truyền thể tích.
  const latentPositions = [
    [0, 0],
    ...Array.from({ length: 8 }, (_, i) => {
      const angle = (i / 8) * Math.PI * 2
      return [Math.cos(angle), Math.sin(angle)]
    }),
  ]
  const latents = latentPositions.map(() =>
    createAperiodicBank(p.aperiodicExponent, p.aperiodicRms, random),
  )
  const latentValues = new Float64Array(latents.length)

  const alpha = {
    common: createOscillator(p.alphaHz, p.alphaBandwidthHz, p.alphaRms, random),
    left: createOscillator(p.alphaHz, p.alphaBandwidthHz, p.alphaRms, random),
    right: createOscillator(p.alphaHz, p.alphaBandwidthHz, p.alphaRms, random),
  }
  const beta = {
    left: createOscillator(p.betaHz, p.betaBandwidthHz, p.betaRms, random),
    right: createOscillator(p.betaHz, p.betaBandwidthHz, p.betaRms, random),
  }

  // Lúc nghỉ, sóng alpha trên EEG da đầu lan từ trán về chẩm (Alamia & VanRullen 2019).
  const maxY = 0.95
  const delayBuffer = 512
  const alphaHistory = { left: new Float64Array(delayBuffer), right: new Float64Array(delayBuffer) }

  const sites = ELECTRODES.map((name) => {
    const [x, y] = POSITIONS[name]
    const raw = latentPositions.map(([lx, ly]) =>
      Math.exp(-((x - lx) ** 2 + (y - ly) ** 2) / (2 * 0.7 ** 2)),
    )
    const norm = Math.sqrt(raw.reduce((sum, w) => sum + w * w, 0))
    const lagSeconds = ((maxY - y) * p.ringRadiusMeters) / p.waveSpeed
    return {
      x,
      latentWeights: raw.map((w) => w / norm),
      alpha: alphaWeight(y),
      beta: betaWeight(y),
      blink: blinkWeight(y),
      evoked: evokedWeight(y),
      lag: Math.round(lagSeconds * SAMPLE_RATE),
    }
  })

  const index = Object.fromEntries(ELECTRODES.map((name, i) => [name, i]))
  const pairs = MONTAGE.map(([a, b]) => [index[a], index[b]])
  const electrodes = new Float64Array(sites.length)
  const electrodeAlpha = new Float64Array(sites.length)
  const channelAlphaPower = new Float64Array(pairs.length)
  const envelopeCoefficient = 1 - Math.exp(-1 / (p.envelopeSeconds * SAMPLE_RATE))
  const evokedSamples = Math.round(p.evokedSeconds * SAMPLE_RATE)

  let attention = 0
  let evokedStart = -Infinity
  let sample = 0
  let eyesClosed = eyes !== 'open'
  let nextSwitch = Math.round((8 + random.uniform() * 6) * SAMPLE_RATE)
  let blinkUntil = -1
  let forcedBlinkUntil = -1
  let lid = eyesClosed ? 1 : 0
  let lidHeld = lid
  let eog = 0

  const lidCoefficient = 1 - Math.exp(-1 / (0.04 * SAMPLE_RATE))
  const highPassCoefficient = Math.exp(-1 / (1 * SAMPLE_RATE))
  const blinkChance = p.blinksPerMinute / 60 / SAMPLE_RATE

  function updateEyes() {
    if (eyes === 'auto' && sample >= nextSwitch) {
      eyesClosed = !eyesClosed
      const seconds = eyesClosed ? 8 + random.uniform() * 6 : 3 + random.uniform() * 3
      nextSwitch = sample + Math.round(seconds * SAMPLE_RATE)
    }
    if (!eyesClosed && sample > blinkUntil && random.uniform() < blinkChance) {
      blinkUntil = sample + Math.round(p.blinkSeconds * SAMPLE_RATE)
    }

    const pulsing = sample <= forcedBlinkUntil
    const resting = eyesClosed || sample <= blinkUntil ? 1 : 0
    const target = pulsing ? 1 - resting : resting
    const previousLid = lid
    lid += (target - lid) * lidCoefficient
    // High-pass làm lệch hồi về 0: nhắm mắt lệch dương, mở mắt lệch âm.
    eog = highPassCoefficient * (eog + lid - previousLid)
    lidHeld = lid
  }

  function step(out, tags) {
    updateEyes()

    for (let i = 0; i < latents.length; i += 1) latentValues[i] = latents[i]()

    // Mở mắt hoặc chú ý đều làm tăng damping của alpha theo cùng một cơ chế.
    const blocked = eyesClosed ? attention : 1
    const damping = 1 + (p.alphaOpenDampingFactor - 1) * blocked
    const common = alpha.common(damping)
    const cursor = sample % delayBuffer
    alphaHistory.left[cursor] = COMMON_ALPHA * common + LOCAL_ALPHA * alpha.left(damping)
    alphaHistory.right[cursor] = COMMON_ALPHA * common + LOCAL_ALPHA * alpha.right(damping)

    const betaLeft = beta.left()
    const betaRight = beta.right()

    const evokedAge = sample - evokedStart
    const evokedActive = evokedAge >= 0 && evokedAge < evokedSamples
    const evokedValue = evokedActive ? evokedWave(evokedAge / SAMPLE_RATE) : 0

    for (let i = 0; i < sites.length; i += 1) {
      const site = sites[i]
      const past = (cursor - site.lag + delayBuffer) % delayBuffer
      const left = alphaHistory.left[past] * HEMISPHERE_GAIN.left
      const right = alphaHistory.right[past] * HEMISPHERE_GAIN.right
      const alphaValue = site.x < 0 ? left : site.x > 0 ? right : (left + right) / 2
      const betaValue = site.x < 0 ? betaLeft : site.x > 0 ? betaRight : (betaLeft + betaRight) / 2

      let aperiodic = 0
      for (let k = 0; k < latentValues.length; k += 1) {
        aperiodic += site.latentWeights[k] * latentValues[k]
      }

      const siteAlpha = site.alpha * alphaValue
      const rhythm = rhythms ? siteAlpha + site.beta * betaValue : 0
      electrodeAlpha[i] = siteAlpha
      electrodes[i] =
        aperiodic + rhythm + site.blink * p.blinkMicrovolts * eog + site.evoked * evokedValue
    }

    if (out) {
      for (let c = 0; c < pairs.length; c += 1) {
        const [a, b] = pairs[c]
        out[c] = electrodes[a] - electrodes[b]

        const alphaDifference = electrodeAlpha[a] - electrodeAlpha[b]
        channelAlphaPower[c] +=
          (alphaDifference * alphaDifference - channelAlphaPower[c]) * envelopeCoefficient

        if (!tags) continue
        const blinkDifference = (sites[a].blink - sites[b].blink) * p.blinkMicrovolts * eog
        const evokedDifference = Math.abs(sites[a].evoked - sites[b].evoked)
        if (evokedActive && evokedDifference > 0.3) tags[c] = TAG.EVOKED
        else if (Math.abs(blinkDifference) > p.blinkTagMicrovolts) tags[c] = TAG.BLINK
        else if (channelAlphaPower[c] > p.alphaTagRms ** 2) tags[c] = TAG.ALPHA
        else tags[c] = TAG.NONE
      }
    }

    sample += 1
  }

  return {
    step,
    electrodes,
    electrodeIndex: index,
    alphaLevel: (channel) => Math.sqrt(channelAlphaPower[channel]),
    setAttention: (value) => {
      attention = clamp01(value)
    },
    blink: () => {
      forcedBlinkUntil = sample + Math.round(p.blinkSeconds * SAMPLE_RATE)
    },
    stimulate: () => {
      evokedStart = sample
    },
    isEyesClosed: () => eyesClosed,
    lid: () => lidHeld,
  }
}
