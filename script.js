const STEAM_ID = '193291847'; 
const STRATZ_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJTdWJqZWN0IjoiZTk0OTgzODQtNWYwNi00ZGM4LTljMjUtNjAwYjNlM2NiNDc2IiwiU3RlYW1JZCI6IjE5MzI5MTg0NyIsIkFQSVVzZXIiOiJ0cnVlIiwibmJmIjoxNzYxNTg2MTk0LCJleHAiOjE3OTMxMjIxOTQsImlhdCI6MTc2MTU4NjE5NCwiaXNzIjoiaHR0cHM6Ly9hcGkuc3RyYXR6LmNvbSJ9.Spr_CcRGytP-0oG6o8kJ7e5AegKcCi46dYtdWsWTz5E';
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
    
    const playerResponse = await fetch(`https://api.stratz.com/api/v1/Player/${STEAM_ID}`, {
      headers: { 
        'Authorization': `Bearer ${STRATZ_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!playerResponse.ok) {
      throw new Error(`Player API error: ${playerResponse.status}`);
    }

    const playerData = await playerResponse.json();
    console.log('Player data received');
    
    const matchesResponse = await fetch(`https://api.stratz.com/api/v1/Player/${STEAM_ID}/matches`, {
      headers: { 
        'Authorization': `Bearer ${STRATZ_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!matchesResponse.ok) {
      throw new Error(`Matches API error: ${matchesResponse.status}`);
    }

    const matches = await matchesResponse.json();
    console.log('Matches fetched successfully:', matches?.length || 0);
    
    localStorage.setItem(CACHE_KEY, JSON.stringify({ 
      matches, 
      timestamp: Date.now() 
    }));
    
    return matches;
    
  } catch (error) {
    console.error('STRATZ API error:', error);
    return getFallbackMatches();
  }
}

function processMatchData(match) {
  const playerStats = match.players?.find(p => p.steamId == STEAM_ID) || {};
  const hero = playerStats.hero || {};
  
  return {
    heroName: hero.displayName || match.hero?.displayName || 'Unknown Hero',
    kills: playerStats.kills || match.kills || 0,
    deaths: playerStats.deaths || match.deaths || 0,
    assists: playerStats.assists || match.assists || 0,
    win: playerStats.isVictory !== undefined ? playerStats.isVictory : (match.didRadiantWin === playerStats.isRadiant),
    ratingChange: match.rankChange || match.ratingChange || 0,
    startTime: match.startDateTime || match.date || Date.now(),
    laneRole: getLaneRole(playerStats.lane || match.lane || 0),
    isRadiant: playerStats.isRadiant !== undefined ? playerStats.isRadiant : true,
    rating: match.rank || match.rating || 0,
    duration: match.duration || 0
  };
}

function getLaneRole(laneId) {
  const lanes = {
    1: 'safe',
    2: 'mid', 
    3: 'off',
    4: 'jungle',
    5: 'roam'
  };
  return lanes[laneId] || 'mid';
}

function createMatchCard(matchData) {
  const heroNameForIcon = matchData.heroName.replace(/ /g, '_').replace(/'/g, '').toLowerCase();
  const heroIcon = `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/${heroNameForIcon}.png`;
  
  const article = document.createElement('article');
  article.className = 'card match-card';
  article.innerHTML = `
    <img src="${heroIcon}" class="hero-icon" alt="${matchData.heroName}" 
         onerror="this.style.display='none'">
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

    console.log('Raw matches data:', matches);
    
    container.innerHTML = '';
    
    // Берем последние 3 матча
    const recentMatches = matches.slice(0, 3).map(processMatchData);
    console.log('Processed matches:', recentMatches);
    
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

  // Для графика используем больше данных
  const allMatches = matches;
  const labels = allMatches.map(m => {
    const date = new Date(m.startTime);
    return `${date.getDate()}.${date.getMonth() + 1} ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
  }).reverse();
  
  const data = allMatches.map(m => m.rating || 4500).reverse();
  
  if (data.length > 0) {
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
}

function getFallbackMatches() {
  return [];
}

document.addEventListener('DOMContentLoaded', initMatches);