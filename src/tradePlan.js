function average(values) {
  const usable = values.filter(Number.isFinite)
  if (!usable.length) return null
  return usable.reduce((sum, value) => sum + value, 0) / usable.length
}

function clampPrice(value) {
  if (!Number.isFinite(value)) return null
  return Number(value.toFixed(2))
}

function nearestBelow(values, price) {
  const usable = values.filter((value) => Number.isFinite(value) && value < price)
  if (!usable.length) return null
  return Math.max(...usable)
}

function nearestAbove(values, price) {
  const usable = values.filter((value) => Number.isFinite(value) && value > price)
  if (!usable.length) return null
  return Math.min(...usable)
}

export function buildTradePlan(rows, period = 'day') {
  if (period !== 'day') {
    return {
      available: false,
      stance: '切换到日 K 后生成',
      summary: '明日买卖点计划以日 K 为基础，分时、周 K、月 K 更适合观察节奏或大周期，不适合直接生成明日价位。',
      levels: [],
      reasons: [],
    }
  }

  if (!rows || rows.length < 20) {
    return {
      available: false,
      stance: '样本不足',
      summary: '日 K 数据少于 20 条，无法稳定计算 5/10/20 日均线与近期支撑压力。',
      levels: [],
      reasons: [],
    }
  }

  const last = rows[rows.length - 1]
  const recent = rows.slice(-20)
  const close = last.close
  const ma5 = average(rows.slice(-5).map((item) => item.close))
  const ma10 = average(rows.slice(-10).map((item) => item.close))
  const ma20 = average(rows.slice(-20).map((item) => item.close))
  const ma60 = average(rows.slice(-60).map((item) => item.close))
  const volume5 = average(rows.slice(-5).map((item) => item.volume))
  const resistance = Math.max(...recent.map((item) => item.high))
  const support = Math.min(...recent.map((item) => item.low))
  const maSupport = nearestBelow([ma5, ma10, ma20, ma60], close)
  const maResistance = nearestAbove([ma5, ma10, ma20, ma60], close)
  const pullbackBuy = clampPrice((maSupport || ma10 || ma20 || support) * 1.005)
  const breakoutBuy = clampPrice(Math.max(resistance, maResistance || 0) * 1.003)
  const stopLoss = clampPrice(Math.min(support, ma20 || support) * 0.985)
  const firstTarget = clampPrice(Math.max(resistance, close * 1.025))
  const secondTarget = clampPrice(firstTarget * 1.035)
  const isBullStack = ma5 > ma10 && ma10 > ma20
  const isBearStack = ma5 < ma10 && ma10 < ma20
  const aboveMa20 = close >= ma20
  const volumeActive = volume5 ? last.volume >= volume5 * 1.15 : false
  const macdBull = last.dif > last.dea && last.macd > 0
  const kdjBull = last.k > last.d && last.k < 85

  const score =
    (isBullStack ? 24 : isBearStack ? -18 : 0) +
    (aboveMa20 ? 18 : -18) +
    (macdBull ? 16 : -12) +
    (kdjBull ? 12 : -10) +
    (volumeActive ? 10 : 0)

  let stance = '中性观察'
  if (score >= 38) stance = '偏多，等回踩或突破确认'
  else if (score <= -28) stance = '偏弱，先防守再观察'

  return {
    available: true,
    stance,
    summary:
      score >= 38
        ? '均线、趋势指标和量能具备一定配合，明日重点看回踩承接或放量突破。'
        : score <= -28
          ? '短线结构偏弱，明日不宜盲目追买，优先观察止跌和重新站回关键均线。'
          : '多空信号不够一致，明日更适合按区间交易计划执行，避免情绪化追涨杀跌。',
    movingAverages: { ma5, ma10, ma20, ma60 },
    levels: [
      { label: '低吸观察位', value: pullbackBuy, note: '靠近短中期均线或近期支撑，有承接再考虑。' },
      { label: '突破确认位', value: breakoutBuy, note: '需放量站上近期压力，假突破要快速撤退。' },
      { label: '防守止损位', value: stopLoss, note: '跌破说明短线结构转弱，应控制仓位风险。' },
      { label: '第一止盈位', value: firstTarget, note: '接近近期压力或短线涨幅目标，适合分批兑现。' },
      { label: '强势目标位', value: secondTarget, note: '仅在放量延续、MACD/KDJ 未转弱时参考。' },
    ],
    reasons: [
      `收盘价 ${close.toFixed(2)}，位于 20 日线${aboveMa20 ? '之上' : '之下'}。`,
      `均线结构：MA5 ${ma5.toFixed(2)} / MA10 ${ma10.toFixed(2)} / MA20 ${ma20.toFixed(2)}${ma60 ? ` / MA60 ${ma60.toFixed(2)}` : ''}。`,
      `MACD ${macdBull ? '偏多' : '偏弱'}，KDJ ${kdjBull ? '偏多或未明显超买' : '偏弱或存在高位钝化风险'}。`,
      volumeActive ? '今日成交量高于 5 日均量，短线资金参与度提升。' : '量能未明显放大，突破信号需要成交量确认。',
    ],
  }
}
