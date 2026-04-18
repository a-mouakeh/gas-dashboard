async function loadForecast() {
  try {
    const response = await fetch(`http://localhost:8080/api/forecast?t=${Date.now()}`);
    const data = await response.json();

    // Update KPI cards
    document.getElementById('fc-current').textContent = `€${data.current_price}`;
    document.getElementById('fc-normal').textContent = `€${data.normal_forecast}`;
    document.getElementById('fc-crisis').textContent = `€${data.crisis_forecast}`;
    document.getElementById('fc-premium').textContent = `€${data.risk_premium}`;
    document.getElementById('fc-storage').textContent = `${data.eu_storage}%`;
document.getElementById('fc-regime').textContent = data.current_regime;
    document.getElementById('fc-regime').style.color = data.current_regime === 'CRISIS' ? '#d43f3f' : '#2d8a55';
    document.getElementById('fc-regime').style.borderColor = data.current_regime === 'CRISIS' ? '#d43f3f' : '#2d8a55';

    // Divergence alert
    const alertEl = document.getElementById('fc-divergence');
    if (data.divergence) {
      alertEl.style.display = 'block';
      alertEl.innerHTML = `
        <span style="color:#d43f3f; font-weight:500">⚠ MODEL DIVERGENCE DETECTED</span>
        &nbsp;·&nbsp; Current TTF (€${data.current_price}) is ${Math.abs(data.divergence_zscore)}σ
        ${data.divergence_direction} normal forecast (€${data.normal_forecast})
        &nbsp;·&nbsp; <span style="color:#5a6480">Possible cause: ${data.divergence_direction === 'above' ? 'geopolitical risk premium being priced in' : 'demand destruction or supply surplus'}</span>
      `;
    } else {
      alertEl.style.display = 'block';
      alertEl.innerHTML = `
        <span style="color:#2d8a55">✓ NO DIVERGENCE</span>
        &nbsp;·&nbsp; Current price within expected range (z-score: ${data.divergence_zscore})
      `;
    }

    // Build chart
    const ctx = document.getElementById('forecastChart').getContext('2d');

    const recentHistory = data.historical.slice(-12);
    const histLabels = recentHistory.map(d => d.date);
    const histValues = recentHistory.map(d => d.actual);

    const forecastLabels = data.forecast.map(d => d.date);
    const normalFc = data.forecast.map(d => d.normal);
    const crisisFc = data.forecast.map(d => d.crisis);
    const normalUpper = data.forecast.map(d => d.normal_upper);
    const normalLower = data.forecast.map(d => d.normal_lower);
    const crisisUpper = data.forecast.map(d => d.crisis_upper);
    const crisisLower = data.forecast.map(d => d.crisis_lower);

    const allLabels = [...histLabels, ...forecastLabels];

    // Pad historical to align with full label set
    const histPadded    = [...histValues, ...Array(forecastLabels.length).fill(null)];
    const normalPadded  = [...Array(histLabels.length).fill(null), ...normalFc];
    const crisisPadded  = [...Array(histLabels.length).fill(null), ...crisisFc];
    const nUpperPadded  = [...Array(histLabels.length).fill(null), ...normalUpper];
    const nLowerPadded  = [...Array(histLabels.length).fill(null), ...normalLower];
    const cUpperPadded  = [...Array(histLabels.length).fill(null), ...crisisUpper];
    const cLowerPadded  = [...Array(histLabels.length).fill(null), ...crisisLower];

    new Chart(ctx, {
      type: 'line',
      data: {
        labels: allLabels,
        datasets: [
          // Crisis upper band fill
          {
            label: 'Crisis Upper',
            data: cUpperPadded,
            borderColor: 'transparent',
            backgroundColor: 'rgba(212,63,63,0.08)',
            fill: '+1',
            pointRadius: 0,
            tension: 0.3,
          },
          // Crisis lower band
          {
            label: 'Crisis Lower',
            data: cLowerPadded,
            borderColor: 'transparent',
            backgroundColor: 'rgba(212,63,63,0.08)',
            fill: false,
            pointRadius: 0,
            tension: 0.3,
          },
          // Normal upper band fill
          {
            label: 'Normal Upper',
            data: nUpperPadded,
            borderColor: 'transparent',
            backgroundColor: 'rgba(232,160,32,0.10)',
            fill: '+1',
            pointRadius: 0,
            tension: 0.3,
          },
          // Normal lower band
          {
            label: 'Normal Lower',
            data: nLowerPadded,
            borderColor: 'transparent',
            backgroundColor: 'rgba(232,160,32,0.10)',
            fill: false,
            pointRadius: 0,
            tension: 0.3,
          },
          // Historical actual
          {
            label: 'TTF Actual (€/MWh)',
            data: histPadded,
            borderColor: '#d4dae8',
            backgroundColor: 'transparent',
            borderWidth: 2,
            pointRadius: 2,
            pointBackgroundColor: '#d4dae8',
            tension: 0.3,
            spanGaps: false,
          },
          // Normal forecast line
          {
            label: 'Normal Regime Forecast',
            data: normalPadded,
            borderColor: '#e8a020',
            backgroundColor: 'transparent',
            borderWidth: 2,
            borderDash: [6, 3],
            pointRadius: 3,
            pointBackgroundColor: '#e8a020',
            tension: 0.3,
            spanGaps: false,
          },
          // Crisis forecast line
          {
            label: 'Crisis Regime Forecast',
            data: crisisPadded,
            borderColor: '#d43f3f',
            backgroundColor: 'transparent',
            borderWidth: 2,
            borderDash: [6, 3],
            pointRadius: 3,
            pointBackgroundColor: '#d43f3f',
            tension: 0.3,
            spanGaps: false,
          },
        ]
      },
      options: {
        responsive: true,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            labels: {
              color: '#d4dae8',
              font: { family: 'IBM Plex Mono', size: 9 },
              filter: (item) => !['Crisis Upper', 'Crisis Lower', 'Normal Upper', 'Normal Lower'].includes(item.text)
            }
          },
          tooltip: {
            backgroundColor: '#111520',
            borderColor: '#1e2a42',
            borderWidth: 1,
            titleColor: '#e8a020',
            bodyColor: '#d4dae8',
            titleFont: { family: 'IBM Plex Mono', size: 10 },
            bodyFont: { family: 'IBM Plex Mono', size: 10 },
            filter: (item) => !['Crisis Upper', 'Crisis Lower', 'Normal Upper', 'Normal Lower'].includes(item.dataset.label)
          },
          annotation: {
            annotations: {
              separator: {
                type: 'line',
                xMin: histLabels[histLabels.length - 1],
                xMax: histLabels[histLabels.length - 1],
                borderColor: 'rgba(255,255,255,0.15)',
                borderWidth: 1,
                borderDash: [4, 4],
                label: {
                  display: true,
                  content: 'FORECAST →',
                  color: '#5a6480',
                  font: { family: 'IBM Plex Mono', size: 8 },
                  position: 'start'
                }
              }
            }
          }
        },
        scales: {
          x: {
            ticks: {
              color: '#5a6480',
              font: { family: 'IBM Plex Mono', size: 8 },
              maxRotation: 45,
            },
            grid: { color: '#1e2a42' }
          },
          y: {
            title: {
              display: true,
              text: 'TTF €/MWh',
              color: '#5a6480',
              font: { family: 'IBM Plex Mono', size: 10 }
            },
            ticks: { color: '#5a6480', font: { family: 'IBM Plex Mono', size: 9 } },
            grid: { color: '#1e2a42' }
          }
        }
      }
    });

    document.getElementById('fc-loading').style.display = 'none';
    document.getElementById('fc-content').style.display = 'block';

  } catch (e) {
    console.error('Forecast error:', e);
    document.getElementById('fc-loading').textContent = 'Failed to load forecast.';
  }
}

loadForecast();
