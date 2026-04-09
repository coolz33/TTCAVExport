/**
 * TTCAV Export - Script Principal
 * Logique métier restaurée depuis la version fonctionnelle.
 */

const state = {
    appId: localStorage.getItem('fftt_appId') || '',
    appKey: localStorage.getItem('fftt_appKey') || '',
    clubId: localStorage.getItem('fftt_clubId') || '',
    groqKey: localStorage.getItem('groq_key') || '',
    groqModel: localStorage.getItem('groq_model') || 'llama-3.3-70b-versatile',
    teams: [],
    matchdays: [],
    results: [],
    matchDataRegistry: {}, // Pour stocker les données de chaque match (clé = matchID)
    aiSummaries: {},       // Cache local des résumés générés
    giantHTMLRaw: '',     // Version brute de l'export WP avec commentaires
    currentMatchData: null // Compatibilité ancienne vers.
};

// ===== UI ELEMENTS =====
const elements = {
    selectPhase: document.getElementById('select-phase'),
    selectTeam: document.getElementById('select-team'),
    selectDay: document.getElementById('select-day'),
    resultsGrid: document.getElementById('results-grid'),
    loader: document.getElementById('loader'),
    loaderText: document.getElementById('loader-text'),
    exportContainer: document.getElementById('export-container'),
    exportPanel: document.getElementById('export-panel'),
    modalSettings: document.getElementById('modal-settings'),
    debugConsole: document.getElementById('debug-console'),
    debugLog: document.getElementById('debug-log'),
    toast: document.getElementById('toast'),
    toastMessage: document.getElementById('toast-message'),
    btnCopyAll: document.getElementById('btn-copy-all')
};

// ===== INIT INPUTS =====
const safeSetVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
};
safeSetVal('input-app-id', state.appId);
safeSetVal('input-app-key', state.appKey);
safeSetVal('input-club-id', state.clubId);
safeSetVal('input-groq-key', state.groqKey);
safeSetVal('select-groq-model', state.groqModel);

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
document.getElementById('btn-refresh-top').onclick = () => loadTeams(true);
document.getElementById('btn-generate').onclick = () => generateResults();
document.getElementById('btn-copy-all').onclick = () => copyAllMatchesToWordPress();

const btnCopyCSS = document.getElementById('btn-copy-css');
if (btnCopyCSS) {
    btnCopyCSS.onclick = () => {
        navigator.clipboard.writeText(getWordPressCSS()).then(() => showToast('CSS copié !'));
    };
}

document.getElementById('save-settings').onclick = () => {
    state.appId = document.getElementById('input-app-id').value;
    state.appKey = document.getElementById('input-app-key').value;
    state.clubId = document.getElementById('input-club-id').value;
    state.groqKey = document.getElementById('input-groq-key').value;
    state.groqModel = document.getElementById('select-groq-model').value;

    localStorage.setItem('fftt_appId', state.appId);
    localStorage.setItem('fftt_appKey', state.appKey);
    localStorage.setItem('fftt_clubId', state.clubId);
    localStorage.setItem('groq_key', state.groqKey);
    localStorage.setItem('groq_model', state.groqModel);

    if (debugCheckbox) {
        localStorage.setItem('fftt_showDebug', debugCheckbox.checked);
        elements.debugConsole.style.display = debugCheckbox.checked ? 'block' : 'none';
    }

    elements.modalSettings.style.display = 'none';
    showToast('Configuration enregistrée !');
    loadTeams();
};

