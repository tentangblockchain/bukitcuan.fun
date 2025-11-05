
<?php
header('Content-Type: application/json');
header('Cache-Control: no-cache, must-revalidate');

$logsDir = __DIR__ . '/../logs';
$stats = [
    'total_searches' => 0,
    'total_events' => 0,
    'popular_searches' => [],
    'conversion_rate' => 0,
    'ab_test_results' => ['A' => 0, 'B' => 0]
];

if (is_dir($logsDir)) {
    $files = glob($logsDir . '/tracking_*.json');
    $searches = [];
    
    foreach ($files as $file) {
        $data = json_decode(file_get_contents($file), true) ?: [];
        foreach ($data as $entry) {
            if (isset($entry['data'])) {
                foreach ($entry['data'] as $event) {
                    $stats['total_events']++;
                    
                    if (isset($event['event']) && $event['event'] === 'search') {
                        $stats['total_searches']++;
                        $term = $event['search_term'] ?? '';
                        if ($term) {
                            $searches[$term] = ($searches[$term] ?? 0) + 1;
                        }
                    }
                    
                    if (isset($event['ab_variant'])) {
                        $variant = $event['ab_variant'];
                        if (isset($stats['ab_test_results'][$variant])) {
                            $stats['ab_test_results'][$variant]++;
                        }
                    }
                }
            }
        }
    }
    
    arsort($searches);
    $stats['popular_searches'] = array_slice($searches, 0, 10, true);
}

echo json_encode($stats, JSON_PRETTY_PRINT);
