<?php
$ch=curl_init('http://localhost:8000/api.php?action=getMatches&divisionId=229494&pouleId=&appId=TEST&appKey=TEST');
curl_setopt($ch,CURLOPT_RETURNTRANSFER,true);
echo curl_exec($ch);
