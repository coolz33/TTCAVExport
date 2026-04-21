<?php
// Test script to fetch player data directly through api.php logic
$_GET['action'] = 'getPlayerDetail';
$_GET['licence'] = '6936302'; // Example licence, let's just pick one or maybe Ethan GILLE if we know his licence. Let's use a known one or just any valid licence.
require 'api.php';
