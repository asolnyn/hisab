// Fetches a Google Sheet's live data via the public gviz JSON feed.
// No API key needed — the sheet just needs to be shared as
// "Anyone with the link — Viewer".
async function fetchSheet(sheetId, tab) {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(tab)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Could not reach this sheet. Check it is shared as "Anyone with the link".');
  const text = await res.text();

  // Response is wrapped like: google.visualization.Query.setResponse({...});
  const jsonStart = text.indexOf('{');
  const jsonEnd = text.lastIndexOf('}');
  const json = JSON.parse(text.slice(jsonStart, jsonEnd + 1));

  const rows = json.table.rows.map(r =>
    (r.c || []).map(cell => (cell ? (cell.v ?? cell.f ?? '') : ''))
  );
  return rows;
}

// Finds the header row (contains "tarikh") and parses everything after
// it into { amount, date, note } transactions, skipping summary rows.
function parseTransactions(rows) {
  const headerIdx = rows.findIndex(r =>
    r.some(c => String(c).toLowerCase().includes('tarikh'))
  );
  const dataRows = headerIdx >= 0 ? rows.slice(headerIdx + 1) : rows;

  const txns = [];
  for (const r of dataRows) {
    const amount = parseFloat(r[0]);
    if (isNaN(amount)) continue;
    txns.push({
      amount,
      date: r[1] ? String(r[1]) : '',
      note: r[2] ? String(r[2]) : ''
    });
  }
  return txns;
}

function formatMoney(n) {
  const sign = n < 0 ? '−' : '+';
  return sign + Math.abs(n).toLocaleString();
}
