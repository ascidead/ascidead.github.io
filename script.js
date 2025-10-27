const steamId = '76561198153557575';
const stratzToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJTdWJqZWN0IjoiZTk0OTgzODQtNWYwNi00ZGM4LTljMjUtNjAwYjNlM2NiNDc2IiwiU3RlYW1JZCI6IjE5MzI5MTg0NyIsIkFQSVVzZXIiOiJ0cnVlIiwibmJmIjoxNzYwNjU3MzU5LCJleHAiOjE3OTIxOTMzNTksImlhdCI6MTc2MDY1NzM1OSwiaXNzIjoiaHR0cHM6Ly9hcGkuc3RyYXR6LmNvbSJ9.nUBXfh53D-Oi-LWXYt9625g6DZZXLkFTCDiuRBnrrU8';
const CACHE_KEY = 'stratz_ascided';
const CACHE_TTL = 10 * 60 * 1000; 

async function fetchMatches() {
  const cached = localStorage.getItem(CACHE_KEY);
  if(cached){
    const data = JSON.parse(cached);
    if(Date.now() - data.timestamp < CACHE_TTL) return data.matches;
  }
  const res = await fetch(`https://api.stratz.com/api/v1/Player/${steamId}/matches?take=10`, {
    headers: { 'Authorization': `Bearer ${stratzToken}` }
  });
  const matches = await res.json();
  localStorage.setItem(CACHE_KEY, JSON.stringify({ matches, timestamp: Date.now() }));
  return matches;
}

function createMatchCard(match){
  const heroIcon = `https://cdn.stratz.com/images/dota2/heroes/${match.heroName.replace(/ /g,'')}.png`;
  const article = document.createElement('article');
  article.className = 'card match-card';
  article.innerHTML = `
    <img src="${heroIcon}" class="hero-icon">
    <div class="match-info">
      <h3>${match.heroName}</h3>
      <p class="kda">${match.kills} / ${match.deaths} / ${match.assists}</p>
      <p class="details">
        ${match.laneRole || 'mid'}, ${match.isRadiant ? 'radiant' : 'dire'}<br>
        <span class="result ${match.win ? 'win' : 'lose'}">${match.win ? 'Win' : 'Lose'}</span>
        MMR: ${match.ratingChange > 0 ? '+' : ''}${match.ratingChange}
      </p>
    </div>
  `;
  return article;
}

async function initMatches() {
  const container = document.querySelector('#matches .grid');
  const matches = await fetchMatches();
  container.innerHTML = '';
  matches.slice(0,3).forEach(m => container.appendChild(createMatchCard(m)));

  const now = Date.now();
  const oneDay = 24*60*60*1000;
  let dayDelta = 0;
  matches.forEach(m => { if(now - new Date(m.startTime).getTime() <= oneDay) dayDelta += m.ratingChange; });
  document.getElementById('mmrDelta').textContent = `Δ MMR for 24h: ${dayDelta>0?'+':''}${dayDelta}`;

  const labels = matches.map(m => new Date(m.startTime).toLocaleDateString());
  const data = matches.map(m => m.rating);
  new Chart(document.getElementById('mmrChart'), {
    type:'line',
    data:{labels,datasets:[{label:'MMR',data,borderColor:'#fff',backgroundColor:'rgba(255,255,255,0.1)',tension:0.3,pointRadius:3,pointBackgroundColor:'#fff'}]},
    options:{
      responsive:true,
      plugins:{legend:{labels:{color:'#fff'}}},
      scales:{
        x:{ticks:{color:'#fff'},grid:{color:'#222'}},
        y:{ticks:{color:'#fff'},grid:{color:'#222'}}
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', () => { initMatches(); });