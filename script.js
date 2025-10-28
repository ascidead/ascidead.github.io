const STEAM_ID = '193291847';
let currentMMR = parseInt(localStorage.getItem('current_mmr')) || 2998;
let heroesMap = {};

async function fetchHeroes() {
    try {
        const response = await fetch('https://api.opendota.com/api/heroes');
        const heroes = await response.json();
        const heroesMap = {};
        heroes.forEach(hero => {
            heroesMap[hero.id] = hero.localized_name;
        });
        return heroesMap;
    } catch (error) {
        return {};
    }
}

async function fetchMatches() {
    try {
        const response = await fetch(`https://api.opendota.com/api/players/${STEAM_ID}/recentMatches`);
        if (!response.ok) {
            throw new Error(`OpenDota API error: ${response.status}`);
        }
        const matches = await response.json();
        return matches;
    } catch (error) {
        return getFallbackMatches();
    }
}

function getPositionFromMatchData(match) {
    if (match.lane_role !== null && match.lane_role !== undefined) {
        const positions = {
            1: 'Carry',
            2: 'Mid', 
            3: 'Offlane',
            4: 'Support',
        };
        return positions[match.lane_role] || 'Support';
    }
    const gpm = match.gold_per_min || 0;
    const xpm = match.xp_per_min || 0;
    const lastHits = match.last_hits || 0;
    
    if (gpm > 600 && xpm > 600) return 'Mid';
    if (gpm > 550 && lastHits > 150) return 'Carry';
    if (gpm > 450 && gpm <= 550) return 'Offlane';
    if (gpm <= 450) return 'Support';
    
    return 'Support';
}