document.getElementById('btn-do-clear-cache').onclick = async () => {
    const clearResults = document.getElementById('clear-results-check').checked;
    const clearSummaries = document.getElementById('clear-summaries-check').checked;

    if (!clearResults && !clearSummaries) {
        return showToast('Veuillez sélectionner au moins une option.', true);
    }

    if (!confirm('Confirmer le nettoyage du cache ? Cette action est irréversible.')) return;

    let type = 'all';
    if (clearResults && !clearSummaries) type = 'results';
    if (!clearResults && clearSummaries) type = 'summaries';

    setAppBusy(true);
    updateLoaderStep('Nettoyage du cache...');

    try {
        const data = await fetchData('clearCache', { type });
        if (data && data.success) {
            showToast('Cache nettoyé avec succès !');
            if (clearResults) {
                state.matchdays = [];
                state.results = [];
                state.matchDataRegistry = {};
                loadTeams(true);
            }
            if (clearSummaries) {
                state.aiSummaries = {};
            }
        } else {
            showToast('Erreur lors du nettoyage du cache.', true);
        }
    } catch(e) {
        showToast('Erreur réseau lors du nettoyage.', true);
    } finally {
        setAppBusy(false);
    }
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

function setAppBusy(busy) {
    const selectors = 'button, select, input';
    document.querySelectorAll(selectors).forEach(el => {
        if (busy) {
            el.disabled = true;
            el.style.opacity = '0.5';
            el.style.cursor = 'not-allowed';
        } else {
            el.disabled = false;
            el.style.opacity = '1';
            el.style.cursor = 'pointer';
        }
    });
    if (elements.loader) {
        elements.loader.style.display = busy ? 'block' : 'none';
    }
}

function updateLoaderStep(text) {
    if (elements.loaderText) {
        elements.loaderText.innerHTML = `<div style="display:flex; flex-direction:column; align-items:center; gap:10px;">
            <div style="font-weight: 600;">${text}</div>
        </div>`;
    }
}

function getVal(v) {
    return typeof v === 'string' ? v.trim() : '';
}

function cleanTeamName(name) {
    if (!name) return "";
    let n = getVal(name).toUpperCase();
    
    // Détection spécifique du club TTCAV (Villefranche)
    if (n.includes("VILLEFR") || n.includes("VILLFR") || n.includes("TTCAV")) {
        const numMatch = n.match(/\d+/);
        const num = numMatch ? numMatch[0] : "";
        // On remplace le nom complet par TTCAV + numéro + Villefranche, sans la Phase
        return `TTCAV ${num} (Villefranche)`.trim();
    }
    
    // Pour les autres clubs : Retrait de "Phase X" et Titrisation
    n = n.replace(/PHASE\s*\d+/gi, '').trim();
    return n.toLowerCase().split(' ').map(s => {
        if (/^\d+$/.test(s)) return s;
        return s.charAt(0).toUpperCase() + s.substring(1);
    }).join(' ');
}

function cleanDivisionName(name) {
    if (!name) return "";
    let n = getVal(name).toUpperCase();
    
    // Nettoyage agressif des formats DEPARTEMENTALE_3_PHASE2 ou L01_PRE NATIONALE
    n = n.replace(/^[A-Z]\d{2}_/g, ''); // L01_
    n = n.replace(/PHASE\s*\d+/gi, ''); // PHASE2
    n = n.replace(/Ph\d+/gi, '');       // Ph2
    n = n.replace(/_/g, ' ');           // Remplacer underscores par espaces
    
    n = n.replace(/PRE\s+NATIONALE/gi, 'Pré Nationale');
    n = n.replace(/REGIONALE\s+(\d+)/gi, 'Régionale $1');
    n = n.replace(/DEPARTEMENTALE\s+(\d+)/gi, 'Départementale $1');
    n = n.replace(/PRE\s+REGIONALE/gi, 'Pré Régionale');
    n = n.replace(/Mess\s+AURA/gi, '');
    
    n = n.replace(/\s{2,}/g, ' ').trim();

    // Remplacer Poule par – Poule si nécessaire
    if (n.includes('POULE') && !n.includes('–')) {
        n = n.replace(/POULE/gi, '– Poule');
    }
    
    return n;
}

// ===== API =====
async function fetchData(action, extraParams = {}, forceRefresh = false, postData = null) {
    const params = new URLSearchParams({
        appId: state.appId,
        appKey: state.appKey,
        serial: state.serial,
        clubId: state.clubId,
        action: action,
        ...extraParams
    });

    if (forceRefresh) params.append('refresh', '1');

    const options = {
        method: postData ? 'POST' : 'GET',
    };

    if (postData) {
        options.body = new URLSearchParams({ text: postData });
        options.headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    }

    try {
        logDebug(`API Request: ${action}`);
        const response = await fetch(`api.php?${params.toString()}`, options);
        const text = await response.text();
        
        let data;
        try {
            data = JSON.parse(text);
        } catch (parseError) {
            logDebug(`Erreur parsing JSON sur ${action}: ${parseError.message}`, 'error');
            logDebug(`Début de la réponse reçue : ${text.substring(0, 300)}`, 'error');
            return { error: 'Erreur format réponse', message: 'La réponse du serveur n\'est pas au format JSON valide.' };
        }

        if (data.error) {
            const msg = data.message ? `${data.error} : ${data.message}` : data.error;
            // Ne pas logger en erreur si c'est juste un résumé non trouvé (normal au début)
            if (action !== 'getSummary') logDebug(msg, 'error');
        }
        return data;
    } catch (e) {
        logDebug(`Erreur réseau : ${e.message}`, 'error');
        return { error: 'Erreur réseau' };
    }
}

// ===== CHARGEMENT DES ÉQUIPES =====
async function loadTeams(forceRefresh = false) {
    if (!state.clubId) return showToast('Veuillez configurer votre numéro de club.', true);

    setAppBusy(true);
    updateLoaderStep('Récupération de la liste des équipes...');
    logDebug('Requête des équipes...');

    try {
        if (elements.resultsGrid) {
            elements.resultsGrid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 4rem; opacity: 0.5;">
                    <i class="fas fa-hand-pointer" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i>
                    Sélectionnez une équipe et une journée pour afficher les résultats.
                </div>
            `;
        }
        const data = await fetchData('getTeams', {}, forceRefresh);

        if (data && data.equipe) {
            state.teams = Array.isArray(data.equipe) ? data.equipe : [data.equipe];
            logDebug(`${state.teams.length} équipes chargées.`);

            // Extract phases
            const phases = new Set();
            state.teams.forEach(t => {
                if (!t) return;
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

            const updateTeamDropdown = async (phaseVal) => {
                elements.selectTeam.innerHTML = '<option value="all">Toutes les équipes</option>';
                let filteredTeams = state.teams;

                if (phaseVal !== "all") {
                    filteredTeams = state.teams.filter(t => {
                        if (!t) return false;
                        const tName = t.libequipe || t.libequ || t.libepr || t.lib || "";
                        return tName.toLowerCase().includes(phaseVal.toLowerCase());
                    });
                }

                // Tri numérique par numéro d'équipe
                filteredTeams.sort((a, b) => {
                    const na = (a && (a.libequipe || a.libequ)) || "";
                    const nb = (b && (b.libequipe || b.libequ)) || "";
                    const numA = parseInt(na.match(/\d+/) || 0);
                    const numB = parseInt(nb.match(/\d+/) || 0);
                    return numA - numB;
                });

                const seen = new Set();
                filteredTeams.forEach(t => {
                    if (!t) return;
                    const idx = state.teams.indexOf(t);
                    const tRaw = t.libequipe || t.libequ || t.libepr || t.lib || `Équipe ${idx + 1}`;
                    const tName = cleanTeamName(tRaw);
                    
                    if (!tName.includes('TTCAV') || seen.has(tName)) return;
                    seen.add(tName);
                    
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
                        elements.selectTeam.value = "all";
                        await loadMatchdays(validTeam, forceRefresh);
                    }
                } else {
                    elements.selectDay.innerHTML = '<option value="">Sélectionnez une journée</option>';
                }
            };

            elements.selectPhase.onchange = async () => {
                setAppBusy(true);
                try {
                    await updateTeamDropdown(elements.selectPhase.value);
                } finally {
                    setAppBusy(false);
                }
            };

            elements.selectTeam.onchange = async () => {
                const idx = elements.selectTeam.value;
                setAppBusy(true);
                try {
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
                        if (validTeam) await loadMatchdays(validTeam, forceRefresh);
                    } else {
                        await loadMatchdays(state.teams[idx], forceRefresh);
                    }
                } finally {
                    setAppBusy(false);
                }
            };

            // Auto-select latest phase
            if (phases.size > 0) {
                const latestPhase = Array.from(phases).sort().reverse()[0];
                elements.selectPhase.value = latestPhase;
                await updateTeamDropdown(latestPhase);
            } else {
                await updateTeamDropdown("all");
            }
        } else {
            const errorMsg = data.message || data.error || "Aucune équipe trouvée.";
            logDebug(errorMsg, "error");
            showToast(errorMsg, true);
        }
    } catch (err) {
        logDebug(`Erreur fatale loadTeams: ${err.message}`, 'error');
        showToast('Erreur de chargement des équipes.', true);
    } finally {
        setAppBusy(false);
    }
}

// ===== CHARGEMENT DES JOURNÉES =====
async function loadMatchdays(team, forceRefresh = false) {
    const teamName = team.libequipe || team.lib || team.libequ || "Équipe";
    updateLoaderStep(`Récupération des journées : ${teamName}...`);
    logDebug(`Chargement des journées pour ${teamName}...`);

    let divisionId = '';
    let pouleId = '';

    try {
        let divisionLink = team.liendivision || team.liendiv || "";
        if (typeof divisionLink !== 'string') divisionLink = "";

        const linkParams = new URLSearchParams(divisionLink.includes('?') ? divisionLink.split('?')[1] : divisionLink);
        divisionId = linkParams.get('D1') || '';
        pouleId = linkParams.get('cx_poule') || '';

        const data = await fetchData('getMatches', { divisionId, pouleId }, forceRefresh);

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
                const tourMatch = getVal(round.libelle).match(/tour n°\d+/i);
                if (tourMatch) tourExtracted = tourMatch[0];
                
                const key = tourExtracted.toLowerCase().trim();
                if (seenRounds.has(key)) return;
                seenRounds.add(key);

                const opt = document.createElement('option');
                opt.value = key;
                opt.textContent = d ? `${tourExtracted} - ${d}` : tourExtracted;
                elements.selectDay.appendChild(opt);
            });

            // Sélection par défaut de la dernière journée
            if (playedRounds.length > 0) {
                const lastRound = playedRounds[playedRounds.length - 1];
                const lastTm = getVal(lastRound.libelle).match(/tour n°\d+/i);
                const lastKey = lastTm ? lastTm[0].toLowerCase().trim() : `tour n°${playedRounds.length}`;
                elements.selectDay.value = lastKey;
            }
        } else {
            logDebug("Aucune journée trouvée dans la réponse API.", "error");
        }
    } catch (err) {
        logDebug(`Erreur loadMatchdays: ${err.message}`, 'error');
    }
}

// ===== GÉNÉRATION DES RÉSULTATS =====
async function generateResults() {
    const selectedDayVal = elements.selectDay.value;
    const selectedTeamIdx = elements.selectTeam.value;

    if (!selectedDayVal) return showToast('Veuillez sélectionner une journée.', true);

    setAppBusy(true);
    updateLoaderStep('Analyse des rencontres en cours...');
    logDebug('Génération des résultats...');
    
    try {
        elements.resultsGrid.innerHTML = '';
        state.results = [];
        if (elements.btnCopyAll) elements.btnCopyAll.disabled = true;

        let teamsToProcess = state.teams;
        const selectedPhase = elements.selectPhase.value;
        
        if (selectedTeamIdx !== "all") {
            teamsToProcess = [state.teams[selectedTeamIdx]];
        } else {
            if (selectedPhase !== "all") {
                teamsToProcess = state.teams.filter(t => {
                    if (!t) return false;
                    const tName = t.libequipe || t.libequ || t.libepr || t.lib || "";
                    return tName.toLowerCase().includes(selectedPhase.toLowerCase());
                });
            }
        }

        const promises = teamsToProcess.map(async (team) => {
            if (!team) return;
            const teamName = team.libequipe || team.libequ || team.libepr || team.lib || "Équipe";
            const isPhase2 = (selectedPhase !== "all") ? selectedPhase.toLowerCase().includes("phase 2") : teamName.toLowerCase().includes("phase 2");

            let divisionLink = team.liendivision || team.liendiv || "";
            if (typeof divisionLink !== 'string') divisionLink = "";

            const categoryName = team.libdivision || team.libdiv || (isPhase2 ? "Phase 2" : "Phase 1");

            const linkParams = new URLSearchParams(divisionLink.includes('?') ? divisionLink.split('?')[1] : divisionLink);
            const divisionId = linkParams.get('D1') || '';
            const pouleId = linkParams.get('cx_poule') || '';

            if (!divisionId || !pouleId) return;

            const data = await fetchData('getMatches', { divisionId, pouleId });

            if (data && data.tour) {
                const allMatchesInPoule = Array.isArray(data.tour) ? data.tour : [data.tour];

                const matchFound = allMatchesInPoule.find((r, idx) => {
                    let tExt = `tour n°${idx + 1}`;
                    const tm = getVal(r.libelle).match(/tour n°\d+/i);
                    if (tm) tExt = tm[0].toLowerCase().trim();
                    
                    if (tExt !== selectedDayVal) return false;

                    let d = getVal(r.dateprevue) || getVal(r.datereelle) || '';
                    if (d) {
                        const month = parseInt(d.split('/')[1]);
                        const isJanJuly = (month >= 1 && month <= 7);
                        if (isPhase2 && !isJanJuly) return false;
                        if (!isPhase2 && isJanJuly) return false;
                    }

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

                    if (sA === '' && sB === '') return;

                    const isHome = getVal(matchFound.equa).toLowerCase().includes(teamName.toLowerCase()) ||
                        teamName.toLowerCase().includes(getVal(matchFound.equa).toLowerCase());

                    state.results.push({
                        teamName: cleanTeamName(teamName),
                        category: cleanDivisionName(categoryName),
                        opponent: cleanTeamName(isHome ? getVal(matchFound.equb) : getVal(matchFound.equa)),
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
        logDebug(`Résultats chargés : ${state.results.length} rencontres.`);
        renderResults();
    } catch (err) {
        logDebug(`Erreur generateResults: ${err.message}`, 'error');
        showToast('Erreur lors de la génération des résultats.', true);
    } finally {
        setAppBusy(false);
    }
}

if (elements.btnCopyAll) elements.btnCopyAll.disabled = true;

// ===== AFFICHAGE DES RÉSULTATS =====
function renderResults() {
    const hasResults = state.results.length > 0;
    if (elements.btnCopyAll) elements.btnCopyAll.disabled = !hasResults;

    if (!hasResults) {
        elements.resultsGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; opacity: 0.5; padding: 4rem;">Aucun match trouvé pour cette journée.</div>';
        return;
    }

    // Tri numérique par numéro d'équipe
    state.results.sort((a, b) => {
        const numA = parseInt(a.teamName.match(/\d+/) || 0);
        const numB = parseInt(b.teamName.match(/\d+/) || 0);
        return numA - numB;
    });

    elements.resultsGrid.innerHTML = state.results.map((res, index) => {
        let statusClass = 'draw';
        let statusText = 'NUL';

        const myScore = res.isHome ? res.scoreA : res.scoreB;
        const opScore = res.isHome ? res.scoreB : res.scoreA;

        if (myScore > opScore) { statusClass = 'win'; statusText = 'VICTOIRE'; }
        else if (myScore < opScore) { statusClass = 'loss'; statusText = 'DÉFAITE'; }
        if (myScore === 0 && opScore === 0) { statusClass = 'draw'; statusText = 'À VENIR'; }

        return `
            <div class="result-card ${statusClass}" style="animation-delay: ${index * 0.1}s; padding: 1rem 1.2rem 0.8rem 1.2rem;">
                <div class="card-header" style="margin-bottom: 0.4rem; border-bottom: none; padding-bottom: 0;">
                    <span class="category" style="font-weight: 700; font-size: 0.75rem; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.5px;">${res.category}</span>
                    <span class="status-badge status-${statusClass}" style="font-size: 0.6rem; padding: 1px 6px;">${statusText}</span>
                </div>
                <div class="match-info" style="margin: 0.3rem 0; display: flex; align-items: center; gap: 10px;">
                    <div class="side team-a" style="font-size: 0.9rem; font-weight: 600; text-align: right; flex: 1;">${res.isHome ? res.teamName : res.opponent}</div>
                    <div class="score-display">
                        <span class="score-badge ${statusClass}" style="padding: 4px 10px; font-size: 1rem; font-weight: 800; border-radius: 6px; background: rgba(255,255,255,0.1); border: none;">${res.score}</span>
                    </div>
                    <div class="side team-b" style="font-size: 0.9rem; font-weight: 600; text-align: left; flex: 1;">${res.isHome ? res.opponent : res.teamName}</div>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.2rem; padding-top: 0.4rem;">
                    <span class="match-date" style="font-size: 0.7rem; opacity: 0.5;"><i class="far fa-calendar-alt"></i> ${res.date}</span>
                    ${res.detailLink ? `<button class="secondary" style="padding: 3px 10px; font-size: 0.7rem; height: auto;" onclick="showMatchDetails(${index})">Détails</button>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

// ===== DÉTAILS DU MATCH =====
async function showMatchDetails(index) {
    const res = state.results[index];
    if (!res || !res.detailLink) return showToast('Lien de détail manquant.', true);

    setAppBusy(true);
    updateLoaderStep(`Chargement des détails : ${res.teamName}...`);
    logDebug('Récupération des détails du match...');

    try {
        const linkParams = new URLSearchParams(res.detailLink.includes('?') ? res.detailLink.split('?')[1] : res.detailLink);
        const is_retour = linkParams.get('is_retour') || '0';
        const renc_id = linkParams.get('renc_id') || linkParams.get('res_id') || '';

        const data = await fetchData('getMatchDetails', { is_retour, renc_id });
        let rankingData = null;
        if (res.divisionId && res.pouleId) {
            rankingData = await fetchData('getClassement', { divisionId: res.divisionId, pouleId: res.pouleId });
        }

        if (data && data.resultat) {
            const p = data.resultat;
            const matchID = 'match-' + res.teamName.replace(/\s/g, '-') + '-' + (res.category || '').replace(/\s/g, '-');
            
            elements.exportPanel.innerHTML = `
                <div class="export-actions" style="display: flex; gap: 0.75rem; justify-content: flex-end; margin-bottom: 1.5rem; background: #1e293b; padding: 1rem; border-radius: 8px;">
                    <button onclick="copyWPHTMLToClipboard()" style="background: #eab308; color: white; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; font-weight: 700;">📋 Copier HTML (Gutenberg)</button>
                    <button onclick="document.getElementById('export-container').style.display='none'" style="background: #e2e8f0; color: #475569; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer;">✕ Fermer</button>
                </div>
                ${getMatchDetailsHTML(res, data, false, rankingData)}
            `;
            // On prépare aussi la version brute pour le bouton copier
            state.giantHTMLRaw = getMatchDetailsHTML(res, data, true, rankingData);
            // Affichage identique à l'ancienne version fonctionnelle
            elements.exportContainer.style.cssText = "display: block; position: fixed; left: 0; top: 0; width: 100%; height: 100%; z-index: 5000; background: rgba(0,0,0,0.8); overflow-y: auto; padding: 40px 20px;";
            elements.exportPanel.style.cssText = "display: block; margin: 0 auto; background: white; max-width: 1000px; padding: 40px; border-radius: 12px; position: relative;";
            
            // Trigger AI summary automatically
            setTimeout(() => {
                generateAISummaryClickHandler(matchID);
            }, 300);
        } else {
            showToast('Impossible de charger les détails de ce match.', true);
        }
    } catch (err) {
        logDebug(`Erreur showMatchDetails: ${err.message}`, 'error');
        console.error(err);
        showToast(`Erreur : ${err.message}`, true);
    } finally {
        setAppBusy(false);
    }
}

// ===== GENERATION HTML DETAIL =====
function getMatchDetailsHTML(res, details, isBatch = false, rankingData = null) {
    try {
        const p = details.resultat;
        if (!p) throw new Error("Données de match absentes (resultat manquant)");

        const phaseVal = elements.selectPhase.value;
        const currentPhaseText = phaseVal === 'all' ? 'Saison' : phaseVal;
        const summaryLabel = `Bilan ${currentPhaseText}`;

        const equipeA = p.equa || 'Equipe A';
        const equipeB = p.equb || 'Equipe B';

    // Scores : l'API detail renvoie resa/resb, on fallback sur le score de la liste
    let tmpScoreA = parseInt(p.resa);
    let tmpScoreB = parseInt(p.resb);
    let API_SCORE_A = isNaN(tmpScoreA) ? 0 : tmpScoreA;
    let API_SCORE_B = isNaN(tmpScoreB) ? 0 : tmpScoreB;

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
        compoHTML += `<tr><td class="col-player">${htmlA}</td><td class="col-player">${htmlB}</td></tr>`;
    }

    compoHTML += `
        <tr class="compo-total-row" style="background: #f1f5f9; font-weight: 700; font-size: 0.85rem; color: #475569; text-align: center; text-transform: uppercase;">
            <td style="padding: 0.5rem 1rem;">TOTAL POINTS EQUIPE : ${equipeAPoints}</td>
            <td style="padding: 0.5rem 1rem;">TOTAL POINTS EQUIPE : ${equipeBPoints}</td>
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
        let jA = (getVal(m.ja) || '-').replace(/\s+(?:et|&)\s+/gi, ' / ');
        let jB = (getVal(m.jb) || '-').replace(/\s+(?:et|&)\s+/gi, ' / ');

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

        // NEW SCORING LOGIC ACCUMULATION
        let pointsSummaryA = 0;
        let pointsSummaryB = 0;

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
                if (isNaN(val)) return;

                if (val > 0) { // Team A wins set (input is Team B's points, e.g. 8 for 11-8)
                    pointsSummaryA += (val < 10) ? 11 : (val + 2);
                    pointsSummaryB += val;
                } else if (val < 0) { // Team B wins set (input is -8 for 8-11)
                    const absVal = Math.abs(val);
                    pointsSummaryA += absVal;
                    pointsSummaryB += (absVal < 10) ? 11 : (absVal + 2);
                }

                if (val < 0) setsWB++; else setsWA++; hasValidSets = true; 
            }
        });

        totalPointsA += pointsSummaryA;
        totalPointsB += pointsSummaryB;

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
                if (res.isHome) { rowPoints = gainA; if (clubStats[jA]) clubStats[jA].ptsMatch += rowPoints; }
                else { rowPoints = gainB; if (clubStats[jB]) clubStats[jB].ptsMatch += rowPoints; }
            }
        } else if (jA.toLowerCase().includes('double') || jA.includes('/') || jB.includes('/')) {
            // Attribution du résultat du double aux joueurs individuels
            [jA, jB].forEach((doubleStr, isB) => {
                if (!doubleStr || doubleStr === '-') return;
                // On sépare par / ou "et" au cas où
                const names = doubleStr.split(/[\/]| et /);
                names.forEach(namePart => {
                    const clean = (namePart || '').trim();
                    if (!clean || clean.length < 3) return;
                    
                    // On cherche si ce nom (ou partie du nom) correspond à un de nos joueurs
                    const matched = Object.keys(clubStats).find(k => k.toLowerCase().includes(clean.toLowerCase()) || clean.toLowerCase().includes(k.toLowerCase()));
                    if (matched) {
                        clubStats[matched].doubleResult = (isB ? (finalSB > finalSA ? 'V' : 'D') : (finalSA > finalSB ? 'V' : 'D'));
                    }
                });
            });
        }

        const styleA = finalSA > finalSB ? 'font-weight: bold; color: #0f172a;' : '';
        const styleB = finalSB > finalSA ? 'font-weight: bold; color: #0f172a;' : '';

        const diff = rowPoints;
        const ptsClass = diff > 0 ? 'pts-pos' : (diff < 0 ? 'pts-neg' : 'pts-neu');

        partiesHTML += `
            <tr>
                <td class="col-player" style="${styleA}">${formatPlayerName(jA)}</td>
                <td class="col-player" style="${styleB}">${formatPlayerName(jB)}</td>
                <td class="col-set">${sets[0]}</td>
                <td class="col-set">${sets[1]}</td>
                <td class="col-set">${sets[2]}</td>
                <td class="col-set">${sets[3]}</td>
                <td class="col-set">${sets[4]}</td>
                <td class="col-score"><span class="${isWinForClub ? 'badge-win' : 'badge-loss'}">${finalSA}-${finalSB}</span></td>
                <td style="text-align: center; font-size: 0.75rem;">
                    <span class="pts-gain ${ptsClass}">${diff > 0 ? '+' : ''}${diff !== 0 ? diff : ''}</span>
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
        let ja = getVal(m.ja).replace(' et ', ' / ');
        let jb = getVal(m.jb).replace(' et ', ' / ');
        
        // Ignorer les doubles pour le comptage V/D individuel
        if ((ja && ja.includes(' / ')) || (jb && jb.includes(' / '))) return;
        
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
        let c = clubStats[name] || { ptsMatch: 0, doubleResult: '-' };
        
        // Recherche de secours ultra-robuste
        if (c.doubleResult === '-') {
            const searchParts = name.toLowerCase().split(' ').filter(p => p.length > 2);
            
            parties.forEach(m => {
                let ja = (getVal(m.ja) || '').toLowerCase().replace(' et ', ' / ');
                let jb = (getVal(m.jb) || '').toLowerCase().replace(' et ', ' / ');
                
                if (ja.includes('/') || jb.includes('/') || ja.includes('double') || jb.includes('double')) {
                    const ourSide = res.isHome ? ja : jb;
                    
                    // On vérifie si une partie significative du nom est présente
                    const found = searchParts.some(part => ourSide.includes(part));
                    
                    if (found) {
                        let finalSA = parseInt(getVal(m.scorea)) || 0;
                        let finalSB = parseInt(getVal(m.scoreb)) || 0;
                        // Si scorea/scoreb absent, on regarde les sets
                        if (finalSA === 0 && finalSB === 0) {
                            let sets = (m.detail || '').split(' ');
                            if (sets.length < 2) sets = [m.ms1, m.ms2, m.ms3, m.ms4, m.ms5];
                            sets.forEach(s => { let v = parseInt(s); if(!isNaN(v)) { if(v>0) finalSA++; else finalSB++; } });
                        }
                        const isWin = res.isHome ? (finalSA > finalSB) : (finalSB > finalSA);
                        c.doubleResult = isWin ? 'V' : 'D';
                    }
                }
            });
        }

        stats[name].double = c.doubleResult; // Prise en compte pour l'IA
        const diff = c.ptsMatch;
        const ptsClass = diff > 0 ? 'pts-pos' : (diff < 0 ? 'pts-neg' : 'pts-neu');
        const dbClass = c.doubleResult === 'V' ? 'pts-pos' : (c.doubleResult === 'D' ? 'pts-neg' : 'pts-neu');

        statsHTML += `
            <tr>
                <td class="col-player">${name}</td>
                <td>${s.v}</td>
                <td>${s.d}</td>
                <td>
                    <span class="pts-gain ${ptsClass}">${diff > 0 ? '+' : ''}${diff.toFixed(1)}</span>
                </td>
                <td>
                    <span class="pts-gain ${dbClass}">${c.doubleResult}</span>
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
        <div class="premium-scoreboard">
            <div class="score-digit-box digit-red" style="width: 30px; height: 45px; font-size: 1.6rem;">${outcomeA}</div>
            <div class="score-divider"></div>
            <div class="score-digit-box digit-black" style="width: 55px; height: 65px; font-size: 2.5rem;">${finalTeamScoreA}</div>
            <div class="score-divider"></div>
            <div class="score-digit-box digit-black" style="width: 55px; height: 65px; font-size: 2.5rem;">${finalTeamScoreB}</div>
            <div class="score-divider"></div>
            <div class="score-digit-box digit-red" style="width: 30px; height: 45px; font-size: 1.6rem;">${outcomeB}</div>
        </div>
    `;

    // Clean matchID for consistency
    const matchID = 'match-' + res.teamName.replace(/\s/g, '-') + '-' + (res.category || '').replace(/\s/g, '-');

    // Sauvegarder les données pour l'IA (Registre)
    const mData = { 
        teamA: equipeA, 
        teamB: equipeB, 
        scoreA: finalTeamScoreA, 
        scoreB: finalTeamScoreB, 
        category: res.category, 
        stats: stats,
        isHome: res.isHome,
        ourTeamName: res.teamName
    };
    state.matchDataRegistry[matchID] = mData;
    state.currentMatchData = mData; 

    // ===== CALCUL DU CLASSEMENT (POUR UI ET EXPORT) =====
    let rankingSectionHTML = '';
    if (rankingData && rankingData.classement) {
        logDebug(`Rendu ranking pour ${res.teamName}, data: présente`);
        const list = Array.isArray(rankingData.classement) ? rankingData.classement : [rankingData.classement];
        list.sort((a,b) => (parseInt(b.pts)||0) - (parseInt(a.pts)||0));
        list.forEach((e, idx) => { e.rang_affiche = e.clt || (idx + 1); });

        const myEntry = list.find(e => (e.equipe && e.equipe.toLowerCase().includes(res.teamName.toLowerCase())) || (e.numero === state.clubId));
        
        let rankingTable = `
            <div class="section-title">Classement ${currentPhaseText}</div>
            <table class="premium-table">
                <thead><tr><th>Rang</th><th>Équipe</th><th>Pts</th><th>J</th><th>V</th><th>N</th><th>D</th></tr></thead>
                <tbody>
        `;
        
        list.forEach(e => {
            const entryClubNum = (e.numero || "").toString().trim();
            const targetClubId = (state.clubId || "").toString().trim();
            const isUs = (entryClubNum === targetClubId && entryClubNum !== "") || 
                         (e.equipe && e.equipe.toLowerCase().includes(res.teamName.toLowerCase()));
            
            rankingTable += `
                 <tr style="${isUs ? 'background: #f0f9ff; font-weight: 800; color: #1e293b !important;' : ''}">
                    <td style="text-align: center; ${isUs ? 'font-weight: 800;' : ''}">${e.rang_affiche}</td>
                    <td style="${isUs ? 'font-weight: 800;' : ''}">${cleanTeamName(getVal(e.equipe))}</td>
                    <td style="${isUs ? 'font-weight: 800;' : ''}">${e.pts}</td>
                    <td style="${isUs ? 'font-weight: 800;' : ''}">${e.joue}</td>
                    <td style="${isUs ? 'font-weight: 800;' : ''}">${e.vic}</td>
                    <td style="${isUs ? 'font-weight: 800;' : ''}">${e.nul}</td>
                    <td style="${isUs ? 'font-weight: 800;' : ''}">${e.def}</td>
                </tr>
            `;
        });
        rankingTable += '</tbody></table>';

        let summaryBlock = '';
        if (myEntry) {
            summaryBlock = `
                <div class="section-title">${summaryLabel}</div>
                <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.5rem; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 12px rgba(0,0,0,0.05); margin-bottom: 2rem;">
                    <div>
                        <div style="font-size: 0.75rem; color: #64748b; text-transform: uppercase; font-weight: 700;">Classement Actuel</div>
                        <div style="font-size: 1.5rem; font-weight: 800; color: #1e293b;">${myEntry.rang_affiche}<sup>${myEntry.rang_affiche == 1 ? 'er' : 'ème'}</sup> / ${list.length}</div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 0.75rem; color: #64748b; text-transform: uppercase; font-weight: 700;">${summaryLabel}</div>
                        <div style="font-size: 1.1rem; color: #334155; font-weight: 600;">
                            <span style="color: #10b981;">${myEntry.vic}V</span> - 
                            <span style="color: #64748b;">${myEntry.nul}N</span> - 
                            <span style="color: #ef4444;">${myEntry.def}D</span>
                        </div>
                    </div>
                </div>
            `;
        }
        rankingSectionHTML = summaryBlock + rankingTable;
    } else {
        rankingSectionHTML = `<div style="text-align:center; padding: 1rem; color: #94a3b8; font-style: italic;">Données de classement non disponibles pour cette poule.</div>`;
    }

    if (isBatch) {
        // WordPress BLOCK MODE
        const wpTitle = `<!-- wp:html -->\n<div class="ttcav-export-wrapper">\n<h2 class="ttcav-wp-title">${equipeA} – ${equipeB}</h2>\n</div>\n<!-- /wp:html -->`;
        
        const wpHeader = `<!-- wp:html -->\n<div class="ttcav-export-wrapper">\n<div class="export-subtitle">${res.category}</div>\n${scoreboardHTML}\n</div>\n<!-- /wp:html -->`;
        
        const wpAI = `<!-- wp:html -->\n<div class="ttcav-export-wrapper">\n<div id="ai-summary-${matchID}" class="ttcav-wp-ai">${state.aiSummaries[matchID] || '<em>Génération du résumé...</em>'}</div>\n</div>\n<!-- /wp:html -->`;
        
        const wpImage = `<!-- wp:image -->\n<figure class="wp-block-image"><img src="URL_DE_VOTRE_IMAGE" alt="Photo d'équipe"/></figure>\n<!-- /wp:image -->`;
        
        const wpGallery = `<!-- wp:gallery {"linkTo":"none"} -->\n<figure class="wp-block-gallery has-nested-images columns-default is-cropped"></figure>\n<!-- /wp:gallery -->`;
        
        const wpFooter = `<!-- wp:html -->\n<div class="ttcav-export-wrapper">\n${compoHTML}\n${partiesHTML}\n<div class="match-sets-sum"><span>Les points : ${totalPointsA} / ${totalPointsB}</span> | Les manches : ${totalSetsA} - ${totalSetsB}</div>\n${statsHTML}\n${rankingSectionHTML}\n<div class="summary-footer">Bilan du match : ${finalTeamScoreA > finalTeamScoreB ? 'Victoire de ' + equipeA : (finalTeamScoreA < finalTeamScoreB ? 'Victoire de ' + equipeB : 'Match nul')}</div>\n</div>\n<!-- /wp:html -->`;

        return `${wpTitle}\n${wpHeader}\n${wpAI}\n${wpImage}\n${wpGallery}\n${wpFooter}`;
    }

    // Modal/App View mode
    return `
        <style>${getWordPressCSS()}</style>
        <div class="ttcav-export-wrapper" style="background: white; padding: 20px; border-radius: 12px;">
            <div class="match-detail-block" id="block-${matchID}">
                <div class="export-header">
                    <h2 class="ttcav-wp-title" style="margin-top:0 !important;">${equipeA} – ${equipeB}</h2>
                    <div class="export-subtitle">${res.category}</div>
                    <div style="text-align:center; margin-bottom: 2rem;"><img src="URL_DE_VOTRE_IMAGE" alt="Photo d'équipe" style="max-width:100%; border-radius:12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);"></div>
                    ${scoreboardHTML}
                </div>
                <div class="ttcav-export-wrapper" style="display: flex; align-items: center; gap: 15px; margin: 2rem 0 4rem 0;">
                    <div class="ttcav-wp-ai" style="flex: 1; margin: 0 !important;">
                        <div id="ai-summary-${matchID}">
                            ${state.aiSummaries[matchID] || '<em>Chargement du résumé...</em>'}
                        </div>
                    </div>
                    <button id="btn-ai-${matchID}" data-match-id="${matchID}" onclick="generateAISummaryClickHandler('${matchID}', true)" style="flex-shrink: 0; background: #8b5cf6; color: white; border: none; width: 40px; height: 40px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; box-shadow: 0 4px 12px rgba(139, 92, 246, 0.4);" title="Regénérer le résumé IA">
                        <i class="fas fa-sync-alt" style="font-size: 1rem;"></i>
                    </button>
                </div>
                <div style="overflow-x: auto;">
                    ${compoHTML}
                    ${partiesHTML}
                </div>
                <div class="match-sets-sum"><span>Les points : ${totalPointsA} / ${totalPointsB}</span> | Les manches : ${totalSetsA} - ${totalSetsB}</div>
                <div style="overflow-x: auto;">
                    ${statsHTML}
                </div>

                <div id="league-ranking-container-${matchID}">
                    ${rankingSectionHTML}
                </div>
                <div class="summary-footer">Bilan du match : ${finalTeamScoreA > finalTeamScoreB ? 'Victoire de ' + equipeA : (finalTeamScoreA < finalTeamScoreB ? 'Victoire de ' + equipeB : 'Match nul')}</div>
            </div>
        </div>
    `;
} catch (err) {
        logDebug(`Erreur critique dans getMatchDetailsHTML: ${err.message}`, 'error');
        console.error(err);
        return `<div class="error-box" style="padding: 2rem; border: 2px dashed #ef4444; border-radius: 12px; color: #ef4444; text-align: center; background: #fef2f2;">
            <i class="fas fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 1rem;"></i>
            <div style="font-weight: 700;">Erreur d'affichage des détails</div>
            <div style="font-size: 0.85rem; margin-top: 0.5rem; opacity: 0.8;">Une erreur interne est survenue : ${err.message}</div>
        </div>`;
    }
}

// ===== IA SUMMARY (GROQ) =====
async function generateAISummaryClickHandler(matchID = null, forceRegen = false) {
    const matchData = matchID ? state.matchDataRegistry[matchID] : state.currentMatchData;
    
    // Déterminer les IDs des éléments
    const displayID = matchID ? `ai-summary-${matchID}` : 'ai-summary-display';
    const btnID = matchID ? `btn-ai-${matchID}` : 'btn-ai-refresh';

    const btn = document.getElementById(btnID);
    const display = document.getElementById(displayID);
    if (!display) {
        logDebug(`Display element not found: ${displayID}`, 'error');
        return;
    }

    // 1. Check Cache first (unless forceRegen)
    if (!forceRegen) {
        try {
            const cache = await fetchData('getSummary', { matchId: matchID });
            if (cache && cache.text) {
                display.innerHTML = cache.text;
                state.aiSummaries[matchID] = cache.text;
                logDebug(`Résumé chargé du cache pour ${matchID}`);
                return;
            }
        } catch (err) {
            logDebug(`Info cache résumé: ${err.message}`);
        }
    }

    if (!matchData) {
        logDebug(`Données de match non trouvées pour ID: ${matchID}. Registre: ${Object.keys(state.matchDataRegistry).join(', ')}`, 'error');
        display.innerHTML = '<span style="color: #64748b;">(Données de match non trouvées pour la génération)</span>';
        return;
    }

    if (!state.groqKey) {
        display.innerHTML = '<span style="color: #ef4444;">Configurez la clé Groq dans les paramètres pour générer le résumé.</span>';
        return;
    }
    const originalContent = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    }
    display.innerHTML = '<em>L\'IA prépare le résumé...</em>';

    try {
        const statsObj = matchData.stats || {};
        const statsStr = Object.entries(statsObj).map(([name, s]) => {
            let res = `${name}: ${s.v}V/${s.d}D`;
            if (s.double === 'V') res += ' + Double gagné';
            else if (s.double === 'D') res += ' + Double perdu';
            return res;
        }).join(', ') || 'N/A';
        const ourClubName = matchData.isHome ? matchData.teamA : matchData.teamB;
        const opponentName = matchData.isHome ? matchData.teamB : matchData.teamA;
        const ourScore = matchData.isHome ? matchData.scoreA : matchData.scoreB;
        const oppScore = matchData.isHome ? matchData.scoreB : matchData.scoreA;

        const prompt = `Tu es un journaliste sportif spécialisé dans le tennis de table du club TTCAV (les "Jaunes"). 
        Rédige un court paragraphe percutant (environ 3-4 phrases) pour résumer cette rencontre de championnat.
        
        Détails de la rencontre :
        - Notre club (${matchData.isHome ? 'à domicile' : 'à l\'extérieur'}) : ${ourClubName}
        - Adversaire : ${opponentName}
        - Score Final : ${ourScore} pour nous, ${oppScore} pour l'adversaire.
        - Division : ${matchData.category}
        - Stats de nos joueurs de ${ourClubName} : ${statsStr}
        
        Instructions :
        - Sois enthousiaste si on a gagné (notre score > score adverse), encourageant sinon.
        - Mets en avant les joueurs ayant fait un sans-faute (ex: 3V/0D).
        - IMPORTANT : N'utilise QUE les PRÉNOMS des joueurs de notre club (ex: "Ethan" au lieu de "Ethan GILLE").
        - Utilise un ton de club local (ex: Jaunes, TTCAV). NE mentionne PAS que tu es une IA.
        - Réponds directement par le paragraphe, sans introduction ni guillemets.`;

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${state.groqKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: state.groqModel,
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.8, // Légère augmentation pour plus de variété
                max_tokens: 300
            })
        });

        const result = await response.json();
        if (result.choices && result.choices[0]) {
            const aiText = result.choices[0].message.content.trim();
            display.textContent = aiText;
            state.aiSummaries[matchID] = aiText;
            // 3. Save to Cache
            try {
                await fetchData('saveSummary', { matchId: matchID }, false, aiText);
                logDebug(`Résumé sauvegardé en cache pour ${matchID}`);
            } catch (err) {
                logDebug(`Erreur sauvegarde cache: ${err.message}`);
            }

            const mainBtn = document.getElementById('btn-ai-summary');
            if (mainBtn) mainBtn.innerHTML = '🔄 Régénérer';
            showToast('Résumé IA généré !');
        } else {
            throw new Error('Réponse vide de Groq');
        }
    } catch (e) {
        logDebug(`Erreur Groq: ${e.message}`, 'error');
        showToast('Erreur lors de la génération IA.', true);
        display.textContent = "";
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalContent;
    }
}

// ===== CLIPBOARD =====
function copyWPHTMLToClipboard() {
    const rawContent = elements.exportPanel.cloneNode(true);
    // Supprimer les actions, boutons de rafraîchissement IA, et les icônes de chargement
    rawContent.querySelectorAll('.export-actions, .btn-ai-refresh, [id^="btn-ai-"], button[data-match-id]').forEach(el => el.remove());
    
    // Nettoyer les textes de chargement résiduels si l'utilisateur copie avant la fin de la génération
    rawContent.querySelectorAll('.ai-summary-text').forEach(el => {
        if (el.innerHTML.includes('Chargement') || el.innerHTML.includes('analyse')) {
            el.innerHTML = '<em>Résumé non disponible.</em>';
        }
    });

    const wpContent = `<!-- wp:html -->
