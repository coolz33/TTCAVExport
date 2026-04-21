<?php
/**
 * FFTT API Proxy
 * Handles authentication and requests to the FFTT official API.
 */

// Désactiver l'affichage des erreurs qui pourraient corrompre le JSON
error_reporting(0);
ini_set('display_errors', 0);

// Démarrer la mise en mémoire tampon pour éviter toute sortie accidentelle (espaces, warnings)
ob_start();

header('Content-Type: application/json; charset=utf-8');

// Get credentials from request
$appId = $_GET['appId'] ?? '';
$appKey = $_GET['appKey'] ?? '';
$serial = $_GET['serial'] ?? '';
$clubId = $_GET['clubId'] ?? '';
$action = $_GET['action'] ?? '';

// Configuration du cache
$cacheDir = __DIR__ . '/cache';
if (!is_dir($cacheDir)) {
    mkdir($cacheDir, 0777, true);
}
$cacheDuration = 86400; // 24 heures
$bypassCache = (isset($_GET['refresh']) && $_GET['refresh'] == '1') 
               || ($action === 'getPlayerDetail') 
               || ($action === 'getMatchPlayers')
               || ($action === 'clearCache')
               || ($action === 'saveCustomPoints')
               || ($action === 'getCustomPoints');

// Création d'un identifiant unique pour la requête (basé sur tous les paramètres sauf refresh)
$paramsForCache = $_GET;
unset($paramsForCache['refresh']);
$cacheKey = md5(serialize($paramsForCache));
$cacheFile = $cacheDir . '/' . $cacheKey . '.json';

// Vérifier si le cache existe et est valide
if (!$bypassCache && file_exists($cacheFile) && (time() - filemtime($cacheFile) < $cacheDuration)) {
    $content = file_get_contents($cacheFile);
    if ($content && strpos($content, '{') === 0) {
        ob_clean();
        header('X-Cache: HIT');
        header('X-Cache-Action: ' . $action);
        echo $content;
        exit;
    }
}

if (!$action || ((!$appId || !$appKey) && !in_array($action, ['saveCustomPoints', 'getCustomPoints']))) {
    ob_clean();
    echo json_encode(['error' => 'Missing parameters']);
    exit;
}

$baseUrl = 'http://www.fftt.com/mobile/pxml/';

// Signature calculation
$tm = date('YmdHis') . substr(microtime(), 2, 3);
$tmc = hash_hmac('sha1', $tm, hash('md5', $appKey));

if (!$serial) {
    $serial = '';
    for($i=0; $i<15; $i++) { $serial .= chr(mt_rand(65, 90)); }
}

function fetchData($url, $params)
{
    $queryString = http_build_query($params);
    $fullUrl = $url . '?' . $queryString;

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $fullUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_HTTPHEADER, array(
        "User-agent: Mozilla/4.0 (compatible; MSIE 6.0; Win32)",
        "Accept-Encoding: gzip",
        "Connection: Keep-Alive",
    ));
    curl_setopt($ch, CURLOPT_ENCODING, ""); 

    $response = curl_exec($ch);
    curl_close($ch);

    return $response;
}

$params = [
    'id' => $appId,
    'serie' => substr($serial ?: $appId, 0, 15),
    'tm' => $tm,
    'tmc' => $tmc
];

