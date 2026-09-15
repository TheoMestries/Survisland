<?php
// Run from the terminal; this script never accepts web requests.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
$dir = getenv('SURVISLAND_DATA_DIR') ?: __DIR__ . '/private';
if (!is_dir($dir) && !mkdir($dir, 0700, true)) { fwrite(STDERR, "Impossible de créer le dossier privé.\n"); exit(1); }
if (is_file($dir . '/config.php')) { fwrite(STDERR, "Un compte existe déjà. Configuration conservée.\n"); exit(1); }
$password = bin2hex(random_bytes(12));
$config = "<?php\nreturn " . var_export(['password_hash' => password_hash($password, PASSWORD_DEFAULT)], true) . ";\n";
if (file_put_contents($dir . '/config.php', $config, LOCK_EX) === false) { fwrite(STDERR, "Écriture impossible.\n"); exit(1); }
echo "Compte Flopy19 créé. Mot de passe à conserver : " . $password . "\nOuvre admin.html depuis le serveur PHP.\n";
