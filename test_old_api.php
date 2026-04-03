<?php
$x = file_get_contents('http://www.fftt.com/mobile/xml/xml_equipe.php?numclu=01690023');
echo substr($x, 0, 800);
