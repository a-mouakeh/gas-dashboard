let currentChart = null;
let currentPeriod = '2y';

async function fetchSeries(commodity, period) {
  const response = await fetch(`http://localhost:8080/api/prices/${commodity}?period=${period}&t=${Date.now()}`);
  const json = await response.json();
  return json.data;
}

function setPeriod(period) {
  currentPeriod = period;
  document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`btn-${period}`).classList.add('active');
  if (currentChart) {
    currentChart.destroy();
    currentChart = null;
  }
  document.getElementById('loading-prices').style.display = 'block';
  document.getElementById('priceChart').style.display = 'none';
  loadPriceChart(period);
}

async function loadPriceChart(period = '2y') {
  try {
    const brentData = await fetchSeries('brent', period);
    await new Promise(r => setTimeout(r, 300));
    const henryData = await fetchSeries('henry', period);
    await new Promise(r => setTimeout(r, 300));
    const ttfData   = await fetchSeries('ttf',   period);

    const allDates = [...new Set([
      ...brentData.map(d => d.date),
      ...henryData.map(d => d.date),
      ...ttfData.map(d => d.date)
    ])].sort();

    const brentMap = Object.fromEntries(brentData.map(d => [d.date, d.value]));
    const henryMap = Object.fromEntries(henryData.map(d => [d.date, d.value]));
    const ttfMap   = Object.fromEntries(ttfData.map(d => [d.date, d.value]));

    const brentValues = allDates.map(d => brentMap[d] ?? null);
    const henryValues = allDates.map(d => henryMap[d] ?? null);
    const ttfValues   = allDates.map(d => ttfMap[d]   ?? null);

    document.getElementById('loading-prices').style.display = 'none';
    document.getElementById('priceChart').style.display = 'block';

    const ctx = document.getElementById('priceChart').getContext('2d');

    currentChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: allDates,
        datasets: [
          {
            label: 'Brent Crude ($/bbl)',
            data: brentValues,
            borderColor: '#d43f3f',
            backgroundColor: 'rgba(212, 63, 63, 0.05)',
            borderWidth: 2,
            pointRadius: 3,
            pointBackgroundColor: '#d43f3f',
            fill: true,
            tension: 0.3,
            yAxisID: 'yBrent',
            spanGaps: true
          },
          {
            label: 'Henry Hub ($/MMBtu)',
            data: henryValues,
            borderColor: '#e8a020',
            backgroundColor: 'rgba(232, 160, 32, 0.05)',
            borderWidth: 2,
            pointRadius: 3,
            pointBackgroundColor: '#e8a020',
            fill: true,
            tension: 0.3,
            yAxisID: 'yHenry',
            spanGaps: true
          },
          {
            label: 'TTF European Gas (€/MWh)',
            data: ttfValues,
            borderColor: '#2d8a55',
            backgroundColor: 'rgba(45, 138, 85, 0.05)',
            borderWidth: 2,
            pointRadius: 3,
            pointBackgroundColor: '#2d8a55',
            fill: true,
            tension: 0.3,
            yAxisID: 'yTTF',
            spanGaps: true
          }
        ]
      },
      options: {
        responsive: true,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            labels: {
              color: '#d4dae8',
              font: { family: 'IBM Plex Mono', size: 10 }
            }
          },
          tooltip: {
            backgroundColor: '#111520',
            borderColor: '#1e2a42',
            borderWidth: 1,
            titleColor: '#e8a020',
            bodyColor: '#d4dae8',
            titleFont: { family: 'IBM Plex Mono', size: 10 },
            bodyFont: { family: 'IBM Plex Mono', size: 10 }
          }
        },
        scales: {
          x: {
            ticks: { color: '#5a6480', font: { family: 'IBM Plex Mono', size: 9 } },
            grid: { color: '#1e2a42' }
          },
          yBrent: {
            position: 'left',
            title: {
              display: true,
              text: 'Brent $/bbl',
              color: '#d43f3f',
              font: { family: 'IBM Plex Mono', size: 11 }
            },
            ticks: { color: '#d43f3f', font: { family: 'IBM Plex Mono', size: 9 } },
            grid: { color: '#1e2a42' }
          },
          yHenry: {
            position: 'right',
            title: {
              display: true,
              text: 'Henry Hub $/MMBtu',
              color: '#e8a020',
              font: { family: 'IBM Plex Mono', size: 11 }
            },
            ticks: { color: '#e8a020', font: { family: 'IBM Plex Mono', size: 9 } },
            grid: { drawOnChartArea: false }
          },
          yTTF: {
            position: 'right',
            title: {
              display: true,
              text: 'TTF €/MWh',
              color: '#2d8a55',
              font: { family: 'IBM Plex Mono', size: 11 }
            },
            ticks: { color: '#2d8a55', font: { family: 'IBM Plex Mono', size: 9 } },
            grid: { drawOnChartArea: false },
            offset: true
          }
        }
      }
    });

  } catch (error) {
    document.getElementById('loading-prices').textContent = 'Failed to load price data.';
    console.error(error);
  }
}

// Set 1mo as default and load
document.getElementById('btn-1mo').classList.add('active');
// Small delay to ensure DOM is ready
setTimeout(() => loadPriceChart('1mo'), 100);