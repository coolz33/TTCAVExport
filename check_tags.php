<?php
$xml = file_get_contents('logs_match.xml');
if (stripos($xml, '<licence>') !== false) {
    echo "LICENCE_FOUND\n";
} else {
    echo "LICENCE_NOT_FOUND\n";
    // Trouvons les tags disponibles dans <joueur>
    if (preg_match('/<joueur>(.*?)<\/joueur>/s', $xml, $m)) {
        echo "Tags in <joueur>: " . htmlspecialchars($m[1]) . "\n";
    }
}
