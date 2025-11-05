
<?php
/**
 * Backup Script - Jalankan via cron job
 * Contoh cron: 0 2 * * * php /path/to/backup.php
 */

$backupDir = __DIR__ . '/backups';
$logsDir = __DIR__ . '/logs';
$timestamp = date('Y-m-d_H-i-s');
$backupFile = $backupDir . '/backup_' . $timestamp . '.zip';

// Create backup directory if not exists
if (!is_dir($backupDir)) {
    mkdir($backupDir, 0755, true);
}

// Create zip archive
$zip = new ZipArchive();
if ($zip->open($backupFile, ZipArchive::CREATE) === TRUE) {
    // Add all log files
    $files = glob($logsDir . '/*.json');
    foreach ($files as $file) {
        $zip->addFile($file, 'logs/' . basename($file));
    }
    
    $zip->close();
    echo "Backup created: $backupFile\n";
    
    // Delete backups older than 30 days
    $oldBackups = glob($backupDir . '/backup_*.zip');
    foreach ($oldBackups as $backup) {
        if (time() - filemtime($backup) > 30 * 24 * 3600) {
            unlink($backup);
            echo "Deleted old backup: $backup\n";
        }
    }
} else {
    echo "Failed to create backup\n";
}
