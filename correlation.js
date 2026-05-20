// ============================================================
// Phase 8 — Correlation Analysis
// correlation.js — Fear Index × TTF Monthly Returns
// ============================================================

let correlationChart = null;

async function loadCorrelation() {
  try {
    async function fetchWithRetry(url, retries = 3) {
      for (let i = 0; i < retries; i++) {
        try {
          const response = await fetch(url);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return await response.json();
        } catch (e) {
          if (i === retries - 1) throw e;
          await new Promise(r => setTimeout(r, 2000));
        }
      }
    }

    const data = await fetchWithRetry(`http://localhost:8080/api/correlation?t=${Date.now()}`);

    if (data.error) {
      document.getElementById('corr-loading').textContent = 'Failed to load correlation data.';
      return;
    }

    renderCorrelationLeft(data);
    renderCorrelationChart(data);

    document.getElementById('corr-loading').style.display = 'none';
    document.getElementById('corr-content').style.display = 'grid';

  } catch (e) {
    console.error('Correlation error:', e);
    document.getElementById('corr-loading').textContent = 'Failed to load correlation data.';
  }
}

// ── Left panel: KPIs + regime table + interpretation + method note ────────────
function renderCorrelationLeft(data) {
  const { r, r_squared, p_value, significance, sig_note, n_samples, summary } = data;

  const rAbs    = Math.abs(r);
  const rColor  = rAbs >= 0.6 ? '#d43f3f' : rAbs >= 0.3 ? '#e8a020' : '#2d8a55';
  const sigColor = significance === 'Highly Significant' ? '#d43f3f'
                 : significance === 'Significant'        ? '#e8a020'
                 : '#5a6480';

  const direction = r > 0 ? 'positive' : 'negative';
  const strength  = rAbs >= 0.6 ? 'strong' : rAbs >= 0.3 ? 'moderate' : 'weak';
  const variance  = Math.round(r_squared * 100);

  // KPI values
  document.getElementById('corr-r').textContent      = r;
  document.getElementById('corr-r').style.color      = rColor;
  document.getElementById('corr-r-sub').textContent  = `${strength} ${direction}`;
  document.getElementById('corr-r2').textContent     = r_squared;
  document.getElementById('corr-r2-sub').textContent = `${variance}% variance explained`;
  document.getElementById('corr-p').textContent      = p_value;
  document.getElementById('corr-p').style.color      = sigColor;
  document.getElementById('corr-p-sub').textContent  = `${significance} · ${sig_note}`;
  document.getElementById('corr-n').textContent      = n_samples;

  // Regime table
  document.getElementById('corr-crisis-stats').textContent =
    `avg fear ${summary.avg_fear_crisis}  ·  avg return ${summary.avg_ret_crisis > 0 ? '+' : ''}${summary.avg_ret_crisis}%  ·  n=${summary.crisis_n}`;
  document.getElementById('corr-normal-stats').textContent =
    `avg fear ${summary.avg_fear_normal}  ·  avg return ${summary.avg_ret_normal > 0 ? '+' : ''}${summary.avg_ret_normal}%  ·  n=${summary.normal_n}`;

  // Interpretation
  document.getElementById('corr-interp').innerHTML =
    `A <strong style="color:${rColor}">${strength} ${direction}</strong> relationship (r&nbsp;=&nbsp;${r}) between the FinBERT Fear Index and monthly TTF returns. During <strong style="color:#d43f3f">crisis regimes</strong> (fear&nbsp;≥&nbsp;60), mean monthly return is <strong style="color:#d4dae8">${summary.avg_ret_crisis > 0 ? '+' : ''}${summary.avg_ret_crisis}%</strong> vs <strong style="color:#d4dae8">${summary.avg_ret_normal > 0 ? '+' : ''}${summary.avg_ret_normal}%</strong> in <strong style="color:#e8a020">normal regimes</strong>. R²&nbsp;=&nbsp;${r_squared} — the fear index explains <strong style="color:#d4dae8">${variance}%</strong> of variance in monthly TTF moves.`;
}

// ── Scatter chart ─────────────────────────────────────────────────────────────
function renderCorrelationChart(data) {
  if (correlationChart) correlationChart.destroy();

  const ctx = document.getElementById('correlationChart').getContext('2d');
  const { crisis_points, normal_points, trendline } = data;

  correlationChart = new Chart(ctx, {
    type: 'scatter',
    data: {
      datasets: [
        {
          label: 'Crisis Regime (fear ≥ 60)',
          data: crisis_points,
          backgroundColor: 'rgba(212, 63, 63, 0.70)',
          borderColor: '#d43f3f',
          pointRadius: 7,
          pointHoverRadius: 9,
        },
        {
          label: 'Normal Regime (fear < 60)',
          data: normal_points,
          backgroundColor: 'rgba(232, 160, 32, 0.70)',
          borderColor: '#e8a020',
          pointRadius: 7,
          pointHoverRadius: 9,
        },
        {
          label: '_trendline',
          data: [
            { x: trendline.x[0], y: trendline.y[0] },
            { x: trendline.x[1], y: trendline.y[1] },
          ],
          type: 'line',
          borderColor: 'rgba(90, 100, 128, 0.50)',
          borderWidth: 1.5,
          borderDash: [5, 4],
          pointRadius: 0,
          fill: false,
          tension: 0,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'nearest', intersect: true },
      plugins: {
        legend: {
          labels: {
            color: '#d4dae8',
            font: { family: 'IBM Plex Mono', size: 9 },
            filter: item => !item.text.startsWith('_')
          }
        },
        tooltip: {
          backgroundColor: '#111520',
          borderColor: '#1e2a42',
          borderWidth: 1,
          titleColor: '#e8a020',
          bodyColor: '#d4dae8',
          titleFont: { family: 'IBM Plex Mono', size: 9 },
          bodyFont:  { family: 'IBM Plex Mono', size: 9 },
          filter: item => !item.dataset.label.startsWith('_'),
          callbacks: {
            title: ctx => ctx[0].raw.date || '',
            label: ctx => {
              const p = ctx.raw;
              return [
                `Fear Index : ${p.x}`,
                `TTF Return : ${p.y > 0 ? '+' : ''}${p.y.toFixed(2)}%`,
              ];
            }
          }
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'FinBERT Fear Index  (0 – 100)',
            color: '#5a6480',
            font: { family: 'IBM Plex Mono', size: 9 }
          },
          min: 0,
          max: 100,
          grid:  { color: '#1e2a42' },
          ticks: { color: '#5a6480', font: { family: 'IBM Plex Mono', size: 8 } }
        },
        y: {
          title: {
            display: true,
            text: 'TTF Monthly Return  (%)',
            color: '#5a6480',
            font: { family: 'IBM Plex Mono', size: 9 }
          },
          grid:  { color: '#1e2a42' },
          ticks: {
            color: '#5a6480',
            font: { family: 'IBM Plex Mono', size: 8 },
            callback: v => (v > 0 ? '+' : '') + v + '%'
          }
        }
      }
    }
  });
}

loadCorrelation();
