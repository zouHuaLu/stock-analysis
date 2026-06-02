const QUOTE_FIELDS = [
  'f43',
  'f44',
  'f45',
  'f46',
  'f47',
  'f48',
  'f50',
  'f57',
  'f58',
  'f60',
  'f107',
  'f113',
  'f114',
  'f115',
  'f116',
  'f117',
  'f122',
  'f127',
  'f128',
  'f129',
  'f130',
  'f131',
  'f132',
  'f133',
  'f134',
  'f135',
  'f136',
  'f137',
  'f138',
  'f139',
  'f140',
  'f141',
  'f142',
  'f143',
  'f144',
  'f145',
  'f168',
  'f169',
  'f170',
  'f171',
  'f172',
  'f173',
  'f177',
  'f178',
  'f181',
  'f182',
  'f184',
  'f185',
  'f186',
  'f187',
  'f188',
  'f189',
  'f190',
  'f191',
  'f192',
  'f193',
  'f194',
  'f195',
  'f196',
  'f197',
  'f198',
]

const KLINE_FIELDS = ['f51', 'f52', 'f53', 'f54', 'f55', 'f56', 'f57', 'f58', 'f59', 'f60', 'f61']

const PERIOD_CONFIG = {
  minute: { eastmoneyKlt: '1', tencentPeriod: 'minute', limit: 240, label: '分时' },
  day: { eastmoneyKlt: '101', tencentPeriod: 'day', limit: 120, label: '日 K' },
  week: { eastmoneyKlt: '102', tencentPeriod: 'week', limit: 160, label: '周 K' },
  month: { eastmoneyKlt: '103', tencentPeriod: 'month', limit: 180, label: '月 K' },
}

