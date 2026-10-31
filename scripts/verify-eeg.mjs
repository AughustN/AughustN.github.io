// Đo lại tín hiệu mô phỏng và so với giá trị nguồn. Chạy: node scripts/verify-eeg.mjs
import {
  createEegModel,
  ELECTRODES,
  MONTAGE,
  PARAMS,
  SAMPLE_RATE,
} from '../src/eeg/model.js'

const FFT_SIZE = 2048
const SECONDS = 1200
const SEEDS = [1, 2, 3, 4, 5]

function fft(re, im) {
  const n = re.length
  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      ;[re[i], re[j]] = [re[j], re[i]]
      ;[im[i], im[j]] = [im[j], im[i]]
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const angle = (-2 * Math.PI) / len
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < len / 2; k += 1) {
        const wr = Math.cos(angle * k)
        const wi = Math.sin(angle * k)
        const a = i + k
        const b = a + len / 2
        const tr = re[b] * wr - im[b] * wi
        const ti = re[b] * wi + im[b] * wr
        re[b] = re[a] - tr
        im[b] = im[a] - ti
        re[a] += tr
        im[a] += ti
      }
    }
  }
}

function welch(signal) {
  const psd = new Float64Array(FFT_SIZE / 2 + 1)
  const window = Float64Array.from(
    { length: FFT_SIZE },
    (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (FFT_SIZE - 1)),
  )
  let segments = 0
  for (let start = 0; start + FFT_SIZE <= signal.length; start += FFT_SIZE / 2) {
    const re = new Float64Array(FFT_SIZE)
    const im = new Float64Array(FFT_SIZE)
    for (let i = 0; i < FFT_SIZE; i += 1) re[i] = signal[start + i] * window[i]
    fft(re, im)
    for (let i = 0; i < psd.length; i += 1) psd[i] += re[i] * re[i] + im[i] * im[i]
    segments += 1
  }
  return psd.map((value) => value / segments)
}

function linearFit(xs, ys) {
  const n = xs.length
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n
  let top = 0
  let bottom = 0
  for (let i = 0; i < n; i += 1) {
    top += (xs[i] - mx) * (ys[i] - my)
    bottom += (xs[i] - mx) ** 2
  }
  const slope = top / bottom
  return { slope, intercept: my - slope * mx }
}

function record(seed, eyes, seconds, name, rhythms = true) {
  const model = createEegModel({ seed, eyes, rhythms })
  const index = model.electrodeIndex[name]
  const signal = new Float64Array(seconds * SAMPLE_RATE)
  for (let i = 0; i < signal.length; i += 1) {
    model.step()
    signal[i] = model.electrodes[index]
  }
  return signal
}

function analyseSpectrum(signal) {
  const psd = welch(signal)
  const hz = (i) => (i * SAMPLE_RATE) / FFT_SIZE
  const xs = []
  const ys = []
  for (let i = 1; i < psd.length; i += 1) {
    const f = hz(i)
    const fitBand = (f >= 2 && f < 6) || (f > 15 && f <= 40)
    if (fitBand) {
      xs.push(Math.log10(f))
      ys.push(Math.log10(psd[i]))
    }
  }
  const { slope, intercept } = linearFit(xs, ys)

  let peak = 0
  let peakPower = -Infinity
  const flat = new Float64Array(psd.length)
  for (let i = 1; i < psd.length; i += 1) {
    const f = hz(i)
    flat[i] = psd[i] - 10 ** (intercept + slope * Math.log10(f))
    if (f >= 7 && f <= 14 && flat[i] > peakPower) {
      peakPower = flat[i]
      peak = i
    }
  }
  let lo = peak
  while (lo > 1 && flat[lo] > peakPower / 2) lo -= 1
  let hi = peak
  while (hi < flat.length - 1 && flat[hi] > peakPower / 2) hi += 1

  return { exponent: -slope, peakHz: hz(peak), bandwidthHz: hz(hi) - hz(lo) }
}

function bandRms(signal) {
  const psd = welch(signal)
  const windowPower = FFT_SIZE * 0.375
  let total = 0
  for (let i = 1; i < psd.length; i += 1) {
    const f = (i * SAMPLE_RATE) / FFT_SIZE
    if (f >= 8 && f <= 13) total += (2 * psd[i]) / (windowPower * FFT_SIZE)
  }
  return Math.sqrt(total)
}

function burstPeaks(signal) {
  const peaks = []
  const block = SAMPLE_RATE
  for (let i = 0; i + block <= signal.length; i += block) {
    let max = 0
    for (let k = i; k < i + block; k += 1) max = Math.max(max, Math.abs(signal[k]))
    peaks.push(max)
  }
  peaks.sort((a, b) => a - b)
  return { median: peaks[Math.floor(peaks.length / 2)], p95: peaks[Math.floor(peaks.length * 0.95)] }
}

function mean(values) {
  return values.reduce((a, b) => a + b, 0) / values.length
}

const spectra = SEEDS.map((seed) => analyseSpectrum(record(seed, 'closed', SECONDS, 'O1')))
const report = (key) => mean(spectra.map((s) => s[key]))
const aperiodicOnly = mean(
  SEEDS.map((seed) => analyseSpectrum(record(seed, 'closed', SECONDS, 'O1', false)).exponent),
)

const closedSignals = SEEDS.map((seed) => record(seed, 'closed', 300, 'O1'))
const openSignals = SEEDS.map((seed) => record(seed, 'open', 300, 'O1'))
const closedAlpha = mean(closedSignals.map(bandRms))
const openAlpha = mean(openSignals.map(bandRms))
const peaks = closedSignals.map(burstPeaks)

