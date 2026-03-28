function getFearColor(index) {
    if (index >= 70) return '#d43f3f';
    if (index >= 40) return '#e8a020';
    return '#2d8a55';
  }
  
  function getFearLabel(index) {
    if (index >= 70) return 'HIGH RISK';
    if (index >= 40) return 'ELEVATED';
    return 'LOW RISK';
  }
  
  function timeAgo(dateStr) {
    const diff = Math.floor((Date.now() - new Date(dateStr)) / 60000);
    if (diff < 60) return `${diff}m ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
    return `${Math.floor(diff / 1440)}d ago`;
  }
  
  function renderSentimentArticle(article) {
    const colors = {
      negative: '#d43f3f',
      neutral:  '#5a6480',
      positive: '#2d8a55'
    };
    const color = colors[article.label];
    const pct = Math.round(article.confidence * 100);
  
    return `
      <div style="
        display: flex;
        align-items: flex-start;
        gap: 12px;
        padding: 10px 0;
        border-bottom: 1px solid #1e2a42;
      ">
        <div style="
          flex-shrink: 0;
          width: 72px;
          text-align: center;
          padding: 4px 6px;
          border: 1px solid ${color};
          font-family: 'IBM Plex Mono', monospace;
          font-size: 8px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: ${color};
          margin-top: 2px;
        ">
          ${article.label}<br>
          <span style="font-size:9px;font-weight:500">${pct}%</span>
        </div>
        <div style="flex: 1;">
          <div style="font-size: 11px; color: #d4dae8; line-height: 1.5; margin-bottom: 3px;">
            ${article.title}
          </div>
          <div style="font-family: 'IBM Plex Mono', monospace; font-size: 9px; color: #3a4460;">
            ${article.source} · ${timeAgo(article.publishedAt)}
          </div>
        </div>
      </div>
    `;
  }
  
  async function loadSentiment() {
    try {
      const response = await fetch(`http://localhost:8080/api/sentiment?t=${Date.now()}`);
      const data = await response.json();
  
      const color = getFearColor(data.fear_index);
      const label = getFearLabel(data.fear_index);
  
      document.getElementById('fear-index-value').textContent = data.fear_index;
      document.getElementById('fear-index-value').style.color = color;
      document.getElementById('fear-label').textContent = label;
      document.getElementById('fear-label').style.color = color;
      document.getElementById('fear-label').style.borderColor = color;
  
      document.getElementById('count-negative').textContent = data.counts.negative;
      document.getElementById('count-neutral').textContent  = data.counts.neutral;
      document.getElementById('count-positive').textContent = data.counts.positive;
  
      const container = document.getElementById('sentiment-articles');
  
      if (data.articles.length === 0) {
        container.innerHTML = '<div style="color:#5a6480;font-size:11px">No scored headlines available.</div>';
        return;
      }
  
      const visible = data.articles.slice(0, 3);
      const hidden  = data.articles.slice(3);
  
      let html = visible.map(renderSentimentArticle).join('');
  
      if (hidden.length > 0) {
        html += `
          <div id="hidden-sentiment" style="display:none">
            ${hidden.map(renderSentimentArticle).join('')}
          </div>
          <button id="sentiment-toggle" onclick="
            const el = document.getElementById('hidden-sentiment');
            const btn = document.getElementById('sentiment-toggle');
            if (el.style.display === 'none') {
              el.style.display = 'block';
              btn.textContent = '− Show less';
            } else {
              el.style.display = 'none';
              btn.textContent = '+ ${hidden.length} more headlines';
            }
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
            + ${hidden.length} more headlines
          </button>
        `;
      }
  
      container.innerHTML = html;
  
    } catch (e) {
      console.error('Sentiment panel error:', e);
      document.getElementById('sentiment-articles').innerHTML = '<div style="color:#5a6480;font-size:11px">Failed to load sentiment.</div>';
    }
  }
  
  loadSentiment();
  setInterval(loadSentiment, 300000);