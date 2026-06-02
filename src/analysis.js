function valueState(stock) {
  const pe = stock.peTtm || stock.peDynamic || stock.peStatic
  const pb = stock.pb
  const roe = stock.roe
  const dividend = stock.dividendYield
  const score = [
    pe && pe > 0 && pe < 18,
    pb && pb > 0 && pb < 2.5,
    roe && roe >= 12,
    dividend && dividend >= 2,
  ].filter(Boolean).length

  if (score >= 3) return '估值与股东回报指标相对友好，接近格雷厄姆式“安全边际”的观察方向。'
  if (score === 2) return '估值或盈利质量有部分支撑，但安全边际并不充分，需要继续看利润稳定性和资产质量。'
  return '仅从当前公开行情指标看，低估值或高质量证据不足，价值投资框架下应提高买入要求。'
}

function qualityState(stock) {
  const roe = stock.roe
  const margin = stock.netMargin || stock.grossMargin
  const debt = stock.debtRatio
  if (roe >= 15 && margin >= 15 && (!debt || debt < 55)) {
    return '盈利能力和负债结构较健康，符合巴菲特、芒格式“好公司优先”的初筛特征。'
  }
  if (roe >= 10 || margin >= 10) {
    return '具备一定盈利能力，但还不足以单独证明长期护城河，需要结合行业地位、现金流和管理层质量。'
  }
  return '盈利质量指标偏弱或缺失，长期持有逻辑需要更强的基本面证据支撑。'
}

function trendState(stock, kline) {
  if (kline.length < 20) return '历史价格样本不足，暂不做趋势判断。'
  const last = kline[kline.length - 1]
  const ma20 = average(kline.slice(-20).map((item) => item.close))
  const ma60 = average(kline.slice(-60).map((item) => item.close))
  const latestTurnover = last.turnover
  const direction = last.close >= ma20 ? '站上' : '低于'
  const longer = ma60 ? (last.close >= ma60 ? '中期均线之上' : '中期均线之下') : '中期均线样本有限'
  const activity = latestTurnover >= 5 ? '成交活跃度较高' : '成交活跃度温和'

  return `价格${direction} 20 日均线，处于${longer}，${activity}。按欧奈尔 CAN SLIM 或趋势交易思路，应重点观察放量突破、回撤承接和市场整体环境。`
}

function riskState(stock, kline) {
  const drawdown = maxDrawdown(kline)
  const risks = []
  if (stock.peTtm > 40 || stock.pb > 8) risks.push('估值容错率偏低')
  if (stock.debtRatio > 70) risks.push('资产负债率偏高')
  if (drawdown <= -25) risks.push('近阶段最大回撤较深')
  if (stock.turnover > 12) risks.push('换手率过高，短线资金博弈较强')
  if (risks.length === 0) return '主要量化风险暂未明显暴露，但仍需检查财报、行业周期和重大公告。'
  return `需要优先核查：${risks.join('、')}。`
}

function average(values) {
  const usable = values.filter((value) => Number.isFinite(value))
  if (!usable.length) return null
  return usable.reduce((sum, value) => sum + value, 0) / usable.length
}

function maxDrawdown(kline) {
  let peak = 0
  let worst = 0
  kline.forEach((item) => {
    peak = Math.max(peak, item.close)
    if (peak > 0) worst = Math.min(worst, (item.close - peak) / peak)
  })
  return worst * 100
}

function conclusion(stock, kline) {
  const price = stock.price || 0
  const last = kline[kline.length - 1]
  const ma20 = average(kline.slice(-20).map((item) => item.close))
  const pe = stock.peTtm || stock.peDynamic || stock.peStatic

  if (stock.roe >= 12 && pe > 0 && pe < 25 && ma20 && price >= ma20) {
    return '综合看法：基本面与趋势同时具备一定支撑，可列入跟踪池；更稳妥的动作是等待财报确认和合理回撤后的风险收益比。'
  }
  if (last && ma20 && last.close < ma20 && (pe > 35 || stock.pb > 6)) {
    return '综合看法：当前更像高波动或估值压力阶段，不宜只因短期反弹追高；应先确认盈利增长能否覆盖估值。'
  }
  return '综合看法：信息尚不足以形成高置信度判断，建议把它作为待研究标的，补充行业景气度、近三年财报、现金流和同业估值比较。'
}

