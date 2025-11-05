
<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit(json_encode(['error' => 'Method not allowed']));
}

$data = json_decode(file_get_contents('php://input'), true);

if (!$data || !is_array($data)) {
    http_response_code(400);
    exit(json_encode(['error' => 'Invalid data']));
}

$logFile = __DIR__ . '/../logs/tracking_' . date('Y-m-d') . '.json';
$logDir = dirname($logFile);

if (!is_dir($logDir)) {
    mkdir($logDir, 0755, true);
}

$existingData = [];
if (file_exists($logFile)) {
    $existingData = json_decode(file_get_contents($logFile), true) ?: [];
}

$existingData[] = [
    'timestamp' => date('c'),
    'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
    'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? 'unknown',
    'data' => $data
];

file_put_contents($logFile, json_encode($existingData, JSON_PRETTY_PRINT));

echo json_encode(['success' => true]);
