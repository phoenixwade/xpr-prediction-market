<?php
/**
 * Image Upload Endpoint for Proton Prediction Market
 * Accepts image uploads and stores them in /images/ directory
 * Returns JSON with the image URL
 */

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

if (empty($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo json_encode(['error' => 'Upload failed']);
    exit;
}

$maxSize = 2 * 1024 * 1024;
if ($_FILES['file']['size'] > $maxSize) {
    http_response_code(413);
    echo json_encode(['error' => 'File too large (max 2MB)']);
    exit;
}

$tmpPath = $_FILES['file']['tmp_name'];

$finfo = new finfo(FILEINFO_MIME_TYPE);
$mime = $finfo->file($tmpPath);

$imgType = @exif_imagetype($tmpPath);

$mimeMap = [
    'image/jpeg' => 'jpg',
    'image/png' => 'png',
    'image/webp' => 'webp'
];

$exifMap = [
    IMAGETYPE_JPEG => 'jpg',
    IMAGETYPE_PNG => 'png',
    IMAGETYPE_WEBP => 'webp'
];

if (!isset($mimeMap[$mime]) || !isset($exifMap[$imgType]) || $mimeMap[$mime] !== $exifMap[$imgType]) {
    http_response_code(415);
    echo json_encode(['error' => 'Unsupported image type (only jpg, png, webp allowed)']);
    exit;
}

$ext = $mimeMap[$mime];
$filename = bin2hex(random_bytes(16)) . '.' . $ext;

$uploadDir = __DIR__ . '/../images/';
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}

$destPath = $uploadDir . $filename;
if (!move_uploaded_file($tmpPath, $destPath)) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to save file']);
    exit;
}

chmod($destPath, 0644);

echo json_encode([
    'success' => true,
    'url' => '/images/' . $filename
]);