function getHeroIcon(heroId, variant, heroName) {
    const heroNameForIcon = heroName.replace(/ /g, '_').replace(/'/g, '').toLowerCase();
    const baseIcon = `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/${heroNameForIcon}.png`;
    if (variant && variant > 1) {
        const variantIcon = `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/${heroNameForIcon}_${variant}.png`;
        return variantIcon;
    }
    return baseIcon;
}

function processMatchData(match, heroesMap) {
    const isRadiant = match.player_slot < 128;
    const win = isRadiant ? match.radiant_win : !match.radiant_win;
    const mmrChange = win ? '+25' : '-25';
    
    return {
        heroName: heroesMap[match.hero_id] || `Hero ${match.hero_id}`,
        hero_id: match.hero_id,
        hero_variant: match.hero_variant || 1,
        kills: match.kills || 0,
        deaths: match.deaths || 0,
        assists: match.assists || 0,
        win: win,
        ratingChange: mmrChange,
        startTime: match.start_time * 1000,
        laneRole: getPositionFromMatchData(match),
        isRadiant: isRadiant,
        duration: match.duration || 0,
        match_id: match.match_id
    };
}

function createMatchCard(matchData) {
    const heroIcon = getHeroIcon(matchData.hero_id, matchData.hero_variant, matchData.heroName);
    const team = matchData.isRadiant ? 'Radiant' : 'Dire';
    
    const article = document.createElement('article');
    article.className = 'card match-card';
    article.innerHTML = `
        <img src="${heroIcon}" class="hero-icon" alt="${matchData.heroName}" 
             onerror="this.src='https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/${matchData.heroName.replace(/ /g, '_').replace(/'/g, '').toLowerCase()}.png'">
        <div class="match-info">
            <h3>${matchData.heroName}</h3>
            <p class="kda">${matchData.kills} / ${matchData.deaths} / ${matchData.assists}</p>
            <p class="details">
                ${matchData.laneRole}, ${team}<br>
                <span class="result ${matchData.win ? 'win' : 'lose'}">
                    ${matchData.win ? '🏆 VICTORY' : '💀 DEFEAT'}
                </span><br>
                MMR: ${matchData.ratingChange}
            </p>
        </div>
    `;
    return article;
}

function autoUpdateMMR() {
    const today = new Date().toDateString();
    const lastUpdate = localStorage.getItem('last_mmr_update');
    
    if (lastUpdate !== today) {
        const dayDelta = calculateDayDelta();
        currentMMR += dayDelta;
        localStorage.setItem('current_mmr', currentMMR);
        localStorage.setItem('last_mmr_update', today);
    }
}

function calculateDayDelta() {
    return 0;
}

async function initMatches() {
    try {
        autoUpdateMMR();
        
        const container = document.querySelector('#matches .grid');
        container.innerHTML = '<p>Loading matches...</p>';
        
        const [heroesData, matches] = await Promise.all([
            fetchHeroes(),
            fetchMatches()
        ]);
        
        heroesMap = heroesData;
        
        if (!matches || matches.length === 0) {
            container.innerHTML = '<p>No matches found</p>';
            return;
        }

        container.innerHTML = '';
        
        const recentMatches = matches.slice(0, 3).map(match => 
            processMatchData(match, heroesMap)
        );
        
        recentMatches.forEach(matchData => {
            container.appendChild(createMatchCard(matchData));
        });

        updateStats(recentMatches, matches);
        
    } catch (error) {
        document.querySelector('#matches .grid').innerHTML = '<p>Error loading statistics</p>';
    }
}

function updateStats(recentMatches, allMatchesForChart) {
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    let dayDelta = 0;
    
    allMatchesForChart.forEach(match => {
        const isRadiant = match.player_slot < 128;
        const win = isRadiant ? match.radiant_win : !match.radiant_win;
        const matchTime = match.start_time * 1000;
        
        if (now - matchTime <= oneDay) {
            dayDelta += win ? 25 : -25;
        }
    });
    
    document.getElementById('mmrDelta').innerHTML = 
        `Current MMR: <strong>${currentMMR}</strong><br>
         Δ MMR today: ${dayDelta > 0 ? '+' : ''}${dayDelta}`;

    const chartMatches = allMatchesForChart.map(match => {
        const isRadiant = match.player_slot < 128;
        const win = isRadiant ? match.radiant_win : !match.radiant_win;
        return {
            win: win,
            startTime: match.start_time * 1000,
            ratingChange: win ? 25 : -25
        };
    }).reverse();

    let runningMMR = currentMMR - dayDelta;
    const data = chartMatches.map(match => {
        runningMMR += match.ratingChange;
        return runningMMR;
    });

    const labels = chartMatches.map(match => {
        const date = new Date(match.startTime);
        return `${date.getDate()}.${date.getMonth() + 1} ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
    });

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
                    pointBackgroundColor: '#00d06b',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        labels: { 
                            color: '#fff',
                            font: { size: 12 }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        titleColor: '#fff',
                        bodyColor: '#fff'
                    }
                },
                scales: {
                    x: {
                        ticks: { 
                            color: '#888',
                            maxTicksLimit: 8
                        },
                        grid: { color: '#222' }
                    },
                    y: {
                        ticks: { color: '#888' },
                        grid: { color: '#222' },
                        suggestedMin: Math.min(...data) - 50,
                        suggestedMax: Math.max(...data) + 50
                    }
                }
            }
        });
    }
}

function getFallbackMatches() {
    return [
        {
            hero_id: 74,
            kills: 12,
            deaths: 4,
            assists: 8,
            player_slot: 1,
            radiant_win: true,
            start_time: Math.floor(Date.now() / 1000) - 7200,
            lane_role: 2,
            duration: 2400,
            match_id: 1234567890,
            gold_per_min: 650,
            xp_per_min: 600,
            is_roaming: false,
            hero_variant: 1
        },
        {
            hero_id: 46,
            kills: 8,
            deaths: 6,
            assists: 12,
            player_slot: 130,
            radiant_win: false,
            start_time: Math.floor(Date.now() / 1000) - 14400,
            lane_role: 4,
            duration: 2100,
            match_id: 1234567891,
            gold_per_min: 380,
            xp_per_min: 400,
            is_roaming: true,
            hero_variant: 1
        }
    ];
}

document.addEventListener('DOMContentLoaded', initMatches);