<script setup>
import { computed, ref } from 'vue'
import { buildAnalysis, buildOpinionScores } from './analysis'
import { fetchStockKline, fetchStockSnapshot } from './api/eastmoney'
import { fetchStockNews } from './api/news'
import { calculateTechnicalIndicators, formatSignal } from './indicators'

const keyword = ref('600519')
const loading = ref(false)
const klineLoading = ref(false)
const error = ref('')
const klineError = ref('')
const stock = ref(null)
const kline = ref([])
const activePeriod = ref('day')
const analysis = ref(null)
const news = ref([])
const scores = ref(null)
const newsError = ref('')
const periodOptions = [
  { value: 'minute', label: '分时 K' },
  { value: 'day', label: '日 K' },
  { value: 'week', label: '周 K' },
  { value: 'month', label: '月 K' },
]

const indicatorRows = computed(() => calculateTechnicalIndicators(kline.value))
const visibleCount = computed(() => (activePeriod.value === 'minute' ? 120 : 90))
const visibleIndicators = computed(() => indicatorRows.value.slice(-visibleCount.value))

const metrics = computed(() => {
  if (!stock.value) return []
  return [
    { label: '最新价', value: formatPrice(stock.value.price), emphasis: true },
    { label: '涨跌幅', value: formatPercent(stock.value.changePercent), tone: numberTone(stock.value.changePercent) },
    { label: '成交额', value: formatMoney(stock.value.amount) },
    { label: '换手率', value: formatPercent(stock.value.turnover) },
    { label: 'PE(TTM)', value: formatNumber(stock.value.peTtm) },
    { label: 'PB', value: formatNumber(stock.value.pb) },
    { label: 'ROE', value: formatPercent(stock.value.roe) },
    { label: '股息率', value: formatPercent(stock.value.dividendYield) },
  ]
})

const chartPoints = computed(() => {
  const rows = visibleIndicators.value
  if (!rows.length) return ''
  return linePoints(rows, (item) => item.close, chartScale(rows, [(item) => item.close]))
})

const chartMeta = computed(() => {
  const rows = visibleIndicators.value
  if (!rows.length) return null
  const closes = rows.map((item) => item.close)
  return {
    start: rows[0].date,
    end: rows[rows.length - 1].date,
    high: Math.max(...closes),
    low: Math.min(...closes),
  }
})

const volumeBars = computed(() => {
  const rows = visibleIndicators.value
  if (!rows.length) return []
  const max = Math.max(...rows.map((item) => item.volume || 0)) || 1
  return rows.map((item, index) => {
    const x = 18 + (index / rows.length) * 684
    const width = Math.max(2, 684 / rows.length - 2)
    const height = ((item.volume || 0) / max) * 212
    return {
      x: x.toFixed(1),
      y: (238 - height).toFixed(1),
      width: width.toFixed(1),
      height: height.toFixed(1),
      tone: item.close >= item.open ? 'up' : 'down',
    }
  })
})

const macdChart = computed(() => {
  const rows = visibleIndicators.value
  if (!rows.length) return null
  const scale = chartScale(rows, [(item) => item.dif, (item) => item.dea, (item) => item.macd])
  return {
    dif: linePoints(rows, (item) => item.dif, scale),
    dea: linePoints(rows, (item) => item.dea, scale),
    bars: histogramBars(rows, (item) => item.macd, scale),
    markers: signalMarkers(rows, (item) => item.macdSignal, scale, (item) => item.dif),
  }
})

const kdjChart = computed(() => {
  const rows = visibleIndicators.value
  if (!rows.length) return null
  const scale = chartScale(rows, [(item) => item.k, (item) => item.d, (item) => item.j])
  return {
    k: linePoints(rows, (item) => item.k, scale),
    d: linePoints(rows, (item) => item.d, scale),
    j: linePoints(rows, (item) => item.j, scale),
    markers: signalMarkers(rows, (item) => item.kdjSignal, scale, (item) => item.k),
  }
})

const recentSignals = computed(() => {
  return indicatorRows.value
    .filter((item) => item.macdSignal || item.kdjSignal)
    .slice(-8)
    .reverse()
    .map((item) => ({
      date: item.date,
      macd: formatSignal(item.macdSignal),
      kdj: formatSignal(item.kdjSignal),
      close: item.close,
    }))
})

