// Cloudflare Pages Function
// 路徑: functions/api/quote/[stock].js
// 負責從台灣證交所抓取即時報價

export async function onRequest(context) {
  const stockNo = context.params.stock?.trim();

  if (!stockNo) {
    return Response.json({ ok: false, error: '請提供股票代號' }, { status: 400 });
  }

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Referer': 'https://mis.twse.com.tw/',
  };

  // 先試 tse（上市），再試 otc（上櫃）
  for (const ex of ['tse', 'otc']) {
    try {
      const url = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=${ex}_${stockNo}.tw&json=1&delay=0`;
      const res = await fetch(url, { headers });
      const data = await res.json();
      const arr = data?.msgArray || [];

      if (arr.length > 0 && arr[0].n) {
        const q = arr[0];
        // q.z 是即時成交價（盤中），q.y 是昨收價；盤後/休市時 q.z 為 '-'
        const price = parseFloat(q.z) || parseFloat(q.y) || 0;
        const prev  = parseFloat(q.y) || price;
        const chg   = Math.round((price - prev) * 100) / 100;
        const pct   = prev ? Math.round((chg / prev) * 10000) / 100 : 0;

        // 有股票名稱就視為找到，price=0 只是休市或未開盤，不跳過
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
        }, {
          headers: { 'Access-Control-Allow-Origin': '*' }
        });
      }
    } catch (_) {
      continue;
    }
  }

  return Response.json(
    { ok: false, error: `查無代號「${stockNo}」，請確認是否為台股代號` },
    { status: 404, headers: { 'Access-Control-Allow-Origin': '*' } }
  );
}
