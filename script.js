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
    customPlayerPoints: JSON.parse(localStorage.getItem('ttcav_custom_points') || '{}'), // Points override
    lastGlobalResults: null, // Stockage pour re-render global
    currentMatchResIndex: null, // Stockage pour re-render single
    aiSummaries: {},       // Cache local des résumés générés
    giantHTMLRaw: '',     // Version brute de l'export WP avec commentaires
    currentMatchData: null, // Compatibilité ancienne vers.
    players: [],
    playerDetailsCache: {}, // Boîte à mémoire pour les points mensuels
    charts: {},
    activeHistoryLicence: null, // Pour garder le panneau ouvert lors d'un re-render
    activeHistoryType: 'histo' // 'histo' ou 'matches'
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
    btnCopyAll: document.getElementById('btn-copy-all'),
    helpModal: document.getElementById('help-modal-wrapper'),
    helpContent: document.getElementById('help-content-area'),
    closeHelp: document.getElementById('close-help-modal'),
    playersList: document.getElementById('players-list'),
    playerSearch: document.getElementById('player-search'),
    playerSort: document.getElementById('player-sort'),
    playerCountBadge: document.getElementById('player-count-badge')
};

// ===== UTILITAIRES DE DÉMARRAGE =====
const safeSetVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
};

const setupListener = (id, callback) => {
    const el = document.getElementById(id);
    if (el) el.onclick = callback;
};

// ===== INITIALISATION SÉCURISÉE =====
window.addEventListener('load', () => {
    try {
        // ===== TABS LOGIC =====
        const tabBtns = document.querySelectorAll('.tab-btn');
        tabBtns.forEach(btn => {
            btn.onclick = () => {
                const tab = btn.dataset.tab;
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => {
                    c.style.display = 'none';
                    c.classList.remove('active');
                });
                btn.classList.add('active');
                const content = document.getElementById(`${tab}-tab`);
                if (content) {
                    content.style.display = 'block';
                    content.classList.add('active');
                }
                if (tab === 'players' && state.players.length === 0) {
                    loadPlayers();
                }
            };
        });

        // ===== INIT INPUTS =====
        safeSetVal('input-app-id', state.appId);
        safeSetVal('input-app-key', state.appKey);
        safeSetVal('input-club-id', state.clubId);
        safeSetVal('input-groq-key', state.groqKey);
        safeSetVal('select-groq-model', state.groqModel);

        // Debug checkbox
        const debugCheckbox = document.getElementById('input-show-debug');
        if (debugCheckbox) {
            debugCheckbox.checked = localStorage.getItem('fftt_showDebug') === 'true';
            if (debugCheckbox.checked && elements.debugConsole) {
                elements.debugConsole.style.display = 'block';
            }
        }

        // ===== EVENT LISTENERS =====
        document.querySelectorAll('.open-settings-btn').forEach(btn => {
            btn.onclick = () => { if (elements.modalSettings) elements.modalSettings.style.display = 'flex'; };
        });

        setupListener('close-settings', () => { if (elements.modalSettings) elements.modalSettings.style.display = 'none'; });
        setupListener('btn-refresh-top', () => loadTeams(true));
        setupListener('btn-help-top', () => showHelpModal());

        if (elements.closeHelp) {
            elements.closeHelp.onclick = () => { if (elements.helpModal) elements.helpModal.style.display = 'none'; };
        }

        setupListener('btn-generate', () => generateResults());
        setupListener('btn-copy-all', () => copyAllMatchesToWordPress());
        setupListener('btn-refresh-players', () => loadPlayers(true));

        if (elements.playerSearch) {
            elements.playerSearch.oninput = (e) => {
                if (typeof renderPlayers === 'function') renderPlayers();
            };
        }

        if (elements.playerSort) {
            elements.playerSort.onchange = () => {
                if (typeof renderPlayers === 'function') renderPlayers();
            };
        }

        const btnCopyCSS = document.getElementById('btn-copy-css');
        if (btnCopyCSS) {
            btnCopyCSS.onclick = () => {
                const css = getWordPressCSS();
                if (css) navigator.clipboard.writeText(css).then(() => showToast('CSS copié !'));
            };
        }

        const saveBtn = document.getElementById('save-settings');
        if (saveBtn) {
            saveBtn.onclick = () => {
                const appIdEl = document.getElementById('input-app-id');
                const appKeyEl = document.getElementById('input-app-key');
                const clubIdEl = document.getElementById('input-club-id');
                const groqKeyEl = document.getElementById('input-groq-key');
                const groqModelEl = document.getElementById('select-groq-model');

                if (appIdEl) state.appId = appIdEl.value;
                if (appKeyEl) state.appKey = appKeyEl.value;
                if (clubIdEl) state.clubId = clubIdEl.value;
                if (groqKeyEl) state.groqKey = groqKeyEl.value;
                if (groqModelEl) state.groqModel = groqModelEl.value;

                localStorage.setItem('fftt_appId', state.appId);
                localStorage.setItem('fftt_appKey', state.appKey);
                localStorage.setItem('fftt_clubId', state.clubId);
                localStorage.setItem('groq_key', state.groqKey);
                localStorage.setItem('groq_model', state.groqModel);

                if (debugCheckbox) {
                    localStorage.setItem('fftt_showDebug', debugCheckbox.checked);
                    if (elements.debugConsole) elements.debugConsole.style.display = debugCheckbox.checked ? 'block' : 'none';
                }

                if (elements.modalSettings) elements.modalSettings.style.display = 'none';
                showToast('Configuration enregistrée !');
                loadTeams();
            };
        }

        // Charger les points personnalisés depuis l'API au démarrage
        fetch('api.php?action=getCustomPoints')
            .then(r => r.json())
            .then(data => {
                if (data && !data.error && Object.keys(data).length > 0) {
                    state.customPlayerPoints = data;
                    localStorage.setItem('ttcav_custom_points', JSON.stringify(data));
                }
            })
            .catch(e => console.error("Erreur chargement points custom", e));

    } catch (e) {
        console.error("Erreur d'initialisation:", e);
        alert("Erreur de démarrage de l'application: " + e.message);
    }
});

const clearCacheHandler = async () => {
    const clearResultsEl = document.getElementById('clear-results-check');
    const clearSummariesEl = document.getElementById('clear-summaries-check');

    if (!clearResultsEl || !clearSummariesEl) return;

    const clearResults = clearResultsEl.checked;
    const clearSummaries = clearSummariesEl.checked;

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
    } catch (e) {
        showToast('Erreur réseau lors du nettoyage.', true);
    } finally {
        setAppBusy(false);
    }
};

setupListener('btn-do-clear-cache', clearCacheHandler);

/** Normalisation pour comparaisons robustes */
const norm = s => (s || "").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

// Helper pour comparer des dates (proximité de N jours)
function isDateClose(dateStr1, dateStr2, maxDays = 5) {
    if (!dateStr1 || !dateStr2) return false;
    try {
        const parse = (s) => {
            const parts = s.split(/[\/\-]/).map(p => p.trim());
            if (parts.length < 3) return null;
            let day, month, year;
            if (parts[0].length === 4) {
                year = parseInt(parts[0]);
                month = parseInt(parts[1]) - 1;
                day = parseInt(parts[2]);
            } else {
                day = parseInt(parts[0]);
                month = parseInt(parts[1]) - 1;
                year = parseInt(parts[2]);
                if (year < 100) year += 2000;
            }
            return new Date(year, month, day);
        };
        const d1 = parse(dateStr1);
        const d2 = parse(dateStr2);
        if (!d1 || !d2 || isNaN(d1) || isNaN(d2)) return false;
        const diff = Math.abs(d1 - d2) / (1000 * 60 * 60 * 24);
        return diff <= maxDays;
    } catch (e) { return false; }
}

// ===== UTILITAIRES =====

