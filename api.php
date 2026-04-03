<?php
/**
 * FFTT API Proxy
 * Handles authentication and requests to the FFTT official API.
 */

header('Content-Type: application/json');

// Get credentials from request (for the demo/generator)
$appId = $_GET['appId'] ?? '';
$appKey = $_GET['appKey'] ?? '';
$serial = $_GET['serial'] ?? '';
$clubId = $_GET['clubId'] ?? '';
$action = $_GET['action'] ?? '';


// No longer using cache for players


if (!$appId || !$appKey || !$action) {
    echo json_encode(['error' => 'Missing parameters']);
    exit;
}

$baseUrl = "https://www.fftt.com/mobile/pxml/";

// Signature calculation (v17-char based on user's class)
$tm = date('YmdHis') . substr(microtime(), 2, 3);
$tmc = hash_hmac('sha1', $tm, hash('md5', $appKey));

// If no serial is provided by user, use a 15-char random string (like Service::generateSerial)
if (!$serial) {
    $serial = '';
    for($i=0; $i<15; $i++) {
        $serial .= chr(mt_rand(65, 90)); 
    }
}

function fetchData($url, $params)
{
    $queryString = http_build_query($params);
    $fullUrl = $url . '?' . $queryString;

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $fullUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false); // For development
    
    // Identical headers as in the code you provided
    curl_setopt($ch, CURLOPT_HTTPHEADER, array(
        "User-agent: Mozilla/4.0 (compatible; MSIE 6.0; Win32)",
        "Accept-Encoding: gzip",
        "Connection: Keep-Alive",
    ));
    
    // Automatically handles decompression if Gzip is used
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
        // The API requires 'type' to return championship division links (liendivision)
        // 'A' is used for Mixed/Adult teams (Masculines et Féminines)
        $params['type'] = $_GET['type'] ?? 'A'; 
        $xml = fetchData($baseUrl . 'xml_equipe.php', $params);
        file_put_contents(__DIR__ . '/logs_teams.xml', $xml);
        break;

    case 'getResults':
        $teamId = $_GET['teamId'] ?? '';
        $params['numequ'] = $teamId;
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
        file_put_contents(__DIR__ . '/logs_match.xml', $xml);
        break;

    case 'getInitialisation':
        $xml = fetchData($baseUrl . 'xml_initialisation.php', $params);
        break;

    case 'getClassement':
        $params['D1'] = $_GET['divisionId'] ?? '';
        $params['cx_poule'] = $_GET['pouleId'] ?? '';
        $xml = fetchData($baseUrl . 'xml_poule_classement.php', $params);
        break;




    default:
        echo json_encode(['error' => 'Unknown action']);
        exit;
}

// Convert XML to JSON for easier frontend handling
if ($xml) {
    libxml_use_internal_errors(true);
    $xmlObj = simplexml_load_string($xml, 'SimpleXMLElement', LIBXML_NOCDATA);
    if ($xmlObj === false) {
        $errors = libxml_get_errors();
        echo json_encode(['error' => 'Erreur de lecture XML', 'details' => $errors, 'raw' => substr($xml, 0, 500)]);
    } else {
        // FFTT can return <erreur> tags
        if (isset($xmlObj->message) || isset($xmlObj->erreur)) {
            echo json_encode(['error' => 'FFTT API Error', 'message' => (string) ($xmlObj->message ?? $xmlObj->erreur)]);
        } else {
            echo json_encode($xmlObj);
        }
    }
} else {
    echo json_encode(['error' => 'Echec de récupération des données (CURL error)']);
}
