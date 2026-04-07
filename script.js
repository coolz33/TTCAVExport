/**
 * TTCAV Export - Script Principal
 * Logique métier restaurée depuis la version fonctionnelle.
 */

const state = {
    appId: localStorage.getItem('fftt_appId') || '',
    appKey: localStorage.getItem('fftt_appKey') || '',
    serial: localStorage.getItem('fftt_serial') || '',
    clubId: localStorage.getItem('fftt_clubId') || '',
    teams: [],
    matchdays: [],
    results: []
};

// ===== UI ELEMENTS =====
const elements = {
    selectPhase: document.getElementById('select-phase'),
    selectTeam: document.getElementById('select-team'),
    selectDay: document.getElementById('select-day'),
    resultsGrid: document.getElementById('results-grid'),
    loader: document.getElementById('loader'),
    exportContainer: document.getElementById('export-container'),
    exportPanel: document.getElementById('export-panel'),
    modalSettings: document.getElementById('modal-settings'),
    debugConsole: document.getElementById('debug-console'),
    debugLog: document.getElementById('debug-log'),
    toast: document.getElementById('toast'),
    toastMessage: document.getElementById('toast-message')
};

// ===== INIT INPUTS =====
document.getElementById('input-app-id').value = state.appId;
document.getElementById('input-app-key').value = state.appKey;
document.getElementById('input-serial').value = state.serial;
document.getElementById('input-club-id').value = state.clubId;

// Debug checkbox
const debugCheckbox = document.getElementById('input-show-debug');
if (debugCheckbox) {
    debugCheckbox.checked = localStorage.getItem('fftt_showDebug') === 'true';
    if (debugCheckbox.checked) elements.debugConsole.style.display = 'block';
}

// ===== EVENT LISTENERS =====
document.querySelectorAll('.open-settings-btn').forEach(btn => {
    btn.onclick = () => elements.modalSettings.style.display = 'flex';
});
document.getElementById('close-settings').onclick = () => elements.modalSettings.style.display = 'none';
document.getElementById('btn-refresh-top').onclick = () => loadTeams();
document.getElementById('btn-generate').onclick = () => generateResults();

document.getElementById('btn-capture').onclick = () => {
    if (state.results.length === 0) return showToast('Générez d\'abord les résultats.', true);
    if (state.results.length === 1) {
        showMatchDetails(0);
    } else {
        showToast('Cliquez sur "Détails" d\'un match spécifique.', true);
    }
};

document.getElementById('btn-copy-text').onclick = () => {
    if (state.results.length === 0) return showToast('Générez d\'abord les résultats.', true);
    const dayLabel = elements.selectDay.value;
    let text = `🏓 RÉSULTATS ${dayLabel} - ${new Date().toLocaleDateString('fr-FR')} 🏓\n\n`;
    state.results.forEach(res => {
        const winIcon = (res.isHome && res.scoreA > res.scoreB) || (!res.isHome && res.scoreB > res.scoreA) ? '✅' :
            ((res.isHome && res.scoreA < res.scoreB) || (!res.isHome && res.scoreB < res.scoreA) ? '❌' : '🤝');
        if (res.scoreA === 0 && res.scoreB === 0) {
            text += `🔸 ${res.teamName} vs ${res.opponent} (Pas encore joué)\n`;
        } else {
            text += `${winIcon} ${res.teamName} [${res.score}] vs ${res.opponent}\n`;
        }
    });
    navigator.clipboard.writeText(text).then(() => showToast('Texte copié !'));
};

const btnCopyCSS = document.getElementById('btn-copy-css');
if (btnCopyCSS) {
    btnCopyCSS.onclick = () => {
        navigator.clipboard.writeText(getWordPressCSS()).then(() => showToast('CSS copié !'));
    };
}

document.getElementById('save-settings').onclick = () => {
    state.appId = document.getElementById('input-app-id').value;
    state.appKey = document.getElementById('input-app-key').value;
    state.serial = document.getElementById('input-serial').value;
    state.clubId = document.getElementById('input-club-id').value;

    localStorage.setItem('fftt_appId', state.appId);
    localStorage.setItem('fftt_appKey', state.appKey);
    localStorage.setItem('fftt_serial', state.serial);
    localStorage.setItem('fftt_clubId', state.clubId);

    if (debugCheckbox) {
        localStorage.setItem('fftt_showDebug', debugCheckbox.checked);
        elements.debugConsole.style.display = debugCheckbox.checked ? 'block' : 'none';
    }

    elements.modalSettings.style.display = 'none';
    showToast('Configuration enregistrée !');
    loadTeams();
};

// ===== UTILITAIRES =====
function showToast(msg, isError = false) {
    const t = elements.toast;
    const icon = t.querySelector('i');
    elements.toastMessage.textContent = msg;
    icon.className = isError ? 'fas fa-exclamation-triangle' : 'fas fa-check-circle';
    icon.style.color = isError ? '#ef4444' : '#10b981';
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
}

function logDebug(msg, type = 'info') {
    const entry = document.createElement('div');
    entry.style.color = type === 'error' ? '#f55' : '#0f0';
    entry.innerText = `[${new Date().toLocaleTimeString()}] ${msg}`;
    elements.debugLog.appendChild(entry);
    elements.debugLog.scrollTop = elements.debugLog.scrollHeight;
    console.log(`[${type}] ${msg}`);
}

