function ema(current, previous, period) {
  const multiplier = 2 / (period + 1)
  return current * multiplier + previous * (1 - multiplier)
}

function average(values) {
  const usable = values.filter((value) => Number.isFinite(value))
  if (!usable.length) return null
  return usable.reduce((sum, value) => sum + value, 0) / usable.length
}

function markerType(previousFast, previousSlow, currentFast, currentSlow) {
  if (![previousFast, previousSlow, currentFast, currentSlow].every(Number.isFinite)) return null
  if (previousFast <= previousSlow && currentFast > currentSlow) return 'golden'
  if (previousFast >= previousSlow && currentFast < currentSlow) return 'death'
  return null
}

export function calculateTechnicalIndicators(kline) {
  let ema12 = null
  let ema26 = null
  let dea = 0
  let previousDif = null
  let previousDea = null
  let previousK = 50
  let previousD = 50

  return kline.map((item, index) => {
    const close = item.close
    ema12 = ema12 === null ? close : ema(close, ema12, 12)
    ema26 = ema26 === null ? close : ema(close, ema26, 26)

    const dif = ema12 - ema26
    dea = index === 0 ? dif : ema(dif, dea, 9)
    const macd = (dif - dea) * 2
    const macdSignal = markerType(previousDif, previousDea, dif, dea)

    const window = kline.slice(Math.max(0, index - 8), index + 1)
    const high = Math.max(...window.map((row) => row.high))
    const low = Math.min(...window.map((row) => row.low))
    const rsv = high === low ? 50 : ((close - low) / (high - low)) * 100
    const k = (previousK * 2 + rsv) / 3
    const d = (previousD * 2 + k) / 3
    const j = 3 * k - 2 * d
    const kdjSignal = markerType(previousK, previousD, k, d)
    const ma5Volume = average(kline.slice(Math.max(0, index - 4), index + 1).map((row) => row.volume))

    previousDif = dif
    previousDea = dea
    previousK = k
    previousD = d

    return {
      ...item,
      dif,
      dea,
      macd,
      macdSignal,
      k,
      d,
      j,
      kdjSignal,
      ma5Volume,
    }
  })
}

export function formatSignal(type) {
  if (type === 'golden') return '金叉'
  if (type === 'death') return '死叉'
  return ''
}
