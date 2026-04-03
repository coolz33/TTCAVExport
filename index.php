<?php
/**
 * Application : TTCAV Results Generator
 * Description : Générateur de rapports premium pour les clubs de tennis de table.
 * Auteur : Antigravity (AI Assistant)
 * Date : 2026-04-03
 */

// Paramètres de configuration (si besoin de charger des variables PHP ici)
?>
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TT Results Generator | Club Dashboard</title>
    <meta name="description" content="Générateur de rapports de tennis de table pour clubs FFTT.">
    
    <!-- Polices et Styles -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&family=Playfair+Display:wght@700&family=Lora:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="stylesheet" href="styles.css">
</head>

<body>
    <!-- Systéme de Notifications (Toast) -->
    <div id="toast" class="toast">
        <i class="fas fa-check-circle"></i>
        <span id="toast-message"></span>
    </div>

    <div class="container" id="app">
        <!-- En-tête -->
        <header>
            <div class="logo">
                <h1>TT<span>CAV</span> Export</h1>
            </div>
            <div class="actions">
                <button class="secondary open-settings-btn" title="Paramètres API">
                    <i class="fas fa-cog"></i> Configuration
                </button>
                <button class="btn-refresh-btn" id="btn-refresh-top" title="Recharger les équipes">
                    <i class="fas fa-sync-alt"></i> Actualiser
                </button>
            </div>
        </header>

        <!-- Section Héro -->
        <div class="hero">
            <h2>Création rapide des rapports de championnat</h2>
            <p>Générez des visuels professionnels et exportez-les vers WordPress en un clic.</p>
        </div>

        <!-- Barre de Contrôles Principal -->
        <div class="controls-bar glass-panel">
            <select id="select-phase" class="fancy-select" title="Filtrer par phase">
                <option value="all">Toutes les phases</option>
            </select>
            <select id="select-team" class="fancy-select" title="Choisir une équipe">
                <option value="all">Toutes les équipes</option>
            </select>
            <select id="select-day" class="fancy-select" title="Choisir une journée">
                <option value="">Sélectionnez une journée</option>
            </select>
            <button id="btn-generate" class="btn-primary">⚡ Générer</button>
            <button class="secondary" id="btn-capture">
                <i class="fas fa-camera"></i> Format Image
            </button>
            <button class="secondary" id="btn-copy-text">
                <i class="fas fa-copy"></i> Copier le texte
            </button>
            <button class="secondary" id="btn-copy-css" title="Copier le CSS pour WordPress">
                <i class="fas fa-code"></i> Copier CSS (WP)
            </button>
        </div>

        <!-- Indicateur de chargement -->
        <div class="loading" id="loader">
            <i class="fas fa-circle-notch"></i>
            <p style="margin-top: 1rem">Communication avec les serveurs FFTT...</p>
        </div>

        <!-- Grille de résultats -->
        <div class="results-grid" id="results-grid">
            <div id="initial-msg" style="grid-column: 1/-1; text-align: center; opacity: 0.5; padding: 4rem;">
                Chargement de l'application...
            </div>
        </div>

        <!-- Conteneur d'export (caché par défaut) -->
        <div id="export-container" style="position: absolute; left: -9999px; display: none;">
            <div id="export-panel">
                <!-- Le contenu sera généré dynamiquement -->
            </div>
        </div>

        <!-- Console de Debug -->
        <div id="debug-console" style="display: none; margin-top: 4rem; padding: 1.5rem; background: #000; border: 1px solid #333; border-radius: 8px; font-family: monospace; font-size: 0.8rem; color: #0f0; max-height: 200px; overflow-y: auto;">
            <div style="color: #666; margin-bottom: 0.5rem; text-transform: uppercase;">Flux de debug API</div>
            <div id="debug-log"></div>
        </div>
    </div>

    <!-- Modal de Configuration -->
    <div class="modal-overlay" id="modal-settings">
        <div class="modal">
            <h3>Configuration API FFTT</h3>
            <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 1.5rem;">
                Identifiants requis pour interroger les serveurs fédéraux.
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
                <label>Serial (Requis pour SWXXX)</label>
                <input type="text" id="input-serial" placeholder="N° de série">
            </div>
            <div class="form-group">
                <label>Numéro de Club (ex: 09690049)</label>
                <input type="text" id="input-club-id" placeholder="09690049">
            </div>
            <div class="form-group checkbox-group">
                <input type="checkbox" id="input-show-debug">
                <label for="input-show-debug">Afficher le panneau de debug</label>
            </div>
            <div class="modal-footer">
                <button class="btn-primary" id="save-settings">Enregistrer</button>
                <button class="secondary" id="close-settings">Fermer</button>
            </div>
        </div>
    </div>

    <script>
        /**
         * ÉTAT GLOBAL DE L'APPLICATION
         */
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

        /**
         * RÉFÉRENCES DOM
         */
        const elements = {
            modal: document.getElementById('modal-settings'),
            resultsGrid: document.getElementById('results-grid'),
            loader: document.getElementById('loader'),
            toast: document.getElementById('toast'),
            toastMsg: document.getElementById('toast-message'),
            debugLog: document.getElementById('debug-log'),
            debugConsole: document.getElementById('debug-console'),
            selectPhase: document.getElementById('select-phase'),
            selectTeam: document.getElementById('select-team'),
            selectDay: document.getElementById('select-day'),
            exportPanel: document.getElementById('export-panel'),
            exportContainer: document.getElementById('export-container')
        };

        /**
         * INITIALISATION
         */
        function initializeApp() {
            // Remplissage des champs de config
            document.getElementById('input-app-id').value = state.appId;
            document.getElementById('input-app-key').value = state.appKey;
            document.getElementById('input-serial').value = state.serial;
            document.getElementById('input-club-id').value = state.clubId;
            document.getElementById('input-show-debug').checked = state.showDebug;
            elements.debugConsole.style.display = state.showDebug ? 'block' : 'none';

            updateInitialMessage();
            bindEvents();

            if (state.appId && state.clubId) loadTeams();
        }

        /**
         * GESTION DES ÉVÉNEMENTS
         */
        function bindEvents() {
            // Modals
            document.querySelectorAll('.open-settings-btn').forEach(btn => {
                btn.onclick = () => elements.modal.style.display = 'flex';
            });
            document.getElementById('close-settings').onclick = () => elements.modal.style.display = 'none';

            // Actions
            document.querySelectorAll('.btn-refresh-btn').forEach(btn => {
                btn.onclick = loadTeams;
            });
            document.getElementById('save-settings').onclick = saveConfiguration;
            document.getElementById('btn-generate').onclick = generateResults;
            document.getElementById('btn-copy-text').onclick = copyToClipboardText;
            document.getElementById('btn-copy-css').onclick = copyToClipboardCSS;
            
            // Sélecteurs
            elements.selectPhase.onchange = () => updateTeamDropdown(elements.selectPhase.value);
            elements.selectTeam.onchange = onTeamSelectionChange;
        }

        /**
         * LOGIQUE CONFIGURATION
         */
        function saveConfiguration() {
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

            elements.debugConsole.style.display = state.showDebug ? 'block' : 'none';
            updateInitialMessage();
            elements.modal.style.display = 'none';
            showToast('Configuration enregistrée !');
            loadTeams();
        }

        /**
         * UTILITAIRES INTERFACE
         */
        function showToast(message, isError = false) {
            elements.toastMsg.innerText = message;
            const icon = elements.toast.querySelector('i');
            icon.className = isError ? 'fas fa-exclamation-circle' : 'fas fa-check-circle';
            icon.style.color = isError ? '#ef4444' : 'var(--win)';
            
            elements.toast.classList.add('show');
            setTimeout(() => elements.toast.classList.remove('show'), 3000);
        }

        function updateInitialMessage() {
            const msgEl = document.getElementById('initial-msg');
            if (msgEl) {
                msgEl.innerText = (state.appId && state.clubId) ? 
                    'Sélectionnez une journée ci-dessus pour générer les rapports.' : 
                    'Configurez vos accès API pour commencer.';
            }
        }

        function logDebug(msg, type = 'info') {
            const entry = document.createElement('div');
            entry.style.color = type === 'error' ? '#f55' : '#0f0';
            entry.innerText = `[${new Date().toLocaleTimeString()}] ${msg}`;
            elements.debugLog.appendChild(entry);
            elements.debugLog.scrollTop = elements.debugLog.scrollHeight;
        }

        /**
         * COMMUNICATION API
         */
        async function apiRequest(action, extraParams = {}) {
            const params = new URLSearchParams({
                appId: state.appId, appKey: state.appKey,
                serial: state.serial, clubId: state.clubId,
                action: action, ...extraParams
            });

            try {
                logDebug(`API Request: ${action}`);
                const response = await fetch(`api.php?${params.toString()}`);
                const data = await response.json();
                
                if (data.error) {
                    logDebug(data.message || data.error, 'error');
                    if (data.raw) logDebug(`RAW RESPONSE: ${data.raw.substring(0, 100)}...`);
                }
                return data;
            } catch (e) {
                logDebug(`Network error: ${e.message}`, 'error');
                return { error: 'Erreur réseau' };
            }
        }

        /**
         * CHARGEMENT DES DONNÉES ÉQUIPES
         */
        async function loadTeams() {
            if (!state.clubId) return showToast('Veuillez configurer votre Numéro de Club.', true);
            
            elements.loader.style.display = 'block';
            await apiRequest('getInitialisation'); // S'assurer que le serial est valide côté serveur
            
            const data = await apiRequest('getTeams');
            elements.loader.style.display = 'none';

            if (data && data.equipe) {
                state.teams = Array.isArray(data.equipe) ? data.equipe : [data.equipe];
                
                // Extraction des phases
                const phases = new Set();
                state.teams.forEach(t => {
                    const match = (t.libequipe || "").match(/Phase\s*\d+/i);
                    if (match) phases.add(match[0]);
                });

                // Remplissage Phase Selector
                elements.selectPhase.innerHTML = '<option value="all">Toutes les phases</option>';
                Array.from(phases).sort().forEach(p => {
                    const opt = new Option(p, p);
                    elements.selectPhase.appendChild(opt);
                });

                // Auto-selection dernière phase
                if (phases.size > 0) {
                    const last = Array.from(phases).sort().reverse()[0];
                    elements.selectPhase.value = last;
                    updateTeamDropdown(last);
                } else updateTeamDropdown("all");
            }
        }

        function updateTeamDropdown(phase) {
            elements.selectTeam.innerHTML = '<option value="all">Toutes les équipes</option>';
            const filtered = (phase === "all") ? state.teams : 
                state.teams.filter(t => (t.libequipe || "").includes(phase));

            filtered.forEach(t => {
                const opt = new Option(t.libequipe || 'Équipe', state.teams.indexOf(t));
                elements.selectTeam.appendChild(opt);
            });

            // Auto-load matchdays for first team
            if (filtered.length > 0) {
                elements.selectTeam.value = state.teams.indexOf(filtered[0]);
                loadMatchdays(filtered[0]);
            }
        }

        function onTeamSelectionChange() {
            const idx = elements.selectTeam.value;
            if (idx === "all") {
                // On prend la première équipe de la phase actuelle
                const firstOpt = elements.selectTeam.options[1];
                if (firstOpt) loadMatchdays(state.teams[firstOpt.value]);
            } else {
                loadMatchdays(state.teams[idx]);
            }
        }

        /**
         * CHARGEMENT DES JOURNÉES
         */
        async function loadMatchdays(team) {
            let divisionLink = team.liendivision || "";
            const linkParams = new URLSearchParams(divisionLink.split('?')[1] || "");
            const data = await apiRequest('getMatches', { 
                divisionId: linkParams.get('D1') || '', 
                pouleId: linkParams.get('cx_poule') || '' 
            });

            elements.selectDay.innerHTML = '<option value="">Choisir une journée</option>';
            if (data && data.tour) {
                const rounds = Array.isArray(data.tour) ? data.tour : [data.tour];
                const played = rounds.filter(r => (r.scorea || "").trim() !== "" || (r.scoreb || "").trim() !== "");
                
                state.matchdays = played;
                played.forEach((r, idx) => {
                    const date = r.dateprevue || r.datereelle || '';
                    const label = (r.libelle || `Tour ${idx+1}`) + (date ? ` (${date})` : '');
                    elements.selectDay.appendChild(new Option(label, date || r.libelle));
                });

                if (played.length > 0) {
                    const last = played[played.length - 1];
                    elements.selectDay.value = last.dateprevue || last.datereelle || last.libelle;
                }
            }
        }

        /**
         * GÉNÉRATION DES RÉSULTATS
         */
        async function generateResults() {
            const day = elements.selectDay.value;
            if (!day) return showToast('Sélectionnez une journée.', true);

            elements.loader.style.display = 'block';
            elements.resultsGrid.innerHTML = '';
            state.results = [];

            const teamIdx = elements.selectTeam.value;
            const teamsToScan = (teamIdx === "all") ? 
                Array.from(elements.selectTeam.options).slice(1).map(o => state.teams[o.value]) : 
                [state.teams[teamIdx]];

            const workers = teamsToScan.map(async (t) => {
                const linkParams = new URLSearchParams((t.liendivision || "").split('?')[1] || "");
                const data = await apiRequest('getMatches', { 
                    divisionId: linkParams.get('D1'), 
                    pouleId: linkParams.get('cx_poule') 
                });

                if (data && data.tour) {
                    const match = (Array.isArray(data.tour) ? data.tour : [data.tour]).find(r => {
                        const rDay = r.dateprevue || r.datereelle || r.libelle;
                        return rDay === day && (r.equa.includes(t.libequipe) || r.equb.includes(t.libequipe));
                    });

                    if (match) {
                        const isHome = match.equa.includes(t.libequipe);
                        state.results.push({
                            teamName: t.libequipe,
                            category: t.libdivision || "Championnat",
                            opponent: isHome ? match.equb : match.equa,
                            scoreA: parseInt(match.scorea) || 0,
                            scoreB: parseInt(match.scoreb) || 0,
                            isHome,
                            date: match.dateprevue || match.datereelle || 'N/A',
                            detailLink: match.lien,
                            divisionId: linkParams.get('D1'),
                            pouleId: linkParams.get('cx_poule')
                        });
                    }
                }
            });

            await Promise.all(workers);
            elements.loader.style.display = 'none';
            renderResultsGrid();
        }

        function renderResultsGrid() {
            if (state.results.length === 0) {
                elements.resultsGrid.innerHTML = '<div class="empty-msg">Aucun résultat trouvé.</div>';
                return;
            }

            elements.resultsGrid.innerHTML = state.results.map((res, i) => {
                const myScore = res.isHome ? res.scoreA : res.scoreB;
                const opScore = res.isHome ? res.scoreB : res.scoreA;
                const status = (myScore > opScore) ? 'win' : (myScore < opScore ? 'loss' : 'draw');
                const label = (myScore === 0 && opScore === 0) ? 'À VENIR' : (status === 'win' ? 'VICTOIRE' : (status === 'loss' ? 'DÉFAITE' : 'NUL'));

                return `
                <div class="result-card ${status}">
                    <div class="card-header">
                        <span class="category">${res.category}</span>
                        <span class="status-badge status-${status}">${label}</span>
                    </div>
                    <div class="team-name">${res.teamName}</div>
                    <div class="match-info">
                        <div class="side">${res.isHome ? res.teamName : res.opponent}</div>
                        <div class="score-box"><div class="score ${status}">${res.scoreA} - ${res.scoreB}</div></div>
                        <div class="side">${res.isHome ? res.opponent : res.teamName}</div>
                    </div>
                    <div class="card-footer">
                        <span><i class="far fa-calendar-alt"></i> ${res.date}</span>
                        <button class="secondary" onclick="fetchMatchDetail(${i})">Détails</button>
                    </div>
                </div>`;
            }).join('');
        }

        /**
         * DÉTAILS ET EXPORT
         */
        async function fetchMatchDetail(index) {
            const res = state.results[index];
            elements.loader.style.display = 'block';
            
            const params = new URLSearchParams(res.detailLink.split('?')[1] || "");
            const data = await apiRequest('getMatchDetails', { 
                is_retour: params.get('is_retour') || '0', 
                renc_id: params.get('renc_id') || params.get('res_id')
            });

            elements.loader.style.display = 'none';
            if (data && data.resultat) renderExportPanel(res, data);
            else showToast('Impossible de charger les détails.', true);
        }

        function renderExportPanel(res, data) {
            const detail = data.resultat;
            const players = Array.isArray(data.joueur) ? data.joueur : [data.joueur].filter(Boolean);
            const matches = Array.isArray(data.partie) ? data.partie : [data.partie].filter(Boolean);

            // Calculs et Parsing...
            const parsed = parseMatchData(res, players, matches);

            // Construction HTML de l'export
            elements.exportPanel.innerHTML = `
                <div class="export-actions">
                    <button onclick="copyHTMLForWordPress()" class="btn-primary">📄 Copier HTML (WP)</button>
                    <button onclick="elements.exportContainer.style.display='none'" class="secondary">Fermer</button>
                </div>
                <div class="export-header">
                    <div class="export-title">${detail.equa} – ${detail.equb}</div>
                    <div class="export-subtitle">${res.category}</div>
                    ${generateScoreboardHTML(detail)}
                </div>
                ${generateCompositionTable(detail.equa, detail.equb, parsed.teamA, parsed.teamB)}
                ${generatePartiesTable(detail.equa, detail.equb, parsed.matches, res.isHome)}
                <div class="match-sets-sum">
                    <span>Points : ${parsed.totals.pointsA} / ${parsed.totals.pointsB}</span>
                    <span>Manches : ${parsed.totals.setsA} - ${parsed.totals.setsB}</span>
                </div>
                ${generateIndividualStats(parsed.stats, parsed.clubRatings)}
                <div class="summary-footer">
                    Bilan : ${detail.scorea > detail.scoreb ? detail.equa : (detail.scoreb > detail.scorea ? detail.equb : 'Match nul')} l'emporte.
                </div>
            `;

            elements.exportContainer.style.cssText = "display: block; position: absolute; left: 50%; transform: translateX(-50%); top: 100px; z-index: 5000;";
            window.scrollTo(0, document.body.scrollHeight);
        }

        /**
         * SOUS-FONCTIONS DE PARSING (Logique métier extraite)
         */
        function parseMatchData(res, rawPlayers, rawMatches) {
            const teamA = [], teamB = [];
            const clubRatings = {};
            
            rawPlayers.forEach(j => {
                const parse = (n, c) => ({ 
                    nom: (n||'').replace(/\s*[MF]\s*$/, '').trim(), 
                    pts: parseInt((c||'').match(/\d+/)) || 0 
                });
                const a = parse(j.xja, j.xca);
                const b = parse(j.xjb, j.xcb);
                if (a.nom) teamA.push(a);
                if (b.nom) teamB.push(b);
            });

            // On stocke les classements de NOS joueurs pour le calcul des points
            const ourList = res.isHome ? teamA : teamB;
            ourList.forEach(p => clubRatings[p.nom] = p.pts);

            let setsA = 0, setsB = 0, ptsA = 0, ptsB = 0;
            const stats = {};

            const processedMatches = rawMatches.map(m => {
                const s = [m.ms1, m.ms2, m.ms3, m.ms4, m.ms5].map(v => parseInt(v) || 0);
                let swA = 0, swB = 0;
                
                s.forEach(val => {
                    if (val === 0) return;
                    if (val > 0) { swA++; ptsA += (val<10?11:val+2); ptsB += val; }
                    else { swB++; ptsB += (Math.abs(val)<10?11:Math.abs(val)+2); ptsA += Math.abs(val); }
                });

                setsA += swA; setsB += swB;
                
                // Calcul +/- individuel (FFTT 2024 simplifié)
                const ptA = clubRatings[m.ja] ? calculateGain(clubRatings[m.ja], clubRatings[m.jb], swA > swB) : 0;
                const ptB = clubRatings[m.jb] ? calculateGain(clubRatings[m.jb], clubRatings[m.ja], swB > swA) : 0;

                // Accumulation stats
                [ {n: m.ja, w: swA>swB, p: ptA}, {n: m.jb, w: swB>swA, p: ptB} ].forEach(obj => {
                    if (clubRatings[obj.n]) {
                        if (!stats[obj.n]) stats[obj.n] = { v: 0, d: 0, pts: 0 };
                        if (obj.w) stats[obj.n].v++; else stats[obj.n].d++;
                        stats[obj.n].pts += obj.p;
                    }
                });

                return { ...m, swA, swB, gain: res.isHome ? ptA : ptB, sets: s };
            });

            return { teamA, teamB, matches: processedMatches, stats, clubRatings, totals: { setsA, setsB, pointsA: ptsA, pointsB: ptsB } };
        }

        function calculateGain(rA, rB, won) {
            if (!rA || !rB) return 0;
            const d = rA - rB;
            if (won) {
                if (d >= 500) return 0.5; if (d >= 200) return 3; if (d >= 0) return 5;
                if (d >= -100) return 8; if (d >= -300) return 22; return 40;
            } else {
                if (d >= 400) return -40; if (d >= 200) return -17; if (d >= 0) return -6;
                return -2;
            }
        }

        /**
         * GÉNÉRATEURS HTML D'EXPORT
         */
        function generateScoreboardHTML(d) {
            const outA = d.scorea > d.scoreb ? 3 : (d.scorea < d.scoreb ? 1 : 2);
            const outB = d.scoreb > d.scorea ? 3 : (d.scoreb < d.scorea ? 1 : 2);
            return `
            <div class="premium-scoreboard">
                <div class="score-digit-box digit-red">${outA}</div>
                <div class="score-digit-box digit-black">${d.scorea}</div>
                <div class="score-divider"></div>
                <div class="score-digit-box digit-black">${d.scoreb}</div>
                <div class="score-digit-box digit-red">${outB}</div>
            </div>`;
        }

        function generateCompositionTable(eqA, eqB, tA, tB) {
            const rows = [];
            for (let i = 0; i < Math.max(tA.length, tB.length); i++) {
                rows.push(`<tr><td>${tA[i]?.nom || ''} (${tA[i]?.pts || ''})</td><td>${tB[i]?.nom || ''} (${tB[i]?.pts || ''})</td></tr>`);
            }
            return `<div class="section-title">Compositions</div><table class="premium-table"><thead><tr><th>${eqA}</th><th>${eqB}</th></tr></thead><tbody>${rows.join('')}</tbody></table>`;
        }

        function generatePartiesTable(eqA, eqB, matches, isHome) {
            const rows = matches.map(m => `
                <tr>
                    <td style="${m.swA > m.swB ? 'font-weight:700' : ''}">${m.ja}</td>
                    <td style="${m.swB > m.swA ? 'font-weight:700' : ''}">${m.jb}</td>
                    ${m.sets.map(v => `<td class="col-set">${v || ''}</td>`).join('')}
                    <td class="col-score"><span class="${(isHome ? m.swA > m.swB : m.swB > m.swA) ? 'badge-win' : 'badge-loss'}">${m.swA}-${m.swB}</span></td>
                </tr>`).join('');
            return `<div class="section-title">Détails des parties</div><table class="premium-table"><thead><tr><th>${eqA}</th><th>${eqB}</th><th colspan="5">Manches</th><th>Score</th></tr></thead><tbody>${rows.join('')}</tbody></table>`;
        }

        function generateIndividualStats(stats, ratings) {
            const rows = Object.keys(stats).map(name => {
                const s = stats[name];
                return `<tr><td>${name}</td><td>${s.v}</td><td>${s.d}</td><td style="color:${s.pts>=0?'#10b981':'#ef4444'}">${s.pts>=0?'+':''}${s.pts.toFixed(1)}</td></tr>`;
            }).join('');
            return `<div class="section-title">Bilan Individuel</div><table class="premium-table"><thead><tr><th>Joueur</th><th>V</th><th>D</th><th>+/-</th></tr></thead><tbody>${rows.join('')}</tbody></table>`;
        }

        /**
         * CLIPBOARD
         */
        function copyToClipboardText() {
            if (state.results.length === 0) return showToast('Générez les résultats.', true);
            const text = state.results.map(r => `${r.scoreA > r.scoreB ? '✅' : '❌'} ${r.teamName} [${res.scoreA}-${res.scoreB}] ${r.opponent}`).join('\n');
            navigator.clipboard.writeText(text).then(() => showToast('Texte copié !'));
        }

        function copyToClipboardCSS() {
            navigator.clipboard.writeText(getWordPressCSS()).then(() => showToast('CSS copié !'));
        }

        function copyHTMLForWordPress() {
            const html = document.getElementById('export-panel').cloneNode(true);
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
.premium-table th { background:#f8fafc; padding:12px; text-align:left; border-bottom:1px solid #e2e8f0; }
.premium-table td { padding:10px; border-bottom:1px solid #f1f5f9; }
.badge-win { background:#dcfce7; color:#166534; padding:4px 10px; border-radius:99px; font-weight:700; }
.badge-loss { background:#fee2e2; color:#991b1b; padding:4px 10px; border-radius:99px; font-weight:700; }`;
        }

        // Démarrage
        initializeApp();
    </script>
</body>
</html>