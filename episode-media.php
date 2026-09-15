<?php
declare(strict_types=1);

const EPISODE_IMAGE_LIMIT = 20;
const EPISODE_IMAGE_BYTES = 8 * 1024 * 1024;
const MEDIA_GUARD = "<?php http_response_code(404); exit; ?>\n";

function uploadImage(array &$store, string $dir): array {
    $file = $_FILES['image'] ?? null;
    if (!$file || !is_array($file) || !isset($file['error']) || is_array($file['error'])) fail('Choisis une image à envoyer.');
    if ($file['error'] !== UPLOAD_ERR_OK) fail('Envoi impossible. Vérifie la taille du fichier et la limite d’envoi du serveur.', 413);
    if (!is_uploaded_file($file['tmp_name'])) fail('Fichier invalide.');
    $size = filesize($file['tmp_name']);
    if (!$size || $size > EPISODE_IMAGE_BYTES) fail('Chaque image doit peser au maximum 8 Mo.', 413);
    $info = @getimagesize($file['tmp_name']);
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
    $types = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'image/gif' => 'gif'];
    if (!$info || !isset($types[$mime]) || $info['mime'] !== $mime) fail('Formats acceptés : JPG, PNG, WebP et GIF.');
    if ($info[0] > 12000 || $info[1] > 12000 || $info[0] * $info[1] > 40000000) fail('Image trop grande. Réduis ses dimensions avant de l’envoyer.');
    $mediaDir = $dir . '/media';
    if (!is_dir($mediaDir) && !mkdir($mediaDir, 0700, true)) throw new RuntimeException('Media directory unavailable');
    $id = bin2hex(random_bytes(16));
    $data = file_get_contents($file['tmp_name']);
    if ($data === false) throw new RuntimeException('Image read failed');
    $destination = $mediaDir . '/' . $id . '.php';
    // Base64 prevents image bytes from ever being parsed as PHP on a direct request.
    $payload = MEDIA_GUARD . base64_encode($data);
    if (file_put_contents($destination, $payload, LOCK_EX) !== strlen($payload)) {
        if (is_file($destination)) unlink($destination);
        throw new RuntimeException('Image write failed');
    }
    $store['media'][$id] = ['mime' => $mime, 'extension' => $types[$mime], 'size' => $size];
    return ['id' => $id, 'caption' => ''];
}

function validateImages(mixed $images, array $media): array {
    if (!is_array($images) || !array_is_list($images) || count($images) > EPISODE_IMAGE_LIMIT) fail('Maximum 20 images par épisode.');
    $result = []; $seen = [];
    foreach ($images as $image) {
        if (!is_array($image)) fail('Image invalide.');
        $id = textField($image, 'id', 32, true);
        if (!preg_match('/^[a-f0-9]{32}$/', $id) || !isset($media[$id]) || !is_file(storagePath() . '/media/' . $id . '.php')) fail('Image introuvable. Envoie-la à nouveau.');
        if (isset($seen[$id])) fail('Cette image figure déjà dans l’épisode.');
        $seen[$id] = true;
        $result[] = ['id' => $id, 'caption' => textField($image, 'caption', 500)];
    }
    return $result;
}

function serveImage(array $store, string $dir, $lock): never {
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') fail('Méthode non autorisée.', 405);
    $id = $_GET['id'] ?? '';
    if (!is_string($id) || !preg_match('/^[a-f0-9]{32}$/', $id) || !isset($store['media'][$id])) fail('Image introuvable.', 404);
    $allowed = !empty($_SESSION['admin']);
    if (!$allowed) foreach ($store['episodes'] as $record) {
        foreach ($record['published']['images'] ?? [] as $image) {
            if ($image['id'] === $id) { $allowed = true; break 2; }
        }
    }
    if (!$allowed) fail('Image introuvable.', 404);
    $file = $dir . '/media/' . $id . '.php';
    if (!is_file($file)) fail('Image introuvable.', 404);
    $handle = fopen($file, 'rb');
    if (!$handle || fread($handle, strlen(MEDIA_GUARD)) !== MEDIA_GUARD) throw new RuntimeException('Invalid image storage');
    $bytes = base64_decode(stream_get_contents($handle), true);
    fclose($handle);
    if ($bytes === false) throw new RuntimeException('Invalid image encoding');
    $meta = $store['media'][$id];
    header('Content-Type: ' . $meta['mime']);
    header('Content-Disposition: inline; filename="image.' . $meta['extension'] . '"');
    header('Content-Length: ' . $meta['size']);
    session_write_close();
    flock($lock, LOCK_UN); fclose($lock);
    echo $bytes; exit;
}