function getVal(v) {
    return typeof v === 'string' ? v.trim() : '';
}

// ===== API =====
async function fetchData(action, extraParams = {}) {
    const params = new URLSearchParams({
        appId: state.appId,
        appKey: state.appKey,
        serial: state.serial,
        clubId: state.clubId,
        action: action,
        ...extraParams
    });

    try {
        logDebug(`API Request: ${action}`);
        const response = await fetch(`api.php?${params.toString()}`);
        const data = await response.json();
        if (data.error) {
            const msg = data.message ? `${data.error} : ${data.message}` : data.error;
            logDebug(msg, 'error');
        }
        return data;
    } catch (e) {
        logDebug(`Erreur réseau : ${e.message}`, 'error');
        return { error: 'Erreur réseau' };
    }
}

// ===== CHARGEMENT DES ÉQUIPES =====
async function loadTeams() {
    if (!state.clubId) return showToast('Veuillez configurer votre numéro de club.', true);

    elements.loader.style.display = 'block';
    logDebug('Initialisation du serial...');
    await fetchData('getInitialisation');

    logDebug(`Chargement des équipes pour le club ${state.clubId}...`);
    const data = await fetchData('getTeams');
    elements.loader.style.display = 'none';

    if (data && data.equipe) {
        state.teams = Array.isArray(data.equipe) ? data.equipe : [data.equipe];
        logDebug(`${state.teams.length} équipes chargées.`);

        // Extract phases
        const phases = new Set();
        state.teams.forEach(t => {
            const tName = t.libequipe || t.libequ || t.libepr || t.lib || "";
            const match = tName.match(/Phase\s*\d+/i);
            if (match) phases.add(match[0]);
        });

        elements.selectPhase.innerHTML = '<option value="all">Toutes les phases</option>';
        Array.from(phases).sort().forEach(p => {
            const opt = document.createElement('option');
            opt.value = p;
            opt.textContent = p;
            elements.selectPhase.appendChild(opt);
        });

        function updateTeamDropdown(phaseVal) {
            elements.selectTeam.innerHTML = '<option value="all">Toutes les équipes</option>';
            let filteredTeams = state.teams;

            if (phaseVal !== "all") {
                filteredTeams = state.teams.filter(t => {
                    const tName = t.libequipe || t.libequ || t.libepr || t.lib || "";
                    return tName.toLowerCase().includes(phaseVal.toLowerCase());
                });
            }

            filteredTeams.forEach(t => {
                const idx = state.teams.indexOf(t);
                const tName = t.libequipe || t.libequ || t.libepr || t.lib || `Équipe ${idx + 1}`;
                const opt = document.createElement('option');
                opt.value = idx;
                opt.textContent = tName;
                elements.selectTeam.appendChild(opt);
            });

            if (filteredTeams.length > 0) {
                const validTeam = filteredTeams.find(t => {
                    let link = t.liendivision || t.liendiv || "";
                    return typeof link === 'string' && link.includes('D1');
                }) || filteredTeams[0];

                if (validTeam) {
                    elements.selectTeam.value = state.teams.indexOf(validTeam);
                    loadMatchdays(validTeam);
                }
            } else {
                elements.selectDay.innerHTML = '<option value="">Sélectionnez une journée</option>';
            }
        }

        elements.selectPhase.onchange = () => updateTeamDropdown(elements.selectPhase.value);

        elements.selectTeam.onchange = () => {
            const idx = elements.selectTeam.value;
            if (idx === "all") {
                const phaseVal = elements.selectPhase.value;
                let filteredTeams = state.teams;
                if (phaseVal !== "all") {
                    filteredTeams = state.teams.filter(t => {
                        const n = t.libequipe || t.libequ || t.libepr || t.lib || "";
                        return n.toLowerCase().includes(phaseVal.toLowerCase());
                    });
                }
                const validTeam = filteredTeams.find(t => {
                    let link = t.liendivision || t.liendiv || "";
                    return typeof link === 'string' && link.includes('D1');
                }) || filteredTeams[0];
                if (validTeam) loadMatchdays(validTeam);
            } else {
                loadMatchdays(state.teams[idx]);
            }
        };

        // Auto-select latest phase
        if (phases.size > 0) {
            const latestPhase = Array.from(phases).sort().reverse()[0];
            elements.selectPhase.value = latestPhase;
            updateTeamDropdown(latestPhase);
        } else {
            updateTeamDropdown("all");
        }
    } else {
        logDebug("Aucune clé 'equipe' dans la réponse API.", "error");
    }
}

