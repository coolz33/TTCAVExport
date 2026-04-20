<?php
// Script de test de connexion FFTT pour les matchs
require_once 'api.php'; // On peut essayer d'inclure mais api.php fait des sorties directes. 
// Copions la logique de signature pour tester proprement.

$appId = $_GET['appId'] ?? 'TEST';
$appKey = $_GET['appKey'] ?? '';
$licence = $_GET['licence'] ?? '6943806';

$tm = date('YmdHis') . substr(microtime(), 2, 3);
$tmc = hash_hmac('sha1', $tm, hash('md5', $appKey));
$serial = 'ABCDEFGHIJKLMNO';

$params = [
    'id' => $appId,
    'serie' => $serial,
    'tm' => $tm,
    'tmc' => $tmc,
    'numlic' => $licence
];

$url = "https://www.fftt.com/mobile/pxml/xml_partie_mysql.php?" . http_build_query($params);

echo "Testing URL: " . $url . "\n\n";

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($ch, CURLOPT_HTTPHEADER, array("User-agent: Mozilla/4.0 (compatible; MSIE 6.0; Win32)"));
$response = curl_exec($ch);
$info = curl_getinfo($ch);
curl_close($ch);

echo "HTTP Status: " . $info['http_code'] . "\n";
echo "Response Length: " . strlen($response) . "\n";
echo "Response Start: " . substr($response, 0, 200) . "\n";
?>
