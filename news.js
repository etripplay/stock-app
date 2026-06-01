// functions/api/news/[stock].js
// 股票最新新聞 — Yahoo Finance（免費，不需要 API Key）

export async function onRequest(context) {
  const symbol = context.params.stock?.trim().toUpperCase();
  if (!symbol) {
    return Response.json({ ok: false, error: '請提供股票代號' }, { status: 400 });
  }

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'application/json',
  };

  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${symbol}&newsCount=6&quotesCount=0&enableNavLinks=false&enableEnhancedTrivialQuery=true`;
    const res  = await fetch(url, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const news = (data.news || []).slice(0, 6).map(n => ({
      title:     n.title     || '',
      publisher: n.publisher || '',
      link:      n.link      || '',
      time:      n.providerPublishTime
        ? new Date(n.providerPublishTime * 1000).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        : '',
    }));

    return Response.json(
      { ok: true, news },
      { headers: { 'Access-Control-Allow-Origin': '*' } }
    );

  } catch (e) {
    return Response.json(
      { ok: false, error: e.message, news: [] },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }
}
