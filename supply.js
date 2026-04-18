function getRiskColor(score) {
    if (score >= 70) return '#d43f3f';
    if (score >= 40) return '#e8a020';
    return '#2d8a55';
  }
  
  async function loadSupplyRisk() {
    try {
      const response = await fetch(`http://localhost:8080/api/supply-risk?t=${Date.now()}`);
      const data = await response.json();
  
      const color = getRiskColor(data.composite);
  
      // Update composite score
      document.getElementById('supply-score').textContent = data.composite;
      document.getElementById('supply-score').style.color = color;
      document.getElementById('supply-risk-level').textContent = data.risk_level;
      document.getElementById('supply-risk-level').style.color = color;
      document.getElementById('supply-risk-level').style.borderColor = color;
      document.getElementById('supply-articles-count').textContent = `${data.articles_analysed} headlines analysed`;
  
      // Update components
      document.getElementById('comp-sentiment').textContent  = data.components.sentiment;
      document.getElementById('comp-volatility').textContent = data.components.volatility;
      document.getElementById('comp-volume').textContent     = data.components.volume;
  
      // Animate bars
      setTimeout(() => {
        document.getElementById('bar-sentiment').style.width  = data.components.sentiment  + '%';
        document.getElementById('bar-volatility').style.width = data.components.volatility + '%';
        document.getElementById('bar-volume').style.width     = data.components.volume     + '%';
      }, 100);
  
    } catch (e) {
      console.error('Supply risk error:', e);
    }
  }
  
  loadSupplyRisk();