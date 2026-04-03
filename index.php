<!DOCTYPE html>
<html lang="fr">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TT Results Generator | Club Dashboard</title>
    <meta name="description" content="Générateur de résultats de tennis de table pour les clubs FFTT.">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link
        href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&family=Playfair+Display:wght@700&family=Lora:ital,wght@0,400;0,700;1,400&display=swap"
        rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="stylesheet" href="styles.css">
</head>

<body>

    <div id="toast" class="toast">
        <i class="fas fa-check-circle"></i>
        <span id="toast-message"></span>
    </div>

    <div class="container" id="app">
        <header>
            <div class="logo">
                <h1>TT<span>CAV</span> Export</h1>
            </div>
            <div class="actions">
                <button class="secondary open-settings-btn">
                    <i class="fas fa-cog"></i> Configuration
                </button>
                <button class="btn-refresh-btn" id="btn-refresh-top">
                    <i class="fas fa-sync-alt"></i> Actualiser
                </button>
            </div>
        </header>

        <div class="hero">
            <h2>Création rapide des résultats du championnat par équipe</h2>
            <p>Génére des résultats et exporte-les vers le site wordpress du club en un clic.</p>
        </div>

        <!-- Top Actions -->
        <div class="controls-bar glass-panel">
            <select id="select-phase" class="fancy-select">
                <option value="all">Toutes les phases</option>
            </select>
            <select id="select-team" class="fancy-select">
                <option value="all">Toutes les équipes</option>
            </select>
            <select id="select-day" class="fancy-select">
                <option value="">Sélectionnez une journée</option>
            </select>
            <button id="btn-generate" class="btn-primary">⚡ Générer</button>
            <button class="secondary" id="btn-capture">
                <i class="fas fa-camera"></i> Format Image
            </button>
            <button class="secondary" id="btn-copy-text">
                <i class="fas fa-copy"></i> Copier le texte
            </button>
            <button class="secondary" id="btn-copy-css">
                <i class="fas fa-code"></i> Copier CSS (WP)
            </button>
        </div>

        <div class="loading" id="loader">
            <i class="fas fa-circle-notch"></i>
            <p style="margin-top: 1rem">Récupération des données depuis la FFTT...</p>
        </div>

        <div class="results-grid" id="results-grid">
            <!-- Cards will be injected here -->
            <div id="initial-msg" style="grid-column: 1/-1; text-align: center; opacity: 0.5; padding: 4rem;">
                Chargement...
            </div>
        </div>

        <!-- Export View Hidden Normally -->
        <div id="export-container" style="position: absolute; left: -9999px;">
            <div id="export-panel">
                <h1 class="export-title" id="exp-title">CHAMPIONNAT PAR ÉQUIPES</h1>
                <div class="export-subtitle" id="exp-subtitle">Phase 2 - Journée 3</div>
                <div id="export-matches"></div>
                <div
                    style="text-align: center; margin-top: 3rem; border-top: 1px solid #eee; padding-top: 1rem; font-size: 0.9rem; color: #999;">
                    Généré par <span style="color: #e63946; font-weight: bold;">TTCAV Dashboard</span>
                </div>
            </div>
        </div>

        <!-- Debug Console -->
        <div id="debug-console"
            style="margin-top: 4rem; padding: 1.5rem; background: #000; border: 1px solid #333; border-radius: 8px; font-family: monospace; font-size: 0.8rem; color: #0f0; max-height: 200px; overflow-y: auto;">
            <div style="color: #666; margin-bottom: 0.5rem; text-transform: uppercase;">Flux de debug API</div>
            <div id="debug-log"></div>
        </div>
    </div>

    <!-- Settings Modal -->
    <div class="modal-overlay" id="modal-settings">
        <div class="modal">
            <h3>Configuration API FFTT</h3>
            <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 1.5rem;">
                Ces identifiants sont nécessaires pour interroger les serveurs de la fédération.
            </p>
            <div class="form-group">
                <label>App ID (ex: ASXXX)</label>
                <input type="text" id="input-app-id" placeholder="AS000">
            </div>
            <div class="form-group">
                <label>App Key (Mot de passe API)</label>
                <input type="password" id="input-app-key" placeholder="Votre clé secrète">
            </div>
            <div class="form-group">
                <label>Serial (N° de série, requis pour SWXXX)</label>
                <input type="text" id="input-serial" placeholder="Votre numéro de série">
            </div>
            <div class="form-group">
                <label>Numéro de Club (ex: 09690049)</label>
                <input type="text" id="input-club-id" placeholder="09690049">
            </div>
            <div class="form-group" style="display: flex; align-items: center; gap: 10px; margin-top: 1rem;">
                <input type="checkbox" id="input-show-debug" style="width: auto; height: auto;">
                <label for="input-show-debug" style="margin-bottom: 0;">Afficher le panneau de debug</label>
            </div>
            <div style="display: flex; gap: 1rem; margin-top: 2rem;">
                <button style="flex: 1" id="save-settings">Enregistrer</button>
                <button class="secondary" id="close-settings">Fermer</button>
            </div>
        </div>
    </div>

    <script>
        const state = {
            appId: localStorage.getItem('fftt_appId') || '',
            appKey: localStorage.getItem('fftt_appKey') || '',
            serial: localStorage.getItem('fftt_serial') || '',
            clubId: localStorage.getItem('fftt_clubId') || '',
            showDebug: localStorage.getItem('fftt_showDebug') === 'true',
            teams: [],
            matchdays: [],
            results: []
        };

        // UI Elements
        const btnSettings = document.getElementById('btn-settings');
        const modalSettings = document.getElementById('modal-settings');
        const saveSettings = document.getElementById('save-settings');
        const closeSettings = document.getElementById('close-settings');
        const btnGenerate = document.getElementById('btn-generate');
        const btnCapture = document.getElementById('btn-capture');
        const btnCopyText = document.getElementById('btn-copy-text');
        const resultsGrid = document.getElementById('results-grid');
        const loader = document.getElementById('loader');
        const toast = document.getElementById('toast');
        const toastMsg = document.getElementById('toast-message');

        // Init inputs
        document.getElementById('input-app-id').value = state.appId;
        document.getElementById('input-app-key').value = state.appKey;
        document.getElementById('input-serial').value = state.serial;
        document.getElementById('input-club-id').value = state.clubId;
        document.getElementById('input-show-debug').checked = state.showDebug;
        document.getElementById('debug-console').style.display = state.showDebug ? 'block' : 'none';

        function updateInitialMessage() {
            const msgEl = document.getElementById('initial-msg');
            if (msgEl) {
                msgEl.innerText = (state.appId && state.clubId) ? 
                    'Sélectionnez une journée ci-dessus pour générer les résultats.' : 
                    'Configurez vos accès API pour commencer.';
            }
        }
        updateInitialMessage();

        function showToast(message, isError = false) {
            toastMsg.innerText = message;
            const icon = toast.querySelector('i');
            if (isError) {
                icon.className = 'fas fa-exclamation-circle';
                icon.style.color = '#ef4444';
            } else {
                icon.className = 'fas fa-check-circle';
                icon.style.color = 'var(--win)';
            }
            toast.classList.add('show');
            setTimeout(() => toast.classList.remove('show'), 3000);
        }


        // Modal events
        document.querySelectorAll('.open-settings-btn').forEach(btn => {
            btn.onclick = () => modalSettings.style.display = 'flex';
        });
        closeSettings.onclick = () => modalSettings.style.display = 'none';

        document.querySelectorAll('.btn-refresh-btn').forEach(btn => {
            btn.onclick = () => loadTeams();
        });

        saveSettings.onclick = () => {
            state.appId = document.getElementById('input-app-id').value;
            state.appKey = document.getElementById('input-app-key').value;
            state.serial = document.getElementById('input-serial').value;
            state.clubId = document.getElementById('input-club-id').value;
            state.showDebug = document.getElementById('input-show-debug').checked;

            localStorage.setItem('fftt_appId', state.appId);
            localStorage.setItem('fftt_appKey', state.appKey);
            localStorage.setItem('fftt_serial', state.serial);
            localStorage.setItem('fftt_clubId', state.clubId);
            localStorage.setItem('fftt_showDebug', state.showDebug);

            document.getElementById('debug-console').style.display = state.showDebug ? 'block' : 'none';

            updateInitialMessage();

            modalSettings.style.display = 'none';
            showToast('Configuration enregistrée !');
            loadTeams();
        };


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
                logDebug(`Appel API : action=${action}`);
                const response = await fetch(`api.php?${params.toString()}`);
                const data = await response.json();
                if (data.error) {
                    const msg = data.message ? `${data.error} : ${data.message}` : data.error;
                    logDebug(msg, 'error');
                    if (data.raw) {
                        logDebug(`BRUT REÇU :\n${data.raw}`, 'info');
                    }
                }
                return data;
            } catch (e) {
                logDebug(`Erreur réseau : ${e.message}`, 'error');
                console.error('Fetch error:', e);
                return { error: 'Erreur réseau' };
            }
        }

        function logDebug(msg, type = 'info') {
            const log = document.getElementById('debug-log');
            const entry = document.createElement('div');
            entry.style.color = type === 'error' ? '#f55' : '#0f0';
            entry.innerText = `[${new Date().toLocaleTimeString()}] ${msg}`;
            log.appendChild(entry);
            console.log(msg);
        }

        async function loadTeams() {
            const clubId = state.clubId;
            if (!clubId) return alert('Veuillez saisir votre numéro de club.');

            loader.style.display = 'block';
            logDebug(`Initialisation du serial...`);
            await fetchData('getInitialisation');

            logDebug(`Chargement des équipes pour le club ${clubId}...`);
            const data = await fetchData('getTeams');
            loader.style.display = 'none';

            if (data && data.equipe) {
                state.teams = Array.isArray(data.equipe) ? data.equipe : [data.equipe];
                logDebug(`${state.teams.length} équipes chargées avec succès.`);

                // Extract phases
                const phases = new Set();
                state.teams.forEach(t => {
                    const tName = t.libequipe || t.libequ || t.libepr || t.lib || "";
                    const match = tName.match(/Phase\s*\d+/i);
                    if (match) phases.add(match[0]);
                });

                const selectPhase = document.getElementById('select-phase');
                selectPhase.innerHTML = '<option value="all">Toutes les phases</option>';
                Array.from(phases).sort().forEach(p => {
                    const opt = document.createElement('option');
                    opt.value = p;
                    opt.textContent = p;
                    selectPhase.appendChild(opt);
                });

                const selectTeam = document.getElementById('select-team');

                function updateTeamDropdown(phaseVal) {
                    selectTeam.innerHTML = '<option value="all">Toutes les équipes</option>';
                    let filteredTeams = state.teams;

                    if (phaseVal !== "all") {
                        filteredTeams = state.teams.filter(t => {
                            const tName = t.libequipe || t.libequ || t.libepr || t.lib || "";
                            return tName.toLowerCase().includes(phaseVal.toLowerCase());
                        });
                    }

                    filteredTeams.forEach((t) => {
                        const idx = state.teams.indexOf(t);
                        const tName = t.libequipe || t.libequ || t.libepr || t.lib || `Équipe ${idx + 1}`;
                        const opt = document.createElement('option');
                        opt.value = idx;
                        opt.textContent = tName;
                        selectTeam.appendChild(opt);
                    });

                    // Trigger change to load matchdays for the first valid D1 team of the filtered list, or just the first
                    if (filteredTeams.length > 0) {
                        const validTeam = filteredTeams.find(t => {
                            let link = t.liendivision || t.liendiv || "";
                            return typeof link === 'string' && link.includes('D1');
                        }) || filteredTeams[0];

                        if (validTeam) {
                            selectTeam.value = state.teams.indexOf(validTeam);
                            loadMatchdays(validTeam);
                        }
                    } else {
                        document.getElementById('select-day').innerHTML = '<option value="">Sélectionnez une journée</option>';
                    }
                }

                // Listen for phase change
                selectPhase.onchange = () => {
                    updateTeamDropdown(selectPhase.value);
                };

                // Listen for Team changes to refresh matchdays
                selectTeam.onchange = () => {
                    const idx = selectTeam.value;
                    if (idx === "all") {
                        const phaseVal = selectPhase.value;
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

                // Auto Select latest phase if it exists, otherwise "all"
                if (phases.size > 0) {
                    const latestPhase = Array.from(phases).sort().reverse()[0];
                    selectPhase.value = latestPhase;
                    updateTeamDropdown(latestPhase);
                } else {
                    updateTeamDropdown("all");
                }
            } else {
                logDebug("Aucune clé 'equipe' dans le JSON. Vérifiez le panneau console (F12).", "error");
            }
        }

        async function loadMatchdays(team) {
            const teamName = team.libequipe || team.lib || team.libequ || "Équipe";
            logDebug(`Chargement des journées pour l'équipe ${teamName}...`);

            let divisionLink = team.liendivision || team.liendiv || "";
            if (typeof divisionLink !== 'string') divisionLink = "";

            const linkParams = new URLSearchParams(divisionLink.includes('?') ? divisionLink.split('?')[1] : divisionLink);
            const divisionId = linkParams.get('D1') || '';
            const pouleId = linkParams.get('cx_poule') || '';

            const data = await fetchData('getMatches', { divisionId, pouleId });

            const selectDay = document.getElementById('select-day');
            selectDay.innerHTML = '<option value="">Sélectionnez une journée</option>';

            if (data && data.tour) {
                const roundsList = Array.isArray(data.tour) ? data.tour : [data.tour];

                // Filter only played rounds : scorea or scoreb must be a non-empty string
                const playedRounds = roundsList.filter(r => {
                    let sA = typeof r.scorea === 'string' ? r.scorea : '';
                    let sB = typeof r.scoreb === 'string' ? r.scoreb : '';
                    return sA.trim() !== '' || sB.trim() !== '';
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
                    opt.textContent = d ? `${tourExtracted} (${d})` : tourExtracted;
                    selectDay.appendChild(opt);
                });

                // Select the last one by default
                if (playedRounds.length > 0) {
                    const lastIdx = playedRounds.length - 1;
                    const lastRound = playedRounds[lastIdx];
                    let lastD = (typeof lastRound.dateprevue === 'string' ? lastRound.dateprevue : '') ||
                        (typeof lastRound.datereelle === 'string' ? lastRound.datereelle : '') || '';
                    let lastTour = `Tour n°${lastIdx + 1}`;
                    const lastTm = (typeof lastRound.libelle === 'string' ? lastRound.libelle : "").match(/tour n°\d+/i);
                    if (lastTm) lastTour = lastTm[0];

                    selectDay.value = lastD || lastTour;
                }
            } else {
                logDebug("Aucune journée trouvée dans la réponse API.", "error");
            }
        }

        async function generateResults() {
            const selectedDayVal = document.getElementById('select-day').value;
            const selectedTeamIdx = document.getElementById('select-team').value;

            if (!selectedDayVal) return showToast('Veuillez sélectionner une journée.', true);


            loader.style.display = 'block';
            logDebug(`Génération des résultats...`);

            resultsGrid.innerHTML = '';
            state.results = [];

            let teamsToProcess = state.teams;
            if (selectedTeamIdx !== "all") {
                teamsToProcess = [state.teams[selectedTeamIdx]];
            }

            const promises = teamsToProcess.map(async (team) => {
                const getVal = (v) => typeof v === 'string' ? v.trim() : '';

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

                    // Find the match in this poule that corresponds to this team AND the selected day/tour
                    const matchFound = allMatchesInPoule.find((r, idx) => {
                        let d = getVal(r.dateprevue) || getVal(r.datereelle) || '';
                        let tExt = `Tour n°${idx + 1}`;
                        const tm = getVal(r.libelle).match(/tour n°\d+/i);
                        if (tm) tExt = tm[0];
                        let rVal = d || tExt;

                        if (rVal !== selectedDayVal) return false;

                        // MUST match the team name
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
                            pouleId: pouleId,
                            originalIndex: state.results.length // Add this to keep track
                        });
                    }
                }
            });

            await Promise.all(promises);
            loader.style.display = 'none';

            logDebug(`Résultats chargés : ${state.results.length} rencontres.`);
            renderResults();
        }

        function renderResults() {
            if (state.results.length === 0) {
                resultsGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; opacity: 0.5; padding: 4rem;">Aucun match trouvé pour cette journée.</div>';
                return;
            }

            resultsGrid.innerHTML = state.results.map((res, index) => {
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
                        <div class="opponent" style="text-align: left;">${res.isHome ? res.teamName : res.opponent}</div>
                        <div class="score-box">
                            <div class="score ${statusClass}">${res.score}</div>
                        </div>
                        <div class="opponent">${res.isHome ? res.opponent : res.teamName}</div>
                    </div>
                    <div class="card-footer">
                        <span class="match-date"><i class="far fa-calendar-alt"></i> ${res.date}</span>
                        ${res.detailLink ? `<button class="secondary" style="padding: 0.4rem 0.8rem; font-size: 0.8rem;" onclick="showMatchDetails(${index})">Détails</button>` : ''}
                    </div>
                </div>
            `;
            }).join('');
        }

        async function showMatchDetails(index) {
            const res = state.results[index];
            if (!res.detailLink) return;

            loader.style.display = 'block';
            logDebug(`Récupération des détails du match... [ID: ${index}]`);

            const linkParams = new URLSearchParams(res.detailLink.includes('?') ? res.detailLink.split('?')[1] : res.detailLink);
            const is_retour = linkParams.get('is_retour') || '0';
            const renc_id = linkParams.get('renc_id') || linkParams.get('res_id') || '';

            try {
                const data = await fetchData('getMatchDetails', { is_retour, renc_id });

                if (data && data.resultat) {
                    logDebug(`Détails récupérés, génération du rapport...`);
                    loader.style.display = 'none';
                    renderPremiumExport(res, data);
                } else {
                    throw new Error("Format de données invalide");
                }
            } catch (err) {
                console.error(err);
                loader.style.display = 'none';
                logDebug(`Erreur : ${err.message}`);
                showToast('Erreur lors de la récupération des détails.', true);
            }
        }

        function renderPremiumExport(res, details) {
            const p = details.resultat;
            const equipeA = p.equa || 'Equipe A';
            const equipeB = p.equb || 'Equipe B';
            let tmpScoreA = parseInt(p.scorea);
            let tmpScoreB = parseInt(p.scoreb);
            let API_SCORE_A = isNaN(tmpScoreA) ? 0 : tmpScoreA;
            let API_SCORE_B = isNaN(tmpScoreB) ? 0 : tmpScoreB;

            const panel = document.getElementById('export-panel');

            // Team Composition
            let jouas = [];
            let joubs = [];
            const joueursArray = Array.isArray(details.joueur) ? details.joueur : (details.joueur ? [details.joueur] : []);

            let equipeAPoints = 0;
            let equipeBPoints = 0;

            function parseClassement(str) {
                if (!str) return { text: '', raw: 0 };
                let points = 0;
                let text = '';

                // Check for National Rank
                let natMatch = str.match(/(?:N°|N)\s*(\d+)/i);
                let natRank = natMatch ? natMatch[1] : null;

                // Extract the points
                let nums = [...str.matchAll(/\d+/g)].map(m => parseInt(m[0], 10));
                if (nums.length > 0) {
                    if (natRank) {
                        let c = nums.filter(n => n.toString() !== natRank);
                        points = c.length > 0 ? c[c.length - 1] : 0;
                    } else {
                        points = nums[nums.length - 1]; // typically the only number: "1450 M" or "M 1450"
                    }
                }

                if (points) {
                    text = points.toString();
                    if (natRank) text = `(n°${natRank}) ` + text;
                } else if (natRank) {
                    text = `(n°${natRank})`;
                }

                return { text: text, raw: points };
            }

            joueursArray.forEach(j => {
                let nA = (j.xja || '').replace(/\s*[MF]\s*$/, '').trim();
                let nB = (j.xjb || '').replace(/\s*[MF]\s*$/, '').trim();

                let pA = parseClassement(j.xca || '');
                let pB = parseClassement(j.xcb || '');

                // Captain check
                let isCapA = nA.toLowerCase().includes(' cap') || j.xca === 'cap' || j.capa === '1';
                let isCapB = nB.toLowerCase().includes(' cap') || j.xcb === 'cap' || j.capb === '1';

                nA = nA.replace(/\s*cap(?:itaine)?\.?\s*$/i, '').trim();
                nB = nB.replace(/\s*cap(?:itaine)?\.?\s*$/i, '').trim();

                if (nA) jouas.push({ nom: nA, classement: pA.text || '', rawPoints: pA.raw, isCap: isCapA });
                if (nB) joubs.push({ nom: nB, classement: pB.text || '', rawPoints: pB.raw, isCap: isCapB });
            });

            // Fallback: extract unique players from matches if details.joueur is empty
            if (jouas.length === 0 && joubs.length === 0) {
                const tempA = new Set();
                const tempB = new Set();
                const parties = Array.isArray(details.partie) ? details.partie : (details.partie ? [details.partie] : []);
                parties.forEach(m => {
                    if (m.ja && m.ja.trim() && m.ja !== '-') {
                        let trimA = m.ja.replace(/\s*[MF]\s*$/, '').trim();
                        tempA.add(trimA);
                    }
                    if (m.jb && m.jb.trim() && m.jb !== '-') {
                        let trimB = m.jb.replace(/\s*[MF]\s*$/, '').trim();
                        tempB.add(trimB);
                    }
                });
                jouas = Array.from(tempA).map(nom => ({ nom, classement: '', rawPoints: 0, isCap: false }));
                joubs = Array.from(tempB).map(nom => ({ nom, classement: '', rawPoints: 0, isCap: false }));
            }

            jouas.forEach(j => { equipeAPoints += j.rawPoints || 0; });
            joubs.forEach(j => { equipeBPoints += j.rawPoints || 0; });

            let compoHTML = `
            <div class="section-title">La composition des équipes</div>
            <table class="premium-table">
                <thead>
                    <tr>
                        <th style="padding: 1rem;">${equipeA}</th>
                        <th style="padding: 1rem;">${equipeB}</th>
                    </tr>
                </thead>
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

                compoHTML += `
                <tr>
                    <td>${htmlA}</td>
                    <td>${htmlB}</td>
                </tr>
            `;
            }

            // Match Sheet (Parties)
            const parties = Array.isArray(details.partie) ? details.partie : (details.partie ? [details.partie] : []);

            // POINT CALCULATION LOGIC
            function getPointsGained(ratingA, ratingB, wonA) {
                if (!ratingA || !ratingB) return 0;
                const diff = ratingA - ratingB;
                const absoluteDiff = Math.abs(diff);
                let gain = 0;

                // Simple standard FFTT table approximation for 2024
                if (wonA) { // Victory
                    if (diff >= 500) gain = 0.5;
                    else if (diff >= 400) gain = 1;
                    else if (diff >= 300) gain = 2;
                    else if (diff >= 200) gain = 3;
                    else if (diff >= 100) gain = 4;
                    else if (diff >= 0) gain = 5;
                    else if (diff >= -24) gain = 6;
                    else if (diff >= -49) gain = 7;
                    else if (diff >= -99) gain = 8;
                    else if (diff >= -149) gain = 10;
                    else if (diff >= -199) gain = 13;
                    else if (diff >= -249) gain = 17;
                    else if (diff >= -299) gain = 22;
                    else if (diff >= -399) gain = 28;
                    else gain = 40;
                } else { // Loss
                    if (diff >= 400) gain = -40;
                    else if (diff >= 300) gain = -28;
                    else if (diff >= 250) gain = -22;
                    else if (diff >= 200) gain = -17;
                    else if (diff >= 150) gain = -13;
                    else if (diff >= 100) gain = -10;
                    else if (diff >= 50) gain = -8;
                    else if (diff >= 25) gain = -7;
                    else if (diff >= 0) gain = -6;
                    else if (diff >= -99) gain = -5;
                    else if (diff >= -199) gain = -4;
                    else if (diff >= -299) gain = -3;
                    else if (diff >= -399) gain = -2;
                    else if (diff >= -499) gain = -1;
                    else gain = -0.5;
                }
                return gain;
            }

            let totalGainedClub = 0;
            const clubStats = {}; // To store points per local player

            // ONLY include OUR club players in stats
            const ourPlayers = res.isHome ? jouas : joubs;
            ourPlayers.forEach(j => {
                if (j.nom) clubStats[j.nom.trim()] = { ptsMatch: 0, doubleResult: '-' };
            });

            compoHTML += `
                <tr class="compo-total-row" style="background: #f1f5f9; font-weight: 700; font-size: 0.85rem; color: #475569; text-align: center; text-transform: uppercase;">
                    <td style="padding: 0.5rem 1rem;">TOTAL POINTS EQUIPE : ${equipeAPoints}</td>
                    <td style="padding: 0.5rem 1rem;">TOTAL POINTS EQUIPE : ${equipeBPoints}</td>
                </tr>
        `;
            compoHTML += `</tbody></table>`;
            let totalSetsA = 0;
            let totalSetsB = 0;
            let matchesWonA = 0;
            let matchesWonB = 0;
            let totalPointsA = 0;
            let totalPointsB = 0;
            let partiesHTML = '';

            parties.forEach(m => {
                const getStr = (v) => typeof v === 'string' ? v.trim() : (typeof v === 'number' ? String(v) : '');
                let jA = getStr(m.ja) || '-';
                let jB = getStr(m.jb) || '-';

                // Sometimes scores are in scorea/scoreb, other times they must be inferred from the detail string
                let strA = getStr(m.scorea);
                let strB = getStr(m.scoreb);
                let sA = parseInt(strA) || 0;
                let sB = parseInt(strB) || 0;
                if (isNaN(sA)) sA = 0;
                if (isNaN(sB)) sB = 0;

                // Check for detail string like "09-11 11-08 ..." or separate m.ms1
                let sets = ['', '', '', '', ''];

                // Populate sets from API structure (could be in m.detail or m.ms1, ms2 etc.)
                if (m.detail && typeof m.detail === 'string') {
                    const s = m.detail.split(' ');
                    for (let i = 0; i < Math.min(s.length, 5); i++) {
                        sets[i] = s[i];
                    }
                } else {
                    sets[0] = getStr(m.ms1);
                    sets[1] = getStr(m.ms2);
                    sets[2] = getStr(m.ms3);
                    sets[3] = getStr(m.ms4);
                    sets[4] = getStr(m.ms5);
                }

                // Calculate sets won
                let setsWA = 0, setsWB = 0;
                let hasValidSets = false;
                sets.forEach(setStr => {
                    if (!setStr) return;

                    if (setStr.includes('-') && setStr.indexOf('-') > 0) {
                        const parts = setStr.split('-');
                        if (parts.length === 2) {
                            const p1 = parseInt(parts[0]), p2 = parseInt(parts[1]);
                            if (!isNaN(p1) && !isNaN(p2)) {
                                if (p1 > p2) setsWA++; else if (p2 > p1) setsWB++;
                                hasValidSets = true;
                            }
                        }
                    } else {
                        // FFTT often provides implicit scores where positive means Team A won and negative means Team B won
                        const val = parseInt(setStr);
                        if (!isNaN(val)) {
                            if (val < 0) setsWB++; else setsWA++;
                            hasValidSets = true;
                        }
                    }
                });

                // Use calculated sets won if available, else fallback to API game points (1/0)
                let finalSA = hasValidSets ? setsWA : sA;
                let finalSB = hasValidSets ? setsWB : sB;

                totalSetsA += finalSA;
                totalSetsB += finalSB;

                const styleA = finalSA > finalSB ? 'font-weight: bold; color: #0f172a;' : '';
                const styleB = finalSB > finalSA ? 'font-weight: bold; color: #0f172a;' : '';

                // NEW SCORING LOGIC ACCUMULATION
                let pointsSummaryA = 0;
                let pointsSummaryB = 0;

                sets.forEach(setStr => {
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
                });

                totalPointsA += pointsSummaryA;
                totalPointsB += pointsSummaryB;


                // The badge should be green only if the club's team won this row
                const isWinForClub = res.isHome ? (finalSA > finalSB) : (finalSB > finalSA);

                // Calculate match points gained
                let rowPoints = 0;
                if (jA && jB && jA !== '-' && jB !== '-' && !jA.toLowerCase().includes('double') && !jB.toLowerCase().includes('double')) {
                    // Find ratings
                    const playerA = jouas.find(p => p.nom === jA);
                    const playerB = joubs.find(p => p.nom === jB);
                    if (playerA && playerB && playerA.rawPoints && playerB.rawPoints) {
                        let gainA = getPointsGained(playerA.rawPoints, playerB.rawPoints, finalSA > finalSB);
                        let gainB = getPointsGained(playerB.rawPoints, playerA.rawPoints, finalSB > finalSA);

                        // rowPoints is relative to our club's team for individual +/- stats
                        rowPoints = res.isHome ? gainA : gainB;

                        if (res.isHome) {
                            if (clubStats[jA]) clubStats[jA].ptsMatch += rowPoints;
                        } else {
                            if (clubStats[jB]) clubStats[jB].ptsMatch += rowPoints;
                        }
                        totalGainedClub += rowPoints;
                    }
                } else if (jA.toLowerCase().includes('double')) {
                    // Double Detection: looking for "/" as separator
                    const isDoubleWin = (finalSA > finalSB);
                    [jA, jB].forEach((doubleStr, isSideB) => {
                        doubleStr.split(/[\/\&]/).forEach(namePart => {
                            const clean = namePart.trim();
                            if (!clean) return;
                            // Find this player in our clubStats (which only contains our players)
                            const matched = Object.keys(clubStats).find(k => k.toLowerCase().includes(clean.toLowerCase()) || clean.toLowerCase().includes(k.toLowerCase()));
                            if (matched) {
                                // If isSideB=false, player is in Team A. If isSideB=true, player is in Team B.
                                const won = isSideB ? !isDoubleWin : isDoubleWin;
                                clubStats[matched].doubleResult = won ? 'V' : 'D';
                            }
                        });
                    });
                }

                // Total Points Calculation for the scoreboard footer handled above by accumulation logic



                partiesHTML += `
                <tr>
                    <td style="${styleA}">${jA}</td>
                    <td style="${styleB}">${jB}</td>
                    <td class="col-set">${sets[0]}</td>
                    <td class="col-set">${sets[1]}</td>
                    <td class="col-set">${sets[2]}</td>
                    <td class="col-set">${sets[3]}</td>
                    <td class="col-set">${sets[4]}</td>
                    <td class="col-score">
                        <span class="${isWinForClub ? 'badge-win' : 'badge-loss'}">${finalSA}-${finalSB}</span>
                    </td>
                    <td style="text-align: center; font-size: 0.75rem; font-weight: bold; color: ${rowPoints > 0 ? '#10b981' : (rowPoints < 0 ? '#ef4444' : '#64748b')}">
                        ${rowPoints > 0 ? '+' : ''}${rowPoints !== 0 ? rowPoints : ''}
                    </td>
                </tr>
            `;
            });
            partiesHTML = `
            <div class="section-title">La feuille de rencontre</div>
            <table class="premium-table">
                <thead>
                    <tr>
                        <th class="col-player">${equipeA}</th>
                        <th class="col-player">${equipeB}</th>
                        <th class="col-set">1</th>
                        <th class="col-set">2</th>
                        <th class="col-set">3</th>
                        <th class="col-set">4</th>
                        <th class="col-set">5</th>
                        <th class="col-score">S.</th>
                        <th style="width: 50px; text-align: center; font-size: 0.7rem;">+/-</th>
                    </tr>
                </thead>
                <tbody>
                    ${partiesHTML}
                </tbody>
            </table>`;

            // Individual Stats Calculation (STRICTLY ONLY for our club players)
            const stats = {};
            Object.keys(clubStats).forEach(name => {
                stats[name] = { v: 0, d: 0, pts: 0 };
            });

            parties.forEach(m => {
                const getStr = (v) => typeof v === 'string' ? v.trim() : '';
                const sA = parseInt(getStr(m.scorea)) || 0;
                const sB = parseInt(getStr(m.scoreb)) || 0;
                let ja = getStr(m.ja);
                let jb = getStr(m.jb);

                if (ja) {
                    // Look for an EXACT match or a very close one only in OUR player list
                    let matched = Object.keys(stats).find(k => ja.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(ja.toLowerCase()));
                    if (matched) {
                        if (sA > sB) stats[matched].v++; else stats[matched].d++;
                    }
                }
                if (jb) {
                    let matched = Object.keys(stats).find(k => jb.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(jb.toLowerCase()));
                    if (matched) {
                        if (sB > sA) stats[matched].v++; else stats[matched].d++;
                    }
                }
            });

            let statsHTML = `
            <div class="section-title">Statistiques individuelles</div>
            <table class="premium-table">
                <thead>
                    <tr>
                        <th>Joueur</th>
                        <th>Victoire</th>
                        <th>Défaite</th>
                        <th>Points</th>
                        <th>Double</th>
                    </tr>
                </thead>
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
            statsHTML += `</tbody></table>`;

            let finalTeamScoreA = res.scoreA || API_SCORE_A;
            let finalTeamScoreB = res.scoreB || API_SCORE_B;

            // Outcome Points: 3 for Win, 2 for Draw, 1 for Loss
            let outcomeA = 2;
            let outcomeB = 2;
            if (finalTeamScoreA > finalTeamScoreB) { outcomeA = 3; outcomeB = 1; }
            else if (finalTeamScoreA < finalTeamScoreB) { outcomeA = 1; outcomeB = 3; }

            // Premium Scoreboard HTML: [OutcomeA][ScoreA] vs [ScoreB][OutcomeB]
            const scoreboardHTML = `
            <div class="premium-scoreboard" style="align-items: center;">
                <div class="score-digit-box digit-red" style="width: 40px; height: 56px; font-size: 2rem;">${outcomeA}</div>
                <div class="score-digit-box digit-black" style="width: auto; min-width: 70px; padding: 0 10px;">${finalTeamScoreA}</div>
                <div class="score-divider"></div>
                <div class="score-digit-box digit-black" style="width: auto; min-width: 70px; padding: 0 10px;">${finalTeamScoreB}</div>
                <div class="score-digit-box digit-red" style="width: 40px; height: 56px; font-size: 2rem;">${outcomeB}</div>
            </div>
        `;

            panel.innerHTML = `
            <div style="position: absolute; top: 1rem; right: 1rem; display: flex; gap: 0.5rem;">
                <button onclick="copyHTMLForWordPress()" style="padding: 0.5rem 1rem; border-radius: 8px; background: #1d3557; color: white; border: none; cursor: pointer; font-weight: bold; font-size: 0.8rem;">📄 Copier HTML (WP)</button>
                <button onclick="document.getElementById('export-container').style.display='none'" style="padding: 0.5rem 1rem; border-radius: 8px; background: #e2e8f0; color: #475569; border: none; cursor: pointer; font-weight: bold; box-shadow: none;">X Fermer</button>
            </div>
            <div class="export-header">
                <div class="export-title">${equipeA} –<br>${equipeB}</div>
                <div class="export-subtitle">${res.category}</div>
                ${scoreboardHTML}
            </div>
            ${compoHTML}
            ${partiesHTML}
            <div class="match-sets-sum">
                <span style="margin-right: 1.5rem;">Les points : ${totalPointsA} / ${totalPointsB}</span>
                Les manches : ${totalSetsA} - ${totalSetsB}
            </div>
            ${statsHTML}
            <div id="league-ranking-container"></div>
            <div class="summary-footer">
                Bilan du match : ${finalTeamScoreA > finalTeamScoreB ? 'Victoire de ' + equipeA : (finalTeamScoreA < finalTeamScoreB ? 'Victoire de ' + equipeB : 'Match nul')}
            </div>
        `;

            // Fetch League Ranking in background
            if (res.divisionId && res.pouleId) {
                fetchData('getClassement', { divisionId: res.divisionId, pouleId: res.pouleId }).then(data => {
                    if (data && data.classement) {
                        const list = Array.isArray(data.classement) ? data.classement : [data.classement];
                        // Find our team
                        const myEntry = list.find(e => e.equipe && e.equipe.toLowerCase().includes(res.teamName.toLowerCase()));
                        if (myEntry) {
                            const rankDiv = document.getElementById('league-ranking-container');
                            if (rankDiv) {
                                rankDiv.innerHTML = `
                                <div class="section-title">Bilan de la poule</div>
                                <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.5rem; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
                                    <div>
                                        <div style="font-size: 0.75rem; color: #64748b; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em;">Classement Actuel</div>
                                        <div style="font-size: 1.5rem; font-weight: 800; color: #1e293b;">${myEntry.rang}<sup>${myEntry.rang == 1 ? 'er' : 'ème'}</sup> / ${list.length}</div>
                                    </div>
                                    <div style="text-align: right;">
                                        <div style="font-size: 0.75rem; color: #64748b; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em;">Bilan Saison</div>
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

            // Show panel
            const exportContainer = document.getElementById('export-container');
            exportContainer.style.display = 'block';
            exportContainer.style.left = '50%';
            exportContainer.style.transform = 'translateX(-50%)';
            exportContainer.style.top = '100px';
            exportContainer.style.zIndex = '5000';
            exportContainer.style.position = 'absolute';
            panel.style.display = 'block';
            panel.style.position = 'relative';

            window.scrollTo(0, document.body.scrollHeight);
        }

        btnGenerate.onclick = generateResults;

        btnCapture.onclick = () => {
            if (state.results.length === 0) return showToast('Générez d\'abord les résultats.', true);
            if (state.results.length === 1) {
                showMatchDetails(0);
            } else {
                showToast('Cliquez sur "Détails" spécifique pour voir le rapport.', true);
            }
        };

        btnCopyText.onclick = () => {
            if (state.results.length === 0) return showToast('Générez d\'abord les résultats.', true);

            const dayLabel = document.getElementById('select-day').value;
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

            navigator.clipboard.writeText(text).then(() => {
                showToast('Résultats texte copiés !');
            });
        };

        function getWordPressCSS() {
            return `
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800;900&display=swap');

.ttcav-export-wrapper { 
    font-family: 'Outfit', sans-serif; 
    line-height: 1.6;
    color: #1e293b;
    background: #ffffff;
}

.export-header { text-align: center; margin-bottom: 2.5rem; }
.export-title { font-size: 20px; font-size: 2rem; font-weight: 800; color: #1e293b; margin-bottom: 8px; text-transform: uppercase; letter-spacing: -0.02em; }
.export-subtitle { font-size: 1.2rem; color: #64748b; margin-bottom: 25px; font-weight: 500; }

.premium-scoreboard { display: flex; justify-content: center; gap: 12px; background: #0f172a; padding: 25px; border-radius: 16px; width: fit-content; margin: 0 auto; color: white; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.3); }
.score-digit-box { background: #ffffff; color: #0f172a; width: 50px; height: 70px; display: flex; align-items: center; justify-content: center; font-size: 2.5rem; font-weight: 900; border-radius: 8px; border: 3px solid #334155; font-family: 'Arial Black', Gadget, sans-serif; }
.digit-red { color: #e11d48; }
.score-divider { width: 20px; }

.section-title { font-size: 1.4rem; font-weight: 800; margin: 3.5rem 0 1.5rem; color: #1e293b; text-align: center; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #f1f5f9; padding-bottom: 10px; }

.premium-table { width: 100% !important; border-collapse: separate; border-spacing: 0; margin-bottom: 2.5rem; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
.premium-table th { background: #f8fafc; color: #475569; text-align: left; padding: 14px 18px; border-bottom: 1px solid #e2e8f0; text-transform: uppercase; font-size: 0.8rem; font-weight: 700; letter-spacing: 0.025em; }
.premium-table td { padding: 12px 18px; border-bottom: 1px solid #f1f5f9; color: #1e293b; font-size: 0.95rem; }
.premium-table tr:last-child td { border-bottom: none; }
.premium-table tr:nth-child(even) { background: #f8fafc; }

.col-player { width: 35%; font-weight: 600; }
.col-set { width: 8%; text-align: center; color: #94a3b8; font-weight: 500; }
.col-score { width: 10%; text-align: center; font-weight: 800; color: #0f172a; }

.badge-win { background: #dcfce7; color: #166534; padding: 5px 12px; border-radius: 9999px; font-weight: 700; font-size: 0.75rem; text-transform: uppercase; }
.badge-loss { background: #fee2e2; color: #991b1b; padding: 5px 12px; border-radius: 9999px; font-weight: 700; font-size: 0.75rem; text-transform: uppercase; }

.match-sets-sum { font-size: 0.9rem; margin-top: -1.5rem; margin-bottom: 2rem; color: #64748b; font-style: italic; text-align: right; }
.summary-footer { background: #f8fafc; padding: 2rem; text-align: center; font-weight: 800; font-size: 1.4rem; color: #0f172a; border-radius: 16px; margin-top: 3rem; border: 2px dashed #e2e8f0; }

#league-ranking-container { margin: 3rem 0; }
.compo-total-row { background: #f1f5f9 !important; font-weight: 700; font-size: 0.85rem; color: #475569; text-align: center; text-transform: uppercase; }
        `.trim();
        }

        document.getElementById('btn-copy-css').onclick = () => {
            navigator.clipboard.writeText(getWordPressCSS()).then(() => {
                showToast('CSS WordPress copié !');
            });
        };

        function copyHTMLForWordPress() {
            const panel = document.getElementById('export-panel');
            if (!panel || !panel.innerHTML) return;

            // Clone to modify
            const clone = panel.cloneNode(true);
            // Remove buttons
            const btnBox = clone.querySelector('div');
            if (btnBox) btnBox.remove();

            const fullHTML = `
            <div class="ttcav-export-wrapper" style="background: white; padding: 30px; border-radius: 15px; border: 1px solid #eee; max-width: 800px; margin: 2rem auto; box-shadow: 0 10px 25px rgba(0,0,0,0.05); box-sizing: border-box;">
                ${clone.innerHTML}
            </div>
        `;

            navigator.clipboard.writeText(fullHTML.trim()).then(() => {
                showToast('HTML (WP) sans CSS copié !');
            });
        }

        // Auto-init if credentials exist
        if (state.appId && state.clubId) {
            loadTeams();
        }
    </script>

</body>

</html>