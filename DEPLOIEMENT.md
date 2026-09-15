# Mettre SurvIsland en ligne

## 1. Préparer le serveur

Le site nécessite un hébergement PHP. Aucun serveur Node, build npm ou base de données n'est requis.

- Utiliser une version PHP maintenue, par exemple PHP 8.4 à jour (le projet a été testé localement avec PHP 8.3).
- Activer les extensions `mbstring` et `fileinfo`, les sessions et les envois de fichiers.
- Activer HTTPS sur le domaine.
- Dans les réglages PHP de l'hébergement, définir par exemple :

```ini
file_uploads = On
upload_max_filesize = 10M
post_max_size = 12M
memory_limit = 128M
display_errors = Off
log_errors = On
```

Ces réglages permettent d'envoyer les images autorisées par l'application (8 Mo maximum chacune). L'éditeur envoie les fichiers un par un.

Références : [versions PHP maintenues](https://www.php.net/supported-versions.php), [réglages PHP](https://www.php.net/manual/en/ini.core.php).

## 2. Transférer le site

Avant le transfert, arrêter les modifications locales et sauvegarder le dossier `private/` complet. Transférer par SFTP, ou par le gestionnaire de fichiers sécurisé de l'hébergeur.

Dans le dossier web de destination (`public_html`, `www`, `htdocs`, ou un sous-dossier dédié), placer :

```text
index.html
episodes.html
admin.html
style.css
episodes.css
bee-theme.css
script.js
episodes.js
admin.js
episode-view.js
episode-gallery.js
roster.js
api.php
episode-media.php
assets/                 (tout le dossier)
private/                (tout le dossier, fichiers cachés inclus)
```

Ne pas transférer `.git/`, `.idea/`, les archives de sauvegarde ou les fichiers temporaires de test. Les fichiers Markdown ne sont pas nécessaires au fonctionnement.

Conserver les noms, les majuscules et l'arborescence. Tous les chemins utilisés par le site sont relatifs : l'installation fonctionne à la racine d'un domaine ou dans un sous-dossier.

### Conserver les données actuelles

Le dossier local contient déjà un compte et des données. Pour les conserver :

- `private/config.php` : empreinte du mot de passe administrateur ; le même mot de passe fonctionnera en ligne.
- `private/episodes.php` : épisodes, brouillons, versions publiées et références des images.
- `private/media/` : images envoyées dans les épisodes.
- `private/.htaccess` : protection Apache du dossier.

Le fichier `private/store.lock` peut être copié ; PHP peut aussi le recréer. Le dossier `private/` est exclu de Git : un clonage du dépôt seul ne récupérera pas les données.

Il n'est pas nécessaire de relancer `setup-admin.php` si `config.php` est conservé. Pour une installation neuve uniquement, transférer ce script et exécuter `php setup-admin.php` dans un terminal situé dans le dossier du site. Il ne fonctionne pas dans le navigateur.

## 3. Protéger les données et autoriser l'écriture

PHP doit pouvoir lire et écrire dans `private/`, ses fichiers de données et `private/media/`. Sur Linux, faire correspondre le propriétaire ou le groupe à l'utilisateur qui exécute PHP. Les permissions exactes dépendent de l'hébergement ; ne pas ouvrir le dossier en écriture à tout le monde (`777`).

### Apache

Conserver `private/.htaccess`, qui contient :

```apache
Require all denied
```

Le serveur doit autoriser cette directive dans les fichiers `.htaccess`. Vérifier que l'URL `/private/store.lock` du site renvoie bien 403 ou 404, et non 200. Ce fichier existe après le premier accès à l'API : il permet de vérifier le blocage sans exposer de données.

Référence : [prise en compte des fichiers .htaccess](https://httpd.apache.org/docs/2.4/howto/htaccess.html).

### Nginx

Faire ajouter une règle de protection explicite dans la configuration du site, en adaptant le préfixe si le site est installé dans un sous-dossier. Pour une installation à la racine du domaine :

```nginx
location ^~ /private/ {
    return 404;
}
client_max_body_size 12m;
```

Cette règle complète une configuration PHP-FPM fonctionnelle ; elle ne la remplace pas. Pour `/survisland/`, utiliser `location ^~ /survisland/private/`. Tester puis recharger la configuration Nginx.

Référence : [configuration des requêtes Nginx](https://nginx.org/en/docs/http/ngx_http_core_module.html#client_max_body_size).

### Variante : stockage hors du dossier web

Le code accepte la variable serveur `SURVISLAND_DATA_DIR`, qui indique un chemin absolu vers les données privées. Pour cette variante, copier tout le contenu de `private/` dans ce dossier extérieur et fournir la variable au processus PHP. Sa configuration dépend de l'hébergement. Ne pas utiliser un chemin local Windows sur un serveur Linux.

## 4. Vérifier la mise en ligne

1. Ouvrir `/index.html` : styles, favicon et portraits doivent se charger.
2. Ouvrir `/api.php?action=public` : une réponse JSON doit apparaître, jamais le code source PHP.
3. Ouvrir `/admin.html` et se connecter avec le mot de passe actuel.
4. Créer un brouillon de vérification et ajouter deux images. Enregistrer puis recharger pour confirmer la sauvegarde.
5. Dans une fenêtre privée, vérifier que ce brouillon n'apparaît pas dans `/episodes.html` et que l'URL d'une de ses images reste inaccessible.
6. Quand le contenu est prêt, publier et vérifier le carrousel, les réponses, les rangs et les éliminés en navigation privée.
7. Vérifier que `/private/store.lock` est inaccessible par HTTP.

Si le site utilise un CDN ou un cache de pages, exclure `api.php` de la mise en cache, y compris ses paramètres de requête. L'API envoie déjà `Cache-Control: no-store`.

## 5. Mises à jour suivantes

Une fois le site en ligne, saisir les nouveaux épisodes dans l'administration du serveur.

Pour mettre à jour le code, transférer les fichiers HTML, CSS, JS, PHP et les ressources nécessaires, **sans remplacer le dossier `private/` du serveur par une ancienne copie locale**. Sauvegarder régulièrement ce dossier complet, images comprises, dans un emplacement non public.
