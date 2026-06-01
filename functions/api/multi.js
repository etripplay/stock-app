// Cloudflare Pages Function
// 路徑: functions/api/multi.js
// 一次查詢多支股票，用於首頁熱門個股列表
// TWSE 失敗時 fallback 到 Yahoo Finance

export async function onRequest(context) {
  const url    = new URL(context.request.url);
  const stocks = url.searchParams.get('stocks') || '';
  const list   = stocks.split(',').map(s => s.trim()).filter(Boolean);

  if (!list.length) {
    return Response.json({ ok: false, error: '請提供股票代號' }, { status: 400 });
  }

  const corsHeaders = { 'Access-Control-Allow-Origin': '*' };

  // ── 1. 先試 TWSE ──
  try {
    const tsePart  = list.map(s => `tse_${s}.tw`).join('|');
    const otcPart  = list.map(s => `otc_${s}.tw`).join('|');
    const apiUrl   = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=${tsePart}|${otcPart}&json=1&delay=0`;
    const res      = await fetch(apiUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://mis.twse.com.tw/' },
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json();
    const arr  = data?.msgArray || [];

    const seen    = new Set();
    const results = [];
    for (const q of arr) {
      const code = q.c || '';
      if (!code || seen.has(code) || !q.n) continue;
      seen.add(code);
      const price = parseFloat(q.z) || parseFloat(q.y) || 0;
      const prev  = parseFloat(q.y) || price;
      const chg   = Math.round((price - prev) * 100) / 100;
      const pct   = prev ? Math.round((chg / prev) * 10000) / 100 : 0;
      results.push({ code, name: q.n, price, change: chg, changePct: pct });
    }

    if (results.length > 0) {
      return Response.json({ ok: true, data: results }, { headers: corsHeaders });
    }
  } catch (_) {}

  // ── 2. TWSE 失敗，fallback 到 Yahoo Finance ──
  try {
    const symbols  = list.map(s => `${s}.TW`).join(',');
    const yahooUrl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols}&fields=regularMarketPrice,regularMarketChange,regularMarketChangePercent,shortName`;
    const res      = await fetch(yahooUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(6000),
    });
    const data   = await res.json();
    const quotes = data?.quoteResponse?.result || [];

    if (quotes.length > 0) {
      // 取中文名稱對照表
      let nameMap = {};
      try {
        const baseUrl  = new URL(context.request.url).origin;
        const listRes  = await fetch(`${baseUrl}/api/twse-list`, { signal: AbortSignal.timeout(4000) });
        const listData = await listRes.json();
        for (const s of (listData.data || [])) nameMap[s.c] = s.n;
      } catch (_) {}

      const results = quotes.map(q => {
        const code = q.symbol.replace('.TW', '');
        return {
          code,
          name:      nameMap[code] || q.shortName || code,
          price:     Math.round((q.regularMarketPrice || 0) * 100) / 100,
          change:    Math.round((q.regularMarketChange || 0) * 100) / 100,
          changePct: Math.round((q.regularMarketChangePercent || 0) * 100) / 100,
        };
      });

      return Response.json({ ok: true, data: results }, { headers: corsHeaders });
    }
  } catch (_) {}

  return Response.json(
    { ok: false, error: '無法取得股票資料' },
    { status: 500, headers: corsHeaders }
  );
}
