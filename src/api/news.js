import { normalizeCode } from './eastmoney'

function stripHtml(value) {
  return String(value || '').replace(/<[^>]+>/g, '')
}

export async function fetchStockNews(input, stockName) {
  const keyword = stockName ? `${stockName} ${normalizeCode(input).replace(/^(SH|SZ|BJ)/, '')}` : normalizeCode(input)
  const param = {
    uid: '',
    keyword,
    type: ['cmsArticleWebOld'],
    client: 'web',
    clientVersion: 'curr',
    clientType: 'web',
    param: {
      cmsArticleWebOld: {
        preTag: '',
        postTag: '',
        pageSize: 12,
        pageIndex: 1,
      },
    },
  }

  const query = new URLSearchParams({
    cb: 'callback',
    param: JSON.stringify(param),
  })

  const response = await fetch(`/em-search/search/jsonp?${query}`)
  if (!response.ok) throw new Error(`新闻接口请求失败：${response.status}`)

  const text = await response.text()
  const jsonText = text.replace(/^callback\(/, '').replace(/\)$/, '')
  const payload = JSON.parse(jsonText)
  const rows = payload?.result?.cmsArticleWebOld || []

  return rows.map((item) => ({
    title: stripHtml(item.title),
    summary: stripHtml(item.content),
    date: item.date,
    source: item.mediaName || '东方财富',
    url: item.url,
  }))
}
