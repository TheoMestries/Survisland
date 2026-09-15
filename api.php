<?php
declare(strict_types=1);
require_once __DIR__ . '/episode-media.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function respond(array $data, int $status = 200): never {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    exit;
}
function fail(string $message, int $status = 400): never { respond(['error' => $message], $status); }
function storagePath(): string { return getenv('SURVISLAND_DATA_DIR') ?: __DIR__ . '/private'; }
function readStore(string $path): array {
    if (!is_file($path)) return ['episodes' => [], 'attempts' => []];
    $raw = file_get_contents($path);
    $prefix = "<?php http_response_code(404); exit; ?>\n";
    if ($raw === false || !str_starts_with($raw, $prefix)) throw new RuntimeException('Invalid storage');
    return json_decode(substr($raw, strlen($prefix)), true, 512, JSON_THROW_ON_ERROR);
}
function writeStore(string $path, array $data): void {
    $temp = tempnam(dirname($path), 'write-');
    if ($temp === false) throw new RuntimeException('Write failed');
    try {
        // Temporary files also carry a PHP extension to prevent direct downloads.
        $safe = $temp . '.php';
        if (!rename($temp, $safe)) throw new RuntimeException('Write failed');
        $temp = $safe;
        $raw = "<?php http_response_code(404); exit; ?>\n" . json_encode($data, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
        if (file_put_contents($temp, $raw, LOCK_EX) !== strlen($raw) || !rename($temp, $path)) throw new RuntimeException('Write failed');
    } finally { if (is_file($temp)) unlink($temp); }
}
function textField(array $data, string $key, int $max, bool $required = false): string {
    $value = $data[$key] ?? '';
    if (!is_string($value) || mb_strlen($value) > $max || ($required && trim($value) === '')) fail('Champ invalide : ' . $key);
    return trim($value);
}
function validateEpisode(array $input, array $media): array {
    $number = $input['number'] ?? null;
    if (!is_int($number) || $number < 1 || $number > 999) fail('Le numéro doit être compris entre 1 et 999.');
    $result = ['number' => $number, 'title' => textField($input, 'title', 160, true), 'summary' => textField($input, 'summary', 4000), 'questions' => [], 'people' => []];
    foreach (['questions' => 100, 'people' => 100] as $key => $limit) {
        if (!isset($input[$key]) || !is_array($input[$key]) || !array_is_list($input[$key]) || count($input[$key]) > $limit) fail('Liste invalide : ' . $key);
    }
    foreach ($input['questions'] as $item) {
        if (!is_array($item)) fail('Question invalide.');
        $result['questions'][] = ['question' => textField($item, 'question', 2000, true), 'answer' => textField($item, 'answer', 20000)];
    }
    $names = [];
    foreach ($input['people'] as $item) {
        if (!is_array($item)) fail('Personne invalide.');
        $name = textField($item, 'name', 80, true);
        $tier = $item['tier'] ?? '';
        if (!in_array($tier, ['S', 'A', 'B', 'C', 'D', 'U'], true)) fail('Niveau de confiance invalide.');
        if (in_array(mb_strtolower($name), $names, true)) fail('Chaque personne doit apparaître une seule fois.');
        $names[] = mb_strtolower($name);
        $eliminated = $item['eliminated'] ?? false;
        if (!is_bool($eliminated)) fail('Statut d’élimination invalide.');
        $result['people'][] = ['name' => $name, 'tier' => $tier, 'reason' => textField($item, 'reason', 5000), 'eliminated' => $eliminated];
    }
    $result['images'] = validateImages($input['images'] ?? [], $media);
    return $result;
}

try {
    $action = $_GET['action'] ?? 'public';
    $dir = storagePath();
    if (!is_dir($dir) && !mkdir($dir, 0700, true)) throw new RuntimeException('Storage unavailable');
    $lock = fopen($dir . '/store.lock', 'c');
    if (!$lock || !flock($lock, LOCK_EX)) throw new RuntimeException('Lock failed');
    $path = $dir . '/episodes.php';
    $store = readStore($path);
    if ($action === 'public') {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') fail('Méthode non autorisée.', 405);
        respond(['episodes' => array_values(array_filter(array_map(fn($e) => $e['published'] ?? null, $store['episodes'])))]);
    }
    session_name('survisland_admin');
    session_set_cookie_params(['httponly' => true, 'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off', 'samesite' => 'Strict', 'path' => rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'])), '/') . '/']);
    ini_set('session.use_strict_mode', '1');
    session_start();
    $_SESSION['csrf'] ??= bin2hex(random_bytes(32));
    if ($action === 'image') serveImage($store, $dir, $lock);
    $config = is_file($dir . '/config.php') ? require $dir . '/config.php' : [];
    $hash = getenv('SURVISLAND_ADMIN_HASH') ?: ($config['password_hash'] ?? '');
    if ($action === 'session') respond(['authenticated' => !empty($_SESSION['admin']), 'configured' => $hash !== '', 'csrf' => $_SESSION['csrf']]);
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('Méthode non autorisée.', 405);
    if (!hash_equals($_SESSION['csrf'], $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '')) fail('Session expirée. Recharge la page.', 403);
    if ($action === 'upload') {
        if (empty($_SESSION['admin'])) fail('Connecte-toi pour ajouter des images.', 401);
        if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > EPISODE_IMAGE_BYTES + 65536) fail('Chaque image doit peser au maximum 8 Mo.', 413);
        $image = uploadImage($store, $dir);
        writeStore($path, $store);
        respond(['image' => $image]);
    }
    if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 3000000) fail('Le contenu est trop volumineux.', 413);
    $input = json_decode(file_get_contents('php://input'), true, 512, JSON_THROW_ON_ERROR);
    if (!is_array($input)) fail('Données invalides.');
    if ($action === 'login') {
        if (!$hash) fail('L’espace privé doit être configuré sur le serveur. Consulte le README.', 503);
        $key = hash('sha256', $_SERVER['REMOTE_ADDR'] ?? 'unknown');
        $store['attempts'] = array_filter($store['attempts'] ?? [], fn($attempt) => $attempt['time'] > time() - 900);
        $attempt = $store['attempts'][$key] ?? ['time' => time(), 'count' => 0];
        if ($attempt['count'] >= 10) fail('Trop de tentatives. Réessaie dans 15 minutes.', 429);
        $password = textField($input, 'password', 512, true);
        if (!password_verify($password, $hash)) {
            $attempt['count']++; $store['attempts'][$key] = $attempt; writeStore($path, $store);
            fail('Mot de passe incorrect.', 401);
        }
        unset($store['attempts'][$key]); writeStore($path, $store);
        session_regenerate_id(true); $_SESSION['admin'] = true;
        respond(['ok' => true]);
    }
    if (empty($_SESSION['admin'])) fail('Connecte-toi pour continuer.', 401);
    if ($action === 'logout') { $_SESSION = []; session_destroy(); respond(['ok' => true]); }
    if ($action === 'list') respond(['episodes' => array_values($store['episodes'])]);
    if ($action !== 'save') fail('Action inconnue.', 404);
    $episode = validateEpisode($input['episode'] ?? [], $store['media'] ?? []);
    $id = textField($input, 'id', 40);
    if ($id !== '' && !preg_match('/^[a-f0-9]{32}$/', $id)) fail('Identifiant invalide.');
    $existing = $id === '' ? null : ($store['episodes'][$id] ?? null);
    if ($id !== '' && !$existing) fail('Cet épisode n’existe plus.', 404);
    if ($existing && ($input['revision'] ?? null) !== $existing['revision']) fail('Cet épisode a été modifié dans une autre fenêtre. Recharge sa dernière version avant de continuer.', 409);
    foreach ($store['episodes'] as $otherId => $other) {
        if ($otherId !== $id && $other['draft']['number'] === $episode['number']) fail('Ce numéro d’épisode existe déjà.');
    }
    $mode = $input['mode'] ?? 'draft';
    if (!in_array($mode, ['draft', 'publish', 'unpublish'], true)) fail('Action invalide.');
    if ($mode === 'publish') {
        if (!$episode['questions'] && !$episode['people'] && !$episode['images']) fail('Ajoute une question, une personne ou une image avant de publier.');
        foreach ($episode['questions'] as $q) if ($q['answer'] === '') fail('Réponds à toutes les questions avant de publier.');
        foreach ($episode['people'] as $p) {
            if (!$p['eliminated'] && $p['tier'] === 'U') fail('Classe chaque personne encore en jeu de S à D avant de publier.');
        }
    }
    $id = $id ?: bin2hex(random_bytes(16));
    $episode['id'] = $id;
    $record = ['id' => $id, 'revision' => ($existing['revision'] ?? 0) + 1, 'draft' => $episode, 'published' => $existing['published'] ?? null, 'updatedAt' => gmdate('c')];
    if ($mode === 'publish') { $record['published'] = $episode; $record['published']['publishedAt'] = gmdate('c'); }
    if ($mode === 'unpublish') $record['published'] = null;
    $store['episodes'][$id] = $record;
    writeStore($path, $store);
    respond(['episode' => $record]);
} catch (JsonException $error) { fail('Données JSON invalides.', 400); }
catch (Throwable $error) { error_log((string)$error); fail('Impossible de sauvegarder ou charger le confessional. Vérifie la configuration du serveur.', 500); }
