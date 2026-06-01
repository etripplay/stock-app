// functions/api/twse-list.js
// 從台灣證交所抓完整股票清單（代號 + 名稱），用於搜尋功能
// Cloudflare 會自動 cache，不用每次都打證交所

export async function onRequest(context) {
  const cacheKey = 'twse-stock-list-v1';

  // 嘗試從 Cloudflare Cache 讀取（24小時有效）
  const cache = caches.default;
  const cacheUrl = new URL(context.request.url);
  const cachedRes = await cache.match(cacheUrl);
  if (cachedRes) return cachedRes;

  try {
    // 上市股票清單
    const [tseRes, otcRes] = await Promise.all([
      fetch('https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL', {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      }),
      fetch('https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes', {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      })
    ]);

    const tseData = await tseRes.json().catch(()=>[]);
    const otcData = await otcRes.json().catch(()=>[]);

    const stocks = [];
    const seen = new Set();

    // 上市 (TSE)
    for (const s of tseData) {
      const code = s.Code || s.股票代號 || '';
      const name = s.Name || s.股票名稱 || '';
      if (code && name && !seen.has(code) && /^\d{4}/.test(code)) {
        seen.add(code);
        stocks.push({ c: code, n: name, m: 'tse' });
      }
    }

    // 上櫃 (OTC)
    for (const s of otcData) {
      const code = s.SecuritiesCompanyCode || s.代號 || '';
      const name = s.CompanyName || s.名稱 || '';
      if (code && name && !seen.has(code) && /^\d{4}/.test(code)) {
        seen.add(code);
        stocks.push({ c: code, n: name, m: 'otc' });
      }
    }

    const result = Response.json(
      { ok: true, data: stocks },
      {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=86400', // 24 小時 cache
        }
      }
    );

    // 存入 Cloudflare Cache
    context.waitUntil(cache.put(cacheUrl, result.clone()));
    return result;

  } catch (e) {
    return Response.json(
      { ok: false, error: e.message, data: [] },
      { headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }
}