// ===== CHARGEMENT DES JOURNÉES =====
async function loadMatchdays(team) {
    const teamName = team.libequipe || team.lib || team.libequ || "Équipe";
    logDebug(`Chargement des journées pour ${teamName}...`);

    let divisionLink = team.liendivision || team.liendiv || "";
    if (typeof divisionLink !== 'string') divisionLink = "";

    const linkParams = new URLSearchParams(divisionLink.includes('?') ? divisionLink.split('?')[1] : divisionLink);
    const divisionId = linkParams.get('D1') || '';
    const pouleId = linkParams.get('cx_poule') || '';

    const data = await fetchData('getMatches', { divisionId, pouleId });

    elements.selectDay.innerHTML = '<option value="">Sélectionnez une journée</option>';

    if (data && data.tour) {
        const roundsList = Array.isArray(data.tour) ? data.tour : [data.tour];

        // Ne garder que les tours joués (score non vide)
        const playedRounds = roundsList.filter(r => {
            let sA = typeof r.scorea === 'string' ? r.scorea.trim() : '';
            let sB = typeof r.scoreb === 'string' ? r.scoreb.trim() : '';
            return sA !== '' || sB !== '';
        });

        state.matchdays = playedRounds;
        logDebug(`${playedRounds.length} journées jouées trouvées.`);

        const seenRounds = new Set();
        playedRounds.forEach((round, idx) => {
            let d = (typeof round.dateprevue === 'string' ? round.dateprevue : '') ||
                (typeof round.datereelle === 'string' ? round.datereelle : '') || '';

            let tourExtracted = `Tour n°${idx + 1}`;
            const tourMatch = (typeof round.libelle === 'string' ? round.libelle : "").match(/tour n°\d+/i);
            if (tourMatch) tourExtracted = tourMatch[0];

            const key = `${tourExtracted}_${d}`;
            if (seenRounds.has(key)) return;
            seenRounds.add(key);

            const opt = document.createElement('option');
            opt.value = d || tourExtracted;
            opt.textContent = d ? `${tourExtracted} - ${d}` : tourExtracted;
            elements.selectDay.appendChild(opt);
        });

        // Sélection par défaut de la dernière journée
        if (playedRounds.length > 0) {
            const lastIdx = playedRounds.length - 1;
            const lastRound = playedRounds[lastIdx];
            let lastD = (typeof lastRound.dateprevue === 'string' ? lastRound.dateprevue : '') ||
                (typeof lastRound.datereelle === 'string' ? lastRound.datereelle : '') || '';
            let lastTour = `Tour n°${lastIdx + 1}`;
            const lastTm = (typeof lastRound.libelle === 'string' ? lastRound.libelle : "").match(/tour n°\d+/i);
            if (lastTm) lastTour = lastTm[0];
            elements.selectDay.value = lastD || lastTour;
        }
    } else {
        logDebug("Aucune journée trouvée dans la réponse API.", "error");
    }
}

// ===== GÉNÉRATION DES RÉSULTATS =====
async function generateResults() {
    const selectedDayVal = elements.selectDay.value;
    const selectedTeamIdx = elements.selectTeam.value;

    if (!selectedDayVal) return showToast('Veuillez sélectionner une journée.', true);

    elements.loader.style.display = 'block';
    logDebug('Génération des résultats...');
    elements.resultsGrid.innerHTML = '';
    state.results = [];

    let teamsToProcess = state.teams;
    if (selectedTeamIdx !== "all") {
        teamsToProcess = [state.teams[selectedTeamIdx]];
    }

    const promises = teamsToProcess.map(async (team) => {
        const teamName = team.libequipe || team.libequ || team.libepr || team.lib || "Équipe";

        let divisionLink = team.liendivision || team.liendiv || "";
        if (typeof divisionLink !== 'string') divisionLink = "";

        const categoryName = team.libdivision || team.libdiv || "Phase 2";

        const linkParams = new URLSearchParams(divisionLink.includes('?') ? divisionLink.split('?')[1] : divisionLink);
        const divisionId = linkParams.get('D1') || '';
        const pouleId = linkParams.get('cx_poule') || '';

        if (!divisionId || !pouleId) return;

        const data = await fetchData('getMatches', { divisionId, pouleId });

        if (data && data.tour) {
            const allMatchesInPoule = Array.isArray(data.tour) ? data.tour : [data.tour];

            const matchFound = allMatchesInPoule.find((r, idx) => {
                let d = getVal(r.dateprevue) || getVal(r.datereelle) || '';
                let tExt = `Tour n°${idx + 1}`;
                const tm = getVal(r.libelle).match(/tour n°\d+/i);
                if (tm) tExt = tm[0];
                let rVal = d || tExt;

                if (rVal !== selectedDayVal) return false;

                const eA = getVal(r.equa).toLowerCase();
                const eB = getVal(r.equb).toLowerCase();
                const currentTeamSearch = teamName.toLowerCase();

                return eA.includes(currentTeamSearch) || currentTeamSearch.includes(eA) ||
                    eB.includes(currentTeamSearch) || currentTeamSearch.includes(eB);
            });

            if (matchFound) {
                let dMatch = getVal(matchFound.dateprevue) || getVal(matchFound.datereelle) || 'N/A';
                let lienMatch = getVal(matchFound.lien);
                let sA = getVal(matchFound.scorea);
                let sB = getVal(matchFound.scoreb);

                let parseA = parseInt(sA);
                let parseB = parseInt(sB);
                if (isNaN(parseA)) parseA = 0;
                if (isNaN(parseB)) parseB = 0;

                // Ne pas afficher les matchs à venir (0-0 sans score réel)
                if (sA === '' && sB === '') return;

                const isHome = getVal(matchFound.equa).toLowerCase().includes(teamName.toLowerCase()) ||
                    teamName.toLowerCase().includes(getVal(matchFound.equa).toLowerCase());

                state.results.push({
                    teamName: teamName,
                    category: categoryName,
                    opponent: isHome ? getVal(matchFound.equb) : getVal(matchFound.equa),
                    score: parseA + ' - ' + parseB,
                    scoreA: parseA,
                    scoreB: parseB,
                    isHome: isHome,
                    date: dMatch,
                    detailLink: lienMatch,
                    divisionId: divisionId,
                    pouleId: pouleId
                });
            }
        }
    });

    await Promise.all(promises);
    elements.loader.style.display = 'none';
    logDebug(`Résultats chargés : ${state.results.length} rencontres.`);
    renderResults();
}

