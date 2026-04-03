<?php
$xml = file_get_contents('logs_teams.xml');
$pos = strpos($xml, '<liendivision');
if ($pos !== false) {
    echo "Found liendivision tag!\n";
    echo substr($xml, $pos, 100);
} else {
    echo "Tag <liendivision NOT FOUND in raw XML!\n";
    $pos2 = strpos($xml, '<liendiv');
    if ($pos2 !== false) echo "Found <liendiv instead: " . substr($xml, $pos2, 100);
    else echo "Also no <liendiv found.\n";
}