const frontal = mean(SEEDS.map((seed) => bandRms(record(seed, 'closed', 300, 'Fz'))))

// Hướng sóng: độ trễ giữa P3 và O1 tại đỉnh tương quan chéo. Dương nghĩa là O1 đến sau.
function lagSamples(leading, trailing) {
  let best = 0
  let bestScore = -Infinity
  for (let lag = -60; lag <= 60; lag += 1) {
    let score = 0
    for (let i = 60; i < leading.length - 60; i += 1) score += leading[i] * trailing[i + lag]
    if (score > bestScore) {
      bestScore = score
      best = lag
    }
  }
  return best
}

const waveLag = lagSamples(record(3, 'closed', 300, 'P3'), record(3, 'closed', 300, 'O1'))
const expectedLag = Math.round(((0.95 - 0.5) * PARAMS.ringRadiusMeters * SAMPLE_RATE) / PARAMS.waveSpeed)

// Chớp mắt: đếm số lần và lấy đỉnh của từng lần trên Fp1 khi mắt mở.
const blinkModel = createEegModel({ seed: 7, eyes: 'open' })
const fp = blinkModel.electrodeIndex.Fp1
const blinkPeaks = []
let wasDown = false
let currentPeak = 0
for (let i = 0; i < 600 * SAMPLE_RATE; i += 1) {
  blinkModel.step()
  const down = blinkModel.lid() > 0.5
  if (down) currentPeak = Math.max(currentPeak, blinkModel.electrodes[fp])
  if (!down && wasDown) {
    blinkPeaks.push(currentPeak)
    currentPeak = 0
  }
  wasDown = down
}
blinkPeaks.sort((a, b) => a - b)

// Chú ý: alpha phải giảm giống như mở mắt.
function attentionAlpha(seed) {
  const model = createEegModel({ seed, eyes: 'closed' })
  model.setAttention(1)
  const index = model.electrodeIndex.O1
  const signal = new Float64Array(300 * SAMPLE_RATE)
  for (let i = 0; i < signal.length; i += 1) {
    model.step()
    signal[i] = model.electrodes[index]
  }
  return bandRms(signal)
}
const attendedAlpha = mean(SEEDS.map(attentionAlpha))

// Đáp ứng gợi: trung bình nhiều lần kích thích để lộ dạng sóng, như cách đo VEP thật.
function averageEvoked(trials) {
  const model = createEegModel({ seed: 11, eyes: 'closed' })
  const index = model.electrodeIndex.O1
  const length = Math.round(0.3 * SAMPLE_RATE)
  const sum = new Float64Array(length)
  for (let trial = 0; trial < trials; trial += 1) {
    for (let i = 0; i < SAMPLE_RATE; i += 1) model.step()
    model.stimulate()
    for (let i = 0; i < length; i += 1) {
      model.step()
      sum[i] += model.electrodes[index] / trials
    }
  }
  const ms = (i) => (i * 1000) / SAMPLE_RATE
  const peakIn = (from, to, sign) => {
    let best = 0
    let value = -Infinity
    for (let i = 0; i < length; i += 1) {
      if (ms(i) >= from && ms(i) <= to && sum[i] * sign > value) {
        value = sum[i] * sign
        best = i
      }
    }
    return { latency: ms(best), value: sum[best] }
  }
  const n75 = peakIn(60, 90, -1)
  const p100 = peakIn(90, 125, 1)
  return { latency: p100.latency, amplitude: p100.value - n75.value }
}
const evoked = averageEvoked(4000)

const rows = [
  ['Số điện cực / kênh', '19 / 18', `${ELECTRODES.length} / ${MONTAGE.length}`],
  ['χ, chỉ nền aperiodic', '1.43', aperiodicOnly.toFixed(2)],
  ['χ, tín hiệu đầy đủ', '1.43', report('exponent').toFixed(2)],
  ['Đỉnh alpha (Hz)', '10.7', report('peakHz').toFixed(2)],
  ['Độ rộng alpha (Hz)', '1.9', report('bandwidthHz').toFixed(2)],
  ['Đỉnh alpha O1, trung vị (µV)', '15-45', mean(peaks.map((p) => p.median)).toFixed(1)],
  ['Đỉnh alpha O1, p95 (µV)', '< 100', mean(peaks.map((p) => p.p95)).toFixed(1)],
  ['Alpha mắt nhắm / mở (lần)', '> 1', (closedAlpha / openAlpha).toFixed(2)],
  ['Alpha khi không / có chú ý (lần)', '> 1', (closedAlpha / attendedAlpha).toFixed(2)],
  ['Alpha O1 / Fz (lần)', '> 1', (closedAlpha / frontal).toFixed(2)],
  ['P100, trung bình 4000 lần (ms)', '~102', evoked.latency.toFixed(1)],
  ['N75-P100, trung bình 4000 lần (µV)', '~5.2', evoked.amplitude.toFixed(1)],
  ['Trễ sóng P3 đến O1 (mẫu)', `+${expectedLag}`, `+${waveLag}`.replace('+-', '-')],
  ['Chớp mắt mỗi phút', String(PARAMS.blinksPerMinute), (blinkPeaks.length / 10).toFixed(1)],
  ['Đỉnh chớp mắt Fp1, trung vị (µV)', '~100', blinkPeaks[blinkPeaks.length >> 1].toFixed(0)],
]

console.table(rows.map(([metric, target, measured]) => ({ metric, target, measured })))
