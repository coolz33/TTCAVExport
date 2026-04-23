<?php
/**
 * Script de rafraîchissement automatique du cache
 * À exécuter via une tâche CRON (ex: tous les jours à 00:00)
 */

// On passe en mode CLI ou forcé
set_time_limit(0);
header('Content-Type: text/plain; charset=utf-8');

echo "--- DÉBUT DU RAFRAÎCHISSEMENT DU CACHE (" . date('Y-m-d H:i:s') . ") ---\n";

// Charger l'environnement
require_once __DIR__ . '/env_loader.php';

// Simuler les paramètres pour api.php
$_GET['refresh'] = '1'; // On force le rafraîchissement (bypass cache)

function callApi($action, $params = []) {
    $_GET = array_merge($_GET, $params);
    $_GET['action'] = $action;
    
    ob_start();
    include __DIR__ . '/api.php';
    $output = ob_get_clean();
    
    return json_decode($output, true);
}

// 1. Récupérer la liste des joueurs du club
echo "Étape 1 : Récupération du roster club...\n";
$roster = callApi('findPlayer', ['club' => $_ENV['FFTT_CLUB_ID']]);

if (!$roster || !isset($roster['joueur'])) {
    die("ERREUR : Impossible de récupérer la liste des joueurs.\n");
}

$players = is_array($roster['joueur']) && isset($roster['joueur'][0]) ? $roster['joueur'] : [$roster['joueur']];
echo count($players) . " joueurs trouvés.\n";

// 2. Mettre à jour le détail de chaque joueur (pour les points mensuels précis)
echo "Étape 2 : Mise à jour des détails individuels...\n";
foreach ($players as $index => $p) {
    $licence = $p['licence'] ?? '';
    $nom = $p['nom'] ?? '';
    $prenom = $p['prenom'] ?? '';
    
    if ($licence) {
        echo "[" . ($index + 1) . "/" . count($players) . "] Sync: $nom $prenom ($licence)... ";
        $detail = callApi('getPlayerDetail', ['licence' => $licence, 'refresh' => '1']);
        
        if ($detail && !isset($detail['error'])) {
            echo "OK\n";
        } else {
            echo "ERREUR\n";
        }
        
        // Petite pause pour ne pas saturer l'API FFTT
        usleep(200000); // 0.2s
    }
}

echo "--- RAFRAÎCHISSEMENT TERMINÉ (" . date('Y-m-d H:i:s') . ") ---\n";
?>
