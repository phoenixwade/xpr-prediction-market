<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$results = [];

$results['pdo_drivers'] = PDO::getAvailableDrivers();
$results['has_sqlite'] = in_array('sqlite', PDO::getAvailableDrivers());

$results['sqlite3_loaded'] = extension_loaded('sqlite3');

$dbPath = __DIR__ . '/../data/comments.db';
$dataDir = dirname($dbPath);
$results['data_dir_path'] = $dataDir;
$results['data_dir_exists'] = file_exists($dataDir);
$results['data_dir_writable'] = is_writable(dirname($dataDir));

if (!file_exists($dataDir)) {
    $results['mkdir_attempted'] = true;
    $results['mkdir_success'] = @mkdir($dataDir, 0755, true);
    $results['mkdir_error'] = error_get_last();
} else {
    $results['data_dir_perms'] = substr(sprintf('%o', fileperms($dataDir)), -4);
    $results['data_dir_writable_direct'] = is_writable($dataDir);
}

$results['db_path'] = $dbPath;
$results['db_exists'] = file_exists($dbPath);
if (file_exists($dbPath)) {
    $results['db_perms'] = substr(sprintf('%o', fileperms($dbPath)), -4);
    $results['db_writable'] = is_writable($dbPath);
}

if ($results['has_sqlite']) {
    try {
        $db = new PDO('sqlite:' . $dbPath);
        $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $results['db_connection'] = 'success';
        
        try {
            $db->exec("CREATE TABLE IF NOT EXISTS test_table (id INTEGER PRIMARY KEY, test TEXT)");
            $results['table_creation'] = 'success';
            
            $stmt = $db->prepare("INSERT INTO test_table (test) VALUES (:test)");
            $stmt->execute([':test' => 'test_value']);
            $results['insert'] = 'success';
            
            $db->exec("DROP TABLE test_table");
        } catch (PDOException $e) {
            $results['table_creation'] = 'failed';
            $results['table_error'] = $e->getMessage();
        }
    } catch (PDOException $e) {
        $results['db_connection'] = 'failed';
        $results['db_error'] = $e->getMessage();
    }
}

$results['php_version'] = phpversion();

$results['current_user'] = get_current_user();

echo json_encode($results, JSON_PRETTY_PRINT);
