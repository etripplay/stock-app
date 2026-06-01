// functions/api/tw-fundamental/[stock].js
// 台股本益比、殖利率、股價淨值比 — 台灣證交所 BWIBBU_ALL

export async function onRequest(context) {
  const stockNo = context.params.stock?.trim();
  if (!stockNo) {
    return Response.json({ ok: false, error: '請提供股票代號' }, { status: 400 });
  }

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'application/json',
    'Referer': 'https://www.twse.com.tw/',
  };

  const parse = (v) => {
    if (!v || v === '--' || v === '-' || v === 'N/A') return null;
    const n = parseFloat(String(v).replace(/,/g, ''));
    return isNaN(n) ? null : n;
  };

  // 嘗試今天和最近幾天（避開假日）
  const now = new Date();
  const datesToTry = [];
  for (let i = 0; i <= 7; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    datesToTry.push(
      `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`
    );
  }

  for (const dateStr of datesToTry) {
    try {
      const url = `https://www.twse.com.tw/exchangeReport/BWIBBU_ALL?response=json&date=${dateStr}`;
      const res  = await fetch(url, { headers });
      if (!res.ok) continue;

      const data = await res.json();
      if (data.stat !== 'OK' || !data.data?.length) continue;

      // 欄位（已確認）：
      // [0]股票代號 [1]股票名稱 [2]本益比 [3]殖利率(%) [4]股價淨值比
      const row = data.data.find(r => r[0]?.trim() === stockNo);
      if (!row) {
        // 找不到代號代表這支股票當日無資料（如 ETF），回傳 null 但不報錯
        return Response.json({
          ok: true, stockNo, date: dateStr,
          pe: null, pb: null, dividendYield: null,
          note: '此股票無本益比資料（可能為ETF或虧損股）'
        }, { headers: { 'Access-Control-Allow-Origin': '*' } });
      }

      const pe            = parse(row[2]);
      const dividendYield = parse(row[3]);
      const pb            = parse(row[4]);

      return Response.json({
        ok: true, stockNo, date: dateStr,
        pe, pb, dividendYield,
      }, { headers: { 'Access-Control-Allow-Origin': '*' } });

    } catch(_) { continue; }
  }

  return Response.json(
    { ok: false, error: '無法取得資料，請稍後再試' },
    { headers: { 'Access-Control-Allow-Origin': '*' } }
  );
}