<div class="ttcav-export-wrapper">
    ${rawContent.innerHTML}
</div>
<!-- /wp:html -->`;

    navigator.clipboard.writeText(wpContent.trim()).then(() => showToast('HTML WordPress copié !'));
}



// ===== EXPORT GLOBAL (TOUS LES MATCHS) =====
async function copyAllMatchesToWordPress() {
    if (state.results.length === 0) return;
    
    setAppBusy(true);
    updateLoaderStep('Vérification du cache des résumés IA...');
    
    // Pré-chargement du cache en parallèle
    try {
        const cachePromises = state.results.map(async (res) => {
            const matchID = 'match-' + res.teamName.replace(/\s/g, '-') + '-' + (res.category || '').replace(/\s/g, '-');
            if (!state.aiSummaries[matchID]) {
                const cache = await fetchData('getSummary', { matchId: matchID });
                if (cache && cache.text) {
                    state.aiSummaries[matchID] = cache.text;
                }
            }
        });
        await Promise.all(cachePromises);
    } catch (err) {
        logDebug(`Erreur pré-chargement cache: ${err.message}`);
    }

    const originalText = elements.loaderText.textContent;
    let giantHTML = `
        <div class="export-actions" style="display: flex; gap: 0.75rem; justify-content: flex-end; align-items: center; margin-bottom: 2rem; position: sticky; top: 0; background: #1e293b; padding: 1rem; z-index: 100; border-radius: 0 0 12px 12px;">
            <div id="ai-progress-container" style="flex: 1; display: flex; align-items: center; gap: 10px; padding: 0 10px;">
                <div style="flex: 1; height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden;">
                    <div id="ai-progress-fill" style="width: 0%; height: 100%; background: #eab308; transition: width 0.3s;"></div>
                </div>
                <span id="ai-progress-text" style="font-size: 0.75rem; color: #94a3b8; font-weight: 600; min-width: 100px;">Résumés IA : 0%</span>
            </div>
            <button onclick="copyWPHTMLToClipboard()" style="background: #eab308; color: white; border: none; padding: 0.6rem 1rem; border-radius: 8px; cursor: pointer; font-weight: 700;">📋 Copier HTML</button>
            <button onclick="document.getElementById('export-container').style.display='none'" class="secondary" style="background: #e2e8f0; border: none; padding: 0.6rem 1rem; border-radius: 8px; cursor: pointer;">✕ Fermer</button>
        </div>
        <div style="text-align:center; margin-bottom: 4rem;">
            <h1 style="font-size: 2.5rem; margin-bottom: 0.5rem;">Rapport Complet</h1>
            <p style="opacity: 0.6;">${elements.selectDay.value} — ${state.results.length} rencontres</p>
        </div>
    `;
    state.giantHTMLRaw = '';
    
    try {
        let loadedCount = 0;
        updateLoaderStep(`Préparation de l'export (${loadedCount}/${state.results.length})...`);
        
        const allDataPromises = state.results.map(async (res) => {
            const linkParams = new URLSearchParams(res.detailLink.includes('?') ? res.detailLink.split('?')[1] : res.detailLink);
            const is_retour = linkParams.get('is_retour') || '0';
            const renc_id = linkParams.get('renc_id') || linkParams.get('res_id') || '';
            
            const [detailsData, classData] = await Promise.all([
                fetchData('getMatchDetails', { is_retour, renc_id }),
                res.divisionId && res.pouleId ? fetchData('getClassement', { divisionId: res.divisionId, pouleId: res.pouleId }) : Promise.resolve(null)
            ]);
            
            loadedCount++;
            updateLoaderStep(`Chargement des données (${loadedCount}/${state.results.length}) : <br><b>${res.teamName}</b>`);

            return { res, detailsData, classData };
        });

        const allResults = await Promise.all(allDataPromises);

        updateLoaderStep('Génération du rapport final...');
        
        allResults.forEach(({ res, detailsData, classData }) => {
            if (detailsData && detailsData.resultat) {
                const matchID = 'match-' + res.teamName.replace(/\s/g, '-') + '-' + (res.category || '').replace(/\s/g, '-');
                giantHTML += getMatchDetailsHTML(res, detailsData, false, classData); // Version UI
                state.giantHTMLRaw += getMatchDetailsHTML(res, detailsData, true, classData); // Version WP (Blocks)

                // Le classement est maintenant géré nativement par getMatchDetailsHTML
            }
        });
        
        elements.exportPanel.innerHTML = giantHTML;
        elements.exportContainer.style.cssText = "display: block; position: fixed; left: 0; top: 0; width: 100%; height: 100%; z-index: 5000; background: rgba(0,0,0,0.8); overflow-y: auto; padding: 40px 20px;";
        elements.exportPanel.style.cssText = "display: block; margin: 0 auto; background: white; max-width: 1000px; padding: 40px; border-radius: 12px; position: relative;";
        
        showToast('Rapport complet généré !');
        
        // Déclencher les résumés IA intelligemment
        const processSummaries = async () => {
            const buttons = elements.exportPanel.querySelectorAll('button[data-match-id]');
            const total = buttons.length;
            const fill = document.getElementById('ai-progress-fill');
            const text = document.getElementById('ai-progress-text');
            
            for (let i = 0; i < total; i++) {
                const id = buttons[i].getAttribute('data-match-id');
                
                // Si on a déjà le résumé en local (via pré-chargement), on l'affiche et on passe au suivant sans délai
                if (state.aiSummaries[id]) {
                    const display = document.getElementById(`ai-summary-${id}`);
                    if (display) display.innerHTML = state.aiSummaries[id];
                    logDebug(`Utilisation immédiate du résumé local pour ${id}`);
                } else {
                    // Sinon on génère via le handler habituel
                    await generateAISummaryClickHandler(id);
                    // Et on attend 2.5s pour l'API
                    if (i < total - 1) {
                        await new Promise(resolve => setTimeout(resolve, 2500));
                    }
                }
                
                // Mettre à jour la barre
                const pct = Math.round(((i + 1) / total) * 100);
                if (fill) fill.style.width = pct + '%';
                if (text) text.textContent = `Résumés IA : ${pct}%`;
            }
            if (text) text.textContent = 'Résumés IA : Terminé';
            if (fill) fill.style.background = '#10b981';
        };

        setTimeout(processSummaries, 500);
        
    } catch (e) {
        logDebug(`Erreur export global: ${e.message}`, 'error');
        showToast('Erreur lors de l\'export global.', true);
    } finally {
        setAppBusy(false);
        elements.loaderText.textContent = originalText;
    }
}