export function buildAnalysis(stock, kline) {
  return {
    summary: conclusion(stock, kline),
    points: [
      { title: '价值框架', text: valueState(stock) },
      { title: '质量框架', text: qualityState(stock) },
      { title: '趋势框架', text: trendState(stock, kline) },
      { title: '风险提示', text: riskState(stock, kline) },
    ],
    sources: [
      '本杰明·格雷厄姆《聪明的投资者》：安全边际、低估值与防御性投资原则。',
      '菲利普·费雪《怎样选择成长股》：管理层、行业空间和长期成长质量。',
      '彼得·林奇《彼得·林奇的成功投资》：业务可理解性、成长与估值匹配。',
      '威廉·欧奈尔《笑傲股市》：趋势、成交量和盈利增长共同验证。',
      '巴菲特、芒格公开股东信与访谈：商业质量、护城河、长期现金流与能力圈。',
    ],
  }
}

const BULLISH_WORDS = [
  '回购',
  '注销',
  '增持',
  '净利润增长',
  '同比增长',
  '上涨',
  '盈利增长',
  '中标',
  '突破',
  '创新高',
  '订单',
  '分红',
  '派息',
  '上修',
  '底部',
  '拉升',
  '涨停',
]

const BEARISH_WORDS = [
  '减持',
  '下滑',
  '下降',
  '亏损',
  '暴雷',
  '处罚',
  '立案',
  '问询',
  '终止',
  '跌停',
  '下跌',
  '风险',
  '债务',
  '退市',
  '捆绑',
  '澄清',
  '承压',
]

function clamp(value) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function keywordScore(text, words) {
  return words.reduce((score, word) => (text.includes(word) ? score + 1 : score), 0)
}

function valuationScore(stock) {
  const pe = stock.peTtm || stock.peDynamic || stock.peStatic
  const pb = stock.pb
  const dividend = stock.dividendYield
  const roe = stock.roe
  let score = 50

  if (pe > 0) {
    if (pe <= 12) score += 18
    else if (pe <= 20) score += 10
    else if (pe <= 35) score += 0
    else if (pe <= 60) score -= 14
    else score -= 24
  }

  if (pb > 0) {
    if (pb <= 1.5) score += 12
    else if (pb <= 3) score += 6
    else if (pb > 8) score -= 16
    else if (pb > 5) score -= 8
  }

  if (roe >= 18) score += 10
  else if (roe >= 12) score += 6
  else if (roe > 0 && roe < 8) score -= 8

  if (dividend >= 3) score += 8
  else if (dividend >= 1.5) score += 4

  return clamp(score)
}

function trendScore(stock, kline) {
  if (kline.length < 20) return 50
  const price = stock.price || kline[kline.length - 1].close
  const ma20 = average(kline.slice(-20).map((item) => item.close))
  const ma60 = average(kline.slice(-60).map((item) => item.close))
  let score = 50

  if (ma20) score += price >= ma20 ? 12 : -12
  if (ma60) score += price >= ma60 ? 10 : -10
  if (stock.changePercent > 2) score += 5
  if (stock.changePercent < -2) score -= 5
  return clamp(score)
}

export function buildOpinionScores(stock, kline, news) {
  const newsText = news.map((item) => `${item.title} ${item.summary}`).join(' ')
  const bullishHits = keywordScore(newsText, BULLISH_WORDS)
  const bearishHits = keywordScore(newsText, BEARISH_WORDS)
  const newsBias = clamp(50 + bullishHits * 7 - bearishHits * 8)
  const valuation = valuationScore(stock)
  const trend = trendScore(stock, kline)
  const riskPenalty = stock.debtRatio > 70 || maxDrawdown(kline) <= -25 ? 10 : 0

  const bullish = clamp(newsBias * 0.35 + valuation * 0.3 + trend * 0.25 + 50 * 0.1 - riskPenalty)
  const bearish = clamp(100 - bullish + bearishHits * 3 + riskPenalty)

  return {
    bullish,
    bearish,
    valuation,
    newsBias,
    bullishHits,
    bearishHits,
    comment:
      news.length === 0
        ? '近期新闻样本不足，评分主要来自估值和趋势，置信度偏低。'
        : `近期新闻中识别到 ${bullishHits} 个偏利好信号、${bearishHits} 个偏利空信号；评分为规则模型输出，适合做初筛。`,
  }
}
