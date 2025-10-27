const STEAM_ID = '76561198153557575'; 
const STRATZ_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJTdWJqZWN0IjoiZTk0OTgzODQtNWYwNi00ZGM4LTljMjUtNjAwYjNlM2NiNDc2IiwiU3RlYW1JZCI6IjE5MzI5MTg0NyIsIkFQSVVzZXIiOiJ0cnVlIiwibmJmIjoxNzYwNjU3MzU5LCJleHAiOjE3OTIxOTMzNTksImlhdCI6MTc2MDY1NzM1OSwiaXNzIjoiaHR0cHM6Ly9hcGkuc3RyYXR6LmNvbSJ9.nUBXfh53D-Oi-LWXYt9625g6DZZXLkFTCDiuRBnrrU8';
const CACHE_KEY = 'stratz_matches';
const CACHE_TTL = 5 * 60 * 1000; 

async function fetchMatches() {
  const cached = localStorage.getItem(CACHE_KEY);
  if (cached) {
    const data = JSON.parse(cached);
    if (Date.now() - data.timestamp < CACHE_TTL) {
      console.log('Using cached matches');
      return data.matches;
    }
  }

  try {
    console.log('Fetching from STRATZ API...');
    
    const response = await fetch(`https://api.stratz.com/api/v1/Player/${STEAM_ID}/matches?take=10&include=player`, {
      headers: { 
        'Authorization': `Bearer ${STRATZ_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const matches = await response.json();
    
    localStorage.setItem(CACHE_KEY, JSON.stringify({ 
      matches, 
      timestamp: Date.now() 
    }));
    
    console.log('Matches fetched successfully:', matches.length);
    return matches;
    
  } catch (error) {
    console.error('STRATZ API error:', error);
    
    return getFallbackMatches();
  }
}

function processMatchData(match) {
  const playerStats = match.players?.find(p => p.steamId == STEAM_ID) || {};
  const hero = match.players?.find(p => p.steamId == STEAM_ID)?.hero || {};
  
  return {
    heroName: hero.displayName || 'Unknown Hero',
    kills: playerStats.kills || 0,
    deaths: playerStats.death || 0,
    assists: playerStats.assists || 0,
    win: playerStats.isVictory || false,
    ratingChange: match.ratingChange || 0,
    startTime: match.startDateTime || Date.now(),
    laneRole: getLaneRole(playerStats.lane || 0),
    isRadiant: playerStats.isRadiant || true,
    rating: match.rating || 0,
    duration: match.duration || 0
  };
}

function getLaneRole(laneId) {
  const lanes = {
    1: 'safe',
    2: 'mid', 
    3: 'off',
    4: 'jungle'
  };
  return lanes[laneId] || 'mid';
}

function createMatchCard(matchData) {
  const heroNameForIcon = matchData.heroName.replace(/ /g, '_').replace(/'/g, '').toLowerCase();
  const heroIcon = `https://cdn.stratz.com/images/dota2/heroes/${heroNameForIcon}.png`;
  
  const article = document.createElement('article');
  article.className = 'card match-card';
  article.innerHTML = `
    <img src="${heroIcon}" class="hero-icon" alt="${matchData.heroName}" 
         onerror="this.src='https://cdn.stratz.com/images/dota2/heroes/default.png'">
    <div class="match-info">
      <h3>${matchData.heroName}</h3>
      <p class="kda">${matchData.kills} / ${matchData.deaths} / ${matchData.assists}</p>
      <p class="details">
        ${matchData.laneRole}, ${matchData.isRadiant ? 'radiant' : 'dire'}<br>
        <span class="result ${matchData.win ? 'win' : 'lose'}">
          ${matchData.win ? '🏆 ПОБЕДА' : '💀 ПОРАЖЕНИЕ'}
        </span><br>
        MMR: ${matchData.ratingChange > 0 ? '+' : ''}${matchData.ratingChange}
      </p>
    </div>
  `;
  return article;
}

async function initMatches() {
  try {
    const container = document.querySelector('#matches .grid');
    
    container.innerHTML = '<p>Загрузка матчей...</p>';
    
    const matches = await fetchMatches();
    
    if (!matches || matches.length === 0) {
      container.innerHTML = '<p>Матчи не найдены</p>';
      return;
    }

    container.innerHTML = '';
    
    const recentMatches = matches.slice(0, 3).map(processMatchData);
    recentMatches.forEach(matchData => {
      container.appendChild(createMatchCard(matchData));
    });

    updateStats(recentMatches);
    
  } catch (error) {
    console.error('Init matches error:', error);
    document.querySelector('#matches .grid').innerHTML = 
      '<p>Ошибка загрузки статистики</p>';
  }
}

function updateStats(matches) {
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  let dayDelta = 0;
  
  matches.forEach(m => {
    if (now - new Date(m.startTime).getTime() <= oneDay) {
      dayDelta += m.ratingChange;
    }
  });
  
  document.getElementById('mmrDelta').textContent = 
    `Δ MMR за день: ${dayDelta > 0 ? '+' : ''}${dayDelta}`;

  const allMatches = matches.map(processMatchData);
  const labels = allMatches.map(m => 
    new Date(m.startTime).toLocaleDateString('ru-RU')
  ).reverse();
  
  const data = allMatches.map(m => m.rating || 4500).reverse();
  
  new Chart(document.getElementById('mmrChart'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'MMR',
        data,
        borderColor: '#00d06b',
        backgroundColor: 'rgba(0, 208, 107, 0.1)',
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: '#00d06b'
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { labels: { color: '#fff' } }
      },
      scales: {
        x: { ticks: { color: '#fff' }, grid: { color: '#222' } },
        y: { ticks: { color: '#fff' }, grid: { color: '#222' } }
      }
    }
  });
}

function getFallbackMatches() {
  return []; 
}

document.addEventListener('DOMContentLoaded', initMatches);