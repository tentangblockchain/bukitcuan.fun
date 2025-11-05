
<?php
header('Content-Type: application/json');
header('Cache-Control: no-cache');

$health = [
    'status' => 'healthy',
    'timestamp' => date('c'),
    'php_version' => PHP_VERSION,
    'memory_usage' => round(memory_get_usage() / 1024 / 1024, 2) . ' MB',
    'disk_free' => round(disk_free_space('.') / 1024 / 1024 / 1024, 2) . ' GB'
];

// Check if logs directory is writable
$logsDir = __DIR__ . '/../logs';
if (!is_writable($logsDir)) {
    $health['status'] = 'degraded';
    $health['warnings'][] = 'Logs directory not writable';
}

echo json_encode($health, JSON_PRETTY_PRINT);