function getWordPressCSS() {
    return `@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;800&family=Inter:wght@400;500;600&display=swap');

/* Conteneur Global */
.ttcav-export-wrapper {
    font-family: 'Inter', sans-serif !important;
    max-width: 900px !important;
    margin: 40px auto !important;
    color: #1e293b !important;
    line-height: 1.6 !important;
}

/* Titre - Style Image 1 */
.ttcav-wp-title {
    font-family: 'Outfit', sans-serif !important;
    font-size: 2.2rem !important;
    font-weight: 800 !important;
    text-align: center !important;
    text-transform: uppercase !important;
    color: #1e293b !important;
    margin-bottom: 0.5rem !important;
    letter-spacing: -0.5px !important;
}

.export-subtitle {
    font-family: 'Outfit', sans-serif !important;
    font-size: 1.4rem !important;
    font-weight: 700 !important;
    color: #94a3b8 !important;
    text-align: center !important;
    text-transform: uppercase !important;
    letter-spacing: 2px !important;
    margin-bottom: 2rem !important;
}

/* Scoreboard - Style Image 1 */
.premium-scoreboard {
    display: flex !important;
    justify-content: center !important;
    align-items: center !important;
    gap: 12px !important;
    background: #1e293b !important;
    padding: 24px 32px !important;
    border-radius: 20px !important;
    width: fit-content !important;
    margin: 3rem auto !important;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04) !important;
}

.score-digit-box {
    background: #ffffff !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    font-weight: 900 !important;
    font-family: 'Arial Black', Gadget, sans-serif !important;
    border-radius: 6px !important;
    box-shadow: inset 0 -4px 0 rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.05) !important;
}

.digit-red { color: #e11d48 !important; }
.digit-black { color: #0f172a !important; }
.score-divider { width: 4px !important; height: 10px !important; background: rgba(255,255,255,0.15) !important; border-radius: 2px !important; }

/* Boitier IA - Style Image 1 */
.ttcav-wp-ai {
    background: #f8fafc !important;
    border: 1px solid #e2e8f0 !important;
    border-radius: 20px !important;
    padding: 25px 50px 25px 25px !important;
    margin: 2rem 0 4rem 0 !important;
    font-size: 0.95rem !important;
    line-height: 1.7 !important;
    color: #334155 !important;
    position: relative !important;
    text-align: left !important;
    font-family: 'Inter', sans-serif !important;
}

/* Tableaux Premium */
.section-title {
    font-family: 'Outfit', sans-serif !important;
    text-align: center !important;
    font-size: 1.1rem !important;
    font-weight: 700 !important;
    color: #94a3b8 !important;
    text-transform: uppercase !important;
    letter-spacing: 3px !important;
    margin: 5rem 0 2rem !important;
}

.premium-table {
    width: 100% !important;
    border-collapse: separate !important;
    border-spacing: 0 !important;
    margin-bottom: 3rem !important;
    border-radius: 16px !important;
    overflow: hidden !important;
    border: 1px solid #e2e8f0 !important;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05) !important;
}

.premium-table th {
    background: #f8fafc !important;
    color: #64748b !important;
    font-weight: 700 !important;
    padding: 0.6rem 0.8rem !important; /* Resserrement Desktop */
    text-align: left !important;
    font-size: 0.8rem !important;
    text-transform: uppercase !important;
    letter-spacing: 1px !important;
    border-right: 1px solid #f1f5f9 !important;
}

.premium-table td {
    padding: 0.6rem 0.8rem !important; /* Resserrement Desktop */
    border-bottom: 1px solid #f1f5f9 !important;
    border-right: 1px solid #f1f5f9 !important;
    font-size: 0.9rem !important;
}

.premium-table th:last-child, .premium-table td:last-child {
    border-right: none !important;
}

.premium-table th.col-player, .premium-table td.col-player {
    padding-left: 2rem !important;
    text-align: left !important;
}

.match-sets-sum {
    text-align: right !important;
    font-size: 1rem !important;
    color: #94a3b8 !important;
    margin: -1.5rem 0 4rem !important;
    font-weight: 500 !important;
}

.summary-footer {
    text-align: center !important;
    background: #1e293b !important;
    color: #ffffff !important;
    padding: 3rem !important;
    border-radius: 20px !important;
    font-weight: 800 !important;
    font-size: 1.6rem !important;
    margin-top: 5rem !important;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1) !important;
}

.badge-win { background: #dcfce7 !important; color: #166534 !important; padding: 6px 12px !important; border-radius: 8px !important; font-weight: 700 !important; }
.badge-loss { background: #fee2e2 !important; color: #991b1b !important; padding: 6px 12px !important; border-radius: 8px !important; font-weight: 700 !important; }

/* Responsive adjustments */
@media (max-width: 768px) {
    .ttcav-wp-title { font-size: 1.6rem !important; }
    .premium-scoreboard { padding: 12px 16px !important; gap: 6px !important; margin: 2rem auto !important; }
    .score-digit-box.digit-red { width: 25px !important; height: 35px !important; font-size: 1.2rem !important; }
    .score-digit-box.digit-black { width: 45px !important; height: 55px !important; font-size: 2rem !important; }
    
    .premium-table th, .premium-table td { 
        padding: 0.25rem 0.02rem !important; 
        font-size: 0.65rem !important; 
    }
    
    .premium-table th.col-set, .premium-table td.col-set {
        width: 18px !important;
        min-width: 18px !important;
        text-align: center !important;
        padding: 0.25rem 0 !important;
    }
    
    .premium-table th.col-player, .premium-table td.col-player {
        max-width: 55px !important;
        white-space: normal !important;
        line-height: 0.95 !important;
        word-break: break-all !important;
    }
    
    .mobile-br { display: block !important; height: 0; }
    .mobile-only-indent { display: block !important; height: 5px; }
    .double-sep { font-weight: 800; color: #8b5cf6; display: block; margin: 2px 0; }
    .ttcav-wp-ai { padding: 20px !important; font-size: 1rem !important; }
    .premium-table td.col-player { padding-left: 5px !important; }
}

.mobile-br { display: none; }
.mobile-only-indent { display: none; }
.double-sep { font-weight: inherit; color: inherit; display: inline; }
`;
}

