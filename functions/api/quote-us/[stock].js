// functions/api/quote-us/[stock].js
// 美股即時報價 — 使用 Yahoo Finance（免費，不需要 API Key）

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
    // Yahoo Finance v8 chart API — 抓最新一天的資料當作即時報價
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=5d`;
    const res  = await fetch(url, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data   = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) throw new Error(`查無「${symbol}」，請確認美股代號是否正確`);

    const meta = result.meta;
    const q    = result.indicators?.quote?.[0] || {};
    const n    = (result.timestamp || []).length;

    // 取最新的收盤價
    const price = meta.regularMarketPrice || meta.previousClose || 0;
    const prev  = meta.previousClose || price;
    const chg   = Math.round((price - prev) * 100) / 100;
    const pct   = prev ? Math.round((chg / prev) * 10000) / 100 : 0;

    if (!price) throw new Error(`查無「${symbol}」，請確認美股代號是否正確`);

    // 公司名稱從 meta 取
    const name = meta.longName || meta.shortName || symbol;

    return Response.json({
      ok:        true,
      code:      symbol,
      name,
      price:     +price.toFixed(2),
      prev:      +prev.toFixed(2),
      change:    chg,
      changePct: pct,
      high:      +(meta.regularMarketDayHigh || q.high?.[n-1] || price).toFixed(2),
      low:       +(meta.regularMarketDayLow  || q.low?.[n-1]  || price).toFixed(2),
      open:      +(meta.regularMarketOpen    || q.open?.[n-1] || price).toFixed(2),
      volume:    meta.regularMarketVolume || q.volume?.[n-1] || 0,
      exchange:  '美股',
      currency:  meta.currency || 'USD',
      market:    'US',
    }, {
      headers: { 'Access-Control-Allow-Origin': '*' }
    });

  } catch (e) {
    return Response.json(
      { ok: false, error: e.message || '查詢失敗，請稍後再試' },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }
}
