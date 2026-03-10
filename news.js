const ENERGY_KEYWORDS = [
  'oil', 'gas', 'lng', 'energy', 'fuel', 'pipeline', 'tanker',
  'hormuz', 'refinery', 'opec', 'barrel', 'crude', 'petrochemical',
  'iran', 'houthi', 'saudi', 'gulf', 'shipping', 'facility', 'drone'
];

function isEnergyRelevant(article) {
  const text = `${article.title} ${article.description}`.toLowerCase();
  return ENERGY_KEYWORDS.some(kw => text.includes(kw));
}

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 60000);
  if (diff < 60) return `${diff}m ago`;
  if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
  return `${Math.floor(diff / 1440)}d ago`;
}

function renderArticle(article, color) {
  return `
    <a href="${article.url}" target="_blank" style="
      display: block;
      padding: 12px 0;
      border-bottom: 1px solid #1e2a42;
      text-decoration: none;
      transition: all 0.15s;
    " onmouseover="this.style.paddingLeft='6px'" onmouseout="this.style.paddingLeft='0'">
      <div style="
        font-family: 'IBM Plex Mono', monospace;
        font-size: 9px;
        color: ${color};
        letter-spacing: 0.1em;
        text-transform: uppercase;
        margin-bottom: 4px;
        display: flex;
        justify-content: space-between;
      ">
        <span>${article.source}</span>
        <span style="color:#3a4460">${timeAgo(article.publishedAt)}</span>
      </div>
      <div style="
        font-size: 11px;
        color: #d4dae8;
        line-height: 1.5;
        margin-bottom: 4px;
      ">${article.title}</div>
      <div style="
        font-size: 10px;
        color: #5a6480;
        line-height: 1.4;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      ">${article.description || ''}</div>
    </a>
  `;
}

function renderFeed(container, articles, color, id) {
  if (articles.length === 0) {
    container.innerHTML = '<div style="color:#5a6480;font-size:11px">No relevant articles found.</div>';
    return;
  }

  const visible = articles.slice(0, 3);
  const hidden  = articles.slice(3);

  let html = visible.map(a => renderArticle(a, color)).join('');

  if (hidden.length > 0) {
    html += `
      <div id="hidden-${id}" style="display:none">
        ${hidden.map(a => renderArticle(a, color)).join('')}
      </div>
      <button onclick="
        document.getElementById('hidden-${id}').style.display='block';
        this.style.display='none';
      " style="
        margin-top: 10px;
        background: none;
        border: 1px solid #1e2a42;
        color: #5a6480;
        font-family: 'IBM Plex Mono', monospace;
        font-size: 9px;
        letter-spacing: 0.1em;
        padding: 6px 14px;
        cursor: pointer;
        width: 100%;
        text-transform: uppercase;
        transition: all 0.15s;
      " onmouseover="this.style.borderColor='#e8a020';this.style.color='#e8a020'"
         onmouseout="this.style.borderColor='#1e2a42';this.style.color='#5a6480'">
        + ${hidden.length} more articles
      </button>
    `;
  }

  container.innerHTML = html;
}

async function loadNews() {
  try {
    const [generalRes, hormuzRes] = await Promise.all([
      fetch(`http://localhost:8080/api/news/general?t=${Date.now()}`),
      fetch(`http://localhost:8080/api/news/hormuz?t=${Date.now()}`)
    ]);

    const generalData = await generalRes.json();
    const hormuzData  = await hormuzRes.json();

    const generalFiltered = generalData.filter(isEnergyRelevant).slice(0, 8);
    const hormuzFiltered  = hormuzData.filter(isEnergyRelevant).slice(0, 8);

    renderFeed(document.getElementById('news-general'), generalFiltered, '#e8a020', 'general');
    renderFeed(document.getElementById('news-hormuz'),  hormuzFiltered,  '#d43f3f', 'hormuz');

  } catch (e) {
    console.error('News load failed:', e);
    document.getElementById('news-general').innerHTML = '<div style="color:#5a6480;font-size:11px">Failed to load news.</div>';
    document.getElementById('news-hormuz').innerHTML  = '<div style="color:#5a6480;font-size:11px">Failed to load news.</div>';
  }
}

loadNews();
setInterval(loadNews, 300000);