export function normalizeCode(input) {
  return String(input || '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/^A\./i, '')
    .toUpperCase()
}

export function toSecId(input) {
  const code = normalizeCode(input)
  if (/^SH\d{6}$/.test(code)) return `1.${code.slice(2)}`
  if (/^SZ\d{6}$/.test(code)) return `0.${code.slice(2)}`
  if (/^BJ\d{6}$/.test(code)) return `2.${code.slice(2)}`
  if (/^\d{6}$/.test(code)) {
    if (code.startsWith('6')) return `1.${code}`
    if (code.startsWith('8') || code.startsWith('4') || code.startsWith('9')) return `2.${code}`
    return `0.${code}`
  }
  throw new Error('请输入 A 股代码，例如 600519、000001、300750 或 SH600519。')
}

function toTencentSymbol(input) {
  const code = normalizeCode(input)
  if (/^SH\d{6}$/.test(code)) return code.toLowerCase()
  if (/^SZ\d{6}$/.test(code)) return code.toLowerCase()
  if (/^BJ\d{6}$/.test(code)) return `bj${code.slice(2)}`
  if (/^\d{6}$/.test(code)) {
    if (code.startsWith('6')) return `sh${code}`
    if (code.startsWith('8') || code.startsWith('4') || code.startsWith('9')) return `bj${code}`
    return `sz${code}`
  }
  throw new Error('请输入 A 股代码，例如 600519、000001、300750 或 SH600519。')
}

function scalePrice(value) {
  if (value === undefined || value === null || value === '-' || Number(value) === 0) return null
  const number = Number(value)
  return Math.abs(number) > 10000 ? number / 100 : number
}

function scalePercent(value) {
  if (value === undefined || value === null || value === '-') return null
  return Number(value) / 100
}

function parseRawNumber(value) {
  if (value === undefined || value === null || value === '-') return null
  return Number(value)
}

function parseKline(row) {
  const parts = row.split(',')
  return {
    date: parts[0],
    open: Number(parts[1]),
    close: Number(parts[2]),
    high: Number(parts[3]),
    low: Number(parts[4]),
    volume: Number(parts[5]),
    amount: Number(parts[6]),
    amplitude: Number(parts[7]),
    changePercent: Number(parts[8]),
    change: Number(parts[9]),
    turnover: Number(parts[10]),
  }
}

function parseTencentKline(row) {
  const open = Number(row[1])
  const close = Number(row[2])
  const high = Number(row[3])
  const low = Number(row[4])
  const volume = Number(row[5])
  const previousClose = Number(row[6]) || open
  const change = close - previousClose
  const changePercent = previousClose ? (change / previousClose) * 100 : null

  return {
    date: row[0],
    open,
    close,
    high,
    low,
    volume,
    amount: null,
    amplitude: previousClose ? ((high - low) / previousClose) * 100 : null,
    changePercent,
    change,
    turnover: null,
  }
}

function parseTencentMinute(row, index, rows, tradeDate) {
  const [time, priceText, volumeText, amountText] = row.split(' ')
  const price = Number(priceText)
  const previous = index > 0 ? Number(rows[index - 1].split(' ')[1]) : price
  const volume = Number(volumeText) - (index > 0 ? Number(rows[index - 1].split(' ')[2]) : 0)
  const amount = Number(amountText) - (index > 0 ? Number(rows[index - 1].split(' ')[3]) : 0)

  return {
    date: `${tradeDate || ''} ${time.slice(0, 2)}:${time.slice(2)}`.trim(),
    open: previous,
    close: price,
    high: Math.max(previous, price),
    low: Math.min(previous, price),
    volume: Math.max(0, volume),
    amount: Math.max(0, amount),
    amplitude: null,
    changePercent: previous ? ((price - previous) / previous) * 100 : null,
    change: price - previous,
    turnover: null,
  }
}

function getPeriodConfig(period, days) {
  const config = PERIOD_CONFIG[period] || PERIOD_CONFIG.day
  return {
    ...config,
    limit: days || config.limit,
  }
}

function mapEastmoneySnapshot(raw, secid) {
  return {
    secid,
    source: '东方财富',
    code: raw.f57,
    name: raw.f58,
    market: raw.f107,
    price: scalePrice(raw.f43),
    high: scalePrice(raw.f44),
    low: scalePrice(raw.f45),
    open: scalePrice(raw.f46),
    volume: parseRawNumber(raw.f47),
    amount: parseRawNumber(raw.f48),
    peDynamic: parseRawNumber(raw.f50),
    previousClose: scalePrice(raw.f60),
    totalMarketCap: parseRawNumber(raw.f116),
    circulatingMarketCap: parseRawNumber(raw.f117),
    volumeRatio: parseRawNumber(raw.f122),
    turnover: scalePercent(raw.f168),
    changePercent: scalePercent(raw.f170),
    change: scalePrice(raw.f169),
    amplitude: scalePercent(raw.f171),
    pb: parseRawNumber(raw.f173),
    peStatic: parseRawNumber(raw.f113),
    peTtm: parseRawNumber(raw.f115),
    netInflowMain: parseRawNumber(raw.f184),
    mainInflowPercent: scalePercent(raw.f185),
    roe: scalePercent(raw.f187),
    grossMargin: scalePercent(raw.f188),
    netMargin: scalePercent(raw.f189),
    debtRatio: scalePercent(raw.f190),
    eps: parseRawNumber(raw.f191),
    bvps: parseRawNumber(raw.f192),
    dividendYield: scalePercent(raw.f193),
    updatedAt: new Date().toLocaleString('zh-CN'),
    raw,
  }
}

function mapTencentSnapshot(qt, symbol) {
  return {
    secid: symbol,
    source: '腾讯证券',
    code: qt[2],
    name: qt[1],
    market: symbol.slice(0, 2).toUpperCase(),
    price: parseRawNumber(qt[3]),
    previousClose: parseRawNumber(qt[4]),
    open: parseRawNumber(qt[5]),
    volume: parseRawNumber(qt[36]),
    amount: parseRawNumber(qt[37]) ? parseRawNumber(qt[37]) * 10000 : null,
    turnover: parseRawNumber(qt[38]),
    peDynamic: parseRawNumber(qt[39]),
    high: parseRawNumber(qt[41]),
    low: parseRawNumber(qt[42]),
    amplitude: parseRawNumber(qt[43]),
    totalMarketCap: parseRawNumber(qt[45]) ? parseRawNumber(qt[45]) * 100000000 : null,
    circulatingMarketCap: parseRawNumber(qt[44]) ? parseRawNumber(qt[44]) * 100000000 : null,
    volumeRatio: parseRawNumber(qt[49]),
    change: parseRawNumber(qt[31]),
    changePercent: parseRawNumber(qt[32]),
    pb: parseRawNumber(qt[46]),
    peStatic: parseRawNumber(qt[52]),
    peTtm: parseRawNumber(qt[39]),
    roe: null,
    grossMargin: null,
    netMargin: null,
    debtRatio: null,
    eps: null,
    bvps: null,
    dividendYield: null,
    updatedAt: new Date().toLocaleString('zh-CN'),
    raw: qt,
  }
}

async function fetchEastmoneySnapshot(input) {
  const secid = toSecId(input)
  const query = new URLSearchParams({
    secid,
    fields: QUOTE_FIELDS.join(','),
    ut: 'fa5fd1943c7b386f172d6893dbfba10b',
    fltt: '2',
    invt: '2',
  })

  const response = await fetch(`/em-quote/api/qt/stock/get?${query}`)
  if (!response.ok) throw new Error(`行情接口请求失败：${response.status}`)

  const payload = await response.json()
  if (!payload.data) throw new Error('未查询到股票数据，请确认代码是否正确。')

  return mapEastmoneySnapshot(payload.data, secid)
}

async function fetchTencentSnapshot(input) {
  const symbol = toTencentSymbol(input)
  const query = new URLSearchParams({
    param: `${symbol},day,,,120,qfq`,
  })
  const response = await fetch(`/tencent-stock/appstock/app/fqkline/get?${query}`)
  if (!response.ok) throw new Error(`备用行情接口请求失败：${response.status}`)

  const payload = await response.json()
  const data = payload?.data?.[symbol]
  const qt = data?.qt?.[symbol]
  if (!qt) throw new Error('未查询到股票数据，请确认代码是否正确。')
  return mapTencentSnapshot(qt, symbol)
}

export async function fetchStockSnapshot(input) {
  try {
    return await fetchTencentSnapshot(input)
  } catch (tencentError) {
    const snapshot = await fetchEastmoneySnapshot(input)
    snapshot.fallbackReason = tencentError.message
    return snapshot
  }
}

async function fetchEastmoneyKline(input, period, days) {
  const secid = toSecId(input)
  const config = getPeriodConfig(period, days)
  const query = new URLSearchParams({
    secid,
    klt: config.eastmoneyKlt,
    fqt: '1',
    beg: '0',
    end: '20500000',
    fields1: 'f1,f2,f3,f4,f5,f6',
    fields2: KLINE_FIELDS.join(','),
    lmt: String(config.limit),
  })

  const response = await fetch(`/em-history/api/qt/stock/kline/get?${query}`)
  if (!response.ok) throw new Error(`K 线接口请求失败：${response.status}`)

  const payload = await response.json()
  const rows = payload?.data?.klines || []
  return rows.map(parseKline)
}

async function fetchTencentKline(input, period, days) {
  const symbol = toTencentSymbol(input)
  const config = getPeriodConfig(period, days)
  if (period === 'minute') return fetchTencentMinuteKline(symbol)

  const query = new URLSearchParams({
    param: `${symbol},${config.tencentPeriod},,,${config.limit},qfq`,
  })
  const response = await fetch(`/tencent-stock/appstock/app/fqkline/get?${query}`)
  if (!response.ok) throw new Error(`备用 K 线接口请求失败：${response.status}`)

  const payload = await response.json()
  const data = payload?.data?.[symbol]
  const rows = data?.[`qfq${config.tencentPeriod}`] || data?.[config.tencentPeriod] || data?.qfqday || data?.day || []
  return rows.map(parseTencentKline)
}

async function fetchTencentMinuteKline(symbol) {
  const query = new URLSearchParams({ code: symbol })
  const response = await fetch(`/tencent-stock/appstock/app/minute/query?${query}`)
  if (!response.ok) throw new Error(`分时 K 线接口请求失败：${response.status}`)

  const payload = await response.json()
  const data = payload?.data?.[symbol]?.data
  const rows = data?.data || []
  return rows.map((row, index) => parseTencentMinute(row, index, rows, data?.date))
}

export async function fetchStockKline(input, period = 'day', days) {
  try {
    return await fetchEastmoneyKline(input, period, days)
  } catch {
    return fetchTencentKline(input, period, days)
  }
}

export function fetchDailyKline(input, days = 120) {
  return fetchStockKline(input, 'day', days)
}
