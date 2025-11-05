
<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

// Constants
define('MAX_PAYLOAD_SIZE', 10240); // 10KB max payload
define('MAX_ARRAY_ITEMS', 50); // Max 50 events per request
define('RATE_LIMIT', 100);
define('RATE_LIMIT_WINDOW', 3600); // 1 hour

$ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$rateLimitFile = __DIR__ . '/../logs/rate_limit_' . md5($ip) . '.json';

// Rate limiting: max 100 requests per IP per hour
if (file_exists($rateLimitFile)) {
    $rateLimitData = json_decode(file_get_contents($rateLimitFile), true);
    $requestCount = $rateLimitData['count'] ?? 0;
    $lastReset = $rateLimitData['last_reset'] ?? 0;
    
    if (time() - $lastReset > RATE_LIMIT_WINDOW) {
        $requestCount = 0;
        $lastReset = time();
    }
    
    if ($requestCount >= RATE_LIMIT) {
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

// Check payload size
$rawInput = file_get_contents('php://input');
if (strlen($rawInput) > MAX_PAYLOAD_SIZE) {
    http_response_code(413);
    exit(json_encode(['error' => 'Payload too large']));
}

$data = json_decode($rawInput, true);

if (!$data || !is_array($data)) {
    http_response_code(400);
    exit(json_encode(['error' => 'Invalid data format']));
}

// Limit number of items
if (count($data) > MAX_ARRAY_ITEMS) {
    http_response_code(400);
    exit(json_encode(['error' => 'Too many items']));
}

// Validate and sanitize each item
$sanitizedData = [];
foreach ($data as $item) {
    if (!is_array($item)) continue;
    
    // Keep only safe keys and sanitize values
    $safeItem = [];
    $allowedKeys = ['event', 'variant', 'timestamp', 'search_term', 'ab_variant'];
    
    foreach ($allowedKeys as $key) {
        if (isset($item[$key])) {
            $value = $item[$key];
            // Sanitize strings
            if (is_string($value)) {
                $value = substr($value, 0, 200); // Max 200 chars
                $value = htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
            }
            $safeItem[$key] = $value;
        }
    }
    
    if (!empty($safeItem)) {
        $sanitizedData[] = $safeItem;
    }
}

if (empty($sanitizedData)) {
    http_response_code(400);
    exit(json_encode(['error' => 'No valid data']));
}

$data = $sanitizedData;

$logFile = __DIR__ . '/../logs/tracking_' . date('Y-m-d') . '.json';
$logDir = dirname($logFile);

if (!is_dir($logDir)) {
    mkdir($logDir, 0755, true);
}

$existingData = [];
if (file_exists($logFile)) {
    $content = file_get_contents($logFile);
    $existingData = json_decode($content, true) ?: [];
    
    // Limit log file size - keep max 1000 entries per day
    if (count($existingData) >= 1000) {
        array_shift($existingData); // Remove oldest
    }
}

$existingData[] = [
    'timestamp' => date('c'),
    'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
    'user_agent' => substr($_SERVER['HTTP_USER_AGENT'] ?? 'unknown', 0, 200),
    'data' => $data
];

file_put_contents($logFile, json_encode($existingData, JSON_PRETTY_PRINT));

echo json_encode(['success' => true]);
