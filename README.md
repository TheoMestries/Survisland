# Survisland

Page statique de candidature pour Theo / Flopy19 sur SurvIsland.

Le site repose sur trois fichiers :

- `index.html` pour la structure et les textes
- `style.css` pour le rendu
- `script.js` pour les interactions simples

Le ton a ete resserre pour etre plus direct et moins artificiel, sans perdre le cote candidature / jeu social.

La candidature seule peut être ouverte directement dans un navigateur.

## Le confessional

- `episodes.html` : confessional public, questions/réponses et classement de confiance commenté par épisode.
- `admin.html` : carnet privé, ajout des questions et des joueurs, niveaux S à D, ordre dans chaque niveau, aperçu, brouillons et publication manuelle.
- `api.php` : authentification et sauvegarde sur le serveur, sans base de données.

### Mise en route

Le confessional nécessite **PHP 8.1 ou supérieur avec mbstring**, disponible dans MAMP. Un hébergement uniquement statique (par exemple GitHub Pages) ne peut pas exécuter ce carnet.

1. Depuis le dossier du site, exécuter `php setup-admin.php`. Le terminal affiche un mot de passe aléatoire à conserver dans un gestionnaire de mots de passe. Le serveur ne conserve que son empreinte. Le script refuse d'écraser un compte existant.
2. Démarrer MAMP et ouvrir le site avec son URL HTTP locale, puis `admin.html`. Pour un serveur de développement autonome : `php -S 127.0.0.1:8080`, puis ouvrir `http://127.0.0.1:8080/admin.html`.
3. Créer un épisode, ajouter les questions et leurs réponses, puis les pseudos, niveaux de confiance et explications. Les flèches changent l'ordre des joueurs dans un même niveau.
4. Enregistrer le brouillon, consulter l'aperçu, puis publier. Le bouton « Reprendre les joueurs » crée un nouvel épisode en copiant les joueurs, niveaux et commentaires ; relire ces commentaires pour le nouvel épisode.
5. Les spectateurs consultent `episodes.html`. Chaque épisode possède un lien partageable dans l'adresse du navigateur.

Les sauvegardes sont **manuelles**, avec avertissement avant de quitter une page modifiée. Le bouton Publier exige une réponse à chaque question ; les justifications des joueurs sont facultatives. Une modification sauvegardée en brouillon ne remplace pas la version publique. « Retirer du public » conserve le contenu dans le carnet privé. Deux fenêtres qui enregistrent le même épisode déclenchent un contrôle de conflit ; conserver son texte avant de recharger la version du serveur.

### Joueurs de la saison

Dans « Le classement de confiance », le bouton **Reprendre le classement de l’épisode précédent** copie le classement dans l'épisode en cours. Il utilise le dernier épisode enregistré dont le numéro est inférieur au numéro courant ; la source est indiquée au survol du bouton. Les joueurs, l'ordre, les niveaux, les justifications et les éliminations sont copiés. Le titre, l'introduction et les questions/réponses restent ceux de l'épisode en cours. Enregistrer ensuite le brouillon pour conserver la copie. Le bouton est désactivé si aucun épisode précédent n'existe.

`roster.js` contient les 20 joueurs, leurs portraits et leurs équipes de départ, d'après le tableau fourni :

- **Bumbar (jaune)** : Salamix, TwiZzyx, Anthorus, Flopy19, Sheep.
- **Avispa (bleu)** : Kchouky, Sparya, Paulo, Aelita, Hurakan.
- **Hornet (vert)** : ByPhantom, Fusoya, Templik, DVil, Faeten.
- **Conong (violet)** : XyneAs, Chifuyu, Jenna, Mel, Romain.

Les noms abrégés du tableau et ceux des portraits sont rapprochés automatiquement : Flopy / Flopy19, Mel / Melley, Romain / RomainLeroux et Aelita / Aelita A. Les couleurs des fonds des portraits ne servent pas à déterminer les équipes.

Les nouveaux épisodes préchargent les 19 autres joueurs au niveau privé « À classer ». Flopy19 figure dans la galerie publique, mais n'est pas ajouté à son propre classement. Le bouton « Ajouter les joueurs manquants » complète un ancien brouillon sans écraser ses commentaires ni dupliquer les joueurs connus. Un épisode ne peut pas être publié tant qu'une personne encore en jeu reste « À classer ».

Pour chaque épisode, cocher « Éliminé à cet épisode (ou auparavant) » sur les joueurs sortis du jeu. Plusieurs éliminés sont possibles. Leur contenu est conservé mais ils apparaissent hors classement, sans rang chiffré. Les nouveaux épisodes reprennent les éliminations du dernier épisode enregistré, et « Reprendre les joueurs » copie les statuts de l'épisode sélectionné. Ces statuts restent modifiables indépendamment pour chaque épisode, sans modifier l'historique.

La tierlist publique présente uniquement les portraits cliquables et les rangs continus de 1 à N parmi les joueurs encore en jeu du classement. L'ordre suit S, A, B, C, D, puis l'ordre manuel au sein de chaque niveau. Un clic ouvre une modale avec le portrait, l'équipe et la justification si elle existe. La modale se ferme avec son bouton, Échap ou un clic à l'extérieur. L'aperçu privé utilise le même affichage ; les joueurs « À classer » n'ont pas encore de numéro.

### Images des épisodes

Dans **04 / Images**, sélectionner une ou plusieurs images (JPG, PNG, WebP ou GIF, 8 Mo par fichier, 20 images maximum par épisode). Les flèches changent l'ordre du carrousel ; les légendes sont facultatives. « Retirer » enlève l'image de l'épisode en cours. Enregistrer le brouillon ou publier ensuite pour conserver la sélection.

La vue spectateur et l'aperçu affichent un carrousel avec flèches, miniatures, compteur, navigation au clavier et balayage tactile. Une seule image s'affiche sans commandes superflues. Les anciens épisodes sans images restent compatibles.

Les fichiers sont stockés dans `private/media/` avec une protection PHP et servis par l'API. Seules les images référencées par une version publiée sont accessibles sans connexion. Un ajout ou retrait en brouillon ne modifie pas les images de la version publique. Les fichiers retirés sont conservés sur le serveur, notamment pour ne pas casser une version publiée ; inclure `private/media/` dans les sauvegardes. Les limites PHP `upload_max_filesize` et `post_max_size` doivent autoriser l'envoi de 8 Mo plus les données du formulaire (par exemple 10M chacune). L'extension PHP `fileinfo` est nécessaire.

### Hébergement et données

Utiliser HTTPS en production. Les données sont stockées dans `private/`, exclu de Git et bloqué par `.htaccess` sous Apache. Les fichiers de données portent aussi une protection PHP. Le processus PHP doit pouvoir écrire dans ce dossier. Sauvegarder ce dossier séparément avant un changement de serveur ; ne pas l'écraser lors des mises à jour du site.

Il est recommandé de placer les données hors du répertoire public en définissant la variable serveur `SURVISLAND_DATA_DIR` vers un chemin absolu accessible en écriture. Cette même variable doit être utilisée lors de l'exécution de `setup-admin.php`. L'empreinte du mot de passe peut également être fournie par `SURVISLAND_ADMIN_HASH` au lieu de `private/config.php`.

Les brouillons ne sont jamais envoyés par l'API publique. L'administration utilise une session serveur, une protection CSRF et une limitation des tentatives de connexion. Les textes saisis sont affichés comme du texte, jamais comme du HTML exécutable.
