<?php
$logsDir = __DIR__ . '/../logs';
$maxAge = 30 * 24 * 60 * 60; // 30 days in seconds

if (!is_dir($logsDir)) {
    exit("Logs directory not found\n");
}

$files = glob($logsDir . '/*');
$now = time();
$deleted = 0;

foreach ($files as $file) {
    if (!is_file($file)) continue;
    
    $age = $now - filemtime($file);
    
    if ($age > $maxAge) {
        if (unlink($file)) {
            echo "Deleted: " . basename($file) . " (age: " . round($age / 86400) . " days)\n";
            $deleted++;
        }
    }
}

echo "Cleanup complete. Deleted $deleted old files.\n";
