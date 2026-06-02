<script setup>
import { computed, ref } from 'vue'
import { buildAnalysis, buildOpinionScores } from './analysis'
import { fetchDailyKline, fetchStockSnapshot } from './api/eastmoney'
import { fetchStockNews } from './api/news'

const keyword = ref('600519')
const loading = ref(false)
const error = ref('')
const stock = ref(null)
const kline = ref([])
const analysis = ref(null)
const news = ref([])
const scores = ref(null)
const newsError = ref('')

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
  const rows = kline.value.slice(-90)
  if (!rows.length) return ''
  const width = 720
  const height = 260
  const padding = 18
  const values = rows.map((item) => item.close)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  return rows
    .map((item, index) => {
      const x = padding + (index / Math.max(rows.length - 1, 1)) * (width - padding * 2)
      const y = height - padding - ((item.close - min) / range) * (height - padding * 2)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
})

const chartMeta = computed(() => {
  const rows = kline.value.slice(-90)
  if (!rows.length) return null
  const closes = rows.map((item) => item.close)
  return {
    start: rows[0].date,
    end: rows[rows.length - 1].date,
    high: Math.max(...closes),
    low: Math.min(...closes),
  }
})

async function searchStock() {
  error.value = ''
  loading.value = true
  stock.value = null
  kline.value = []
  analysis.value = null
  news.value = []
  scores.value = null
  newsError.value = ''

  try {
    const [snapshot, history] = await Promise.all([fetchStockSnapshot(keyword.value), fetchDailyKline(keyword.value)])
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
            <p class="eyebrow">90 日走势</p>
            <h3>收盘价趋势</h3>
          </div>
          <span v-if="chartMeta">{{ chartMeta.start }} - {{ chartMeta.end }}</span>
        </div>

        <div class="chart-wrap">
          <svg viewBox="0 0 720 260" role="img" aria-label="近 90 日收盘价折线图">
            <line x1="18" y1="40" x2="702" y2="40" />
            <line x1="18" y1="130" x2="702" y2="130" />
            <line x1="18" y1="220" x2="702" y2="220" />
            <polyline :points="chartPoints" />
          </svg>
        </div>

        <div v-if="chartMeta" class="chart-meta">
          <span>区间高点 {{ formatPrice(chartMeta.high) }}</span>
          <span>区间低点 {{ formatPrice(chartMeta.low) }}</span>
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
