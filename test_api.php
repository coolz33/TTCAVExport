<?php
$xml = simplexml_load_string(file_get_contents("http://www.fftt.com/mobile/pxml/xml_histo_classement.php?serie=&id=&numlic=6943806"));
print_r($xml);
