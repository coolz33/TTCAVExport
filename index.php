<?php
/**
 * Application : TTCAV Exports
 * Description : Générateur de résultat de championnat par équipe pour le club de tennis de table de villefranche sur saone.
 * Auteur : coolz
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
    <link
        href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&family=Playfair+Display:wght@700&family=Lora:ital,wght@0,400;0,700;1,400&display=swap"
        rel="stylesheet">
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
            <button class="secondary" id="btn-copy-all" title="Enchaîner tous les résultats détaillés dans WordPress">
                <i class="fas fa-layer-group"></i> Copier Résultats (WP)
            </button>
            <button class="secondary" id="btn-copy-css" title="Copier le CSS pour WordPress">
                <i class="fas fa-code"></i> Copier CSS (WP)
            </button>
        </div>

        <!-- Indicateur de chargement -->
        <div class="loading" id="loader">
            <i class="fas fa-circle-notch"></i>
            <p id="loader-text" style="margin-top: 1rem">Communication avec les serveurs FFTT...</p>
        </div>

        <!-- Grille de résultats -->
        <div class="results-grid" id="results-grid">
            <div id="initial-msg" style="grid-column: 1/-1; text-align: center; opacity: 0.5; padding: 4rem;">
                Chargement de l'application...
            </div>
        </div>

        <!-- Console de Debug -->
        <div id="debug-console"
            style="display: none; margin-top: 4rem; padding: 1.5rem; background: #000; border: 1px solid #333; border-radius: 8px; font-family: monospace; font-size: 0.8rem; color: #0f0; max-height: 200px; overflow-y: auto;">
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
            <hr style="border:0; border-top:1px solid var(--glass-border); margin: 1.5rem 0;">
            <h3 style="margin-bottom:0.5rem">Intelligence Artificielle (Groq)</h3>
            <p style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 1rem;">Utilisée pour générer des résumés de matchs percutants.</p>
            <div class="form-group">
                <label>Clé API Groq</label>
                <input type="password" id="input-groq-key" placeholder="gsk_...">
            </div>
            <div class="form-group">
                <label>Modèle IA</label>
                <select id="select-groq-model" class="fancy-select" style="min-width: 100%; border-radius: 8px;">
                    <option value="llama-3.3-70b-versatile">Llama 3.3 70B (Recommandé)</option>
                    <option value="llama-3.1-8b-instant">Llama 3.1 8B (Très Rapide)</option>
                    <option value="mixtral-8x7b-32768">Mixtral 8x7B</option>
                </select>
            </div>
            <hr style="border:0; border-top:1px solid var(--glass-border); margin: 1.5rem 0;">
            <div class="form-group">
                <label>Numéro de Club (ex: 09690049)</label>
                <input type="text" id="input-club-id" placeholder="09690049">
            </div>
            <div class="form-group checkbox-group">
                <input type="checkbox" id="input-show-debug">
                <label for="input-show-debug">Afficher le panneau de debug</label>
            </div>
            <hr style="border:0; border-top:1px solid var(--glass-border); margin: 1.5rem 0;">
            <div class="form-group">
                <label>Maintenance du Cache</label>
                <div style="display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.5rem; background: #f1f5f9; padding: 1rem; border-radius: 8px;">
                    <div class="checkbox-group" style="margin:0">
                        <input type="checkbox" id="clear-results-check" checked>
                        <label for="clear-results-check" style="font-weight: 500;">Vider le cache des matchs</label>
                    </div>
                    <div class="checkbox-group" style="margin:0">
                        <input type="checkbox" id="clear-summaries-check">
                        <label for="clear-summaries-check" style="font-weight: 500;">Réinitialiser les résumés IA</label>
                    </div>
                    <button class="secondary" id="btn-do-clear-cache" style="margin-top: 0.5rem; width: 100%; border: 1px solid #cbd5e1; font-weight: 700; color: #ef4444;">Nettoyer le cache sélectionné</button>
                </div>
            </div>

            <div class="modal-footer">
                <button class="btn-primary" id="save-settings">Enregistrer</button>
                <button class="secondary" id="close-settings">Fermer</button>
            </div>
        </div>
    </div>

    <!-- Conteneur d'export (Modal de détail) -->
    <div id="export-container" style="display: none;">
        <div id="export-panel">
            <!-- Le contenu sera généré dynamiquement -->
        </div>
    </div>

    <script src="script.js"></script>
</body>

</html>