// functions/api/fundamentals/[stock].js
// 基本面資料 — 同時打三個 Yahoo Finance 端點，任一有資料就用

export async function onRequest(context) {
  const symbol = context.params.stock?.trim().toUpperCase();
  if (!symbol) {
    return Response.json({ ok: false, error: '請提供股票代號' }, { status: 400 });
  }

  const H = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Origin': 'https://finance.yahoo.com',
    'Referer': 'https://finance.yahoo.com/',
  };

  const get  = (obj, key) => obj?.[key]?.raw ?? obj?.[key] ?? null;
  const fmt  = (v, dec=2) => (v != null && !isNaN(v)) ? +Number(v).toFixed(dec) : null;
  const pct  = (v, dec=1) => fmt(v * 100, dec);

  try {
    // ── 同時打三個 API ──────────────────────────────────────────
    const [r1, r2, r3] = await Promise.allSettled([
      // 1. v7/quote — 即時報價含基本面
      fetch(`https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbol}&fields=trailingPE,forwardPE,epsTrailingTwelveMonths,epsForward,bookValue,priceToBook,fiftyTwoWeekHigh,fiftyTwoWeekLow,dividendYield,beta,marketCap,trailingAnnualDividendYield`, { headers: H }),
      // 2. v8/chart — K線含meta基本面
      fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=5d`, { headers: H }),
      // 3. v11/quoteSummary — 財務詳細（較新的端點）
      fetch(`https://query2.finance.yahoo.com/v11/finance/quoteSummary/${symbol}?modules=financialData,defaultKeyStatistics,summaryDetail`, { headers: H }),
    ]);

    let q1 = {}, meta = {}, fd = {}, ks = {}, sd = {};

    // 解析 v7/quote
    if (r1.status === 'fulfilled' && r1.value.ok) {
      try {
        const d = await r1.value.json();
        q1 = d?.quoteResponse?.result?.[0] || {};
      } catch(_) {}
    }

    // 解析 v8/chart meta
    if (r2.status === 'fulfilled' && r2.value.ok) {
      try {
        const d = await r2.value.json();
        meta = d?.chart?.result?.[0]?.meta || {};
      } catch(_) {}
    }

    // 解析 v11/quoteSummary
    if (r3.status === 'fulfilled' && r3.value.ok) {
      try {
        const d = await r3.value.json();
        const res = d?.quoteSummary?.result?.[0] || {};
        fd = res.financialData        || {};
        ks = res.defaultKeyStatistics || {};
        sd = res.summaryDetail        || {};
      } catch(_) {}
    }

    // ── 組合資料，優先用 v7（最穩定），用 v11 補充 ──────────────
    const pe          = fmt(q1.trailingPE        ?? get(sd,'trailingPE')   ?? get(ks,'trailingPE'));
    const forwardPE   = fmt(q1.forwardPE         ?? get(ks,'forwardPE'));
    const eps         = fmt(q1.epsTrailingTwelveMonths ?? get(ks,'trailingEps'));
    const pbRatio     = fmt(q1.priceToBook       ?? get(ks,'priceToBook'));
    const week52High  = fmt(q1.fiftyTwoWeekHigh  ?? get(sd,'fiftyTwoWeekHigh')  ?? meta.fiftyTwoWeekHigh);
    const week52Low   = fmt(q1.fiftyTwoWeekLow   ?? get(sd,'fiftyTwoWeekLow')   ?? meta.fiftyTwoWeekLow);
    const beta        = fmt(q1.beta              ?? get(sd,'beta'));
    const marketCap   = q1.marketCap             ?? get(sd,'marketCap');
    const divYield    = fmt((q1.trailingAnnualDividendYield ?? get(sd,'dividendYield') ?? 0) * 100, 2);

    // 獲利面主要靠 v11
    const grossMargin    = pct(get(fd,'grossMargins'));
    const opMargin       = pct(get(fd,'operatingMargins'));
    const roe            = pct(get(fd,'returnOnEquity'));
    const debtRatio      = fmt(get(fd,'debtToEquity'));
    const currentRatio   = fmt(get(fd,'currentRatio'));
    const revenueGrowth  = pct(get(fd,'revenueGrowth'));
    const earningsGrowth = pct(get(fd,'earningsGrowth'));
    const targetPrice    = fmt(get(fd,'targetMeanPrice'));

    // 判斷資料是否足夠
    const hasBasic = pe != null || week52High != null;
    if (!hasBasic) {
      return Response.json(
        { ok: false, error: '無法取得基本面資料，可能是台股或資料尚未更新' },
        { headers: { 'Access-Control-Allow-Origin': '*' } }
      );
    }

    return Response.json({
      ok: true, symbol,
      pe, forwardPE, eps, pbRatio,
      grossMargin, opMargin, roe,
      debtRatio, currentRatio,
      revenueGrowth, earningsGrowth,
      week52High, week52Low,
      dividendYield: divYield,
      beta, marketCap, targetPrice,
      // 標記哪些欄位有資料，方便前端判斷
      _sources: {
        v7: Object.keys(q1).length > 0,
        v11: Object.keys(fd).length > 0 || Object.keys(ks).length > 0,
      }
    }, {
      headers: { 'Access-Control-Allow-Origin': '*' }
    });

  } catch (e) {
    return Response.json(
      { ok: false, error: e.message },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }
}
