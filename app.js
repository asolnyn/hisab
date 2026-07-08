// Fetches any JSON file (config files, manifest) with cache-busting,
// so edits show up immediately without needing ?v=2 tricks.
async function fetchJSON(path) {
  const res = await fetch(path + '?_=' + Date.now(), { cache: 'no-store' });
  if (!res.ok) throw new Error('Could not load ' + path);
  return res.json();
}

// Fetches every sheet config file listed in config/manifest.json.
// (We use a manifest instead of GitHub's folder-listing API because
// that API needs auth on private repos — a manifest works either way.)
async function loadAllSheetConfigs() {
  const manifest = await fetchJSON('config/manifest.json');
  const configs = await Promise.all(
    manifest.files.map(f => fetchJSON('config/' + f))
  );
  return configs;
}

// Fetches a Google Sheet's live data via the public gviz JSON feed.
// No API key needed — the sheet just needs to be shared as
// "Anyone with the link — Viewer".
async function fetchSheet(sheetId, tab) {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(tab)}&_=${Date.now()}`;
  const res = await fetch(url, { cache: 'no-store' });
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
    const date = r[1] ? String(r[1]).trim() : '';
    const note = r[2] ? String(r[2]).trim() : '';

    if (isNaN(amount)) continue;
    if (!date) continue;                          // total/summary rows have no date
    if (/in total/i.test(note)) continue;          // extra safety net

    txns.push({ amount, date, note });
  }
  return txns;
}

function formatMoney(n) {
  const sign = n < 0 ? '−' : '+';
  return sign + Math.abs(n).toLocaleString();
}
