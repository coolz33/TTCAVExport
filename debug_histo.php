<?php
$licence = '6943806'; // Licence from previous tests or common one
$url = "http://www.fftt.com/mobile/pxml/xml_histo_classement.php?serie=&id=&numlic=" . $licence;
$content = file_get_contents($url);
echo "URL: " . $url . "\n";
echo "Content length: " . strlen($content) . "\n";
echo $content;
?>
