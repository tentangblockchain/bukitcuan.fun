
<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

// Rate limiting: max 100 requests per IP per hour
$rateLimit = 100;
$rateLimitWindow = 3600; // 1 hour
$ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$rateLimitFile = __DIR__ . '/../logs/rate_limit_' . md5($ip) . '.json';

if (file_exists($rateLimitFile)) {
    $rateLimitData = json_decode(file_get_contents($rateLimitFile), true);
    $requestCount = $rateLimitData['count'] ?? 0;
    $lastReset = $rateLimitData['last_reset'] ?? 0;
    
    if (time() - $lastReset > $rateLimitWindow) {
        $requestCount = 0;
        $lastReset = time();
    }
    
    if ($requestCount >= $rateLimit) {
        http_response_code(429);
        exit(json_encode(['error' => 'Rate limit exceeded']));
    }
    
    $requestCount++;
} else {
    $requestCount = 1;
    $lastReset = time();
}

file_put_contents($rateLimitFile, json_encode([
    'count' => $requestCount,
    'last_reset' => $lastReset
]));

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