switch ($action) {
    case 'getTeams':
        $params['numclu'] = $clubId;
        $params['type'] = $_GET['type'] ?? 'A'; 
        $xml = fetchData($baseUrl . 'xml_equipe.php', $params);
        break;
    case 'getResults':
        $params['numequ'] = $_GET['teamId'] ?? '';
        $xml = fetchData($baseUrl . 'xml_result_equipe.php', $params);
        break;
    case 'getMatches':
        $params['D1'] = $_GET['divisionId'] ?? '';
        $params['cx_poule'] = $_GET['pouleId'] ?? '';
        $params['auto'] = 1;
        $xml = fetchData($baseUrl . 'xml_result_equ.php', $params);
        break;
    case 'getMatchDetails':
        $params['is_retour'] = $_GET['is_retour'] ?? '0';
        $params['renc_id'] = $_GET['renc_id'] ?? '';
        $xml = fetchData($baseUrl . 'xml_chp_renc.php', $params);
        break;
    case 'getInitialisation':
        $xml = fetchData($baseUrl . 'xml_initialisation.php', $params);
        break;
    case 'getClassement':
        $params['D1'] = $_GET['divisionId'] ?? '';
        $params['cx_poule'] = $_GET['pouleId'] ?? '';
        $params['action'] = 'classement';
        $params['auto'] = 1;
        $xml = fetchData($baseUrl . 'xml_result_equ.php', $params);
        break;
    case 'getPlayers':
        $params['club'] = $_GET['clubId'] ?? '';
        $xml = fetchData($baseUrl . 'xml_liste_joueur.php', $params);
        break;
    case 'getPlayerHistory':
        $params['numlic'] = $_GET['licence'] ?? '';
        $xml = fetchData($baseUrl . 'xml_histo_classement.php', $params);
        break;
    case 'getPlayerMatches':
        $licence = $_GET['licence'] ?? '';
        $params['numlic'] = $licence;
        // On utilise mysql.php qui contient souvent plus de détails sur les sets
        $xml = fetchData($baseUrl . 'xml_partie_mysql.php', $params);
        
        $xmlObj = @simplexml_load_string($xml);
        $matches = [];
        if ($xmlObj) {
            $list = $xmlObj->partie ?? $xmlObj->Partie ?? null;
            if ($list) {
                foreach ($list as $p) {
                    $m = [];
                    foreach ($p as $key => $val) {
                        $m[(string)$key] = (string)$val;
                    }
                    $matches[] = $m;
                }
            }
        }
        
        // --- SAUVEGARDE FORCEE EN JSON ---
        if ($licence) {
            $dataDir = __DIR__ . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'players';
            if (!is_dir($dataDir)) @mkdir($dataDir, 0777, true);
            
            $savePath = $dataDir . DIRECTORY_SEPARATOR . $licence . '.json';
            $success = @file_put_contents($savePath, json_encode([
                'updated' => date('Y-m-d H:i:s'),
                'licence' => $licence,
                'matches' => $matches
            ], JSON_UNESCAPED_UNICODE));
            
            // Debug log en cas d'échec
            if (!$success) {
                file_put_contents(__DIR__ . '/debug_api.log', "[" . date('Y-m-d H:i:s') . "] Failed to save $savePath. Dir exists: " . (is_dir($dataDir)?'Y':'N') . " writable: " . (is_writable($dataDir)?'Y':'N') . "\n", FILE_APPEND);
            }
        }

        ob_clean();
        echo json_encode([
            'licence' => $licence, 
            'matches' => $matches, 
            'count' => count($matches),
            'debugUrl' => $baseUrl . 'xml_partie.php?' . http_build_query($params),
            'rawXmlHead' => substr((string)$xml, 0, 500)
        ]);
        exit;
        break;

    case 'saveSummary':
        $matchId = $_GET['matchId'] ?? '';
        $text = $_POST['text'] ?? '';
        if ($matchId && $text) {
            $sumDir = $cacheDir . '/summaries';
            if (!is_dir($sumDir)) mkdir($sumDir, 0777, true);
            file_put_contents($sumDir . '/' . md5($matchId) . '.json', json_encode(['text' => $text]));
            ob_clean();
            echo json_encode(['success' => true]);
            exit;
        }
        ob_clean();
        echo json_encode(['error' => 'Missing matchId or text']);
        exit;

    case 'getSummary':
        $matchId = $_GET['matchId'] ?? '';
        $sumFile = $cacheDir . '/summaries/' . md5($matchId) . '.json';
        ob_clean();
        if (file_exists($sumFile)) {
            echo file_get_contents($sumFile);
        } else {
            echo json_encode(['error' => 'Not found']);
        }
        exit;
    case 'clearCache':
        $type = $_GET['type'] ?? 'all';
        $sumDir = $cacheDir . '/summaries';
        ob_clean();
        if ($type === 'all' || $type === 'results') {
            $files = glob($cacheDir . '/*.json');
            foreach ($files as $file) { if (is_file($file)) unlink($file); }
        }
        if ($type === 'all' || $type === 'summaries') {
            if (is_dir($sumDir)) {
                $files = glob($sumDir . '/*.json');
                foreach ($files as $file) { if (is_file($file)) unlink($file); }
            }
        }
        echo json_encode(['success' => true]);
        exit;
    case 'getPlayerDetail':
        $params['licence'] = $_GET['licence'] ?? '';
        $xml = fetchData($baseUrl . 'xml_joueur.php', $params);
        break;
    case 'getMatchPlayers':
        $params['renc_id'] = $_GET['renc_id'] ?? '';
        $xml = fetchData($baseUrl . 'xml_joueur_renc.php', $params);
        break;
    case 'saveCustomPoints':
        $jsonStr = $_POST['data'] ?? '';
        if ($jsonStr) {
            $sumDir = $cacheDir . '/custom_points';
            if (!is_dir($sumDir)) mkdir($sumDir, 0777, true);
            file_put_contents($sumDir . '/points.json', $jsonStr);
            ob_clean();
            echo json_encode(['success' => true]);
            exit;
        }
        ob_clean();
        echo json_encode(['error' => 'Invalid data']);
        exit;
    case 'getCustomPoints':
        $file = $cacheDir . '/custom_points/points.json';
        ob_clean();
        if (file_exists($file)) {
            echo file_get_contents($file);
        } else {
            echo json_encode([]);
        }
        exit;
    default:
        ob_clean();
        echo json_encode(['error' => 'Unknown action']);
        exit;
}

$output = null;
if ($xml) {
    libxml_use_internal_errors(true);
    // On s'assure que l'XML est traité en UTF-8 si l'entête est absente, 
    // mais SimpleXML gère généralement bien l'ISO-8859-1 s'il est déclaré.
    $xmlObj = simplexml_load_string($xml, 'SimpleXMLElement', LIBXML_NOCDATA);
    if ($xmlObj === false) {
        $output = ['error' => 'Erreur de lecture XML', 'raw' => substr($xml, 0, 200)];
    } else {
        if (isset($xmlObj->message) || isset($xmlObj->erreur)) {
            $output = ['error' => 'FFTT API Error', 'message' => (string) ($xmlObj->message ?? $xmlObj->erreur)];
        } else {
            $output = $xmlObj;
        }
    }
} else {
    $output = ['error' => 'Echec de récupération des données'];
}

$jsonOutput = json_encode($output, JSON_UNESCAPED_UNICODE);

// Si erreur de JSON (caractères invalides), on nettoie
if (json_last_error() !== JSON_ERROR_NONE) {
    $jsonOutput = json_encode(['error' => 'JSON Encoding Error', 'details' => json_last_error_msg()]);
}

if (!isset($output['error']) && $jsonOutput) {
    file_put_contents($cacheFile, $jsonOutput);
}

ob_clean();
header('X-Cache: MISS');
header('X-Cache-Key: ' . $cacheKey);
header('X-Cache-Write: ' . (is_writable($cacheDir) ? 'YES' : 'NO'));
echo $jsonOutput;
ob_end_flush();