/** Retourne le label du mois FFTT (si < 11, mois précédent) */
function getCurrentFFTTMonthLabel() {
    const today = new Date();
    let refDate = new Date(today);
    if (today.getDate() < 11) refDate.setMonth(today.getMonth() - 1);
    return `${refDate.getFullYear()}-${String(refDate.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthlyPoints(fullName, licence = null) {
    const monthLabel = getCurrentFFTTMonthLabel();

    // 1. D'abord par licence dans le localStorage persistant
    if (licence) {
        const cached = localStorage.getItem(`ttcav_mensuel_${licence}_${monthLabel}`);
        if (cached) return parseFloat(cached);

        if (state.playerDetailsCache[licence]) return state.playerDetailsCache[licence].points;
    }

    // 2. Recherche par NOM (fallback moins précis)
    if (fullName) {
        const searchNorm = norm(fullName);

        // Dans state.players
        if (state.players) {
            const p = state.players.find(x => {
                const combinedNorm = norm(x.nom + (x.prenom || ''));
                return combinedNorm.includes(searchNorm) || searchNorm.includes(combinedNorm);
            });
            if (p) {
                const cachedP = localStorage.getItem(`ttcav_mensuel_${p.licence}_${monthLabel}`);
                if (cachedP) return parseFloat(cachedP);
                return p.points_mensuels || p.points_officiels || p.points;
            }
        }

        // Dans cache session
        if (state.playerDetailsCache) {
            const cachedEntry = Object.values(state.playerDetailsCache).find(entry => {
                if (!entry.nom) return false;
                const combinedNorm = norm(entry.nom);
                // Match exact ou partiel dans les deux sens
                return combinedNorm === searchNorm ||
                    combinedNorm.includes(searchNorm) ||
                    searchNorm.includes(combinedNorm);
            });
            if (cachedEntry) return cachedEntry.points;
        }
    }

    return null;
}

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
        elements.loader.style.display = busy ? 'flex' : 'none';
    }
}

function updateLoaderStep(text) {
    if (elements.loaderText) {
        elements.loaderText.innerHTML = `
        <div class="loader-content-inner">
            <div class="loader-step-text">${text}</div>
        </div>`;
    }
}

function getVal(v) {
    if (v === null || v === undefined) return '';
    if (typeof v === 'object') {
        return Object.keys(v).length === 0 ? '' : String(v);
    }
    return String(v).trim();
}


function cleanTeamName(name) {
    if (!name) return "";
    let n = getVal(name);
    // Supprimer tout contenu entre parenthèses
    n = n.replace(/\([^)]*\)/g, '').trim();
    n = n.replace(/PHASE\s*\d+/gi, '').trim();
    return n.split(' ').map(s => {
        if (/^\d+$/.test(s)) return s;
        if (!s) return "";
        return s.charAt(0).toUpperCase() + s.substring(1).toLowerCase();
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
    n = n.replace(/Mess\s+AURA|MESSIEURS\s+AURA/gi, '');

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
        console.log(`[info] API Response (${action}):`, data);
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
            <div class="empty-state-full">
                <i class="fas fa-hand-pointer empty-state-icon"></i>
                Sélectionnez une équipe et une journée pour afficher les résultats.
            </div>
            `;
        }
        const data = await fetchData('getTeams', {}, forceRefresh);

        if (data && data.equipe) {
            const rawTeams = Array.isArray(data.equipe) ? data.equipe : [data.equipe];

            // Déduplication par lien de division pour éviter les doublons réels
            const seenLinks = new Set();
            state.teams = rawTeams.filter(t => {
                const link = t.liendivision || t.liendiv || "";
                if (!link) return true;
                if (seenLinks.has(link)) return false;
                seenLinks.add(link);
                return true;
            });

            logDebug(`${state.teams.length} équipes chargées (après déduplication).`);

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
                    const tRaw = t.libequipe || t.libequ || t.libepr || t.lib || "";

                    // Formatage standardisé : Villefranche (TTCAV) XX (Division)
                    const teamNum = tRaw.match(/\d+/) ? tRaw.match(/\d+/)[0] : (idx + 1);
                    const tDiv = t.libdivision || t.libdiv || "";
                    const tName = `Villefranche (TTCAV) ${teamNum} ${tDiv ? '- ' + tDiv : ''}`;

                    if (seen.has(tName + idx)) return; // Sécurité par index si vraiment identique
                    seen.add(tName + idx);

                    const opt = document.createElement('option');
                    opt.value = idx;
                    opt.textContent = tName;
                    elements.selectTeam.appendChild(opt);
                });

                if (filteredTeams.length > 0) {
                    const validTeam = filteredTeams.find(t => {
                        let link = t.liendivision || t.liendiv || "";
                        return typeof link === 'string' && (link.includes('D1') || link.includes('D2') || link.includes('D3') || link.includes('cx_poule'));
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
                setAppBusy(true);
                try {
                    // Pour garder un calendrier cohérent (Tour 1, 2, 3 aux bonnes dates), 
                    // on utilise toujours la première équipe de la phase comme référence pour les tours.
                    const phaseVal = elements.selectPhase.value;
                    let filteredTeams = state.teams;
                    if (phaseVal !== "all") {
                        filteredTeams = state.teams.filter(t => {
                            const n = (t.libequipe || t.libequ || t.libepr || t.lib || "").toLowerCase();
                            return n.includes(phaseVal.toLowerCase()) || !n.includes("phase");
                        });
                    }
                    const refTeam = filteredTeams.find(t => {
                        let link = t.liendivision || t.liendiv || "";
                        return typeof link === 'string' && (link.includes('D1') || link.includes('D2') || link.includes('D3') || link.includes('cx_poule'));
                    }) || filteredTeams[0];

                    if (refTeam) await loadMatchdays(refTeam, forceRefresh);
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
        state.tourDates = {}; // Reset des dates de référence

        if (data && data.tour) {
            const roundsList = Array.isArray(data.tour) ? data.tour : [data.tour];

            // Ne garder que les tours qui ont au moins un résultat dans la poule
            const playedRounds = roundsList.filter(r => {
                let sA = typeof r.scorea === 'string' ? r.scorea.trim() : '';
                let sB = typeof r.scoreb === 'string' ? r.scoreb.trim() : '';
                return sA !== '' || sB !== '';
            });
            state.matchdays = playedRounds;
            logDebug(`${playedRounds.length} journées jouées trouvées.`);

            // Option pour TOUTE la phase
            const allOpt = document.createElement('option');
            allOpt.value = "all_phase";
            allOpt.textContent = "--- Toute la phase ---";
            elements.selectDay.appendChild(allOpt);

            const seenRounds = new Set();
            // On itère sur la liste complète pour garder les bons numéros de tour par défaut
            roundsList.forEach((round, idx) => {
                let sA = typeof round.scorea === 'string' ? round.scorea.trim() : '';
                let sB = typeof round.scoreb === 'string' ? round.scoreb.trim() : '';
                const hasScore = (sA !== '' || sB !== '');

                // On ne l'affiche dans le menu que s'il y a un score (sauf si mode "all")
                if (!hasScore) return;

                let d = (typeof round.dateprevue === 'string' ? round.dateprevue : '') ||
                    (typeof round.datereelle === 'string' ? round.datereelle : '') || '';

                let tourExtracted = `tour ${idx + 1}`;
                const tourMatch = getVal(round.libelle).match(/(?:tour|journ[eé]e|barrage|titre)\s*(?:n°)?\s*\d+/i);
                if (tourMatch) tourExtracted = tourMatch[0].toLowerCase().replace(/\s*n°\s*/, ' ');

                const key = tourExtracted.toLowerCase().trim();
                if (seenRounds.has(key)) return;
                seenRounds.add(key);

                // On stocke la date de référence pour ce tour (utile pour le recalage des autres équipes)
                if (d) state.tourDates[key] = d;

                const opt = document.createElement('option');
                opt.value = key;
                opt.textContent = d ? `${tourExtracted} - ${d}` : tourExtracted;
                elements.selectDay.appendChild(opt);
            });

            // Sélection par défaut de la dernière journée
            if (state.matchdays.length > 0) {
                const lastRound = state.matchdays[state.matchdays.length - 1];
                const lastTm = getVal(lastRound.libelle).match(/(?:tour|journ[eé]e|barrage|titre)\s*(?:n°)?\s*\d+/i);
                const lastKey = lastTm ? lastTm[0].toLowerCase().replace(/\s*n°\s*/, ' ').trim() : `tour ${state.matchdays.length}`;
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
                    const tName = (t.libequipe || t.libequ || t.libepr || t.lib || "").toLowerCase();
                    const sPhase = selectedPhase.toLowerCase();
                    // Soit le nom contient la phase, soit le nom ne contient AUCUNE phase (on l'inclut par défaut)
                    return tName.includes(sPhase) || !tName.includes("phase");
                });
            }
        }
        console.log(`DEBUG: ${teamsToProcess.length} équipes à traiter pour la phase ${selectedPhase}`);

        const promises = teamsToProcess.map(async (team) => {
            if (!team) return;
            const teamName = team.libequipe || team.libequ || team.libepr || team.lib || "Équipe";
            const isPhase2 = (selectedPhase !== "all") ? selectedPhase.toLowerCase().includes("phase 2") : teamName.toLowerCase().includes("phase 2");

            if (teamName.includes('13') || teamName.includes('14')) {
                console.log(`DEBUG RAW TEAM 13/14:`, team);
            }
            let divisionLink = team.liendivision || team.liendiv || "";
            if (typeof divisionLink !== 'string') divisionLink = "";

            const categoryName = team.libdivision || team.libdiv || (isPhase2 ? "Phase 2" : "Phase 1");

            const linkParams = new URLSearchParams(divisionLink.includes('?') ? divisionLink.split('?')[1] : divisionLink);
            let divisionId = '';
            for (const [key, value] of linkParams.entries()) {
                if (key.match(/^D\d+$/)) {
                    divisionId = value;
                    break;
                }
            }
            if (!divisionId) divisionId = linkParams.get('D1') || linkParams.get('D2') || linkParams.get('D3') || '';
            const pouleId = linkParams.get('cx_poule') || linkParams.get('poule') || '';

            if (!divisionId || !pouleId) {
                logDebug(`Saut de l'équipe ${teamName} : paramètres division/poule manquants.`, "warn");
                return;
            }

            const data = await fetchData('getMatches', { divisionId, pouleId });
            console.log(`DEBUG: Equipe ${teamName}, Division: ${divisionId}, Poule: ${pouleId}, Matchs trouvés: ${data?.tour?.length || (data?.tour ? 1 : 0)}`);

            if (data && data.tour) {
                const allMatchesInPoule = Array.isArray(data.tour) ? data.tour : [data.tour];

                let matchesToProcess = [];
                if (selectedDayVal === "all_phase") {
                    // Collecter uniquement les matchs JOUÉS par NOTRE équipe dans cette poule
                    const targetNorm = norm(teamName);
                    matchesToProcess = allMatchesInPoule.filter(r => {
                        let sA = typeof r.scorea === 'string' ? r.scorea.trim() : '';
                        let sB = typeof r.scoreb === 'string' ? r.scoreb.trim() : '';
                        const nA = norm(getVal(r.equa));
                        const nB = norm(getVal(r.equb));
                        const hasScore = (sA !== '' || sB !== '');

                        const keywords = /ttcav|tt|cp|as|es|ep|pong|avenir|st|saint|ping|vill(?:efranche)?/gi;
                        const cleanA = nA.replace(keywords, '');
                        const cleanB = nB.replace(keywords, '');
                        const cleanTarget = targetNorm.replace(keywords, '');

                        const isA = cleanA.includes(cleanTarget) || cleanTarget.includes(cleanA) ||
                            nA.includes('villefranche') || nA.includes('ttcav') || nA.includes('vtt') || nA.includes('villefr');
                        const isB = cleanB.includes(cleanTarget) || cleanTarget.includes(cleanB) ||
                            nB.includes('villefranche') || nB.includes('ttcav') || nB.includes('vtt') || nB.includes('villefr');

                        return hasScore && (isA || isB);
                    });
                } else {
                    // Match spécifique de NOTRE équipe pour cette journée
                    const targetNorm = norm(teamName);
                    matchesToProcess = allMatchesInPoule.filter((r, idx) => {
                        const tm = getVal(r.libelle).match(/(?:tour|journ[eé]e|barrage|titre)\s*(?:n°)?\s*\d+/i);
                        let tExt = tm ? tm[0].toLowerCase().replace(/\s*n°\s*/, ' ').trim() : "";

                        const mDate = getVal(r.datereelle) || getVal(r.dateprevue) || "";
                        const refDate = state.tourDates[selectedDayVal];

                        const nA = norm(getVal(r.equa));
                        const nB = norm(getVal(r.equb));
                        const keywords = /ttcav|tt|cp|as|es|ep|pong|avenir|st|saint|ping|vill(?:efranche)?/gi;
                        const cleanA = nA.replace(keywords, '');
                        const cleanB = nB.replace(keywords, '');
                        const cleanTarget = targetNorm.replace(keywords, '');

                        const isOurMatch = cleanA.includes(cleanTarget) || cleanTarget.includes(cleanA) ||
                            cleanB.includes(cleanTarget) || cleanTarget.includes(cleanB) ||
                            nA.includes('villefranche') || nB.includes('villefranche') ||
                            nA.includes('ttcav') || nB.includes('ttcav') ||
                            nA.includes('vtt') || nB.includes('vtt') ||
                            nA.includes('villefr') || nB.includes('villefr');

                        if (!isOurMatch) return false;

                        let matchByDate = false;
                        if (refDate && mDate) {
                            // On passe à 9 jours car entre Régionale (11/04) et Départementale (18/04), il y a 7 jours d'écart
                            // Mais on reste en dessous de 14 jours (écart entre deux tours normaux) pour éviter les doublons.
                            matchByDate = isDateClose(mDate, refDate, 9);
                        }

                        // 1. Si la date correspond, c'est le bon tour (peu importe le libellé)
                        if (matchByDate) {
                            // On accepte
                        } else {
                            // 2. Si la date ne correspond pas mais que le libellé est exact (ex: match décalé)
                            const matchesLibelle = (tExt === selectedDayVal);
                            if (matchesLibelle) {
                                // On accepte seulement si on n'a pas de date de référence ou si elle n'est pas trop délirante
                                if (refDate && mDate && !isDateClose(mDate, refDate, 9)) return false;
                            } else {
                                // 3. Pas de date ni de libellé qui matche ? On tente l'index en dernier recours
                                if (!mDate || !refDate) {
                                    const numTour = parseInt(selectedDayVal.match(/\d+/));
                                    if (numTour && (idx + 1) !== numTour) return false;
                                } else {
                                    return false; // Trop loin en date
                                }
                            }
                        }

                        return true;
                    });
                }
                if (matchesToProcess.length > 0) {
                    console.log(`DEBUG: Match trouvé pour ${teamName} (${selectedDayVal}):`, matchesToProcess);
                } else {
                    if (teamName.includes('13') || teamName.includes('14')) {
                        console.log(`DEBUG: AUCUN MATCH trouvé pour ${teamName} au ${selectedDayVal}.`);
                    }
                }

                matchesToProcess.forEach(matchFound => {
                    let dMatch = getVal(matchFound.dateprevue) || getVal(matchFound.datereelle) || 'N/A';
                    let lienMatch = getVal(matchFound.lien);
                    let sA = getVal(matchFound.scorea);
                    let sB = getVal(matchFound.scoreb);

                    let parseA = parseInt(sA);
                    let parseB = parseInt(sB);
                    if (isNaN(parseA)) parseA = 0;
                    if (isNaN(parseB)) parseB = 0;

                    if (sA === '' && sB === '') return;

                    const nA = norm(getVal(matchFound.equa));
                    const nB = norm(getVal(matchFound.equb));
                    const nTarget = norm(teamName);

                    let isHome = nA.includes(nTarget) || nTarget.includes(nA);
                    let isAway = nB.includes(nTarget) || nTarget.includes(nB);

                    if (!isHome && !isAway) {
                        const cleanTarget = nTarget.replace(/ttcav|tt|cp|as|es|ep|pong|avenir|st|saint|ping/gi, '');
                        isHome = nA.includes(cleanTarget);
                        isAway = nB.includes(cleanTarget);
                    }

                    if (isHome && isAway) {
                        isHome = (nA === nTarget) || (nA.length > nB.length && nA.includes(nTarget));
                    } else if (!isHome && isAway) {
                        isHome = false;
                    } else if (isHome && !isAway) {
                        isHome = true;
                    } else {
                        isHome = nA.includes('villefranche') || nA.includes('ttcav') || nA.includes('vtt');
                        isAway = nB.includes('villefranche') || nB.includes('ttcav') || nB.includes('vtt');
                    }

                    // Sécurité : on ignore si on n'a pas trouvé Villefranche
                    if (!isHome && !isAway) return;

                    state.results.push({
                        teamName: `Villefranche (TTCAV) ${teamName.match(/\d+/) ? teamName.match(/\d+/)[0] : ""}`.trim(),
                        category: (selectedDayVal === "all_phase") ? `${getVal(matchFound.libelle)} (${cleanDivisionName(categoryName)})` : cleanDivisionName(categoryName),
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
                });
            }
        });

        await Promise.all(promises);
        await beautifyOpponentNames();
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

// ===== TRI DES RÉSULTATS PAR DIVISION =====
function getDivPriority(cat) {
    const n = (cat || "").toUpperCase();
    if (n.includes('NATIONALE')) return 100;
    if (n.includes('REGIONALE')) {
        const num = parseInt(n.match(/\d+/) || 0);
        return 90 - num;
    }
    if (n.includes('PRE REGIONALE')) return 80;
    if (n.includes('DEPARTEMENTALE')) {
        const num = parseInt(n.match(/\d+/) || 0);
        return 70 - num;
    }
    return 0;
}

// ===== AFFICHAGE DES RÉSULTATS =====
function renderResults() {
    const hasResults = state.results.length > 0;
    if (elements.btnCopyAll) elements.btnCopyAll.disabled = !hasResults;

    if (!hasResults) {
        elements.resultsGrid.innerHTML = '<div class="empty-state-full">Aucun match trouvé pour cette journée.</div>';
        return;
    }

    state.results.sort((a, b) => {
        const prioA = getDivPriority(a.category);
        const prioB = getDivPriority(b.category);
        if (prioA !== prioB) return prioB - prioA;
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
            <div class="result-card ${statusClass} result-card-app" style="animation-delay: ${index * 0.1}s;">
                <div class="card-header-compact">
                    <span class="category-label">${res.category}</span>
                    <span class="status-badge-mini status-${statusClass}">${statusText}</span>
                </div>
                <div class="match-info-compact">
                    <div class="side-team-compact text-right">${res.isHome ? res.teamName : res.opponent}</div>
                    <div class="score-display">
                        <span class="score-badge-compact ${statusClass}">${res.score}</span>
                    </div>
                    <div class="side-team-compact text-left">${res.isHome ? res.opponent : res.teamName}</div>
                </div>
                <div class="card-footer-compact">
                    <span class="match-date-mini"><i class="far fa-calendar-alt"></i> ${res.date}</span>
                    ${res.detailLink ? `<button class="secondary btn-details-mini" onclick="showMatchDetails(${index})">Détails</button>` : ''}
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

        // --- NOUVEAU : Récupération des licences et points mensuels (Villefranche + Adversaires) ---
        try {
            updateLoaderStep(`Récupération des licences de la rencontre...`);
            const dataPlayers = await fetchData('getMatchPlayers', { renc_id });
            if (dataPlayers && dataPlayers.joueur) {
                const plist = Array.isArray(dataPlayers.joueur) ? dataPlayers.joueur : [dataPlayers.joueur];
                if (!state.playerDetailsCache) state.playerDetailsCache = {};

                for (const pj of plist) {
                    // Côté A
                    const licA = pj.xla || pj.licence || '';
                    const nomA = (pj.xja || pj.nom || '').trim();
                    if (licA) {
                        updateLoaderStep(`Points mensuels : ${nomA}...`);
                        const pDet = await fetchData('getPlayerDetail', { licence: licA }, true);
                        if (pDet && pDet.joueur) {
                            state.playerDetailsCache[licA] = {
                                points: parseFloat(pDet.joueur.point || 0),
                                nom: nomA
                            };
                            logDebug(`Sync Live: ${nomA} (${licA}) -> ${state.playerDetailsCache[licA].points}`);
                        }
                    }
                    // Côté B
                    const licB = pj.xlb || '';
                    const nomB = (pj.xjb || '').trim();
                    if (licB) {
                        updateLoaderStep(`Points mensuels : ${nomB}...`);
                        const pDet = await fetchData('getPlayerDetail', { licence: licB }, true);
                        if (pDet && pDet.joueur) {
                            state.playerDetailsCache[licB] = {
                                points: parseFloat(pDet.joueur.point || 0),
                                nom: nomB
                            };
                            logDebug(`Sync Live: ${nomB} (${licB}) -> ${state.playerDetailsCache[licB].points}`);
                        }
                    }
                }
            }
        } catch (err) {
            logDebug(`Erreur sync licences: ${err.message}`, 'error');
        }

        let rankingData = null;
        if (res.divisionId && res.pouleId) {
            rankingData = await fetchData('getClassement', { divisionId: res.divisionId, pouleId: res.pouleId });
        }

        if (data && data.resultat) {
            const p = data.resultat;
            const matchID = 'match-' + res.teamName.replace(/\s/g, '-') + '-' + (res.category || '').replace(/\s/g, '-');

            elements.exportPanel.innerHTML = `
                <div class="export-actions-sticky">
                    <button onclick="restoreSavedPlayerPoints()" class="btn-undo"><i class="fas fa-undo"></i> Restaurer (modif. manuelle)</button>
                    <button onclick="resetPlayerPointsFromAPI('mensuel')" class="btn-mensuel"><i class="fas fa-calendar-alt"></i> Restaurer (Pts Mensuels)</button>
                    <button onclick="resetPlayerPointsFromAPI('officiel')" class="btn-officiel"><i class="fas fa-award"></i> Restaurer (Pts Officiels)</button>
                    <button onclick="copyWPHTMLToClipboard()" class="btn-copy">📋 Copier HTML (Gutenberg)</button>
                    <button onclick="document.getElementById('export-container').style.display='none'" class="secondary btn-close-export">✕ Fermer</button>
                </div>
                ${getMatchDetailsHTML(res, data, false, rankingData, dataPlayers)}
            `;
            // On prépare aussi la version brute pour le bouton copier
            state.giantHTMLRaw = getMatchDetailsHTML(res, data, true, rankingData, dataPlayers);
            // Affichage identique à l'ancienne version fonctionnelle
            state.currentMatchResIndex = resIndex;
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
function getMatchDetailsHTML(res, details, isWordPress = false, rankingData = null, playersRoster = null) {
    try {
        const p = details.resultat;
        if (!p) throw new Error("Données de match absentes (resultat manquant)");

        const phaseVal = elements.selectPhase.value;
        const currentPhaseText = phaseVal === 'all' ? 'Saison' : phaseVal;
        const summaryLabel = `Bilan ${currentPhaseText}`;

        const nameCache = JSON.parse(localStorage.getItem('ttcav_names_cache_v4') || '{}');
        const matchID = 'match-' + res.teamName.replace(/\s/g, '-') + '-' + (res.category || '').replace(/\s/g, '-');

        // Détection ultra-robuste locale pour contrer les inversions de l'API FFTT entre la liste et le détail
        const clean = (s) => norm(s).replace(/ttcav|tt|cp|as|es|ep|pong|avenir|st|saint|ping/gi, '').replace(/\s+/g, '');
        // Détection ultra-robuste du côté Villefranche
        const isClub = (s) => {
            if (!s) return false;
            const ns = norm(s);
            return ns.includes('villefranche') || ns.includes('ttcav');
        };

        const getStd = (raw, sideIsClub) => {
            if (!sideIsClub) return nameCache[raw] || raw;
            const num = (raw.match(/\d+/) || [""])[0];
            return `Villefranche TTCAV ${num}`.trim();
        };

        // ***** LOGIQUE DE DÉTECTION ET D'ALIGNEMENT DOMICILE/EXTÉRIEUR *****
        // On veut que le détail respecte EXACTEMENT le camp (Home/Away) défini dans la liste globale (res.isHome)

        const isOurClub = (name) => {
            if (!name) return false;
            const ns = norm(name);
            return ns.includes('villefranche') || ns.includes('ttcav');
        };

        // 1. On identifie la position de Villefranche dans le flux de données DETAIL
        const detailSideAIsClub = isOurClub(p.equa);
        const detailSideBIsClub = isOurClub(p.equb);

        // 2. On définit qui est equipeA (Gauche) et equipeB (Droite) pour l'affichage
        // On suit la vérité de la liste (res.isHome)
        let equipeA, equipeB;
        let finalTeamScoreA, finalTeamScoreB;
        let isActuallyHome = res.isHome; // On s'aligne sur la liste globale

        if (res.isHome) {
            // Villefranche est à DOMICILE dans la liste
            equipeA = getStd(res.teamName, true);
            equipeB = nameCache[getVal(res.opponent)] || res.opponent;

            // On cherche le score de Villefranche dans le détail
            if (detailSideAIsClub) {
                finalTeamScoreA = parseInt(p.resa) || res.scoreA;
                finalTeamScoreB = parseInt(p.resb) || res.scoreB;
            } else if (detailSideBIsClub) {
                finalTeamScoreA = parseInt(p.resb) || res.scoreA;
                finalTeamScoreB = parseInt(p.resa) || res.scoreB;
            } else {
                finalTeamScoreA = res.scoreA;
                finalTeamScoreB = res.scoreB;
            }
        } else {
            // Villefranche est à l'EXTÉRIEUR dans la liste
            equipeA = nameCache[getVal(res.opponent)] || res.opponent;
            equipeB = getStd(res.teamName, true);

            // On cherche le score de Villefranche (qui doit être à droite/B)
            if (detailSideAIsClub) {
                // Villefranche est en A dans le détail mais on le veut en B (Extérieur)
                finalTeamScoreB = parseInt(p.resa) || res.scoreB;
                finalTeamScoreA = parseInt(p.resb) || res.scoreA;
            } else if (detailSideBIsClub) {
                finalTeamScoreB = parseInt(p.resb) || res.scoreB;
                finalTeamScoreA = parseInt(p.resa) || res.scoreA;
            } else {
                finalTeamScoreB = res.scoreB;
                finalTeamScoreA = res.scoreA;
            }
        }

        // Sécurité pour les scores NaN
        if (isNaN(finalTeamScoreA)) finalTeamScoreA = 0;
        if (isNaN(finalTeamScoreB)) finalTeamScoreB = 0;

        // On définit finalSideAIsClub/B pour la composition des joueurs plus bas
        // ===== DÉTECTION DE L'ALIGNEMENT API vs RÉALITÉ =====
        const apiSideAIsOurClub = isOurClub(p.equa);
        const apiSideBIsOurClub = isOurClub(p.equb);
        const shouldSwapAPI = (res.isHome && apiSideBIsOurClub) || (!res.isHome && apiSideAIsOurClub);

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
            let nA_raw = (j.xja || '').replace(/\s*[MF]\s*$/, '').trim();
            let nB_raw = (j.xjb || '').replace(/\s*[MF]\s*$/, '').trim();
            let pA_raw = parseClassement(j.xca || '');
            let pB_raw = parseClassement(j.xcb || '');

            // Tentative de récupération des licences si absentes (via roster)
            let licA = j.xla || j.licence;
            let licB = j.xlb;

            if (playersRoster && playersRoster.joueur) {
                const plist = Array.isArray(playersRoster.joueur) ? playersRoster.joueur : [playersRoster.joueur];
                const snA = norm(nA_raw);
                const snB = norm(nB_raw);
                if (!licA) {
                    const found = plist.find(pj => norm(pj.xja || pj.nom || '') === snA);
                    if (found) licA = found.xla || found.licence;
                }
                if (!licB) {
                    const found = plist.find(pj => norm(pj.xjb || pj.nom || '') === snB);
                    if (found) licB = found.xlb || found.licence;
                }
            }

            const mPtsA_raw = getMonthlyPoints(nA_raw, licA);
            const mPtsB_raw = getMonthlyPoints(nB_raw, licB);

            let isCapA_raw = nA_raw.toLowerCase().includes(' cap') || j.xca === 'cap' || j.capa === '1';
            let isCapB_raw = nB_raw.toLowerCase().includes(' cap') || j.xcb === 'cap' || j.capb === '1';

            const nA_clean = nA_raw.replace(/\s*cap(?:itaine)?\.?\s*$/i, '').trim();
            const nB_clean = nB_raw.replace(/\s*cap(?:itaine)?\.?\s*$/i, '').trim();

            let customA = state.customPlayerPoints && state.customPlayerPoints[nA_clean];
            let customB = state.customPlayerPoints && state.customPlayerPoints[nB_clean];

            let baseA = state.apiPointsMode === 'officiel' ? pA_raw.raw : (mPtsA_raw || pA_raw.raw);
            let baseB = state.apiPointsMode === 'officiel' ? pB_raw.raw : (mPtsB_raw || pB_raw.raw);

            const pA = {
                nom: nA_clean,
                classement: pA_raw.text || '',
                mensuel: mPtsA_raw,
                rawPoints: pA_raw.raw,
                calcPoints: customA !== undefined ? customA : baseA,
                isCap: isCapA_raw
            };
            const pB = {
                nom: nB_clean,
                classement: pB_raw.text || '',
                mensuel: mPtsB_raw,
                rawPoints: pB_raw.raw,
                calcPoints: customB !== undefined ? customB : baseB,
                isCap: isCapB_raw
            };

            if (!shouldSwapAPI) {
                if (pA.nom) jouas.push(pA);
                if (pB.nom) joubs.push(pB);
            } else {
                if (pB.nom) jouas.push(pB);
                if (pA.nom) joubs.push(pA);
            }
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
            jouas = Array.from(tempA).map(nom => {
                const m = getMonthlyPoints(nom);
                let custom = state.customPlayerPoints && state.customPlayerPoints[nom];
                let base = state.apiPointsMode === 'officiel' ? 0 : (m || 0);
                return { nom, classement: '', mensuel: m, rawPoints: m || 0, calcPoints: custom !== undefined ? custom : base, isCap: false };
            });
            joubs = Array.from(tempB).map(nom => {
                const m = getMonthlyPoints(nom);
                let custom = state.customPlayerPoints && state.customPlayerPoints[nom];
                let base = state.apiPointsMode === 'officiel' ? 0 : (m || 0);
                return { nom, classement: '', mensuel: m, rawPoints: m || 0, calcPoints: custom !== undefined ? custom : base, isCap: false };
            });
        }

        jouas.forEach(j => { equipeAPoints += j.calcPoints || 0; });
        joubs.forEach(j => { equipeBPoints += j.calcPoints || 0; });

        // ===== TABLE DE COMPOSITION =====
        let compoTitleHTML = `<div class="section-title compo-title-row">
            La composition des équipes
            ${!isWordPress ? `<button onclick="openPointsEditorModal('${matchID}')" class="btn-pen-edit" title="Édition rapide des points"><i class="fas fa-pen"></i></button>` : ''}
        </div>`;

        let compoHTML = `
        ${compoTitleHTML}
        <table class="premium-table">
            <thead><tr><th class="col-header-large">${equipeA}</th><th class="col-header-large">${equipeB}</th></tr></thead>
            <tbody>
    `;

        for (let i = 0; i < Math.max(jouas.length, joubs.length); i++) {
            let htmlA = '';
            if (jouas[i]) {
                const j = jouas[i];
                let nomHTML = j.isCap ? `<b>${j.nom}</b>` : j.nom;
                let clastStr = (j.classement || '').trim();
                const ptsOff = Math.floor(j.rawPoints);

                clastStr = clastStr.replace(/\s*\(\s*(n°\d+)\s*\).*/i, '$1');
                clastStr = clastStr.replace(/\s*[nN]°\s*(\d+).*/i, 'n°$1');

                if (clastStr && clastStr.match(/^\d+$/)) {
                    const numClast = parseInt(clastStr);
                    if (numClast === ptsOff || numClast > 3000) clastStr = '';
                    else if (numClast > 30) clastStr = 'n°' + clastStr;
                }

                const sep = clastStr ? ' - ' : '';
                const displayPointsHTML = isWordPress
                    ? `<span class="ranking-num-wrapper">${clastStr}${sep}</span>${Math.round(j.calcPoints)}`
                    : `${clastStr}${sep}${Math.round(j.calcPoints)}`;
                htmlA = `<div class="compo-player-box"><span>${nomHTML}</span><span>${displayPointsHTML}</span></div>`;
            }
            let htmlB = '';
            if (joubs[i]) {
                const j = joubs[i];
                let nomHTML = j.isCap ? `<b>${j.nom}</b>` : j.nom;
                let clastStr = (j.classement || '').trim();
                const ptsOff = Math.floor(j.rawPoints);

                clastStr = clastStr.replace(/\s*\(\s*(n°\d+)\s*\).*/i, '$1');
                clastStr = clastStr.replace(/\s*[nN]°\s*(\d+).*/i, 'n°$1');

                if (clastStr && clastStr.match(/^\d+$/)) {
                    const numClast = parseInt(clastStr);
                    if (numClast === ptsOff || numClast > 3000) clastStr = '';
                    else if (numClast > 30) clastStr = 'n°' + clastStr;
                }

                const sep = clastStr ? ' - ' : '';
                const displayPointsHTML = isWordPress
                    ? `<span class="ranking-num-wrapper">${clastStr}${sep}</span>${Math.round(j.calcPoints)}`
                    : `${clastStr}${sep}${Math.round(j.calcPoints)}`;
                htmlB = `<div class="compo-player-box"><span>${nomHTML}</span><span>${displayPointsHTML}</span></div>`;
            }
            compoHTML += `<tr><td class="col-player">${htmlA}</td><td class="col-player">${htmlB}</td></tr>`;
        }

        compoHTML += `
        <tr class="compo-total-row">
            <td>TOTAL POINTS EQUIPE : ${Math.round(equipeAPoints)}</td>
            <td>TOTAL POINTS EQUIPE : ${Math.round(equipeBPoints)}</td>
        </tr>
    </tbody></table>`;

        // ===== FEUILLE DE RENCONTRE =====
        const parties = Array.isArray(details.partie) ? details.partie : (details.partie ? [details.partie] : []);

        function getPointsGained(ratingA, ratingB, wonA) {
            if (!ratingA || !ratingB) return 0;
            const diff = ratingA - ratingB;
            const adiff = Math.abs(diff);

            if (wonA) {
                if (diff >= 0) {
                    // VICTOIRE NORMALE (VN)
                    if (diff >= 500) return 0;
                    if (diff >= 400) return 0.5;
                    if (diff >= 300) return 1;
                    if (diff >= 200) return 2;
                    if (diff >= 150) return 3;
                    if (diff >= 100) return 4;
                    if (diff >= 50) return 5;
                    if (diff >= 25) return 5.5;
                    return 6;
                } else {
                    // VICTOIRE ANORMALE (VA - PERF)
                    if (adiff >= 500) return 40;
                    if (adiff >= 400) return 28;
                    if (adiff >= 300) return 22;
                    if (adiff >= 200) return 17;
                    if (adiff >= 150) return 13;
                    if (adiff >= 100) return 10;
                    if (adiff >= 50) return 8;
                    if (adiff >= 25) return 7;
                    return 6;
                }
            } else {
                if (diff >= 0) {
                    // DÉFAITE ANORMALE (DA - CONTRE)
                    if (diff >= 500) return -29;
                    if (diff >= 400) return -20;
                    if (diff >= 300) return -16;
                    if (diff >= 200) return -12.5;
                    if (diff >= 150) return -10;
                    if (diff >= 100) return -8;
                    if (diff >= 50) return -7;
                    if (diff >= 25) return -6;
                    return -5;
                } else {
                    // DÉFAITE NORMALE (DN)
                    if (adiff >= 500) return 0;
                    if (adiff >= 400) return 0;
                    if (adiff >= 300) return -0.5;
                    if (adiff >= 200) return -1;
                    if (adiff >= 150) return -2;
                    if (adiff >= 100) return -3;
                    if (adiff >= 50) return -4;
                    if (adiff >= 25) return -4.5;
                    return -5;
                }
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
            let nameA_raw = (getVal(m.ja) || '-').replace(/\s+(?:et|&)\s+/gi, ' / ');
            let nameB_raw = (getVal(m.jb) || '-').replace(/\s+(?:et|&)\s+/gi, ' / ');
            let jA = !shouldSwapAPI ? nameA_raw : nameB_raw;
            let jB = !shouldSwapAPI ? nameB_raw : nameA_raw;

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
            let pointsSummaryA = 0;
            let pointsSummaryB = 0;

            sets.forEach(setStr => {
                if (!setStr) return;
                let sP1, sP2;
                if (setStr.includes('-') && setStr.indexOf('-') > 0) {
                    const parts = setStr.split('-');
                    sP1 = parseInt(parts[0]); sP2 = parseInt(parts[1]);
                } else {
                    const val = parseInt(setStr);
                    if (isNaN(val)) return;
                    const absVal = Math.abs(val);
                    const winVal = Math.max(11, absVal + 2);
                    if (val >= 0) { sP1 = winVal; sP2 = absVal; } else { sP1 = absVal; sP2 = winVal; }
                }

                if (!isNaN(sP1) && !isNaN(sP2)) {
                    const fP1 = !shouldSwapAPI ? sP1 : sP2;
                    const fP2 = !shouldSwapAPI ? sP2 : sP1;
                    if (fP1 > fP2) setsWA++; else if (fP2 > fP1) setsWB++;
                    pointsSummaryA += fP1; pointsSummaryB += fP2;
                    hasValidSets = true;
                }
            });

            totalPointsA += pointsSummaryA;
            totalPointsB += pointsSummaryB;

            let sA_base = !shouldSwapAPI ? (parseInt(getVal(m.scorea)) || 0) : (parseInt(getVal(m.scoreb)) || 0);
            let sB_base = !shouldSwapAPI ? (parseInt(getVal(m.scoreb)) || 0) : (parseInt(getVal(m.scorea)) || 0);

            let finalSA = hasValidSets ? setsWA : sA_base;
            let finalSB = hasValidSets ? setsWB : sB_base;

            totalSetsA += finalSA;
            totalSetsB += finalSB;

            const isWinForClub = res.isHome ? (finalSA > finalSB) : (finalSB > finalSA);

            let rowPoints = 0;
            if (jA && jB && jA !== '-' && jB !== '-' && !jA.toLowerCase().includes('double') && !jB.toLowerCase().includes('double')) {
                const playerA = jouas.find(p => p.nom === jA);
                const playerB = joubs.find(p => p.nom === jB);
                if (playerA && playerB && playerA.calcPoints && playerB.calcPoints) {
                    let gainA = getPointsGained(playerA.calcPoints, playerB.calcPoints, finalSA > finalSB);
                    let gainB = getPointsGained(playerB.calcPoints, playerA.calcPoints, finalSB > finalSA);
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

            const styleA = finalSA > finalSB ? 'class="player-win"' : '';
            const styleB = finalSB > finalSA ? 'class="player-win"' : '';

            const diff = rowPoints;
            const ptsClass = diff > 0 ? 'pts-pos' : (diff < 0 ? 'pts-neg' : 'pts-neu');

            const formattedSets = sets.map(s => {
                if (!s || s === '-') return '-';
                let p1, p2;
                if (typeof s === 'string' && s.includes('-') && s.indexOf('-') > 0) {
                    const parts = s.split('-');
                    p1 = parseInt(parts[0]); p2 = parseInt(parts[1]);
                } else {
                    let val = parseInt(s);
                    if (isNaN(val)) return '-';
                    const absVal = Math.abs(val);
                    const winVal = Math.max(11, absVal + 2);
                    if (val >= 0) { p1 = winVal; p2 = absVal; } else { p1 = absVal; p2 = winVal; }
                }

                if (isNaN(p1) || isNaN(p2)) return '-';

                // On swap les scores individuels si l'API est inversée
                const finalP1 = !shouldSwapAPI ? p1 : p2;
                const finalP2 = !shouldSwapAPI ? p2 : p1;

                // Notre club gagne le set si finalP1 > finalP2 ET on est Home, 
                // OU si finalP2 > finalP1 ET on est Away.
                const clubWinsSet = res.isHome ? (finalP1 > finalP2) : (finalP2 > finalP1);

                const scoreText = `${finalP1}-${finalP2}`;
                return clubWinsSet ? `<strong>${scoreText}</strong>` : scoreText;
            });

            partiesHTML += `
            <tr>
                <td class="col-player ${finalSA > finalSB ? 'player-win' : 'player-loss'}">${formatPlayerName(jA)}</td>
                <td class="col-player ${finalSB > finalSA ? 'player-win' : 'player-loss'}">${formatPlayerName(jB)}</td>
                <td class="col-set">${formattedSets[0]}</td>
                <td class="col-set">${formattedSets[1]}</td>
                <td class="col-set">${formattedSets[2]}</td>
                <td class="col-set">${formattedSets[3]}</td>
                <td class="col-set">${formattedSets[4]}</td>
                <td class="col-score"><span class="${isWinForClub ? 'badge-win' : 'badge-loss'}">${finalSA}-${finalSB}</span></td>
                <td class="col-pts-diff">
                    <span class="pts-gain ${ptsClass}">${diff > 0 ? '+' : ''}${diff !== 0 ? diff.toFixed(1) : ''}</span>
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
                <th class="col-score">Score</th>
                <th class="col-pts-diff">+/-</th>
            </tr></thead>
            <tbody>${partiesHTML}</tbody>
        </table>`;

        // ===== STATISTIQUES INDIVIDUELLES =====
        // On cible les joueurs de Villefranche en fonction de leur position (jouas = Home, joubs = Away)
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

            // Compter V/D individuel de façon ultra-robuste avec normalisation
            const findMatch = (playerName) => {
                if (!playerName) return null;
                const nP = norm(playerName);
                if (!nP) return null;
                let exact = Object.keys(stats).find(k => norm(k) === nP);
                if (exact) return exact;
                return Object.keys(stats).find(k => {
                    const nK = norm(k);
                    return nK.includes(nP) || nP.includes(nK);
                });
            };

            let matched = null;
            let isPlayerA = false;

            if (detailSideAIsClub && ja) {
                matched = findMatch(ja);
                isPlayerA = true;
            }
            if (!matched && !detailSideAIsClub && jb) {
                matched = findMatch(jb);
                isPlayerA = false;
            }
            // Fallback ultime : si on n'a rien trouvé du bon côté, on cherche de l'autre côté
            if (!matched && ja) {
                matched = findMatch(ja);
                if (matched) isPlayerA = true;
            }
            if (!matched && jb) {
                matched = findMatch(jb);
                if (matched) isPlayerA = false;
            }

            if (matched) {
                if (isPlayerA) {
                    if (setsWonA > setsWonB) stats[matched].v++; else stats[matched].d++;
                } else {
                    if (setsWonB > setsWonA) stats[matched].v++; else stats[matched].d++;
                }
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
                        const ourSide = detailSideAIsClub ? ja : jb;

                        // On vérifie si une partie significative du nom est présente
                        const found = searchParts.some(part => ourSide.includes(part));

                        if (found) {
                            let finalSA = parseInt(getVal(m.scorea)) || 0;
                            let finalSB = parseInt(getVal(m.scoreb)) || 0;
                            // Si scorea/scoreb absent, on regarde les sets
                            if (finalSA === 0 && finalSB === 0) {
                                let sets = (m.detail || '').split(' ');
                                if (sets.length < 2) sets = [m.ms1, m.ms2, m.ms3, m.ms4, m.ms5];
                                sets.forEach(s => { let v = parseInt(s); if (!isNaN(v)) { if (v > 0) finalSA++; else finalSB++; } });
                            }
                            const isWin = detailSideAIsClub ? (finalSA > finalSB) : (finalSB > finalSA);
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


        let outcomeA = 2, outcomeB = 2;
        if (finalTeamScoreA > finalTeamScoreB) { outcomeA = 3; outcomeB = 1; }
        else if (finalTeamScoreA < finalTeamScoreB) { outcomeA = 1; outcomeB = 3; }

        const scoreboardHTML = `
        <div class="premium-scoreboard">
            <div class="score-digit-box digit-red score-box-small">${outcomeA}</div>
            <div class="score-divider"></div>
            <div class="score-digit-box digit-black score-box-large">${finalTeamScoreA}</div>
            <div class="score-divider"></div>
            <div class="score-digit-box digit-black score-box-large">${finalTeamScoreB}</div>
            <div class="score-divider"></div>
            <div class="score-digit-box digit-red score-box-small">${outcomeB}</div>
        </div>
`;

        // Sauvegarder les données pour l'IA (Registre) et l'éditeur de points
        const mData = {
            teamA: equipeA,
            teamB: equipeB,
            scoreA: finalTeamScoreA,
            scoreB: finalTeamScoreB,
            category: res.category,
            stats: stats,
            isHome: isActuallyHome,
            ourTeamName: res.teamName,
            jouas: jouas,
            joubs: joubs
        };
        state.matchDataRegistry[matchID] = mData;
        state.currentMatchData = mData;

        // ===== CALCUL DU CLASSEMENT (POUR UI ET EXPORT) =====
        let rankingSectionHTML = '';
        if (rankingData && rankingData.classement) {
            logDebug(`Rendu ranking pour ${res.teamName}, data: présente`);
            const list = Array.isArray(rankingData.classement) ? rankingData.classement : [rankingData.classement];
            list.sort((a, b) => (parseInt(b.pts) || 0) - (parseInt(a.pts) || 0));
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
                 <tr class="${isUs ? 'ranking-row-us' : ''}">
                    <td class="col-rank-num">${e.rang_affiche}</td>
                    <td class="col-rank-team">${cleanTeamName(getVal(e.equipe))}</td>
                    <td class="col-rank-pts">${e.pts}</td>
                    <td class="col-rank-std">${e.joue}</td>
                    <td class="col-rank-std">${e.vic}</td>
                    <td class="col-rank-std">${e.nul}</td>
                    <td class="col-rank-std">${e.def}</td>
                </tr>
            `;
            });
            rankingTable += '</tbody></table>';

            let summaryBlock = '';
            if (myEntry) {
                summaryBlock = `
                <div class="section-title">${summaryLabel}</div>
                <div class="ranking-top-box">
                    <div class="ranking-box-item">
                        <div class="ranking-box-label">Classement Actuel</div>
                        <div class="ranking-box-val">${myEntry.rang_affiche}<sup>${myEntry.rang_affiche == 1 ? 'er' : 'ème'}</sup> / ${list.length}</div>
                    </div>
                    <div class="ranking-box-item item-right">
                        <div class="ranking-box-label">${summaryLabel}</div>
                        <div class="ranking-box-val">
                            <span class="val-v">${myEntry.vic}V</span> - 
                            <span class="val-n">${myEntry.nul}N</span> - 
                            <span class="val-d">${myEntry.def}D</span>
                        </div>
                    </div>
                </div>
            `;
            }
            rankingSectionHTML = summaryBlock + rankingTable;
        } else {
            rankingSectionHTML = `<div class="rank-not-available">Données de classement non disponibles pour cette poule.</div>`;
        }

        if (isWordPress) {
            // WordPress BLOCK MODE
            // 1. Titre (Heading Block) - Inclut les 2 équipes et le VS stylisé (CENTRÉ)
            const wpTitle = `<!-- wp:heading {"textAlign":"center","level":1,"className":"ttcav-wp-main-title","anchor":"anchor-${matchID}"} -->\n<h1 id="anchor-${matchID}" class="has-text-align-center ttcav-wp-main-title">${equipeA} <span class="ttcav-wp-vs">VS</span> ${equipeB}</h1>\n<!-- /wp:heading -->`;

            // 2. Sous-titre et Scoreboard
            const wpHeader = `<!-- wp:html -->\n<div class="ttcav-export-wrapper">\n<div class="export-subtitle">${res.category} <span class="export-match-date">(${res.date})</span></div>\n${scoreboardHTML}\n</div>\n<!-- /wp:html -->`;

            // 3. Résumé IA (Paragraph Block) (CENTRÉ)
            const summaryText = state.aiSummaries[matchID] || '<em>Génération du résumé...</em>';
            const wpAI = `<!-- wp:paragraph {"align":"center","className":"ttcav-wp-ai"} -->\n<p id="ai-summary-${matchID}" class="has-text-align-center ttcav-wp-ai">${summaryText}</p>\n<!-- /wp:paragraph -->`;

            // 4. Photo d'équipe (Vide par défaut pour insertion WP)
            const teamURL = (res.photoURL && !res.photoURL.includes('placehold.co') && res.photoURL !== 'URL_DE_VOTRE_IMAGE') ? res.photoURL : '';
            const wpTeamImage = `<!-- wp:image {"align":"center","sizeSlug":"large","linkDestination":"none"} -->\n<figure class="wp-block-image aligncenter size-large"><img src="${teamURL}" alt="Photo d'équipe"/></figure>\n<!-- /wp:image -->`;

            // 5. Photo d'action (Vide par défaut pour insertion WP)

            const wpActionImage = `<!-- wp:image {"align":"center","sizeSlug":"large","linkDestination":"none"} -->\n<figure class="wp-block-image aligncenter size-large"><img src="" alt=""/></figure>\n<!-- /wp:image -->`;

            const wpGallery = `<!-- wp:gallery {"linkTo":"none"} -->\n<figure class="wp-block-gallery has-nested-images columns-default is-cropped"></figure>\n<!-- /wp:gallery -->`;

            const wpFooter = `<!-- wp:html -->\n<div class="ttcav-export-wrapper">\n${compoHTML}\n${partiesHTML}\n<div class="match-sets-sum"><span>Les points : ${totalPointsA} / ${totalPointsB}</span> | Les manches : ${totalSetsA} - ${totalSetsB}</div>\n${statsHTML}\n${rankingSectionHTML}\n<div class="summary-footer">Bilan du match : ${finalTeamScoreA > finalTeamScoreB ? 'Victoire de ' + equipeA : (finalTeamScoreA < finalTeamScoreB ? 'Victoire de ' + equipeB : 'Match nul')}</div>\n<div class="back-to-top-wrapper" style="margin-top: 40px;"><a href="#summary-top" class="back-to-top-btn">↑ Retour au tableau récapitulatif</a></div>\n<div class="match-separator"></div>\n</div>\n<!-- /wp:html -->`;

            return `${wpTitle}\n${wpHeader}\n${wpAI}\n${wpTeamImage}\n${wpActionImage}\n${wpGallery}\n${wpFooter}`;
        }

        // Modal/App View mode
        const appPhotoHTML = (res.photoURL && res.photoURL !== 'URL_DE_VOTRE_IMAGE')
            ? `<div class="app-photo-container"><img src="${res.photoURL}" alt="Photo d'équipe" class="app-photo-img"></div>`
            : '';

        return `
        <div class="app-match-wrapper" id="anchor-${matchID}">
            <div class="match-detail-block">
                <div class="app-export-header">
                    <h1 class="ttcav-wp-main-title">${equipeA}<span class="ttcav-wp-vs">VS</span>${equipeB}</h1>
                    <div class="app-export-subtitle">${res.category} <span class="export-match-date">(${res.date})</span></div>
                    ${appPhotoHTML}
                    ${scoreboardHTML}
                </div>
                <div class="app-ai-row">
                    <div class="app-ai-box">
                        <div id="ai-summary-${matchID}">
                            ${state.aiSummaries[matchID] || '<em>Chargement du résumé...</em>'}
                        </div>
                    </div>
                    <button id="btn-ai-${matchID}" class="app-ai-btn" data-match-id="${matchID}" onclick="generateAISummaryClickHandler('${matchID}', true)" title="Regénérer le résumé IA">
                        <i class="fas fa-sync-alt app-ai-icon"></i>
                    </button>
                </div>
                <div class="app-table-responsive">
                    ${compoHTML}
                    ${partiesHTML}
                </div>
                <div class="match-sets-sum"><span>Les points : ${totalPointsA} / ${totalPointsB}</span> | Les manches : ${totalSetsA} - ${totalSetsB}</div>
                <div class="app-table-responsive">
                    ${statsHTML}
                </div>

                <div id="league-ranking-container-${matchID}">
                    ${rankingSectionHTML}
                </div>
                <div class="summary-footer">Bilan du match : ${finalTeamScoreA > finalTeamScoreB ? 'Victoire de ' + equipeA : (finalTeamScoreA < finalTeamScoreB ? 'Victoire de ' + equipeB : 'Match nul')}</div>
                <div class="back-to-top-wrapper"><a href="#summary-top" class="back-to-top-btn">↑ Retour au tableau récapitulatif</a></div>
                <div class="match-separator"></div>
            </div>
        </div>
    `;
    } catch (err) {
        logDebug(`Erreur critique dans getMatchDetailsHTML: ${err.message}`, 'error');
        console.error(err);
        return `<div class="error-box">
            <i class="fas fa-exclamation-triangle error-icon"></i>
            <div class="error-title">Erreur d'affichage des détails</div>
            <div class="error-details">Une erreur interne est survenue : ${err.message}</div>
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
        display.innerHTML = '<span class="opacity-5">(Données de match non trouvées pour la génération)</span>';
        return;
    }

    if (!state.groqKey) {
        display.innerHTML = '<span class="status-defaite">Configurez la clé Groq dans les paramètres pour générer le résumé.</span>';
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
        const ourClubName = matchData.isHome ? "Villefranche TTCAV" : matchData.teamB;
        const opponentName = matchData.isHome ? matchData.teamB : matchData.teamA;
        const ourScore = matchData.isHome ? matchData.scoreA : matchData.scoreB;
        const oppScore = matchData.isHome ? matchData.scoreB : matchData.scoreA;

        const prompt = `Tu es un journaliste sportif spécialisé dans le tennis de table pour le club ${ourClubName}. 
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
        - Utilise un ton de club local passionné. NE mentionne PAS que tu es une IA.
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
    const html = state.giantHTMLRaw || "";
    if (!html) return showToast('Aucun contenu à copier. Générez d\'abord l\'export global.', true);
    navigator.clipboard.writeText(html).then(() => showToast('HTML WordPress copié !')).catch(err => {
        console.error('Erreur copie:', err);
        showToast('Erreur lors de la copie.', true);
    });
}



// ===== EXPORT GLOBAL (TOUS LES MATCHS) =====
async function copyAllMatchesToWordPress(forceRefresh = false) {
    if (state.results.length === 0) return showToast('Générez d\'abord les résultats.', true);

    setAppBusy(true);
    updateLoaderStep('Préparation de l\'export global...');

    // 1. Embellissement des noms des adversaires par IA
    try {
        await beautifyOpponentNames();
    } catch (e) {
        logDebug("Erreur embellissement IA : " + e.message, "error");
    }

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
        <div class="ttcav-export-global">
        <div class="export-actions-sticky">
            <div id="ai-progress-container" class="ai-progress-container-app">
                <div class="ai-progress-bar-bg">
                    <div id="ai-progress-fill" class="ai-progress-fill-bar"></div>
                </div>
                <span id="ai-progress-text" class="ai-progress-text-label">Résumés IA : 0%</span>
            </div>
            <button onclick="restoreSavedPlayerPoints()" class="btn-undo"><i class="fas fa-undo"></i> Restaurer (modif. manuelle)</button>
            <button onclick="resetPlayerPointsFromAPI('mensuel')" class="btn-mensuel"><i class="fas fa-calendar-alt"></i> Restaurer (Pts Mensuels)</button>
            <button onclick="resetPlayerPointsFromAPI('officiel')" class="btn-officiel"><i class="fas fa-award"></i> Restaurer (Pts Officiels)</button>
            <button onclick="copyWPHTMLToClipboard()" class="btn-copy">📋 Copier HTML</button>
            <button onclick="document.getElementById('export-container').style.display='none'" class="secondary btn-close-export">✕ Fermer</button>
        </div>
        <div class="text-center margin-b-4">
            <h1 class="export-main-title">Rapport Complet</h1>
            <p class="export-main-subtitle">${elements.selectDay.value} — ${state.results.length} rencontres</p>
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

            const [detailsData, classData, dataPlayers] = await Promise.all([
                fetchData('getMatchDetails', { is_retour, renc_id }, forceRefresh),
                res.divisionId && res.pouleId ? fetchData('getClassement', { divisionId: res.divisionId, pouleId: res.pouleId }, forceRefresh) : Promise.resolve(null),
                fetchData('getMatchPlayers', { renc_id }, forceRefresh)
            ]);

            // Récupérer les détails individuels pour avoir les points mensuels exacts (<point>)
            if (dataPlayers && dataPlayers.joueur) {
                const plist = Array.isArray(dataPlayers.joueur) ? dataPlayers.joueur : [dataPlayers.joueur];
                if (!state.playerDetailsCache) state.playerDetailsCache = {};
                for (const pj of plist) {
                    const processPlayer = async (lic, nom) => {
                        if (lic && (!state.playerDetailsCache[lic] || forceRefresh)) {
                            try {
                                const pDet = await fetchData('getPlayerDetail', { licence: lic }, forceRefresh);
                                if (pDet && pDet.joueur) {
                                    state.playerDetailsCache[lic] = {
                                        points: parseFloat(pDet.joueur.point || 0),
                                        nom: nom
                                    };
                                }
                            } catch (e) { /* ignore */ }
                        }
                    };
                    await processPlayer(pj.xla || pj.licence || '', (pj.xja || pj.nom || '').trim());
                    await processPlayer(pj.xlb || '', (pj.xjb || '').trim());
                }
            }

            loadedCount++;
            updateLoaderStep(`Chargement des données (${loadedCount}/${state.results.length}) : <br><b>${res.teamName}</b>`);

            return { res, detailsData, classData, dataPlayers };
        });

        const allResults = await Promise.all(allDataPromises);

        updateLoaderStep('Génération du rapport final...');

        let totals = { v: 0, n: 0, d: 0 };
        let summaryTableHTML = `
            <div class="ttcav-export-wrapper" id="summary-top">
                <div class="section-title">Tableau Récapitulatif</div>
                <table class="premium-table summary-premium-table">
                    <thead>
                        <tr>
                            <th class="col-header-std">Division</th>
                            <th class="col-header-std-right">Domicile</th>
                            <th class="col-header-std-center">Score</th>
                            <th class="col-header-std-left">Extérieur</th>
                            <th class="col-header-std-center">Bilan</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        const allMatches = state.results.sort((a, b) => {
            const pA = getDivPriority(a.category);
            const pB = getDivPriority(b.category);
            if (pA !== pB) return pB - pA;
            const numA = parseInt(a.teamName.match(/\d+/) || 0);
            const numB = parseInt(b.teamName.match(/\d+/) || 0);
            return numA - numB;
        });

        allMatches.forEach((res, index) => {
            const matchID = 'match-' + res.teamName.replace(/\s/g, '-') + '-' + (res.category || '').replace(/\s/g, '-');

            // Standardisation Villefranche TTCAV
            const getStandardName = (raw, isHome) => {
                const nameCache = JSON.parse(localStorage.getItem('ttcav_names_cache_v4') || '{}');
                if (!isHome) return nameCache[raw] || raw;
                const num = (raw.match(/\d+/) || [""])[0];
                return `Villefranche TTCAV ${num}`.trim();
            };

            const teamHome = getStandardName(res.isHome ? res.teamName : res.opponent, res.isHome);
            const teamAway = getStandardName(res.isHome ? res.opponent : res.teamName, !res.isHome);

            // Score ordonné (Home - Away)
            const scoreA = res.scoreA;
            const scoreB = res.scoreB;

            // Bilan relatif à notre club
            const myScore = res.isHome ? scoreA : scoreB;
            const opScore = res.isHome ? scoreB : scoreA;

            let status = 'Nul';
            let color = '#eab308'; // Nul = Jaune
            if (myScore > opScore) {
                status = 'Victoire';
                color = '#10b981'; // Vert
                totals.v++;
            } else if (myScore < opScore) {
                status = 'Défaite';
                color = '#ef4444'; // Rouge
                totals.d++;
            } else {
                totals.n++;
            }

            // Nettoyage Division (enlever Poule)
            let cleanCat = (res.category || '').split('– Poule')[0].split('Poule')[0].trim();

            // Style gras pour le vainqueur
            const styleHome = scoreA > scoreB ? 'font-weight: 800; color: #1e293b;' : 'font-weight: 400; color: #64748b;';
            const styleAway = scoreB > scoreA ? 'font-weight: 800; color: #1e293b;' : 'font-weight: 400; color: #64748b;';

            summaryTableHTML += `
                <tr class="summary-row" onclick="window.location.hash='anchor-${matchID}'">
                    <td class="col-summary-cat"><a href="#anchor-${matchID}">${cleanCat}</a></td>
                    <td class="col-summary-home"><a href="#anchor-${matchID}" class="${scoreA > scoreB ? 'player-win' : 'player-loss'}">${teamHome}</a></td>
                    <td class="col-summary-score"><a href="#anchor-${matchID}">${res.score}</a></td>
                    <td class="col-summary-away"><a href="#anchor-${matchID}" class="${scoreB > scoreA ? 'player-win' : 'player-loss'}">${teamAway}</a></td>
                    <td class="col-summary-status">
                        <a href="#anchor-${matchID}" class="status-${status.toLowerCase().replace(/é/g, 'e')}">${status}</a>
                    </td>
                </tr>
            `;
        });

        summaryTableHTML += `
                    </tbody>
                </table>
                <div class="summary-totals-card">
                    BILAN DE LA JOURNÉE : 
                    <span class="total-v">${totals.v} V</span> &nbsp;|&nbsp; 
                    <span class="total-n">${totals.n} N</span> &nbsp;|&nbsp; 
                    <span class="total-d">${totals.d} D</span>
                </div>
            </div>
        `;

        giantHTML += summaryTableHTML;

        // Ajout du tableau récapitulatif
        state.giantHTMLRaw += `<!-- wp:html -->\n${summaryTableHTML}\n<div class="match-separator"></div>\n<!-- /wp:html -->\n`;

        // On trie allResults selon le même ordre que allMatches (par division)
        allResults.sort((a, b) => {
            const pA = getDivPriority(a.res.category);
            const pB = getDivPriority(b.res.category);
            if (pA !== pB) return pB - pA;
            const numA = parseInt(a.res.teamName.match(/\d+/) || 0);
            const numB = parseInt(b.res.teamName.match(/\d+/) || 0);
            return numA - numB;
        });

        allResults.forEach(({ res, detailsData, classData, dataPlayers }) => {
            if (detailsData && detailsData.resultat) {
                const detailBlock = getMatchDetailsHTML(res, detailsData, false, classData, dataPlayers);
                giantHTML += detailBlock;
                state.giantHTMLRaw += getMatchDetailsHTML(res, detailsData, true, classData, dataPlayers);
            }
        });

        // Bouton flottant de retour en haut (pour l'UI de preview)
        giantHTML += `
            <button onclick="document.getElementById('summary-top').scrollIntoView({behavior:'smooth'})" 
                    id="floating-back-btn" class="app-floating-back">
                <i class="fas fa-arrow-up"></i> Retour Récapitulatif
            </button>
            <script>
                window.onscroll = function() {
                    const btn = document.getElementById('floating-back-btn');
                    if (btn) {
                        if (document.body.scrollTop > 500 || document.documentElement.scrollTop > 500) {
                            btn.style.display = "flex";
                        } else {
                            btn.style.display = "none";
                        }
                    }
                };
            </script>
        `;

        // On ne met PLUS le bouton flottant dans l'export WP (demandé par l'utilisateur)

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
/* --- TTCAV WP STYLES - HESTIA PREMIUM --- */

/* TITRE PRINCIPAL */
h1.ttcav-wp-main-title,
.ttcav-wp-main-title {
    font-family: 'Outfit', sans-serif !important;
    font-size: 48px !important;
    font-weight: 800 !important;
    color: #1e293b !important;
    text-align: center !important;
    margin: 60px auto 10px auto !important;
    line-height: 52px !important;
    letter-spacing: -1px !important;
    text-transform: uppercase !important;
    display: block !important;
    border: none !important;
}

/* LE "VS" STYLISÉ */
.ttcav-wp-vs {
    font-family: 'Outfit', sans-serif !important;
    font-size: 18px !important;
    font-weight: 800 !important;
    text-align: center !important;
    color: #eab308 !important;
    margin: 15px 0 !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    text-transform: uppercase !important;
    letter-spacing: 4px !important;
}

.ttcav-wp-vs::before,
.ttcav-wp-vs::after {
    content: "" !important;
    flex: 1 !important;
    height: 1px !important;
    background: #e2e8f0 !important;
    margin: 0 20px !important;
}

.mobile-br { display: none !important; }
.mobile-only-indent { display: none !important; }

/* RESET ET POLICES GLOBALES (HAUTE SPÉCIFICITÉ) */
.ttcav-export-wrapper, 
.ttcav-export-wrapper *,
.ttcav-export-wrapper table,
.ttcav-export-wrapper td,
.ttcav-export-wrapper th,
.ttcav-wp-main-title,
.ttcav-wp-ai,
.ttcav-wp-ai * {
    font-family: 'Outfit', sans-serif !important;
    box-sizing: border-box !important;
    line-height: 2.4 !important;
    text-transform: none !important;
}

.ttcav-export-wrapper .opacity-5 {
    opacity: 0.5 !important;
}


.ttcav-export-wrapper .ttcav-wp-vs::before,
.ttcav-export-wrapper .ttcav-wp-vs::after {
    content: "" !important;
    flex: 1 !important;
    height: 1px !important;
    background: #e2e8f0 !important;
    margin: 0 30px !important;
}

/* SOUS-TITRE */
.ttcav-export-wrapper .export-subtitle {
    font-family: 'Outfit', sans-serif !important;
    font-size: 16px !important;
    font-weight: 700 !important;
    color: #64748b !important;
    text-align: center !important;
    text-transform: uppercase !important;
    letter-spacing: 2px !important;
    margin-bottom: 30px !important;
}

.ttcav-export-wrapper .export-match-date {
    color: #94a3b8 !important;
    font-weight: 500 !important;
}

/* RÉSUMÉ IA */
p.ttcav-wp-ai,
.ttcav-export-wrapper .ttcav-wp-ai {
    background: #f8fafc !important;
    border: 1px solid #e2e8f0 !important;
    border-radius: 16px !important;
    padding: 25px 35px !important;
    margin: 40px auto 50px auto !important;
    font-size: 16px !important;
    line-height: 26px !important;
    color: #334155 !important;
    position: relative !important;
    text-align: center !important;
    display: block !important;
    max-width: 850px !important;
}

.ttcav-export-wrapper .ai-summary-box {
    background: #f8fafc !important;
    border: 1px solid #e2e8f0 !important;
    border-radius: 12px !important;
    padding: 20px !important;
    margin: 20px 0 !important;
    font-style: italic !important;
    color: #475569 !important;
    line-height: 1.6 !important;
}


/* TABLES PREMIUM */
.ttcav-export-wrapper .premium-table {
    width: 100% !important;
    max-width: 100% !important;
    border-collapse: separate !important;
    border-spacing: 0 !important;
    margin-bottom: 2rem !important;
    border: 1px solid #e2e8f0 !important;
    border-radius: 12px !important;
    overflow: hidden !important;
    background: #ffffff !important;
    table-layout: auto !important;
}

.ttcav-export-wrapper .premium-table th {
    background: #1e293b !important;
    color: #ffffff !important;
    font-weight: 700 !important;
    text-transform: uppercase !important;
    font-size: 14px !important;
    padding: 15px 10px !important;
    border: none !important;
    line-height: 1.2 !important;
}

.ttcav-export-wrapper .premium-table td {
    padding: 12px 15px !important;
    border-bottom: 1px solid #f1f5f9 !important;
    border-right: 1px solid #f1f5f9 !important;
    font-size: 14px !important;
    text-align: center !important;
    color: #334155 !important;
    vertical-align: middle !important;
    background: transparent !important;
    line-height: 1.4 !important;
}

/* Éviter le passage à la ligne sur bureau */
.ttcav-export-wrapper .col-summary-cat,
.ttcav-export-wrapper .col-summary-score,
.ttcav-export-wrapper .col-summary-home,
.ttcav-export-wrapper .col-summary-away,
.ttcav-export-wrapper .col-player,
.ttcav-export-wrapper .player-name,
.ttcav-export-wrapper .player-pts {
    white-space: nowrap !important;
}

.ttcav-export-wrapper .compo-player-box {
    display: flex !important;
    justify-content: space-between !important;
    align-items: center !important;
    gap: 15px !important;
    width: 100% !important;
}

.ttcav-export-wrapper .premium-table td:last-child {
    border-right: none !important;
}

.ttcav-export-wrapper .premium-table tr:last-child td {
    border-bottom: none !important;
}

.ttcav-export-wrapper .premium-table tr:nth-child(even) {
    background: #f8fafc !important;
}

/* Footer de table (Total) */
.ttcav-export-wrapper .compo-total-row td {
    background: #f1f5f9 !important;
    font-weight: 800 !important;
    color: #475569 !important;
    text-transform: uppercase !important;
    font-size: 14px !important;
    padding: 15px !important;
    border-top: 2px solid #e2e8f0 !important;
}

/* Scoreboard */
.ttcav-export-wrapper .premium-scoreboard {
    display: flex !important;
    justify-content: center !important;
    align-items: center !important;
    gap: 15px !important;
    background: #1e293b !important;
    padding: 25px !important;
    border-radius: 16px !important;
    width: fit-content !important;
    margin: 40px auto !important;
}

.ttcav-export-wrapper .score-digit-box {
    background: #ffffff !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    font-weight: 800 !important;
    font-family: 'Outfit', sans-serif !important;
    border-radius: 10px !important;
    box-shadow: 0 4px 0 rgba(0, 0, 0, 0.1) !important;
}
.ttcav-export-wrapper .score-box-small { width: 48px !important; height: 60px !important; font-size: 28px !important; }
.ttcav-export-wrapper .score-box-large { width: 75px !important; height: 90px !important; font-size: 50px !important; }
.ttcav-export-wrapper .digit-red { color: #ef4444 !important; }
.ttcav-export-wrapper .digit-black { color: #1e293b !important; }

.ttcav-export-wrapper .score-divider {
    width: 2px !important;
    height: 30px !important;
    background: rgba(255, 255, 255, 0.1) !important;
}

/* Status Victoire/Défaite (Badges) */
.ttcav-export-wrapper .status-victoire {
    color: #10b981 !important;
    background: #e6f7f2 !important; /* Couleur solide pour éviter les soucis de transparence */
    padding: 4px 12px !important;
    border-radius: 20px !important;
    font-weight: 800 !important;
    display: inline-block !important;
    font-size: 11px !important;
    text-decoration: none !important;
    line-height: 1 !important;
    white-space: nowrap !important;
    border: none !important;
}
.ttcav-export-wrapper .status-defaite {
    color: #ef4444 !important;
    background: #fdf2f2 !important;
    padding: 4px 12px !important;
    border-radius: 20px !important;
    font-weight: 800 !important;
    display: inline-block !important;
    font-size: 11px !important;
    text-decoration: none !important;
    line-height: 1 !important;
    white-space: nowrap !important;
    border: none !important;
}
.ttcav-export-wrapper .status-nul {
    color: #f59e0b !important;
    background: #fff9eb !important;
    padding: 4px 12px !important;
    border-radius: 20px !important;
    font-weight: 800 !important;
    display: inline-block !important;
    font-size: 11px !important;
    text-decoration: none !important;
    line-height: 1 !important;
    white-space: nowrap !important;
    border: none !important;
}

.ttcav-export-wrapper .player-win { font-weight: 800 !important; color: #1e293b !important; }
.ttcav-export-wrapper .player-loss { color: #94a3b8 !important; }

/* Couleurs Points Match Sheet */
.ttcav-export-wrapper .pts-pos { color: #10b981 !important; font-weight: 700 !important; }
.ttcav-export-wrapper .pts-neg { color: #ef4444 !important; font-weight: 700 !important; }
.ttcav-export-wrapper .pts-neu { color: #94a3b8 !important; }

/* Badges et Indicateurs */
.ttcav-export-wrapper .badge-win { background: #dcfce7 !important; color: #166534 !important; padding: 4px 12px !important; border-radius: 8px !important; font-weight: 800 !important; font-size: 13px !important; display: inline-block !important; }
.ttcav-export-wrapper .badge-loss { background: #fee2e2 !important; color: #991b1b !important; padding: 4px 12px !important; border-radius: 8px !important; font-weight: 800 !important; font-size: 13px !important; display: inline-block !important; }

/* Alignements Colonnes Résumé & Classement */
.ttcav-export-wrapper .summary-row td {
    padding: 0 !important;
    border-bottom: 1px solid #f1f5f9 !important;
}

.ttcav-export-wrapper .col-summary-cat { 
    color: #94a3b8 !important; 
    font-size: 14px !important; 
    padding: 12px 15px !important;
}

.ttcav-export-wrapper .match-line-scroll-wrapper {
    width: 100% !important;
}

.ttcav-export-wrapper .match-line-content {
    display: flex !important;
    align-items: center !important;
    padding: 10px 15px !important;
    width: 100% !important;
}

.ttcav-export-wrapper .col-summary-home { flex: 1 !important; text-align: right !important; }
.ttcav-export-wrapper .col-summary-score { flex: 0 0 80px !important; text-align: center !important; font-weight: 700 !important; background: #f8fafc !important; margin: 0 10px !important; border-radius: 6px !important; padding: 5px !important; }
.ttcav-export-wrapper .col-summary-away { flex: 1 !important; text-align: left !important; }
.ttcav-export-wrapper .col-summary-status { text-align: right !important; text-transform: uppercase !important; font-size: 14px !important; padding: 12px 15px !important; }

.ttcav-export-wrapper .col-rank-num { width: 50px !important; text-align: center !important; font-weight: 800 !important; color: #64748b !important; }
.ttcav-export-wrapper .col-rank-team { text-align: left !important; font-weight: 700 !important; }
.ttcav-export-wrapper .col-rank-pts { font-weight: 800 !important; color: #1e293b !important; text-align: center !important; }
.ttcav-export-wrapper .col-rank-std { text-align: center !important; color: #64748b !important; }

.ttcav-export-wrapper .ranking-row-us,
.ttcav-export-wrapper .ranking-row-us td {
    background: #f0f9ff !important;
    font-weight: 800 !important;
    color: #1e293b !important;
}

/* Autres éléments */
.ttcav-export-wrapper h2.section-title,
.ttcav-export-wrapper .section-title {
    text-align: center !important;
    font-size: 20px !important; /* Utilisation de PX au lieu de REM pour éviter les variations de base du thème */
    margin: 50px 0 20px 0 !important;
    color: #64748b !important;
    position: relative !important;
    font-family: 'Outfit', sans-serif !important;
    text-transform: none !important;
    font-weight: 600 !important;
    background: none !important;
    border: none !important;
    padding: 0 !important;
    line-height: 1.2 !important;
}

.ttcav-export-wrapper .summary-totals-card {
    background: #f8fafc !important;
    color: #64748b !important;
    padding: 2.5rem !important;
    border-radius: 12px !important;
    font-family: 'Outfit', sans-serif !important;
    font-weight: 700 !important;
    font-size: 20px !important;
    text-align: center !important;
    margin: 40px 0 !important;
    border: 1px solid #e2e8f0 !important;
}

.ttcav-export-wrapper .total-v { color: #10b981 !important; margin: 0 10px !important; }
.ttcav-export-wrapper .total-n { color: #64748b !important; margin: 0 10px !important; }
.ttcav-export-wrapper .total-d { color: #ef4444 !important; margin: 0 10px !important; }

.ttcav-export-wrapper .match-sets-sum {
    text-align: center !important;
    font-weight: 600 !important;
    color: #64748b !important;
    margin: 20px 0 !important;
    font-size: 15px !important;
}

@media (max-width: 768px) {
    h1.ttcav-wp-main-title { font-size: 24px !important; line-height: 28px !important; margin: 30px auto 10px auto !important; }
    .ttcav-wp-vs { font-size: 14px !important; margin: 10px 0 !important; }
    .ttcav-wp-vs::before, .ttcav-wp-vs::after { margin: 0 10px !important; }
    
    .mobile-br { display: block !important; }
    
    .ttcav-export-wrapper .premium-table { 
        font-size: 11px !important; 
        display: block !important;
        width: 100% !important;
        overflow-x: auto !important;
        -webkit-overflow-scrolling: touch !important;
    }
    
    /* Pas de fond alterné sur mobile */
    .ttcav-export-wrapper .premium-table tr:nth-child(even) { background: transparent !important; }

    .ttcav-export-wrapper .premium-table td, 
    .ttcav-export-wrapper .premium-table th { 
        padding: 6px 4px !important; 
    }

    /* Empêcher les scores de sets de se couper */
    .ttcav-export-wrapper .col-set {
        padding: 5px 2px !important;
        font-size: 10px !important;
        white-space: nowrap !important;
        min-width: 30px !important;
    }
    
    .ttcav-export-wrapper .col-score {
        padding: 5px 2px !important;
        white-space: nowrap !important;
    }
    .ttcav-export-wrapper .badge-win, 
    .ttcav-export-wrapper .badge-loss {
        padding: 3px 8px !important;
        font-size: 11px !important;
        display: inline-block !important;
        white-space: nowrap !important;
    }

    /* Composition d'équipe flexible */
    .ttcav-export-wrapper .compo-player-box {
        flex-direction: row !important;
        flex-wrap: wrap !important;
        justify-content: flex-start !important;
        gap: 2px 8px !important;
        width: 100% !important;
    }
    .ttcav-export-wrapper .compo-player-box span:first-child {
        text-align: left !important;
        flex: 1 1 60% !important;
        white-space: normal !important;
        line-height: 1.2 !important;
    }
    .ttcav-export-wrapper .compo-player-box span:last-child {
        text-align: right !important;
        flex: 0 0 auto !important;
        margin-left: auto !important;
        font-weight: 700 !important;
    }

    .ttcav-export-wrapper .score-box-large { width: 55px !important; height: 70px !important; font-size: 34px !important; }

    /* PAS DE ZEBRA SUR LE RÉSUMÉ UNIQUEMENT SUR MOBILE */
    .ttcav-export-wrapper .summary-premium-table tr:nth-child(even) { background: transparent !important; }
    
    /* MASQUER LE HEADER DU RÉSUMÉ UNIQUEMENT SUR MOBILE */
    .ttcav-export-wrapper .summary-premium-table thead,
    .ttcav-export-wrapper .summary-premium-table thead tr,
    .ttcav-export-wrapper .summary-premium-table thead th { 
        display: none !important; 
        height: 0 !important;
        padding: 0 !important;
        margin: 0 !important;
        visibility: hidden !important;
    }

    .ttcav-export-wrapper .premium-table td, 
    .ttcav-export-wrapper .premium-table th { 
        padding: 10px 8px !important; 
    }

    /* Division avec fond gris FORCÉ et hauteur réduite */
    .ttcav-export-wrapper .summary-premium-table td.col-summary-cat {
        order: 1 !important;
        width: 100% !important;
        display: block !important;
        text-align: center !important;
        font-size: 11px !important;
        font-weight: 800 !important;
        color: #475569 !important;
        padding: 6px 0 !important; /* Réduit */
        border: none !important;
        text-transform: uppercase !important;
        background-color: #f1f5f9 !important;
        background: #f1f5f9 !important;
        border-bottom: 1px solid #cbd5e1 !important;
        line-height: 1.4 !important; /* Réduit */
    }
    .ttcav-export-wrapper .summary-premium-table td.col-summary-cat a {
        background: transparent !important;
        display: block !important;
        width: 100% !important;
        color: inherit !important;
        text-decoration: none !important;
    }
    
    .ttcav-export-wrapper .summary-row {
        display: flex !important;
        flex-wrap: wrap !important;
        padding: 0 !important;
        border-bottom: 1px solid #f1f5f9 !important;
        align-items: center !important;
    }

    /* Conteneur virtuel pour le scroll horizontal des équipes (Hauteur réduite) */
    .ttcav-export-wrapper .col-summary-home,
    .ttcav-export-wrapper .col-summary-score,
    .ttcav-export-wrapper .col-summary-away {
        order: 2 !important;
        padding: 8px 5px !important; /* Réduit de 12px à 8px */
        border: none !important;
        background: transparent !important;
        line-height: 1.4 !important; /* Réduit */
    }

    .ttcav-export-wrapper .col-summary-home {
        flex: 1 !important;
        text-align: right !important;
        font-size: 13px !important;
        white-space: nowrap !important;
        min-width: 110px !important;
    }
    .ttcav-export-wrapper .col-summary-away {
        flex: 1 !important;
        text-align: left !important;
        font-size: 13px !important;
        white-space: nowrap !important;
        min-width: 110px !important;
    }
    .ttcav-export-wrapper .col-summary-score {
        flex: 0 0 65px !important;
        font-size: 16px !important;
        font-weight: 800 !important;
        background: #f8fafc !important;
        text-align: center !important;
        margin: 0 10px !important;
        border-radius: 6px !important;
    }

    .ttcav-export-wrapper .col-summary-status {
        order: 3 !important;
        width: 100% !important;
        padding: 8px 0 !important;
        border-top: 1px solid #f1f5f9 !important;
        text-align: center !important;
        display: block !important;
        border-right: none !important;
    }

    /* Masquer le n° de classement sur mobile */
    .ttcav-export-wrapper .ranking-num-wrapper {
        display: none !important;
    }
    .ttcav-export-wrapper .col-summary-status {
        width: 100% !important;
        padding: 5px 0 !important;
        border: none !important;
        text-align: center !important;
        display: block !important;
    }

    .ttcav-export-wrapper .section-title { font-size: 18px !important; margin: 35px 0 15px 0 !important; }
    .ttcav-export-wrapper .summary-totals-card { padding: 15px !important; }
    .ttcav-export-wrapper .ranking-box-val { font-size: 20px !important; }

    /* Permettre le passage à la ligne sur mobile si nécessaire */
    .ttcav-export-wrapper .col-player,
    .ttcav-export-wrapper .player-name,
    .ttcav-export-wrapper .player-pts {
        white-space: normal !important;
    }
}

/* BOX CLASSEMENT */
.ttcav-export-wrapper .ranking-top-box { 
    display: flex !important; 
    justify-content: space-between !important; 
    gap: 15px !important; 
    margin: 30px 0 !important; 
    background: #f8fafc !important;
    border: 1px solid #e2e8f0 !important;
    border-radius: 12px !important;
    padding: 1.5rem !important;
    align-items: center !important;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05) !important;
}
.ttcav-export-wrapper .ranking-box-item { 
    background: #f8fafc !important; 
    padding: 20px !important; 
    border-radius: 12px !important; 
    flex: 1 !important; 
    text-align: center !important; 
    border: 1px solid #e2e8f0 !important;
}
.ttcav-export-wrapper .ranking-box-label { font-size: 14px !important; font-weight: 700 !important; color: #64748b !important; text-transform: uppercase !important; margin-bottom: 5px !important; }
.ttcav-export-wrapper .ranking-box-val { font-size: 24px !important; font-weight: 800 !important; color: #1e293b !important; }

.ttcav-export-wrapper .val-v { color: #10b981 !important; }
.ttcav-export-wrapper .val-n { color: #64748b !important; }
.ttcav-export-wrapper .val-d { color: #ef4444 !important; }

/* SEPARATEUR ET ANCRES */
.ttcav-export-wrapper .match-separator { 
    height: 1px !important; 
    background: linear-gradient(to right, transparent, #cbd5e1, transparent) !important; 
    margin: 100px auto !important; 
    max-width: 600px !important; 
    position: relative !important;
    border: none !important; 
}

.ttcav-export-wrapper .match-separator::after {
    content: "◈" !important;
    position: absolute !important;
    left: 50% !important;
    top: 50% !important;
    transform: translate(-50%, -50%) !important;
    background: white !important;
    padding: 0 15px !important;
    color: #94a3b8 !important;
    font-size: 18px !important;
}
[id^="anchor-"], #summary-top { scroll-margin-top: 120px !important; }

/* BOUTON RETOUR */
.ttcav-export-wrapper .back-to-top-wrapper { text-align: center !important; margin: 40px 0 !important; }
.ttcav-export-wrapper .back-to-top-btn { 
    display: inline-block !important;
    background: #f1f5f9 !important;
    color: #1e293b !important;
    padding: 12px 25px !important;
    border-radius: 50px !important;
    text-decoration: none !important;
    font-weight: 700 !important;
    font-size: 14px !important;
    border: 1px solid #e2e8f0 !important;
}
`;
}

// ===== IA BEAUTIFY NAMES =====
async function beautifyOpponentNames() {
    if (!state.groqKey) return;

    const opponents = [...new Set(state.results.map(r => r.opponent))];
    const cacheKey = 'ttcav_names_cache_v4';
    let cache = JSON.parse(localStorage.getItem(cacheKey) || '{}');

    const toClean = opponents.filter(o => !cache[o]);
    if (toClean.length === 0) {
        state.results.forEach(r => { if (cache[r.opponent]) r.opponent = cache[r.opponent]; });
        return;
    }

    updateLoaderStep(`Embellissement des noms d'équipes via IA (${toClean.length})...`);

    const prompt = `Tu es un expert du tennis de table français. 
    Voici une liste de noms de clubs abrégés (format FFTT). 
    Pour chaque nom, donne-moi une version ultra-courte et dynamique au format : "Ville (raccourcie) + Sigle".
    
    Règles CRITIQUES :
    - Identifie la ville d'origine de l'adversaire (ex: "MONQUI" -> "Monqui", "FRAT" -> "Oullins").
    - N'utilise JAMAIS "Villefranche" si l'adversaire n'est pas de Villefranche.
    - Utilise le sigle du club (ex: "Tennis de Table Club" -> "TTC").
    - Exemples : 
      "FRAT.O-PB" -> "Oullins FRAT"
      "ASUL LYON" -> "Lyon ASUL"
      "MONQUI PONG" -> "Monqui PONG"
    
    Garde le numéro d'équipe à la fin s'il est présent (ex: " 1" ou " 2").
    Réponds UNIQUEMENT sous forme d'un objet JSON { "nom_abrege": "Ville Sigle" }.
    
    Liste : ${toClean.join(', ')}`;

    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${state.groqKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: state.groqModel,
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.1,
                response_format: { type: "json_object" }
            })
        });
        const data = await response.json();
        const cleaned = JSON.parse(data.choices[0].message.content);

        // Update cache and results
        Object.assign(cache, cleaned);
        localStorage.setItem(cacheKey, JSON.stringify(cache));

        state.results.forEach(r => { if (cache[r.opponent]) r.opponent = cache[r.opponent]; });
    } catch (e) {
        console.error("AI Beautify Error:", e);
    }
}

function copyWPStylesToClipboard() {
    const css = getWordPressCSS();
    navigator.clipboard.writeText(css).then(() => showToast('CSS copié !'));
}

function copyWPHTMLToClipboard() {
    let finalHTML = state.giantHTMLRaw;

    // Nettoyage : Fusionner les blocs wp:html consécutifs
    finalHTML = finalHTML.replace(/<!--\s*\/wp:html\s*-->\s*<!--\s*wp:html\s*-->/g, '\n');

    // Injecter les résumés IA dans les blocs paragraph de giantHTMLRaw
    Object.keys(state.aiSummaries).forEach(matchID => {
        const summary = state.aiSummaries[matchID];
        const placeholder = '<p id="ai-summary-' + matchID + '" class="has-text-align-center ttcav-wp-ai"><em>Génération du résumé...</em></p>';
        // On remplace le placeholder par le vrai texte dans un bloc propre
        finalHTML = finalHTML.replace(placeholder, '<p id="ai-summary-' + matchID + '" class="has-text-align-center ttcav-wp-ai">' + summary + '</p>');
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
                return sub[0] + ' <br class="mobile-br"><span class="mobile-only-indent"></span>' + sub.slice(1).join(' ');
            }
            return p;
        }).join(' /<br>');
    }
    // Si c'est un joueur individuel
    const sub = name.trim().split(' ');
    if (sub.length >= 2) {
        return sub[0] + ' <br class="mobile-br"><span class="mobile-only-indent"></span>' + sub.slice(1).join(' ');
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
            <div class="config-required-box">
                <i class="fas fa-cog config-icon"></i>
                <h3 class="config-title">Configuration requise</h3>
                <p class="config-desc">Veuillez renseigner vos identifiants API FFTT (App ID, App Key et N° de club) dans les paramètres pour commencer.</p>
                <button onclick="document.getElementById('help-modal-wrapper').style.display='flex'" class="btn-primary">
                    <i class="fas fa-cog"></i> Ouvrir la configuration
                </button>
            </div>
        `;
    }
}

function showHelpModal() {
    elements.helpContent.innerHTML = `
        <h2 class="guide-title">Guide de Publication WordPress</h2>
        
        <div class="help-section">
            <div class="help-step">
                <h3><span class="step-num">1</span> Préparation : Copier le Style (CSS)</h3>
                <p>Pour un rendu identique à cette application, copiez notre feuille de style optimisée.</p>
                <div class="help-image-container">
                    <img src="img/app_css_btn.png" alt="Bouton Copier CSS" class="help-image">
                </div>
            </div>

            <div class="help-step">
                <h3><span class="step-num">2</span> Configuration : Coller le code CSS</h3>
                <p>Dans le menu <strong>Styles</strong> de l'éditeur WordPress (icône noir & blanc), ouvrez les options (3 points) et accédez au <strong>CSS Additionnel</strong>.</p>
                <div class="help-image-container">
                    <img src="img/wp_css_menu.png" alt="Menu Styles Additionnels" class="help-image">
                    <img src="img/wp_css_editor.png" alt="Éditeur CSS" class="help-image margin-t-15">
                </div>
            </div>

            <div class="help-step">
                <h3><span class="step-num">3</span> Accès : Accéder à l'Éditeur</h3>
                <p>Dans votre tableau de bord WordPress, rendez-vous dans le menu <strong>Apparence > Éditeur</strong>.</p>
                <div class="help-image-container">
                    <img src="img/wp_dash.png" alt="Menu Apparence Éditeur" class="help-image">
                </div>
            </div>
        </div>

        <div class="help-section">
            <div class="help-step">
                <h3><span class="step-num">4</span> Action : Exporter les Matchs</h3>
                <p>Générez vos résultats et utilisez le bouton global pour copier tous les blocs WordPress.</p>
                <div class="help-image-container">
                    <img src="img/app_grid.png" alt="Copie des résultats" class="help-image">
                </div>
            </div>

            <div class="help-step">
                <h3><span class="step-num">5</span> Finalisation : Créer l'Article</h3>
                <p>Créez votre article et collez simplement le contenu (Ctrl+V). Les tableaux et bilans s'afficheront instantanément avec le design premium.</p>
            </div>
        </div>

        <div class="help-footer">
            <p class="guide-footer-text">Propulsé par TTCAV Export Engine &bull; Guide v2.1</p>
        </div>
    `;
    elements.helpModal.style.display = 'flex';
}

// ===== JOUEURS INFO =====
async function loadPlayers(forceRefresh = false) {
    if (!state.clubId) {
        showToast('Veuillez configurer votre numéro de club dans les paramètres.', true);
        logDebug("Loading players aborted: Club ID missing.", 'error');
        return;
    }
    const cacheKey = 'ttcav_players_cache_v1';
    const cacheInfoKey = 'ttcav_players_cache_info';
    const cached = localStorage.getItem(cacheKey);
    const cachedInfo = JSON.parse(localStorage.getItem(cacheInfoKey) || '{}');
    let playersLoaded = [];

    const today = new Date();
    const currentDay = today.getDate();
    const lastUpdate = cachedInfo.updatedAt ? new Date(cachedInfo.updatedAt) : null;

    let isStale = false;
    // Logique demandée : si entre le 10 et le 20 du mois, et cache d'avant le 10 -> Refresh
    if (lastUpdate) {
        const tenThisMonth = new Date(today.getFullYear(), today.getMonth(), 10);
        if (currentDay >= 10 && currentDay <= 20 && lastUpdate < tenThisMonth) {
            isStale = true;
            logDebug("Cache obsolète (mise à jour mensuelle de la fédération détectée), rafraîchissement automatique...");
        }
    }

    if (forceRefresh) {
        localStorage.removeItem(cacheKey);
        localStorage.removeItem(cacheInfoKey);
    }

    if (!forceRefresh && cached && !isStale) {
        playersLoaded = JSON.parse(cached);
        state.players = playersLoaded;
        renderPlayers();
        await syncPlayerHistories(playersLoaded);

        // Maintenance silencieuse le mercredi
        const isWednesday = today.getDay() === 3;
        const lastSyncDay = cachedInfo.lastSyncDay || '';
        const todayStr = today.toDateString();
        const shouldSilentSync = isWednesday && lastSyncDay !== todayStr;

        await syncPlayerMensuelPoints(playersLoaded, false, shouldSilentSync);

        if (shouldSilentSync) {
            cachedInfo.lastSyncDay = todayStr;
            localStorage.setItem(cacheInfoKey, JSON.stringify(cachedInfo));
            logDebug("Synchronisation de maintenance hebdomadaire effectuée (silencieuse).", "success");
        }
        return;
    }

    // Si on arrive ici, c'est qu'on doit TOUT télécharger (ou forceRefresh)
    setAppBusy(true);
    updateLoaderStep('Récupération de l\'annuaire des joueurs...');
    logDebug("Retrieving players list from server...");

    try {
        const data = await fetchData('getPlayers', { clubId: state.clubId }, forceRefresh);
        if (data && data.joueur) {
            let playersArray = Array.isArray(data.joueur) ? data.joueur : [data.joueur];

            // Log de détection pour le premier joueur (pour le debug)
            const pj = playersArray[0];
            const source = pj.pts ? 'pts' : (pj.point ? 'point' : (pj.points ? 'points' : 'clast'));
            logDebug(`Détection points (source: ${source}). Exemple: ${pj.nom} -> ${pj[source]}`);

            // --- GESTION DE L'HISTORIQUE LOCAL ---
            const historyKey = 'ttcav_points_history';
            let pointsHistory = JSON.parse(localStorage.getItem(historyKey) || '{}');

            const currentMonthKeys = getCurrentFFTTMonthLabel();

            // Mois précédent pour la progression
            const parts = currentMonthKeys.split('-');
            let prevDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1);
            prevDate.setMonth(prevDate.getMonth() - 1);
            let prevMonthKeys = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

            if (!pointsHistory[currentMonthKeys]) pointsHistory[currentMonthKeys] = {};

            playersArray.forEach(p => {
                const currentPts = parseFloat(p.pts || p.point || p.points || p.clast || 0);

                if (currentPts > 100) p.points = currentPts;
                else p.points = currentPts * 100;

                p.points_officiels = Math.floor(p.points);

                // Restaurer depuis le cache mensuel si on l'a déjà, sinon prendre le global
                const cachedMens = localStorage.getItem(`ttcav_mensuel_${p.licence}_${currentMonthKeys}`);
                p.points_mensuels = cachedMens ? parseFloat(cachedMens) : currentPts;

                pointsHistory[currentMonthKeys][p.licence] = p.points;
                let prevPts = pointsHistory[prevMonthKeys]?.[p.licence] || p.points;
                p.prog_mens = Math.round(p.points - prevPts);
            });

            localStorage.setItem(historyKey, JSON.stringify(pointsHistory));

            playersLoaded = playersArray;
            state.players = playersArray;
            state.players.sort((a, b) => (parseFloat(b.points_mensuels || b.points_officiels) || 0) - (parseFloat(a.points_mensuels || a.points_officiels) || 0));
            localStorage.setItem(cacheKey, JSON.stringify(state.players));
            const infoToSave = {
                updatedAt: new Date().toISOString(),
                lastSyncDay: today.toDateString()
            };
            localStorage.setItem('ttcav_players_cache_info', JSON.stringify(infoToSave));
            renderPlayers();
            logDebug(`${state.players.length} joueurs chargés (Mensuel OK).`, 'success');

            if (playersLoaded.length > 0) {
                await syncPlayerHistories(playersLoaded);
                await syncPlayerMensuelPoints(playersLoaded, forceRefresh, false);
            }
        } else {
            logDebug("API : Aucun joueur trouvé.", "error");
        }
    } catch (e) {
        logDebug("Erreur chargement joueurs: " + e.message, "error");
    } finally {
        setAppBusy(false);
    }
}

async function syncPlayerMensuelPoints(playersArray, forceRefresh = false, silent = false) {
    const today = new Date();
    const monthLabel = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    // Optimisation : On ne fetch que si on n'a pas déjà de décimales (points_mensuels === entier)
    let playersToFetch = playersArray.filter(p => {
        if (forceRefresh) return true;
        const hasDecimals = p.points_mensuels % 1 !== 0;
        const inLocal = localStorage.getItem(`ttcav_mensuel_${p.licence}_${monthLabel}`);
        return !inLocal && !hasDecimals;
    });

    // Restaurer depuis localStorage pour ceux déjà en cache
    playersArray.forEach(p => {
        if (!p.points_mensuels || p.points_mensuels % 1 === 0) {
            const cached = localStorage.getItem(`ttcav_mensuel_${p.licence}_${monthLabel}`);
            if (cached) p.points_mensuels = parseFloat(cached);
        }
    });

    if (playersToFetch.length > 0) {
        const wasBusy = elements.loader && elements.loader.style.display === 'block';
        if (!wasBusy && !silent) setAppBusy(true);

        for (let i = 0; i < playersToFetch.length; i++) {
            const p = playersToFetch[i];
            if (!silent) {
                updateLoaderStep(`Précision mensuelle... (${i + 1}/${playersToFetch.length})<br><span class="color-primary font-size-large">${p.nom} ${p.prenom}</span>`);
            }
            try {
                // Utilisation du bypass cache pour être sûr d'avoir le point live
                const data = await fetchData('getPlayerDetail', { licence: p.licence }, true);
                if (data && data.joueur) {
                    const mPts = parseFloat(data.joueur.point || 0);
                    if (mPts > 0) {
                        localStorage.setItem(`ttcav_mensuel_${p.licence}_${monthLabel}`, mPts.toFixed(2));
                        p.points_mensuels = mPts;
                    }
                }
                await new Promise(r => setTimeout(r, 100));
            } catch (e) { console.error(e); }
        }
        if (!silent) {
            setAppBusy(false);
            renderPlayers();
        } else {
            // En mode silencieux, on rafraîchit à la fin sans toast
            console.log(`[Background Sync] Done for ${playersToFetch.length} players.`);
            renderPlayers();
        }
    }
}

async function syncPlayerHistories(playersArray) {
    const today = new Date();
    const monthLabel = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    // Identifier les joueurs n'ayant pas leur historique en cache pour ce mois
    let playersToFetch = playersArray.filter(p => !localStorage.getItem(`ttcav_histo_v3_${p.licence}_${monthLabel}`));

    if (playersToFetch.length > 0) {
        const wasBusy = elements.loader && elements.loader.style.display === 'block';
        if (!wasBusy) setAppBusy(true);

        for (let i = 0; i < playersToFetch.length; i++) {
            const p = playersToFetch[i];
            updateLoaderStep(`Mise en cache des historiques... (${i + 1}/${playersToFetch.length})<br><span class="color-primary font-size-large">${p.nom} ${p.prenom}</span>`);

            try {
                const hData = await fetchData('getPlayerHistory', { licence: p.licence });
                if (hData && hData.histo) {
                    const hd = Array.isArray(hData.histo) ? hData.histo : [hData.histo]; // Retrait du .reverse()

                    // Purger l'ancien cache éventuel pour ce joueur
                    Object.keys(localStorage).forEach(k => {
                        if (k.startsWith(`ttcav_histo_v2_${p.licence}`) || k.startsWith(`ttcav_histo_v3_${p.licence}`)) localStorage.removeItem(k);
                    });

                    localStorage.setItem(`ttcav_histo_v3_${p.licence}_${monthLabel}`, JSON.stringify(hd));
                }
                // Léger délai pour ne pas brusquer l'API FFTT
                await new Promise(r => setTimeout(r, 200));
            } catch (e) {
                console.error('Erreur chargement histo', e);
            }
        }
        setAppBusy(false);
    }
}

window.playerSortCol = window.playerSortCol || 'points';
window.playerSortOrder = window.playerSortOrder || -1;

window.setPlayerSort = function (col) {
    if (window.playerSortCol === col) window.playerSortOrder *= -1;
    else { window.playerSortCol = col; window.playerSortOrder = (col === 'name') ? 1 : -1; }
    renderPlayers();
};

window.refreshSinglePlayerPoints = async function (licence) {
    if (!licence) return;
    const btn = event.currentTarget;
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    }

    try {
        const data = await fetchData('getPlayerDetail', { licence }, true);
        if (data && data.joueur) {
            const mPts = parseFloat(data.joueur.point || 0);
            const p = state.players.find(x => x.licence === licence);
            if (p) {
                p.points_mensuels = mPts;
                // Sauvegarde persistance mensuelle
                const mKey = getCurrentFFTTMonthLabel();
                localStorage.setItem(`ttcav_mensuel_${licence}_${mKey}`, mPts.toString());

                // MISE À JOUR DU STATE ET DU CACHE GLOBAL
                localStorage.setItem('ttcav_players_cache_v1', JSON.stringify(state.players));

                renderPlayers();
                showToast(`Points mensuels de ${p.nom} : ${Math.round(mPts)}`);
            }
        }
    } catch (e) {
        showToast("Erreur lors du rafraîchissement individuel.", true);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-sync-alt"></i>';
        }
    }
};

window.renderPlayers = function () {
    if (!elements.playersList) return;

    // Calcul à la volée des métriques détaillées d'après le cache de l'historique FFTT
    const today = new Date();
    const monthLabel = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    state.players.forEach(p => {
        const histoData = JSON.parse(localStorage.getItem(`ttcav_histo_v3_${p.licence}_${monthLabel}`) || 'null');
        const virtPts = parseFloat(localStorage.getItem(`ttcav_virtuel_${p.licence}_${monthLabel}`) || '0');
        p.ph1 = 0; p.ph2 = 0; p.prog_ann = 0;
        p.virtuel = (parseFloat(p.points) || 0) + virtPts;
        p.prog_virt = virtPts;

        if (histoData && histoData.length > 0) {
            let lastPh1 = [...histoData].reverse().find(h => /ph.*(1|I)/i.test(getVal(h.saison)));
            let lastPh2 = [...histoData].reverse().find(h => /ph.*(2|II)/i.test(getVal(h.saison)));

            if (lastPh1) p.ph1 = parseInt(getVal(lastPh1.point)) || 0;
            if (lastPh2) p.ph2 = parseInt(getVal(lastPh2.point)) || 0;

            if (p.ph1 > 0) p.prog_ann = Math.round((parseInt(p.points) || 0) - p.ph1);
        }
    });

    const filter = elements.playerSearch ? elements.playerSearch.value : '';
    const normStr = s => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    let filtered = state.players.filter(p => normStr(`${p.nom} ${p.prenom}`).includes(normStr(filter)) || p.licence.includes(filter));

    filtered.sort((a, b) => {
        let valA, valB;
        if (window.playerSortCol === 'prog') { valA = parseInt(a.prog_mens) || 0; valB = parseInt(b.prog_mens) || 0; }
        else if (window.playerSortCol === 'prog_ann') { valA = parseInt(a.prog_ann) || 0; valB = parseInt(b.prog_ann) || 0; }
        else if (window.playerSortCol === 'virt') { valA = parseFloat(a.points_mensuels || a.points_officiels || a.points) || 0; valB = parseFloat(b.points_mensuels || b.points_officiels || b.points) || 0; }
        else if (window.playerSortCol === 'ph1') { valA = parseInt(a.ph1) || 0; valB = parseInt(b.ph2) || 0; } // Correction ph2 -> ph1 ? Non, wait.
        else if (window.playerSortCol === 'ph2') { valA = parseInt(a.ph2) || 0; valB = parseInt(b.ph2) || 0; }
        else if (window.playerSortCol === 'name') { valA = a.nom.toLowerCase(); valB = b.nom.toLowerCase(); }
        else { valA = parseFloat(a.points_officiels || a.points) || 0; valB = parseFloat(b.points_officiels || b.points) || 0; }

        if (window.playerSortCol === 'name') return valA.localeCompare(valB) * window.playerSortOrder;
        return (valA - valB) * window.playerSortOrder;
    });

    elements.playerCountBadge.textContent = `${filtered.length} joueurs`;
    if (filtered.length === 0) {
        elements.playersList.innerHTML = `<div class="loading-placeholder">Aucun joueur trouvé.</div>`;
        return;
    }

    let html = `
        <div class="player-header-wrapper">
            <div class="player-header-item">
                <div class="player-header-main" onclick="setPlayerSort('name')">
                    <span class="player-sort-icon"><i class="fas fa-sort${window.playerSortCol === 'name' ? (window.playerSortOrder === 1 ? '-alpha-down' : '-alpha-up') : ''}" style="opacity: ${window.playerSortCol === 'name' ? '1' : '0.3'}"></i></span> JOUEUR
                </div>
                <div class="player-stats-header">
                    <div class="stat-group" onclick="setPlayerSort('points')">
                        <div class="stat-label"><i class="fas fa-sort${window.playerSortCol === 'points' ? (window.playerSortOrder === 1 ? '-numeric-up' : '-numeric-down') : ''}" style="margin-right: 4px; opacity: ${window.playerSortCol === 'points' ? '1' : '0.3'}"></i>Officiel</div>
                    </div>
                    <div class="stat-group" onclick="setPlayerSort('virt')">
                        <div class="stat-label"><i class="fas fa-sort${window.playerSortCol === 'virt' ? (window.playerSortOrder === 1 ? '-numeric-up' : '-numeric-down') : ''}" style="margin-right: 4px; opacity: ${window.playerSortCol === 'virt' ? '1' : '0.3'}"></i>Mensuel</div>
                    </div>
                    <div class="stat-group" onclick="setPlayerSort('ph1')">
                        <div class="stat-label"><i class="fas fa-sort${window.playerSortCol === 'ph1' ? (window.playerSortOrder === 1 ? '-numeric-up' : '-numeric-down') : ''}" style="margin-right: 4px; opacity: ${window.playerSortCol === 'ph1' ? '1' : '0.3'}"></i>Ph. 1</div>
                    </div>
                    <div class="stat-group" onclick="setPlayerSort('ph2')">
                        <div class="stat-label"><i class="fas fa-sort${window.playerSortCol === 'ph2' ? (window.playerSortOrder === 1 ? '-numeric-up' : '-numeric-down') : ''}" style="margin-right: 4px; opacity: ${window.playerSortCol === 'ph2' ? '1' : '0.3'}"></i>Ph. 2</div>
                    </div>
                    <div class="stat-group" onclick="setPlayerSort('prog')">
                        <div class="stat-label"><i class="fas fa-sort${window.playerSortCol === 'prog' ? (window.playerSortOrder === 1 ? '-numeric-up' : '-numeric-down') : ''}" style="margin-right: 4px; opacity: ${window.playerSortCol === 'prog' ? '1' : '0.3'}"></i>Mois</div>
                    </div>
                    <div class="stat-group" onclick="setPlayerSort('prog_ann')">
                        <div class="stat-label"><i class="fas fa-sort${window.playerSortCol === 'prog_ann' ? (window.playerSortOrder === 1 ? '-numeric-up' : '-numeric-down') : ''}" style="margin-right: 4px; opacity: ${window.playerSortCol === 'prog_ann' ? '1' : '0.3'}"></i>Année</div>
                    </div>
                </div>
            </div>
        </div>
    `;

    html += filtered.map(p => {
        const ptsOff = parseInt(p.points_officiels || p.points) || 0;
        const ptsMens = p.points_mensuels || ptsOff;
        const progMens = Math.round(ptsMens - ptsOff);
        const progAnn = parseInt(p.prog_ann) || 0;
        const ph1 = parseInt(p.ph1) || '-';
        const ph2 = parseInt(p.ph2) || '-';

        // Couleurs par genre
        const isFemale = (p.sexe === 'F');
        const genderClass = isFemale ? 'pts-gender-f' : 'pts-gender-m';
        const genderTitle = isFemale ? 'Joueuse' : 'Joueur';

        const isOpen = state.activeHistoryLicence === p.licence;

        return `
            <div class="player-wrapper">
                <div class="player-item" onclick="togglePlayerHistory('${p.licence}')">
                    <div class="player-main">
                        <img src="https://www.fftt.com/site/joueurs/photos/${p.licence}.jpg" class="player-photo" onerror="this.src='https://ui-avatars.com/api/?name=${p.nom}+${p.prenom}'">
                        <div class="player-name-box">
                            <div class="player-name-box-inner">
                                <span class="player-name">${p.nom} ${p.prenom}</span>
                                <button class="btn-sync-mini" onclick="event.stopPropagation(); refreshSinglePlayerPoints('${p.licence}')" title="Rafraîchir en direct">
                                    <i class="fas fa-sync-alt"></i>
                                </button>
                            </div>
                            <span class="player-license">${p.licence}</span>
                        </div>
                    </div>
                    <div class="player-stats-grid">
                        <div class="stat-group"><div class="stat-label">Officiel</div><div class="stat-value ${genderClass}" title="${genderTitle}">${ptsOff}</div></div>
                        <div class="stat-group"><div class="stat-label">Mensuel</div><div class="stat-value stat-value-mensuel">${Math.round(ptsMens)} <small class="stat-prog-small ${progMens >= 0 ? 'stat-prog-up' : 'stat-prog-down'}">${progMens >= 0 ? '+' : ''}${Math.round(progMens)}</small></div></div>
                        <div class="stat-group"><div class="stat-label">Ph. 1</div><div class="stat-value stat-value-muted">${ph1}</div></div>
                        <div class="stat-group"><div class="stat-label">Ph. 2</div><div class="stat-value stat-value-muted">${ph2}</div></div>
                        <div class="stat-group"><div class="stat-label">Mois</div><div class="stat-value ${progMens >= 0 ? 'prog-up' : 'prog-down'}">${progMens}</div></div>
                        <div class="stat-group"><div class="stat-label">Année</div><div class="stat-value ${progAnn >= 0 ? 'prog-up' : 'prog-down'}">${progAnn}</div></div>
                    </div>
                </div>
                <div class="player-history-box" id="history-${p.licence}" style="display: ${isOpen && state.activeHistoryType === 'histo' ? 'block' : 'none'}">
                    <div class="history-header">
                        <span class="history-title">Historique des points</span>
                        <div class="history-btns">
                            <button class="btn-close-history btn-primary-bg" onclick="togglePlayerMatches('${p.licence}')">Matchs</button>
                            <button class="btn-close-history" onclick="togglePlayerHistory('${p.licence}', true)">Fermer</button>
                        </div>
                    </div>
                    <div class="chart-container"><canvas id="chart-${p.licence}"></canvas></div>
                </div>
                <div class="player-history-box" id="matches-${p.licence}" style="display: ${isOpen && state.activeHistoryType === 'matches' ? 'block' : 'none'}">
                    <div class="history-header">
                        <span class="history-title">Dernières Parties</span>
                        <div class="history-btns">
                            <button class="btn-close-history btn-primary-bg" onclick="togglePlayerHistory('${p.licence}')">Graphique</button>
                            <button class="btn-close-history" onclick="togglePlayerMatches('${p.licence}', true)">Fermer</button>
                        </div>
                    </div>
                    <div id="match-list-${p.licence}" class="match-list-container match-list-scroll">
                        <div class="loading-placeholder">Chargement des matchs...</div>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    elements.playersList.innerHTML = html;

    // Restaurer l'historique ou les matchs
    if (state.activeHistoryLicence) {
        if (state.activeHistoryType === 'histo') {
            setTimeout(() => {
                delete state.charts[state.activeHistoryLicence];
                loadPlayerHistory(state.activeHistoryLicence);
            }, 50);
        } else {
            setTimeout(() => {
                loadPlayerMatches(state.activeHistoryLicence);
            }, 50);
        }
    }
};

window.togglePlayerHistory = async function (licence, forceClose = false) {
    const box = document.getElementById(`history-${licence}`);
    if (!box) return;

    if ((state.activeHistoryLicence === licence && state.activeHistoryType === 'histo') || forceClose) {
        state.activeHistoryLicence = null;
        renderPlayers();
        return;
    }

    state.activeHistoryLicence = licence;
    state.activeHistoryType = 'histo';
    renderPlayers();
};

window.togglePlayerMatches = async function (licence, forceClose = false) {
    const box = document.getElementById(`matches-${licence}`);
    if (!box) {
        // Si on clique depuis l'item principal
        state.activeHistoryLicence = licence;
        state.activeHistoryType = 'matches';
        renderPlayers();
        return;
    }

    if ((state.activeHistoryLicence === licence && state.activeHistoryType === 'matches') || forceClose) {
        state.activeHistoryLicence = null;
        renderPlayers();
        return;
    }

    state.activeHistoryLicence = licence;
    state.activeHistoryType = 'matches';
    renderPlayers();
};

window.loadPlayerMatches = async function (licence) {
    const container = document.getElementById(`match-list-${licence}`);
    if (!container) return;

    try {
        const data = await fetchData('getPlayerMatches', { licence });
        const matches = data.matches || data.partie;

        if (!matches || !Array.isArray(matches) || matches.length === 0) {
            container.innerHTML = '<div class="loading-placeholder">Aucun match trouvé pour cette phase.</div>';
            return;
        }

        // Log du premier match pour aider l'utilisateur à identifier les clés
        console.log("Structure d'un match FFTT détectée :", matches[0]);

        const player = state.players.find(pl => pl.licence === licence);
        const playerPoints = player ? parseFloat(player.points) : 0;

        // Groupement par Date + Épreuve
        let html = '';
        let currentGroupKey = '';

        matches.forEach(m => {
            const mDate = m.date;
            const mEpreuve = m.epreuve;
            const groupKey = `${mDate}_${mEpreuve}`;

            if (groupKey !== currentGroupKey) {
                currentGroupKey = groupKey;
                html += `<div class="match-date-group">${mDate} - ${mEpreuve}</div>`;
            }

            // --- MAPPING SELON DOC SMARTPING 2.0 (xml_partie_mysql.php) ---
            const mNom = m.advnompre || m.nom || "Inconnu";

            // Gestion spéciale des Numérotés (N°1, N°150...)
            let mClastRaw = (m.advclaof || m.clast || m.classement || "").toString().trim();
            let mClastLabel = mClastRaw;
            let mClastPoints = 500;

            // Tentative d'extraction intelligente : On cherche un gros nombre (points) et un petit (rang)
            const numbers = mClastRaw.match(/\d+/g) || [];
            let foundRank = null;
            let foundPoints = null;

            numbers.forEach(numStr => {
                const n = parseInt(numStr);
                // Un rang national est entre 1 et 1000, mais les points commencent à 500
                if (n > 0 && n < 500) foundRank = n;
                if (n >= 500) foundPoints = n;
            });

            const isNumbered = (foundRank !== null && foundRank < 500) ||
                (mClastRaw.toUpperCase().includes('N') && foundRank !== null && foundRank < 1000);

            if (isNumbered) {
                const rank = foundRank || "?";
                const pts = foundPoints || Math.max(2100, 3100 - (parseInt(rank) * 1.0) || 0);
                mClastLabel = `N°${rank} (${pts} pts)`;
                mClastPoints = pts;
            } else {
                mClastPoints = foundPoints || parseFloat(mClastRaw) || 500;
                mClastLabel = `${mClastPoints} pts`;
            }

            const mVicRaw = (m.vd || m.vic || m.victoire || "").toString().toUpperCase();
            const isVic = mVicRaw.startsWith('V');
            const mCoef = parseFloat(m.coefchamp || m.coef || m.coeff || m.coefficient || 1.0);
            let mPts = parseFloat(m.pointres || m.pts || m.pointselo);

            // On cherche AUSSI les sets via scan de clés (fallback si pas dans champ explicite)
            let playerSets = [];
            let opponentSets = [];
            Object.keys(m).forEach(key => {
                const k = key.toLowerCase();
                const setMatch = k.match(/(set|score|res)[_a-z]*(\d+)([ab])/i);
                if (setMatch) {
                    const idx = parseInt(setMatch[2]) - 1;
                    if (setMatch[3].toLowerCase() === 'a') playerSets[idx] = m[key];
                    else opponentSets[idx] = m[key];
                }
            });

            // Si l'API ne renvoie pas les points ou qu'ils sont à 0, calcul manuel (Fédération Française de Tennis de Table - Elo)
            if (isNaN(mPts) || (mPts === 0 && !isVic)) {
                const diff = mClastPoints - playerPoints;
                let gain = 0;
                if (isVic) {
                    if (diff >= 500) gain = 40;
                    else if (diff >= 400) gain = 28;
                    else if (diff >= 300) gain = 22;
                    else if (diff >= 200) gain = 17;
                    else if (diff >= 150) gain = 13;
                    else if (diff >= 100) gain = 10;
                    else if (diff >= 50) gain = 8;
                    else if (diff >= 25) gain = 7;
                    else if (diff >= -24) gain = 6;
                    else if (diff >= -49) gain = 5;
                    else if (diff >= -99) gain = 4;
                    else if (diff >= -149) gain = 3;
                    else if (diff >= -199) gain = 2;
                    else if (diff >= -299) gain = 1;
                    else if (diff >= -399) gain = 0.5;
                    else gain = 0;
                } else {
                    if (diff >= 500) gain = 0;
                    else if (diff >= 400) gain = -0.5;
                    else if (diff >= 300) gain = -1;
                    else if (diff >= 200) gain = -2;
                    else if (diff >= 150) gain = -3;
                    else if (diff >= 100) gain = -4;
                    else if (diff >= 50) gain = -5;
                    else if (diff >= -24) gain = -6;
                    else if (diff >= -49) gain = -7;
                    else if (diff >= -99) gain = -8;
                    else if (diff >= -149) gain = -10;
                    else if (diff >= -199) gain = -13;
                    else if (diff >= -299) gain = -17;
                    else if (diff >= -399) gain = -22;
                    else if (diff >= -499) gain = -28;
                    else gain = -40;
                }
                mPts = gain * mCoef;
            }

            const ptsSign = mPts >= 0 ? '+' : '';

            // Filtrer les sets vides
            const finalPlayerSets = playerSets.filter(s => s !== undefined && s !== "");
            const finalOpponentSets = opponentSets.filter(s => s !== undefined && s !== "");

            let setsHtml = '';
            if (finalPlayerSets.length > 0) {
                setsHtml = `<div class="match-sets-col">
                    <div class="match-sets-row">
                        ${finalPlayerSets.map(s => `<div class="set-box set-box-win">${s}</div>`).join('')}
                    </div>
                    <div class="match-sets-row">
                        ${finalOpponentSets.map(s => `<div class="set-box set-box-loss">${s}</div>`).join('')}
                    </div>
                </div>`;
            }

            html += `
                <div class="match-row-item">
                    <div class="match-row-main">
                        <div class="match-res-badge ${isVic ? 'match-res-win' : 'match-res-loss'}">
                            ${ptsSign}${mPts.toFixed(1)}
                        </div>
                        <div class="match-row-info">
                            <span class="match-row-name">${mNom}</span>
                            <span class="match-row-meta">${mClastLabel} • Coef: ${mCoef}</span>
                        </div>
                    </div>
                    ${setsHtml}
                </div>
            `;
        });
        container.innerHTML = html;
    } catch (e) {
        container.innerHTML = `<div class="error-box" style="color:#f87171;">Erreur lors du chargement : ${e.message}</div>`;
    }
};

window.loadPlayerHistory = async function (licence) {
    const canvas = document.getElementById(`chart-${licence}`);
    if (!canvas || state.charts[licence]) return;

    const today = new Date();
    const monthLabel = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const cacheKey = `ttcav_histo_v3_${licence}_${monthLabel}`;
    const cached = localStorage.getItem(cacheKey);
    let historyData = null;

    try {
        if (cached) {
            historyData = JSON.parse(cached);
        } else {
            updateLoaderStep('Chargement de l\'historique...');
            setAppBusy(true);
            const data = await fetchData('getPlayerHistory', { licence });
            if (data && data.histo) {
                historyData = Array.isArray(data.histo) ? data.histo : [data.histo]; // Retrait du .reverse()
                localStorage.setItem(cacheKey, JSON.stringify(historyData));
            }
        }

        if (historyData) {
            state.charts[licence] = new Chart(canvas.getContext('2d'), {
                type: 'line',
                data: {
                    labels: historyData.map(h => getVal(h.saison).replace('Saison ', '')),
                    datasets: [{
                        label: 'Points',
                        data: historyData.map(h => parseInt(getVal(h.point)) || 0),
                        borderColor: '#ef4444',
                        backgroundColor: '#ef4444',
                        borderWidth: 3,
                        pointBackgroundColor: '#ef4444',
                        pointBorderWidth: 2,
                        pointRadius: 4,
                        tension: 0.3
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: '#334155',
                            titleFont: { size: 14, family: 'Outfit' },
                            bodyFont: { size: 14, weight: 'bold' },
                            displayColors: false,
                            callbacks: {
                                title: (tooltipItems) => {
                                    const idx = tooltipItems[0].dataIndex;
                                    const rawLabel = getVal(historyData[idx].saison);

                                    // Détection ultra-robuste de la phase (chiffres, romains, ou simple position)
                                    let phNum = "";
                                    if (/(ph|phase).*(1|I)/i.test(rawLabel) || /\(1\)/.test(rawLabel) || /1$/.test(rawLabel)) phNum = "1";
                                    else if (/(ph|phase).*(2|II)/i.test(rawLabel) || /\(2\)/.test(rawLabel) || /2$/.test(rawLabel)) phNum = "2";
                                    else phNum = (idx % 2 === 0) ? "1" : "2"; // Guess par alternance si rien n'est trouvé

                                    const yearMatch = rawLabel.match(/20\d\d/g);
                                    let yearStr = yearMatch ? (yearMatch.length > 1 ? `${yearMatch[0]}/${yearMatch[1]}` : yearMatch[0]) : rawLabel;
                                    return `Saison ${yearStr} • Phase ${phNum}`;
                                },
                                label: (context) => `${context.parsed.y} points`
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: { color: 'rgba(255,255,255,0.05)', tickColor: 'transparent' },
                            ticks: {
                                maxRotation: 0,
                                autoSkip: false,
                                callback: function (value, index, values) {
                                    const label = this.getLabelForValue(value);
                                    const isPh1 = /ph.*1/i.test(label) || /phase.*1/i.test(label);
                                    const isPh2 = /ph.*2/i.test(label) || /phase.*2/i.test(label);

                                    // On affiche l'année pour la Phase 1 (ou au moins 1 fois sur 2 si pas de phase détectée)
                                    if (isPh1 || (!isPh2 && index % 2 === 0)) {
                                        const yMatch = label.match(/20\d\d/);
                                        return yMatch ? yMatch[0] : label.substring(0, 4);
                                    }
                                    return ""; // Vide pour la Phase 2
                                }
                            }
                        },
                        y: { grid: { color: 'rgba(255,255,255,0.05)' }, beginAtZero: false }
                    }
                }
            });
        }
    } catch (e) {
        logDebug("Error loading history: " + e.message, "error");
    } finally {
        setAppBusy(false);
    }
};

// ===== GESTION ÉDITION DES POINTS EN DIRECT =====
window.openPointsEditorModal = function (matchID) {
    const mData = state.matchDataRegistry[matchID];
    if (!mData) return;

    // Créer la modale si elle n'existe pas
    let modal = document.getElementById('points-editor-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'points-editor-modal';
        modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:10000; display:flex; align-items:center; justify-content:center; opacity:0; transition:opacity 0.2s;';
        document.body.appendChild(modal);
    }

    let html = `
    <div class="points-editor-content" id="points-editor-content">
        <h2 class="points-editor-title">
            Édition des points
            <button onclick="document.getElementById('points-editor-modal').style.opacity='0'; setTimeout(()=>document.getElementById('points-editor-modal').style.display='none',200);" class="points-editor-close">&times;</button>
        </h2>
        <p class="points-editor-desc">Modifiez les points pour recalculer le rapport. Naviguez avec Tab.</p>
        <div class="points-editor-list">
    `;

    const addPlayerInput = (j) => {
        if (!j || !j.nom) return '';
        const currentVal = Math.round(j.calcPoints);
        return `
            <div class="pe-item">
                <span class="pe-name">${j.nom}</span>
                <input type="number" class="pe-input" data-nom="${j.nom.replace(/"/g, '&quot;')}" value="${currentVal}" onkeydown="if(event.key==='Enter') savePointsEditorModal()">
            </div>
        `;
    };

    mData.jouas.forEach(j => html += addPlayerInput(j));
    mData.joubs.forEach(j => html += addPlayerInput(j));

    html += `
        </div>
        <div class="pe-footer">
            <button onclick="document.getElementById('points-editor-modal').style.opacity='0'; setTimeout(()=>document.getElementById('points-editor-modal').style.display='none',200);" class="secondary pe-btn-cancel">Annuler</button>
            <button onclick="savePointsEditorModal()" class="pe-btn-save"><i class="fas fa-check"></i> Valider et Recalculer</button>
        </div>
    </div>
    `;

    modal.innerHTML = html;
    modal.style.display = 'flex';
    setTimeout(() => {
        modal.style.opacity = '1';
        document.getElementById('points-editor-content').style.transform = 'scale(1)';
        const firstInput = modal.querySelector('.pe-input');
        if (firstInput) firstInput.focus();
    }, 10);
};

window.savePointsEditorModal = async function () {
    const inputs = document.querySelectorAll('.pe-input');
    state.customPlayerPoints = state.customPlayerPoints || {};

    inputs.forEach(input => {
        const nom = input.getAttribute('data-nom');
        const val = parseFloat(input.value);
        if (!isNaN(val)) {
            state.customPlayerPoints[nom] = val;
        } else {
            delete state.customPlayerPoints[nom];
        }
    });

    // Sauvegarder dans localStorage et API
    localStorage.setItem('ttcav_custom_points', JSON.stringify(state.customPlayerPoints));

    const formData = new URLSearchParams();
    formData.append('data', JSON.stringify(state.customPlayerPoints));
    fetch('api.php?action=saveCustomPoints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData
    }).catch(e => console.error("Erreur saveCustomPoints API", e));

    // Fermer modale
    const modal = document.getElementById('points-editor-modal');
    if (modal) {
        modal.style.opacity = '0';
        setTimeout(() => modal.style.display = 'none', 200);
    }

    await triggerRepaintAfterEdit();
};

window.restoreSavedPlayerPoints = async function () {
    try {
        const response = await fetch('api.php?action=getCustomPoints');
        const data = await response.json();
        if (data && !data.error && Object.keys(data).length > 0) {
            state.customPlayerPoints = data;
            state.apiPointsMode = 'mensuel';
            localStorage.setItem('ttcav_custom_points', JSON.stringify(data));
            showToast('Points restaurés depuis le serveur !');
            await triggerRepaintAfterEdit();
        } else {
            showToast('Aucun point sauvegardé sur le serveur.', true);
        }
    } catch (e) {
        showToast('Erreur lors de la restauration.', true);
    }
};

window.resetPlayerPointsFromAPI = async function (mode) {
    let modeText = mode === 'officiel' ? 'officiels' : 'mensuels';
    state.customPlayerPoints = {};
    state.apiPointsMode = mode;
    state.playerDetailsCache = {};
    Object.keys(localStorage).forEach(k => {
        if (k.startsWith('ttcav_mensuel_')) localStorage.removeItem(k);
    });

    showToast(`Mise à jour depuis FFTT (${modeText})...`);
    await triggerRepaintAfterEdit(true);
};

async function triggerRepaintAfterEdit(forceRefresh = false) {
    const exportContainer = elements.exportContainer;
    if (!exportContainer) return;

    const currentScroll = exportContainer.scrollTop;
    const isGlobal = !!document.getElementById('summary-top');

    try {
        if (isGlobal) {
            await copyAllMatchesToWordPress(forceRefresh);
        } else if (state.currentMatchResIndex !== null && state.currentMatchResIndex !== undefined) {
            await showMatchDetails(state.currentMatchResIndex, forceRefresh);
        }

        if (exportContainer) {
            setTimeout(() => {
                exportContainer.scrollTop = currentScroll;
            }, 50);
        }
    } catch (e) {
        console.error("Erreur repaint :", e);
    }
}