async function searchStock() {
  error.value = ''
  klineError.value = ''
  loading.value = true
  stock.value = null
  kline.value = []
  analysis.value = null
  news.value = []
  scores.value = null
  newsError.value = ''

  try {
    const [snapshot, history] = await Promise.all([fetchStockSnapshot(keyword.value), loadKline(activePeriod.value)])
    stock.value = snapshot
    kline.value = history
    analysis.value = buildAnalysis(snapshot, history)
    try {
      news.value = await fetchStockNews(keyword.value, snapshot.name)
    } catch (err) {
      newsError.value = err.message || '新闻查询失败。'
      news.value = []
    }
    scores.value = buildOpinionScores(snapshot, history, news.value)
  } catch (err) {
    error.value = err.message || '查询失败，请稍后重试。'
  } finally {
    loading.value = false
  }
}

async function loadKline(period) {
  return fetchStockKline(keyword.value, period)
}

async function changePeriod(period) {
  if (activePeriod.value === period || klineLoading.value || !stock.value) return
  activePeriod.value = period
  klineError.value = ''
  klineLoading.value = true
  try {
    const history = await loadKline(period)
    kline.value = history
    analysis.value = buildAnalysis(stock.value, history)
    scores.value = buildOpinionScores(stock.value, history, news.value)
  } catch (err) {
    klineError.value = err.message || 'K 线加载失败。'
  } finally {
    klineLoading.value = false
  }
}

function formatNumber(value, digits = 2) {
  if (!Number.isFinite(value)) return '--'
  return value.toFixed(digits)
}

function formatPrice(value) {
  if (!Number.isFinite(value)) return '--'
  return value.toFixed(2)
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return '--'
  return `${value.toFixed(2)}%`
}

function formatMoney(value) {
  if (!Number.isFinite(value)) return '--'
  if (value >= 100000000) return `${(value / 100000000).toFixed(2)} 亿`
  if (value >= 10000) return `${(value / 10000).toFixed(2)} 万`
  return value.toFixed(0)
}

function numberTone(value) {
  if (!Number.isFinite(value)) return ''
  if (value > 0) return 'up'
  if (value < 0) return 'down'
  return ''
}

function chartScale(rows, accessors) {
  const values = rows.flatMap((item) => accessors.map((accessor) => accessor(item))).filter(Number.isFinite)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const padding = (max - min || 1) * 0.12
  return {
    min: min - padding,
    max: max + padding,
  }
}

function chartX(index, total) {
  return 18 + (index / Math.max(total - 1, 1)) * 684
}

function chartY(value, scale) {
  const range = scale.max - scale.min || 1
  return 238 - ((value - scale.min) / range) * 216
}

function linePoints(rows, accessor, scale) {
  return rows
    .map((item, index) => `${chartX(index, rows.length).toFixed(1)},${chartY(accessor(item), scale).toFixed(1)}`)
    .join(' ')
}

function histogramBars(rows, accessor, scale) {
  const zero = chartY(0, scale)
  return rows.map((item, index) => {
    const value = accessor(item)
    const y = chartY(value, scale)
    return {
      x: (18 + (index / rows.length) * 684).toFixed(1),
      y: Math.min(y, zero).toFixed(1),
      width: Math.max(2, 684 / rows.length - 2).toFixed(1),
      height: Math.max(1, Math.abs(zero - y)).toFixed(1),
      tone: value >= 0 ? 'up' : 'down',
    }
  })
}

function signalMarkers(rows, signalAccessor, scale, valueAccessor) {
  return rows
    .map((item, index) => ({
      type: signalAccessor(item),
      date: item.date,
      x: chartX(index, rows.length).toFixed(1),
      y: chartY(valueAccessor(item), scale).toFixed(1),
    }))
    .filter((item) => item.type)
}

searchStock()
</script>

