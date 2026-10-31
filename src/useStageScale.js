import { useLayoutEffect } from 'react'

// Khung đầu được dựng trên "sân khấu" có kích thước cố định, rồi phóng theo màn hình.
const WIDE_STAGE = { width: 1536, height: 782 }
const TALL_STAGE = { width: 375, height: 760 }

const MIN_NAV_SCALE = 0.6
const MAX_NAV_SCALE = 1.3

export function useStageScale() {
  useLayoutEffect(() => {
    const root = document.documentElement

    function apply() {
      const width = root.clientWidth
      const height = window.innerHeight
      const portrait = height > width
      const stage = portrait ? TALL_STAGE : WIDE_STAGE
      const scale = Math.min(width / stage.width, height / stage.height)
      const navScale = Math.min(MAX_NAV_SCALE, Math.max(MIN_NAV_SCALE, scale))

      root.classList.toggle('portrait', portrait)
      root.style.setProperty('--stage-width', stage.width)
      // Phần cao dư được trải vào khoảng trống quanh chữ và thân nhân vật.
      root.style.setProperty('--stage-height', height / scale)
      root.style.setProperty('--stage-scale', scale)
      root.style.setProperty('--nav-scale', navScale)
    }

    apply()
    addEventListener('resize', apply)
    return () => removeEventListener('resize', apply)
  }, [])
}
