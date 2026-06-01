// functions/api/history-us/[stock].js
// 美股歷史 K 線（最近 3 個月），使用 Yahoo Finance v8 chart API

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
    // range=3mo, interval=1d
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=3mo`;
    const res  = await fetch(url, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data   = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) throw new Error(`查無「${symbol}」`);

    const timestamps = result.timestamp || [];
    const q = result.indicators?.quote?.[0] || {};
    const opens   = q.open   || [];
    const highs   = q.high   || [];
    const lows    = q.low    || [];
    const closes  = q.close  || [];
    const volumes = q.volume || [];

    const rows = timestamps.map((ts, i) => ({
      date:   new Date(ts * 1000).toISOString().slice(0, 10),
      open:   opens[i]   != null ? +opens[i].toFixed(2)   : null,
      high:   highs[i]   != null ? +highs[i].toFixed(2)   : null,
      low:    lows[i]    != null ? +lows[i].toFixed(2)    : null,
      close:  closes[i]  != null ? +closes[i].toFixed(2)  : null,
      volume: volumes[i] || 0,
    })).filter(r => r.close != null);

    return Response.json(
      { ok: true, data: rows },
      { headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  } catch (e) {
    return Response.json(
      { ok: false, error: e.message || '查詢失敗，請稍後再試' },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }
}