// ===== AFFICHAGE DES RÉSULTATS =====
function renderResults() {
    if (state.results.length === 0) {
        elements.resultsGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; opacity: 0.5; padding: 4rem;">Aucun match trouvé pour cette journée.</div>';
        return;
    }

    state.results.sort((a, b) => a.teamName.localeCompare(b.teamName));

    elements.resultsGrid.innerHTML = state.results.map((res, index) => {
        let statusClass = 'draw';
        let statusText = 'NUL';

        const myScore = res.isHome ? res.scoreA : res.scoreB;
        const opScore = res.isHome ? res.scoreB : res.scoreA;

        if (myScore > opScore) { statusClass = 'win'; statusText = 'VICTOIRE'; }
        else if (myScore < opScore) { statusClass = 'loss'; statusText = 'DÉFAITE'; }
        if (myScore === 0 && opScore === 0) { statusClass = 'draw'; statusText = 'À VENIR'; }

        return `
            <div class="result-card ${statusClass}" style="animation-delay: ${index * 0.1}s">
                <div class="card-header">
                    <span class="category">${res.category}</span>
                    <span class="status-badge status-${statusClass}">${statusText}</span>
                </div>
                <div class="team-name">${res.teamName}</div>
                <div class="match-info">
                    <div class="side team-a">${res.isHome ? res.teamName : res.opponent}</div>
                    <div class="score-display">
                        <span class="score-badge ${statusClass}">${res.score}</span>
                    </div>
                    <div class="side team-b">${res.isHome ? res.opponent : res.teamName}</div>
                </div>
                <div class="card-footer">
                    <span class="match-date"><i class="far fa-calendar-alt"></i> ${res.date}</span>
                    ${res.detailLink ? `<button class="secondary" style="padding: 0.4rem 0.8rem; font-size: 0.8rem;" onclick="showMatchDetails(${index})">Détails</button>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

// ===== DÉTAILS DU MATCH =====
async function showMatchDetails(index) {
    const res = state.results[index];
    if (!res || !res.detailLink) return showToast('Lien de détail manquant.', true);

    elements.loader.style.display = 'block';
    logDebug('Récupération des détails du match...');

    const linkParams = new URLSearchParams(res.detailLink.includes('?') ? res.detailLink.split('?')[1] : res.detailLink);
    const is_retour = linkParams.get('is_retour') || '0';
    const renc_id = linkParams.get('renc_id') || linkParams.get('res_id') || '';

    const data = await fetchData('getMatchDetails', { is_retour, renc_id });

    elements.loader.style.display = 'none';

    if (data && data.resultat) {
        renderPremiumExport(res, data);
    } else {
        showToast('Impossible de charger les détails de ce match.', true);
    }
}

// ===== EXPORT PREMIUM (LOGIQUE ORIGINALE COMPLÈTE) =====
function renderPremiumExport(res, details) {
    const p = details.resultat;
    const equipeA = p.equa || 'Equipe A';
    const equipeB = p.equb || 'Equipe B';

    // Scores : l'API detail renvoie resa/resb, on fallback sur le score de la liste
    let tmpScoreA = parseInt(p.resa);
    let tmpScoreB = parseInt(p.resb);
    let API_SCORE_A = isNaN(tmpScoreA) ? 0 : tmpScoreA;
    let API_SCORE_B = isNaN(tmpScoreB) ? 0 : tmpScoreB;

    const panel = elements.exportPanel;

    // ===== COMPOSITION DES ÉQUIPES =====
    let jouas = [];
    let joubs = [];
    const joueursArray = Array.isArray(details.joueur) ? details.joueur : (details.joueur ? [details.joueur] : []);

    let equipeAPoints = 0;
    let equipeBPoints = 0;

    function parseClassement(str) {
        if (!str) return { text: '', raw: 0 };
        let points = 0;
        let text = '';
        let natMatch = str.match(/(?:N°|N)\s*(\d+)/i);
        let natRank = natMatch ? natMatch[1] : null;
        let nums = [...str.matchAll(/\d+/g)].map(m => parseInt(m[0], 10));
        if (nums.length > 0) {
            if (natRank) {
                let c = nums.filter(n => n.toString() !== natRank);
                points = c.length > 0 ? c[c.length - 1] : 0;
            } else {
                points = nums[nums.length - 1];
            }
        }
        if (points) {
            text = points.toString();
            if (natRank) text = `(n°${natRank}) ` + text;
        } else if (natRank) {
            text = `(n°${natRank})`;
        }
        return { text, raw: points };
    }

    joueursArray.forEach(j => {
        let nA = (j.xja || '').replace(/\s*[MF]\s*$/, '').trim();
        let nB = (j.xjb || '').replace(/\s*[MF]\s*$/, '').trim();
        let pA = parseClassement(j.xca || '');
        let pB = parseClassement(j.xcb || '');

        let isCapA = nA.toLowerCase().includes(' cap') || j.xca === 'cap' || j.capa === '1';
        let isCapB = nB.toLowerCase().includes(' cap') || j.xcb === 'cap' || j.capb === '1';
        nA = nA.replace(/\s*cap(?:itaine)?\.?\s*$/i, '').trim();
        nB = nB.replace(/\s*cap(?:itaine)?\.?\s*$/i, '').trim();

        if (nA) jouas.push({ nom: nA, classement: pA.text || '', rawPoints: pA.raw, isCap: isCapA });
        if (nB) joubs.push({ nom: nB, classement: pB.text || '', rawPoints: pB.raw, isCap: isCapB });
    });

    // Fallback: extraire les joueurs des parties si joueur est vide
    if (jouas.length === 0 && joubs.length === 0) {
        const tempA = new Set();
        const tempB = new Set();
        const partiesFallback = Array.isArray(details.partie) ? details.partie : (details.partie ? [details.partie] : []);
        partiesFallback.forEach(m => {
            if (m.ja && m.ja.trim() && m.ja !== '-') tempA.add(m.ja.replace(/\s*[MF]\s*$/, '').trim());
            if (m.jb && m.jb.trim() && m.jb !== '-') tempB.add(m.jb.replace(/\s*[MF]\s*$/, '').trim());
        });
        jouas = Array.from(tempA).map(nom => ({ nom, classement: '', rawPoints: 0, isCap: false }));
        joubs = Array.from(tempB).map(nom => ({ nom, classement: '', rawPoints: 0, isCap: false }));
    }

    jouas.forEach(j => { equipeAPoints += j.rawPoints || 0; });
    joubs.forEach(j => { equipeBPoints += j.rawPoints || 0; });

    // ===== TABLE DE COMPOSITION =====
    let compoHTML = `
        <div class="section-title">La composition des équipes</div>
        <table class="premium-table">
            <thead><tr><th style="padding: 1rem;">${equipeA}</th><th style="padding: 1rem;">${equipeB}</th></tr></thead>
            <tbody>
    `;

    for (let i = 0; i < Math.max(jouas.length, joubs.length); i++) {
        let htmlA = '';
        if (jouas[i]) {
            let nomHTML = jouas[i].isCap ? `<b>${jouas[i].nom}</b>` : jouas[i].nom;
            htmlA = `<div style="display:flex; justify-content:space-between;"><span>${nomHTML}</span><span>${jouas[i].classement}</span></div>`;
        }
        let htmlB = '';
        if (joubs[i]) {
            let nomHTML = joubs[i].isCap ? `<b>${joubs[i].nom}</b>` : joubs[i].nom;
            htmlB = `<div style="display:flex; justify-content:space-between;"><span>${nomHTML}</span><span>${joubs[i].classement}</span></div>`;
        }
        compoHTML += `<tr><td>${htmlA}</td><td>${htmlB}</td></tr>`;
    }

    compoHTML += `
        <tr style="background: #f1f5f9; font-weight: 700; font-size: 0.85rem; color: #475569; text-align: center; text-transform: uppercase;">
            <td style="padding: 0.5rem 1rem;">TOTAL : ${equipeAPoints} pts</td>
            <td style="padding: 0.5rem 1rem;">TOTAL : ${equipeBPoints} pts</td>
        </tr>
    </tbody></table>`;

    // ===== FEUILLE DE RENCONTRE =====
    const parties = Array.isArray(details.partie) ? details.partie : (details.partie ? [details.partie] : []);

    function getPointsGained(ratingA, ratingB, wonA) {
        if (!ratingA || !ratingB) return 0;
        const diff = ratingA - ratingB;
        if (wonA) {
            if (diff >= 500) return 0.5; if (diff >= 400) return 1; if (diff >= 300) return 2;
            if (diff >= 200) return 3; if (diff >= 100) return 4; if (diff >= 0) return 5;
            if (diff >= -24) return 6; if (diff >= -49) return 7; if (diff >= -99) return 8;
            if (diff >= -149) return 10; if (diff >= -199) return 13; if (diff >= -249) return 17;
            if (diff >= -299) return 22; if (diff >= -399) return 28; return 40;
        } else {
            if (diff >= 400) return -40; if (diff >= 300) return -28; if (diff >= 250) return -22;
            if (diff >= 200) return -17; if (diff >= 150) return -13; if (diff >= 100) return -10;
            if (diff >= 50) return -8; if (diff >= 25) return -7; if (diff >= 0) return -6;
            if (diff >= -99) return -5; if (diff >= -199) return -4; if (diff >= -299) return -3;
            if (diff >= -399) return -2; if (diff >= -499) return -1; return -0.5;
        }
    }

    const clubStats = {};
    jouas.concat(joubs).forEach(j => {
        if (j.nom) clubStats[j.nom.trim()] = { ptsMatch: 0, doubleResult: '-' };
    });

    let totalSetsA = 0, totalSetsB = 0;
    let totalPointsA = 0, totalPointsB = 0;
    let partiesHTML = '';

    parties.forEach(m => {
        let jA = getVal(m.ja) || '-';
        let jB = getVal(m.jb) || '-';

        let sets = ['', '', '', '', ''];
        if (m.detail && typeof m.detail === 'string') {
            const s = m.detail.split(' ');
            for (let i = 0; i < Math.min(s.length, 5); i++) sets[i] = s[i];
        } else {
            sets[0] = getVal(m.ms1); sets[1] = getVal(m.ms2); sets[2] = getVal(m.ms3);
            sets[3] = getVal(m.ms4); sets[4] = getVal(m.ms5);
        }

        let setsWA = 0, setsWB = 0;
        let hasValidSets = false;
        sets.forEach(setStr => {
            if (!setStr) return;
            if (setStr.includes('-') && setStr.indexOf('-') > 0) {
                const parts = setStr.split('-');
                if (parts.length === 2) {
                    const p1 = parseInt(parts[0]), p2 = parseInt(parts[1]);
                    if (!isNaN(p1) && !isNaN(p2)) { if (p1 > p2) setsWA++; else if (p2 > p1) setsWB++; hasValidSets = true; }
                }
            } else {
                const val = parseInt(setStr);
                if (!isNaN(val)) { if (val < 0) setsWB++; else setsWA++; hasValidSets = true; }
            }
        });

        let strA = getVal(m.scorea);
        let strB = getVal(m.scoreb);
        let sA = parseInt(strA) || 0;
        let sB = parseInt(strB) || 0;

        let finalSA = hasValidSets ? setsWA : sA;
        let finalSB = hasValidSets ? setsWB : sB;

        totalSetsA += finalSA;
        totalSetsB += finalSB;

        const isWinForClub = res.isHome ? (finalSA > finalSB) : (finalSB > finalSA);

        let rowPoints = 0;
        if (jA && jB && jA !== '-' && jB !== '-' && !jA.toLowerCase().includes('double') && !jB.toLowerCase().includes('double')) {
            const playerA = jouas.find(p => p.nom === jA);
            const playerB = joubs.find(p => p.nom === jB);
            if (playerA && playerB && playerA.rawPoints && playerB.rawPoints) {
                let gainA = getPointsGained(playerA.rawPoints, playerB.rawPoints, finalSA > finalSB);
                let gainB = getPointsGained(playerB.rawPoints, playerA.rawPoints, finalSB > finalSA);
                totalPointsA += gainA;
                totalPointsB += gainB;
                if (res.isHome) { rowPoints = gainA; if (clubStats[jA]) clubStats[jA].ptsMatch += rowPoints; }
                else { rowPoints = gainB; if (clubStats[jB]) clubStats[jB].ptsMatch += rowPoints; }
            }
        } else if (jA.toLowerCase().includes('double') || (jA.includes(' et ') || jB.includes(' et '))) {
            [jA, jB].forEach((doubleStr, isB) => {
                doubleStr.split(/[\/\&]|( et )/).forEach(namePart => {
                    if (!namePart || namePart === ' et ') return;
                    const clean = namePart.trim();
                    const matched = Object.keys(clubStats).find(k => k.includes(clean) || clean.includes(k));
                    if (matched) clubStats[matched].doubleResult = (isB ? (finalSB > finalSA ? 'V' : 'D') : (finalSA > finalSB ? 'V' : 'D'));
                });
            });
        }

        const styleA = finalSA > finalSB ? 'font-weight: bold; color: #0f172a;' : '';
        const styleB = finalSB > finalSA ? 'font-weight: bold; color: #0f172a;' : '';

        partiesHTML += `
            <tr>
                <td style="${styleA}">${jA}</td>
                <td style="${styleB}">${jB}</td>
                <td class="col-set">${sets[0]}</td>
                <td class="col-set">${sets[1]}</td>
                <td class="col-set">${sets[2]}</td>
                <td class="col-set">${sets[3]}</td>
                <td class="col-set">${sets[4]}</td>
                <td class="col-score"><span class="${isWinForClub ? 'badge-win' : 'badge-loss'}">${finalSA}-${finalSB}</span></td>
                <td style="text-align: center; font-size: 0.75rem; font-weight: bold; color: ${rowPoints > 0 ? '#10b981' : (rowPoints < 0 ? '#ef4444' : '#64748b')}">
                    ${rowPoints > 0 ? '+' : ''}${rowPoints !== 0 ? rowPoints : ''}
                </td>
            </tr>
        `;
    });

    partiesHTML = `
        <div class="section-title">La feuille de rencontre</div>
        <table class="premium-table">
            <thead><tr>
                <th class="col-player">${equipeA}</th>
                <th class="col-player">${equipeB}</th>
                <th class="col-set">1</th><th class="col-set">2</th><th class="col-set">3</th><th class="col-set">4</th><th class="col-set">5</th>
                <th class="col-score">S.</th>
                <th style="width: 50px; text-align: center; font-size: 0.7rem;">+/-</th>
            </tr></thead>
            <tbody>${partiesHTML}</tbody>
        </table>`;

    // ===== STATISTIQUES INDIVIDUELLES =====
    // Seulement les joueurs du club (pas les adversaires)
    const ourPlayers = res.isHome ? jouas : joubs;
    const stats = {};
    ourPlayers.forEach(j => {
        if (j.nom) stats[j.nom.trim()] = { v: 0, d: 0 };
    });

    parties.forEach(m => {
        let ja = getVal(m.ja);
        let jb = getVal(m.jb);
        
        // Ignorer les doubles pour le comptage V/D individuel
        if ((ja && ja.includes(' et ')) || (jb && jb.includes(' et '))) return;
        
        // Déterminer le vainqueur via les sets (plus fiable que scorea/scoreb)
        let setsWonA = 0, setsWonB = 0;
        let sets = [];
        if (m.detail && typeof m.detail === 'string') {
            sets = m.detail.split(' ');
        } else {
            sets = [getVal(m.ms1), getVal(m.ms2), getVal(m.ms3), getVal(m.ms4), getVal(m.ms5)];
        }
        sets.forEach(s => {
            if (!s) return;
            const val = parseInt(s);
            if (!isNaN(val)) { if (val < 0) setsWonB++; else setsWonA++; }
        });
        
        // Fallback sur scorea/scoreb si pas de sets
        if (setsWonA === 0 && setsWonB === 0) {
            setsWonA = parseInt(getVal(m.scorea)) || 0;
            setsWonB = parseInt(getVal(m.scoreb)) || 0;
        }

        // Compter V/D uniquement pour nos joueurs
        if (res.isHome && ja) {
            let matched = Object.keys(stats).find(k => k === ja || k.includes(ja) || ja.includes(k));
            if (matched) { if (setsWonA > setsWonB) stats[matched].v++; else stats[matched].d++; }
        }
        if (!res.isHome && jb) {
            let matched = Object.keys(stats).find(k => k === jb || k.includes(jb) || jb.includes(k));
            if (matched) { if (setsWonB > setsWonA) stats[matched].v++; else stats[matched].d++; }
        }
    });

    let statsHTML = `
        <div class="section-title">Statistiques individuelles</div>
        <table class="premium-table">
            <thead><tr><th>Joueur</th><th>V</th><th>D</th><th>Points</th><th>Double</th></tr></thead>
            <tbody>
    `;
    Object.keys(stats).forEach(name => {
        const s = stats[name];
        const c = clubStats[name] || { ptsMatch: 0, doubleResult: '-' };
        statsHTML += `
            <tr>
                <td>${name}</td>
                <td>${s.v}</td>
                <td>${s.d}</td>
                <td style="font-weight: bold; color: ${c.ptsMatch > 0 ? '#10b981' : (c.ptsMatch < 0 ? '#ef4444' : '#64748b')}">
                    ${c.ptsMatch > 0 ? '+' : ''}${c.ptsMatch.toFixed(1)}
                </td>
                <td style="font-weight: bold; color: ${c.doubleResult === 'V' ? '#10b981' : (c.doubleResult === 'D' ? '#ef4444' : '#64748b')}">
                    ${c.doubleResult}
                </td>
            </tr>
        `;
    });
    statsHTML += '</tbody></table>';

    // ===== SCOREBOARD =====
    let finalTeamScoreA = res.scoreA || API_SCORE_A;
    let finalTeamScoreB = res.scoreB || API_SCORE_B;

    let outcomeA = 2, outcomeB = 2;
    if (finalTeamScoreA > finalTeamScoreB) { outcomeA = 3; outcomeB = 1; }
    else if (finalTeamScoreA < finalTeamScoreB) { outcomeA = 1; outcomeB = 3; }

    const scoreboardHTML = `
        <div class="premium-scoreboard" style="align-items: center;">
            <div class="score-digit-box digit-red" style="width: 40px; height: 56px; font-size: 2rem;">${outcomeA}</div>
            <div class="score-digit-box digit-black" style="width: auto; min-width: 70px; padding: 0 10px;">${finalTeamScoreA}</div>
            <div class="score-divider"></div>
            <div class="score-digit-box digit-black" style="width: auto; min-width: 70px; padding: 0 10px;">${finalTeamScoreB}</div>
            <div class="score-digit-box digit-red" style="width: 40px; height: 56px; font-size: 2rem;">${outcomeB}</div>
        </div>
    `;

    // ===== ASSEMBLAGE FINAL =====
    panel.innerHTML = `
        <div style="display: flex; gap: 0.75rem; justify-content: flex-end; margin-bottom: 1.5rem;">
            <button onclick="copyHTMLForWordPress()" style="padding: 0.6rem 1.25rem; border-radius: 8px; background: #e63946; color: white; border: none; cursor: pointer; font-weight: bold; box-shadow: none; font-size: 0.9rem;">📄 Copier HTML (WP)</button>
            <button onclick="document.getElementById('export-container').style.display='none'" style="padding: 0.6rem 1.25rem; border-radius: 8px; background: #e2e8f0; color: #475569; border: none; cursor: pointer; font-weight: bold; box-shadow: none; font-size: 0.9rem;">✕ Fermer</button>
        </div>
        <div class="export-header">
            <div class="export-title">${equipeA} –<br>${equipeB}</div>
            <div class="export-subtitle">${res.category}</div>
            ${scoreboardHTML}
        </div>
        ${compoHTML}
        ${partiesHTML}
        <div style="font-size: 0.9rem; margin-top: -1.5rem; margin-bottom: 2rem; color: #64748b; font-style: italic; text-align: right;">
            <span style="margin-right: 1.5rem;">Les points : ${totalPointsA.toFixed(1)} / ${totalPointsB.toFixed(1)}</span>
            Les manches : ${totalSetsA} - ${totalSetsB}
        </div>
        ${statsHTML}
        <div id="league-ranking-container"></div>
        <div class="summary-footer">
            Bilan du match : ${finalTeamScoreA > finalTeamScoreB ? 'Victoire de ' + equipeA : (finalTeamScoreA < finalTeamScoreB ? 'Victoire de ' + equipeB : 'Match nul')}
        </div>
    `;

    // Classement de la poule en arrière-plan
    if (res.divisionId && res.pouleId) {
        fetchData('getClassement', { divisionId: res.divisionId, pouleId: res.pouleId }).then(data => {
            if (data && data.classement) {
                const list = Array.isArray(data.classement) ? data.classement : [data.classement];
                const myEntry = list.find(e => e.equipe && e.equipe.toLowerCase().includes(res.teamName.toLowerCase()));
                if (myEntry) {
                    const rankDiv = document.getElementById('league-ranking-container');
                    if (rankDiv) {
                        rankDiv.innerHTML = `
                            <div class="section-title">Bilan de la poule</div>
                            <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.5rem; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
                                <div>
                                    <div style="font-size: 0.75rem; color: #64748b; text-transform: uppercase; font-weight: 700;">Classement Actuel</div>
                                    <div style="font-size: 1.5rem; font-weight: 800; color: #1e293b;">${myEntry.rang}<sup>${myEntry.rang == 1 ? 'er' : 'ème'}</sup> / ${list.length}</div>
                                </div>
                                <div style="text-align: right;">
                                    <div style="font-size: 0.75rem; color: #64748b; text-transform: uppercase; font-weight: 700;">Bilan Saison</div>
                                    <div style="font-size: 1.1rem; color: #334155; font-weight: 600;">
                                        <span style="color: #10b981;">${myEntry.vic}V</span> - 
                                        <span style="color: #64748b;">${myEntry.nul}N</span> - 
                                        <span style="color: #ef4444;">${myEntry.def}D</span>
                                    </div>
                                </div>
                            </div>
                        `;
                    }
                }
            }
        });
    }

    // Afficher le panneau
    const exportContainer = elements.exportContainer;
    exportContainer.style.cssText = "display: block; position: fixed; left: 0; top: 0; width: 100%; height: 100%; z-index: 5000; background: rgba(0,0,0,0.8); overflow-y: auto; padding: 40px 20px;";
    panel.style.cssText = "display: block; margin: 0 auto; background: white; max-width: 1000px; padding: 40px; border-radius: 12px; position: relative;";
}

// ===== CLIPBOARD =====
function copyHTMLForWordPress() {
    const html = elements.exportPanel.cloneNode(true);
    html.querySelector('.export-actions')?.remove();
    const wrapper = `<div class="ttcav-export-wrapper" style="background:#fff;padding:30px;max-width:800px;margin:auto;">${html.innerHTML}</div>`;
    navigator.clipboard.writeText(wrapper).then(() => showToast('HTML copié !'));
}

function getWordPressCSS() {
    return `@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;800&display=swap');
.ttcav-export-wrapper { font-family:'Outfit',sans-serif; color:#1e293b; }
.export-header { text-align:center; margin-bottom:2rem; }
.premium-scoreboard { display:flex; justify-content:center; gap:10px; background:#0f172a; padding:20px; border-radius:12px; color:#fff; }
.score-digit-box { background:#fff; color:#000; width:40px; height:50px; display:flex; align-items:center; justify-content:center; font-size:1.8rem; font-weight:800; border-radius:6px; }
.premium-table { width:100%; border-collapse:collapse; margin-bottom:2rem; }
.premium-table th { background:#f1f5f9; padding:0.75rem; border:1px solid #e2e8f0; }
.premium-table td { padding:0.75rem; border:1px solid #e2e8f0; }
.badge-win { background:#dcfce7; color:#166534; padding:2px 8px; border-radius:4px; }
.badge-loss { background:#fee2e2; color:#991b1b; padding:2px 8px; border-radius:4px; }`;
}

// ===== AUTO-INIT =====
if (state.appId && state.appKey && state.clubId) {
    loadTeams();
} else {
    elements.resultsGrid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 4rem 2rem;">
            <i class="fas fa-cog" style="font-size: 3rem; color: var(--primary); margin-bottom: 1.5rem; display: block;"></i>
            <h3 style="margin-bottom: 0.75rem; color: var(--text);">Configuration requise</h3>
            <p style="color: var(--text-muted); margin-bottom: 1.5rem;">Veuillez renseigner vos identifiants API FFTT (App ID, App Key et N° de club) dans les paramètres pour commencer.</p>
            <button onclick="document.getElementById('modal-settings').style.display='flex'" style="padding: 0.75rem 1.5rem; border-radius: 12px; background: var(--primary); color: white; border: none; cursor: pointer; font-weight: 600; font-size: 1rem;">
                <i class="fas fa-cog"></i> Ouvrir la configuration
            </button>
        </div>
    `;
}