function copyWPStylesToClipboard() {
    const css = getWordPressCSS();
    navigator.clipboard.writeText(css).then(() => showToast('CSS copié !'));
}

function copyWPHTMLToClipboard() {
    let finalHTML = state.giantHTMLRaw;
    
    // Injecter les résumés IA dans les blocs paragraph de giantHTMLRaw
    Object.keys(state.aiSummaries).forEach(matchID => {
        const summary = state.aiSummaries[matchID];
        const placeholder = `<div id="ai-summary-${matchID}" class="ttcav-wp-ai"><em>Génération du résumé...</em></div>`;
        // On remplace le placeholder par le vrai texte dans un bloc propre
        finalHTML = finalHTML.replace(placeholder, `<div id="ai-summary-${matchID}" class="ttcav-wp-ai">${summary}</div>`);
    });

    navigator.clipboard.writeText(finalHTML).then(() => showToast('HTML (Blocks) copié !'));
}

function formatPlayerName(name) {
    if (!name || name === '-') return '-';
    // Si c'est un double
    if (name.includes(' / ')) {
        const parts = name.split(' / ');
        return parts.map(p => {
            const sub = p.trim().split(' ');
            if (sub.length >= 2) {
                return `${sub[0]} <br class="mobile-br"><span class="mobile-only-indent"></span>${sub.slice(1).join(' ')}`;
            }
            return p;
        }).join(' <br class="mobile-br"><span class="double-sep">/</span> ');
    }
    // Si c'est un joueur individuel
    const sub = name.trim().split(' ');
    if (sub.length >= 2) {
        return `${sub[0]} <br class="mobile-br"><span class="mobile-only-indent"></span>${sub.slice(1).join(' ')}`;
    }
    return name;
}

// ===== AUTO-INIT =====
if (elements.btnCopyAll) elements.btnCopyAll.disabled = true;

// Sécurité supplémentaire : On s'assure que le loader disparaît quoi qu'il arrive après 3 secondes
setTimeout(() => setAppBusy(false), 3000);

if (state.appId && state.appKey && state.clubId) {
    loadTeams().finally(() => setAppBusy(false));
} else {
    setAppBusy(false);
    if (elements.resultsGrid) {
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
}
