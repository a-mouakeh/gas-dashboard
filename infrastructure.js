const FACILITIES = [
  // Qatar
  { name: 'Ras Laffan LNG Terminal', country: 'Qatar', type: 'LNG Terminal', capacity: '77 mtpa', lat: 25.932, lng: 51.551, keywords: ['ras laffan', 'qatar lng', 'qatargas', 'qatar energy'] },
  { name: 'Pearl GTL Plant', country: 'Qatar', type: 'Gas Processing', capacity: '140,000 bpd', lat: 25.900, lng: 51.520, keywords: ['pearl gtl', 'qatar shell', 'qatar gas'] },

  // UAE
  { name: 'Das Island LNG Terminal', country: 'UAE', type: 'LNG Terminal', capacity: '5.8 mtpa', lat: 25.148, lng: 52.873, keywords: ['das island', 'adnoc lng', 'abu dhabi lng'] },
  { name: 'Ruwais Refinery', country: 'UAE', type: 'Refinery', capacity: '837,000 bpd', lat: 24.114, lng: 52.730, keywords: ['ruwais', 'adnoc refinery', 'abu dhabi refinery'] },
  { name: 'Habshan Gas Plant', country: 'UAE', type: 'Gas Processing', capacity: '1.8 bcf/d', lat: 23.850, lng: 53.730, keywords: ['habshan', 'adnoc gas', 'abu dhabi gas'] },

  // Saudi Arabia
  { name: 'Abqaiq Processing Facility', country: 'Saudi Arabia', type: 'Oil Processing', capacity: '7 mbpd', lat: 25.930, lng: 49.660, keywords: ['abqaiq', 'saudi aramco processing', 'aramco facility'] },
  { name: 'Jubail Industrial City', country: 'Saudi Arabia', type: 'Refinery Complex', capacity: '1.2 mbpd', lat: 27.005, lng: 49.658, keywords: ['jubail', 'saudi refinery', 'sabic'] },
  { name: 'Ras Tanura Refinery', country: 'Saudi Arabia', type: 'Refinery', capacity: '550,000 bpd', lat: 26.648, lng: 50.159, keywords: ['ras tanura', 'aramco refinery', 'saudi export terminal'] },
  { name: 'Shaybah Oil Field', country: 'Saudi Arabia', type: 'Oil Field', capacity: '1 mbpd', lat: 22.514, lng: 54.050, keywords: ['shaybah', 'saudi oilfield', 'aramco shaybah'] },

  // Kuwait
  { name: 'Mina Al Ahmadi Refinery', country: 'Kuwait', type: 'Refinery', capacity: '466,000 bpd', lat: 29.066, lng: 48.133, keywords: ['mina al ahmadi', 'kuwait refinery', 'knpc'] },
  { name: 'Burgan Oil Field', country: 'Kuwait', type: 'Oil Field', capacity: '1.7 mbpd', lat: 28.993, lng: 47.948, keywords: ['burgan', 'kuwait oil', 'koc'] },

  // Bahrain
  { name: 'Bapco Refinery', country: 'Bahrain', type: 'Refinery', capacity: '267,000 bpd', lat: 26.105, lng: 50.558, keywords: ['bapco', 'bahrain refinery', 'bahrain petroleum'] },

  // Iran
  { name: 'South Pars Gas Field', country: 'Iran', type: 'Gas Field', capacity: '700 mcm/d', lat: 27.200, lng: 52.000, keywords: ['south pars', 'iran gas', 'pars lng'] },
  { name: 'Kharg Island Terminal', country: 'Iran', type: 'Oil Export Terminal', capacity: '5 mbpd', lat: 29.239, lng: 50.328, keywords: ['kharg island', 'iran oil export', 'iran terminal'] },
  { name: 'Bandar Abbas Refinery', country: 'Iran', type: 'Refinery', capacity: '320,000 bpd', lat: 27.183, lng: 56.269, keywords: ['bandar abbas', 'iran refinery', 'hormuz refinery'] },

  // Chokepoints
  { name: 'Strait of Hormuz', country: 'Chokepoint', type: 'Strategic Chokepoint', capacity: '~20 mbpd', lat: 26.558, lng: 56.500, keywords: ['hormuz', 'strait', 'hormuz closure', 'hormuz threat'] },
  { name: 'Bab el-Mandeb Strait', country: 'Chokepoint', type: 'Strategic Chokepoint', capacity: '~4 mbpd', lat: 12.585, lng: 43.340, keywords: ['bab el-mandeb', 'bab-el-mandeb', 'red sea strait', 'mandeb'] },
];

const TYPE_COLORS = {
  'LNG Terminal':          '#2d8a55',
  'Gas Processing':        '#2d8a55',
  'Gas Field':             '#2d8a55',
  'Refinery':              '#e8a020',
  'Refinery Complex':      '#e8a020',
  'Oil Processing':        '#e8a020',
  'Oil Field':             '#e8a020',
  'Oil Export Terminal':   '#e8a020',
  'Strategic Chokepoint':  '#d43f3f',
};

let map;
let markers = {};
let allNewsHeadlines = [];

function initMap() {
  map = L.map('infrastructure-map', {
    center: [25.5, 51.0],
    zoom: 6,
    zoomControl: true,
  });

  // Dark tile layer
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap © CARTO',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(map);
}

