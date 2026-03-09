const TICKER_LABELS = {
  ttf:      { label: 'TTF',      unit: '€/MWh' },
  henry:    { label: 'Henry Hub', unit: '$/MMBtu' },
  brent:    { label: 'Brent',    unit: '$/bbl' },
  nakilat:  { label: 'Nakilat',  unit: 'QAR' },
  aramco:   { label: 'Aramco',   unit: 'SAR' },
  shell:    { label: 'Shell',    unit: '$' },
  total:    { label: 'TotalEnergies', unit: '$' },
  cheniere: { label: 'Cheniere', unit: '$' },
};

async function loadTicker() {
  try {
    const response = await fetch(`http://localhost:8080/api/live?t=${Date.now()}`);
    const data = await response.json();

    const inner = document.getElementById('ticker-inner');
    inner.innerHTML = '';

    for (let pass = 0; pass < 2; pass++) {
      data.forEach(item => {
        if (item.price === null) return;

        const meta = TICKER_LABELS[item.name] || { label: item.name, unit: '' };
        const isUp = item.change_pct >= 0;
        const changeColor = isUp ? '#2d8a55' : '#d43f3f';
        const arrow = isUp ? '▲' : '▼';

        const el = document.createElement('div');
        el.style.cssText = `
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0 24px;
          border-right: 1px solid #1e2a42;
          white-space: nowrap;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 10px;
          letter-spacing: 0.06em;
        `;

        el.innerHTML = `
          <span style="color:#5a6480">${meta.label}</span>
          <span style="color:#d4dae8">${item.price} ${meta.unit}</span>
          <span style="color:${changeColor}">${arrow} ${Math.abs(item.change_pct)}%</span>
        `;

        inner.appendChild(el);
      });
    }

  } catch (e) {
    console.error('Ticker failed:', e);
  }
}

loadTicker();
// Refresh every 10 seconds
setInterval(loadTicker, 10000);