// functions/api/history-us/[stock].js
// 美股歷史 K 線 — 使用 Yahoo Finance（免費，不需要 API Key）

export async function onRequest(context) {
  const symbol = context.params.stock?.trim().toUpperCase();
  if (!symbol) {
    return Response.json({ ok: false, error: '請提供股票代號' }, { status: 400 });
  }

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'application/json',
  };

  const to   = Math.floor(Date.now() / 1000);
  const from = to - 90 * 24 * 3600;

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&period1=${from}&period2=${to}`;
    const res  = await fetch(url, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data   = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) throw new Error(`查無 ${symbol} 資料`);

    const ts  = result.timestamp || [];
    const q   = result.indicators?.quote?.[0] || {};

    const rows = ts.map((t, i) => ({
      date:   new Date(t * 1000).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' }),
      open:   q.open?.[i]   ? +q.open[i].toFixed(2)   : null,
      high:   q.high?.[i]   ? +q.high[i].toFixed(2)   : null,
      low:    q.low?.[i]    ? +q.low[i].toFixed(2)    : null,
      close:  q.close?.[i]  ? +q.close[i].toFixed(2)  : null,
      volume: q.volume?.[i] || 0,
    })).filter(r => r.close !== null);

    if (!rows.length) throw new Error(`${symbol} 暫無歷史資料`);

    return Response.json(
      { ok: true, data: rows },
      { headers: { 'Access-Control-Allow-Origin': '*' } }
    );

  } catch (e) {
    return Response.json(
      { ok: false, error: e.message },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }
}