function getStatusColor(facility, headlines) {
  if (facility.type === 'Strategic Chokepoint') return '#d43f3f';
  const text = headlines.join(' ').toLowerCase();
  const hasEscalation = facility.keywords.some(kw => text.includes(kw)) &&
    ['attack', 'strike', 'bomb', 'missile', 'shut', 'closure', 'fire', 'explosion', 'damage'].some(w => text.includes(w));
  const hasMention = facility.keywords.some(kw => text.includes(kw));
  if (hasEscalation) return '#d43f3f';
  if (hasMention) return '#e8a020';
  return '#2d8a55';
}

function addMarkers(headlines) {
  FACILITIES.forEach(facility => {
    const color = getStatusColor(facility, headlines);
    const isChokepoint = facility.type === 'Strategic Chokepoint';

    const icon = L.divIcon({
      className: '',
      html: `<div style="
        width: ${isChokepoint ? '16px' : '12px'};
        height: ${isChokepoint ? '16px' : '12px'};
        border-radius: 50%;
        background: ${color};
        border: 2px solid rgba(255,255,255,0.3);
        box-shadow: 0 0 ${color === '#d43f3f' ? '8px' : '4px'} ${color};
        cursor: pointer;
      "></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });

    const marker = L.marker([facility.lat, facility.lng], { icon })
      .addTo(map)
      .bindTooltip(`
        <div style="font-family: monospace; font-size: 11px; background: #111520; border: 1px solid #1e2a42; padding: 8px 12px; color: #d4dae8;">
          <strong style="color: ${color}">${facility.name}</strong><br>
          <span style="color: #5a6480">${facility.country} · ${facility.type}</span><br>
          <span style="color: #e8a020">Capacity: ${facility.capacity}</span>
        </div>
      `, { className: 'custom-tooltip', opacity: 1 })
      .on('click', () => showFacilityNews(facility, headlines));

    markers[facility.name] = { marker, facility, color };
  });
}

function showFacilityNews(facility, headlines) {
  const relevant = allNewsHeadlines.filter(h =>
    facility.keywords.some(kw =>
      `${h.title} ${h.description || ''}`.toLowerCase().includes(kw)
    )
  );

  const newsEl = document.getElementById('facility-news');
  const titleEl = document.getElementById('facility-news-title');
  const contentEl = document.getElementById('facility-news-content');

  titleEl.textContent = `Latest News — ${facility.name}`;
  newsEl.style.display = 'block';

  if (relevant.length === 0) {
    contentEl.innerHTML = `<div style="color:#5a6480; font-family:'IBM Plex Mono',monospace; font-size:10px;">No recent news mentioning this facility.</div>`;
    return;
  }

  contentEl.innerHTML = relevant.slice(0, 4).map(a => `
    <a href="${a.url}" target="_blank" style="display:block; padding: 8px 0; border-bottom: 1px solid #1e2a42; text-decoration: none;">
      <div style="font-size: 11px; color: #d4dae8; margin-bottom: 3px;">${a.title}</div>
      <div style="font-family: 'IBM Plex Mono', monospace; font-size: 9px; color: #3a4460;">${a.source} · ${a.publishedAt.slice(0, 10)}</div>
    </a>
  `).join('');
}

function renderFacilityList(headlines) {
  const listEl = document.getElementById('facility-list');
  listEl.innerHTML = FACILITIES.map(f => {
    const color = getStatusColor(f, headlines);
    const statusText = color === '#d43f3f' ? 'ALERT' : color === '#e8a020' ? 'WATCH' : 'NORMAL';
    return `
      <div onclick="showFacilityNews(facilityByName('${f.name}'), allNewsHeadlines)" style="
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 7px 0;
        border-bottom: 1px solid #1e2a42;
        cursor: pointer;
      " onmouseover="this.style.paddingLeft='4px'" onmouseout="this.style.paddingLeft='0'">
        <div style="width: 8px; height: 8px; border-radius: 50%; background: ${color}; flex-shrink: 0;"></div>
        <div style="flex: 1;">
          <div style="font-size: 10px; color: #d4dae8;">${f.name}</div>
          <div style="font-family: 'IBM Plex Mono', monospace; font-size: 8px; color: #5a6480;">${f.country} · ${f.type}</div>
        </div>
        <div style="font-family: 'IBM Plex Mono', monospace; font-size: 8px; color: ${color}; letter-spacing: 0.06em;">${statusText}</div>
      </div>
    `;
  }).join('');
}

function facilityByName(name) {
  return FACILITIES.find(f => f.name === name);
}

async function loadInfrastructure() {
  try {
    // Fetch all news for status inference
    const [generalRes, hormuzRes] = await Promise.all([
      fetch(`http://localhost:8080/api/news/general?t=${Date.now()}`),
      fetch(`http://localhost:8080/api/news/hormuz?t=${Date.now()}`)
    ]);

    const generalData = await generalRes.json();
    const hormuzData  = await hormuzRes.json();
    allNewsHeadlines  = [...generalData, ...hormuzData];

    const headlines = allNewsHeadlines.map(a =>
      `${a.title} ${a.description || ''}`.toLowerCase()
    );

    addMarkers(headlines);
    renderFacilityList(headlines);

  } catch (e) {
    console.error('Infrastructure load failed:', e);
  }
}

// Init
initMap();
loadInfrastructure();
