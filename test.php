<?php
function test() {
    $x = file_get_contents('http://localhost:8000/api.php?action=getPlayerLicence&nom=LEVEQUE&prenom=Geoffrey&appId=AS000&appKey=XXX');
    var_dump($x);
}
test();
