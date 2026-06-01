// Cloudflare Pages Function
// 路徑: functions/api/quote/[stock].js
// 負責從台灣證交所抓取即時報價，TWSE 失敗時 fallback 到 Yahoo Finance

export async function onRequest(context) {
  const stockNo = context.params.stock?.trim();

  if (!stockNo) {
    return Response.json({ ok: false, error: '請提供股票代號' }, { status: 400 });
  }

  const corsHeaders = { 'Access-Control-Allow-Origin': '*' };

  // ── 1. 先試 TWSE（tse 上市 / otc 上櫃）──
  const twseHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Referer': 'https://mis.twse.com.tw/',
  };

  for (const ex of ['tse', 'otc']) {
    try {
      const url = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=${ex}_${stockNo}.tw&json=1&delay=0`;
      const res = await fetch(url, { headers: twseHeaders, signal: AbortSignal.timeout(5000) });
      const data = await res.json();
      const arr = data?.msgArray || [];

      if (arr.length > 0 && arr[0].n) {
        const q = arr[0];
        // q.z 是即時成交價（盤中），q.y 是昨收價；盤後/休市時 q.z 為 '-'
        const price = parseFloat(q.z) || parseFloat(q.y) || 0;
        const prev  = parseFloat(q.y) || price;
        const chg   = Math.round((price - prev) * 100) / 100;
        const pct   = prev ? Math.round((chg / prev) * 10000) / 100 : 0;

        return Response.json({
          ok: true,
          code:      q.c || stockNo,
          name:      q.n || '',
          price,
          prev,
          change:    chg,
          changePct: pct,
          high:      parseFloat(q.h) || 0,
          low:       parseFloat(q.l) || 0,
          open:      parseFloat(q.o) || 0,
          volume:    parseInt(q.v)   || 0,
          exchange:  ex === 'tse' ? '上市' : '上櫃',
          time:      q.t || '',
          source:    'twse',
        }, { headers: corsHeaders });
      }
    } catch (_) {
      continue;
    }
  }

  // ── 2. TWSE 失敗，fallback 到 Yahoo Finance（台股加 .TW）──
  try {
    const symbol = `${stockNo}.TW`;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=5d`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(6000),
    });
    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;

    if (meta && meta.regularMarketPrice) {
      const price = Math.round(meta.regularMarketPrice * 100) / 100;
      const prev  = Math.round((meta.previousClose || meta.chartPreviousClose || price) * 100) / 100;
      const chg   = Math.round((price - prev) * 100) / 100;
      const pct   = prev ? Math.round((chg / prev) * 10000) / 100 : 0;

      return Response.json({
        ok: true,
        code:      stockNo,
        name:      meta.shortName || meta.longName || stockNo,
        price,
        prev,
        change:    chg,
        changePct: pct,
        high:      Math.round((meta.regularMarketDayHigh || 0) * 100) / 100,
        low:       Math.round((meta.regularMarketDayLow  || 0) * 100) / 100,
        open:      Math.round((meta.regularMarketOpen    || 0) * 100) / 100,
        volume:    meta.regularMarketVolume || 0,
        exchange:  '上市',
        time:      '',
        source:    'yahoo',
      }, { headers: corsHeaders });
    }
  } catch (_) {}

  return Response.json(
    { ok: false, error: `查無代號「${stockNo}」，請確認是否為台股代號` },
    { status: 404, headers: corsHeaders }
  );
}