<template>
  <main class="app-shell">
    <section class="query-band">
      <div class="query-copy">
        <p class="eyebrow">Eastmoney Market Data</p>
        <h1>股票可视化分析</h1>
        <p>输入 A 股代码，读取东方财富公开行情与日 K 数据，并按价值、质量、趋势和风险框架生成研判。</p>
      </div>

      <form class="search-box" @submit.prevent="searchStock">
        <label for="stock-code">股票代码</label>
        <div class="search-row">
          <input id="stock-code" v-model="keyword" autocomplete="off" placeholder="600519 / 000001 / 300750" />
          <button type="submit" :disabled="loading">{{ loading ? '查询中' : '查询' }}</button>
        </div>
        <span>支持沪深北 A 股代码；结果仅供研究，不构成投资建议。</span>
      </form>
    </section>

    <p v-if="error" class="error-message">{{ error }}</p>

    <section v-if="stock" class="stock-head">
      <div>
        <p class="eyebrow">实时快照</p>
        <h2>{{ stock.name }} <span>{{ stock.code }}</span></h2>
      </div>
      <div class="price-block" :class="numberTone(stock.changePercent)">
        <strong>{{ formatPrice(stock.price) }}</strong>
        <span>{{ formatPrice(stock.change) }} / {{ formatPercent(stock.changePercent) }}</span>
      </div>
    </section>

    <section v-if="stock" class="metric-grid">
      <article v-for="item in metrics" :key="item.label" class="metric-card">
        <span>{{ item.label }}</span>
        <strong :class="item.tone">{{ item.value }}</strong>
      </article>
    </section>

    <section v-if="scores" class="score-grid">
      <article class="score-card bullish-score">
        <span>看多评分</span>
        <strong>{{ scores.bullish }}</strong>
        <p>新闻倾向、估值与趋势合成</p>
      </article>
      <article class="score-card bearish-score">
        <span>看空评分</span>
        <strong>{{ scores.bearish }}</strong>
        <p>利空词、回撤与高估风险合成</p>
      </article>
      <article class="score-card valuation-score">
        <span>估值评分</span>
        <strong>{{ scores.valuation }}</strong>
        <p>PE、PB、ROE、股息率规则评分</p>
      </article>
      <article class="score-card">
        <span>新闻倾向</span>
        <strong>{{ scores.newsBias }}</strong>
        <p>{{ scores.comment }}</p>
      </article>
    </section>

    <section v-if="stock" class="content-grid">
      <article class="panel chart-panel">
        <div class="panel-head">
          <div>
            <p class="eyebrow">Technical View</p>
            <h3>价格、成交量、MACD 与 KDJ</h3>
          </div>
          <div class="period-switch" aria-label="K 线周期切换">
            <button
              v-for="item in periodOptions"
              :key="item.value"
              type="button"
              :class="{ active: activePeriod === item.value }"
              :disabled="klineLoading"
              @click="changePeriod(item.value)"
            >
              {{ item.label }}
            </button>
          </div>
        </div>
        <p v-if="klineError" class="error-message compact-error">{{ klineError }}</p>
        <p v-if="klineLoading" class="muted-text">正在加载 K 线数据...</p>

        <div class="indicator-stack">
          <div class="chart-wrap">
            <div class="chart-title">
              <strong>{{ periodOptions.find((item) => item.value === activePeriod)?.label }} 收盘价趋势</strong>
              <span v-if="chartMeta">高 {{ formatPrice(chartMeta.high) }} / 低 {{ formatPrice(chartMeta.low) }}</span>
            </div>
            <svg viewBox="0 0 720 260" role="img" aria-label="收盘价折线图">
              <line x1="18" y1="40" x2="702" y2="40" />
              <line x1="18" y1="130" x2="702" y2="130" />
              <line x1="18" y1="220" x2="702" y2="220" />
              <polyline class="price-line" :points="chartPoints" />
            </svg>
          </div>

          <div class="chart-wrap compact-chart">
            <div class="chart-title">
              <strong>成交量</strong>
              <span>红涨绿跌，按区间最高量归一化</span>
            </div>
            <svg viewBox="0 0 720 260" role="img" aria-label="成交量柱状图">
              <line x1="18" y1="40" x2="702" y2="40" />
              <line x1="18" y1="130" x2="702" y2="130" />
              <line x1="18" y1="220" x2="702" y2="220" />
              <rect
                v-for="(bar, index) in volumeBars"
                :key="index"
                :class="bar.tone"
                :x="bar.x"
                :y="bar.y"
                :width="bar.width"
                :height="bar.height"
              />
            </svg>
          </div>

          <div v-if="macdChart" class="chart-wrap compact-chart">
            <div class="chart-title">
              <strong>MACD</strong>
              <span>DIF / DEA / MACD 柱</span>
            </div>
            <svg viewBox="0 0 720 260" role="img" aria-label="MACD 指标图">
              <line x1="18" y1="130" x2="702" y2="130" />
              <rect
                v-for="(bar, index) in macdChart.bars"
                :key="index"
                :class="bar.tone"
                :x="bar.x"
                :y="bar.y"
                :width="bar.width"
                :height="bar.height"
              />
              <polyline class="dif-line" :points="macdChart.dif" />
              <polyline class="dea-line" :points="macdChart.dea" />
              <g v-for="marker in macdChart.markers" :key="`${marker.date}-${marker.type}`">
                <circle :class="marker.type" :cx="marker.x" :cy="marker.y" r="5" />
                <text :x="marker.x" :y="Number(marker.y) - 10" text-anchor="middle">
                  {{ formatSignal(marker.type) }}
                </text>
              </g>
            </svg>
          </div>

          <div v-if="kdjChart" class="chart-wrap compact-chart">
            <div class="chart-title">
              <strong>KDJ</strong>
              <span>K / D / J</span>
            </div>
            <svg viewBox="0 0 720 260" role="img" aria-label="KDJ 指标图">
              <line x1="18" y1="80" x2="702" y2="80" />
              <line x1="18" y1="130" x2="702" y2="130" />
              <line x1="18" y1="180" x2="702" y2="180" />
              <polyline class="k-line" :points="kdjChart.k" />
              <polyline class="d-line" :points="kdjChart.d" />
              <polyline class="j-line" :points="kdjChart.j" />
              <g v-for="marker in kdjChart.markers" :key="`${marker.date}-${marker.type}`">
                <circle :class="marker.type" :cx="marker.x" :cy="marker.y" r="5" />
                <text :x="marker.x" :y="Number(marker.y) - 10" text-anchor="middle">
                  {{ formatSignal(marker.type) }}
                </text>
              </g>
            </svg>
          </div>
        </div>

        <div class="signal-table">
          <strong>最近交叉信号</strong>
          <div v-if="recentSignals.length">
            <span v-for="item in recentSignals" :key="`${item.date}-${item.macd}-${item.kdj}`">
              {{ item.date }} 收盘 {{ formatPrice(item.close) }} · MACD {{ item.macd || '--' }} · KDJ
              {{ item.kdj || '--' }}
            </span>
          </div>
          <p v-else>近 90 日暂无 MACD 或 KDJ 交叉信号。</p>
        </div>
      </article>

      <article class="panel analysis-panel">
        <div class="panel-head">
          <div>
            <p class="eyebrow">Framework View</p>
            <h3>专业框架看法</h3>
          </div>
        </div>
        <p class="summary">{{ analysis.summary }}</p>
        <div class="analysis-list">
          <div v-for="item in analysis.points" :key="item.title">
            <strong>{{ item.title }}</strong>
            <p>{{ item.text }}</p>
          </div>
        </div>
      </article>
    </section>

    <section v-if="stock" class="detail-grid">
      <article class="panel">
        <p class="eyebrow">交易指标</p>
        <dl>
          <div>
            <dt>今开 / 昨收</dt>
            <dd>{{ formatPrice(stock.open) }} / {{ formatPrice(stock.previousClose) }}</dd>
          </div>
          <div>
            <dt>最高 / 最低</dt>
            <dd>{{ formatPrice(stock.high) }} / {{ formatPrice(stock.low) }}</dd>
          </div>
          <div>
            <dt>振幅</dt>
            <dd>{{ formatPercent(stock.amplitude) }}</dd>
          </div>
          <div>
            <dt>量比</dt>
            <dd>{{ formatNumber(stock.volumeRatio) }}</dd>
          </div>
        </dl>
      </article>

      <article class="panel">
        <p class="eyebrow">分析依据</p>
        <ul class="source-list">
          <li v-for="item in analysis.sources" :key="item">{{ item }}</li>
        </ul>
      </article>
    </section>

    <section v-if="stock" class="panel news-panel">
      <div class="panel-head">
        <div>
          <p class="eyebrow">Recent News</p>
          <h3>近期相关利好新闻</h3>
        </div>
        <span>{{ news.length }} 条</span>
      </div>
      <p v-if="newsError" class="muted-text">{{ newsError }}</p>
      <div v-else-if="news.length" class="news-list">
        <a v-for="item in news" :key="item.url || item.title" :href="item.url" target="_blank" rel="noreferrer">
          <div>
            <strong>{{ item.title }}</strong>
            <p>{{ item.summary }}</p>
          </div>
          <span>{{ item.source }} · {{ item.date }}</span>
        </a>
      </div>
      <p v-else class="muted-text">暂无可用相关新闻。</p>
    </section>
  </main>
</template>
