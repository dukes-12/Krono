# Krono — mise en ligne et installation

## Contenu du dossier

| Fichier | Rôle |
|---|---|
| `index.html` | Le jeu entier : HTML, CSS et JavaScript en un seul fichier |
| `manifest.json` | Nom, icônes, couleurs, lancement en plein écran |
| `sw.js` | Service worker : fonctionnement hors ligne |
| `icone-*.png` | Icônes 180, 192 et 512 px, plus une version « maskable » pour Android |

Les quatre types de fichiers doivent rester **dans le même dossier**, sinon le
manifeste et le service worker ne se trouveront pas.

## Mettre en ligne

Il faut du HTTPS : un service worker ne s'installe pas en `file://` ni en `http://`.

**Le plus simple — Netlify Drop.** Allez sur `app.netlify.com/drop`, glissez le
dossier entier (pas les fichiers un par un). Vous obtenez une URL en quelques
secondes, sans créer de compte.

**GitHub Pages.** Créez un dépôt, déposez les fichiers à la racine, puis
Settings → Pages → Source : branche `main`, dossier `/root`.

**Cloudflare Pages** ou **Vercel** fonctionnent pareil si vous préférez.

## Installer sur le téléphone

**iPhone.** Ouvrez l'URL **dans Safari** — l'ajout à l'écran d'accueil ne
fonctionne pas depuis Chrome sur iOS. Bouton Partager, puis *Sur l'écran
d'accueil*. L'app se lance ensuite en plein écran, sans barre d'adresse.

**Android.** Chrome propose *Installer l'application* dans le menu ⋮, ou
affiche une bannière automatiquement.

## Mettre le jeu à jour

Remplacez `index.html`, **et changez `VERSION` dans `sw.js`** (par exemple
`krono-v2`). Sans ce changement, les téléphones qui ont déjà installé l'app
continueront à servir l'ancienne version depuis leur cache.

## Garder le panthéon d'une version à l'autre

Les profils vivent dans le `localStorage` du navigateur, sous la clé `krono.v1`.
Ce stockage est attaché à **l'adresse du site**, pas aux fichiers. Redéployer
n'y touche donc pas — à une condition près, décisive.

**Déployez toujours sur le même site.** Reglisser le zip sur `app.netlify.com/drop`
crée un site *neuf*, avec une nouvelle adresse, donc un stockage vide : le panthéon
semble effacé alors qu'il est resté sur l'ancienne adresse. Pour mettre à jour,
allez sur l'onglet **Deploys** de votre site existant et déposez le zip dans la
zone en bas de page. L'adresse ne bouge pas, les données non plus.

Créez un compte : un site déposé anonymement est supprimé au bout d'une heure
s'il n'est pas revendiqué.

**Changer `VERSION` dans `sw.js` ne touche pas aux profils.** Le cache du service
worker et le `localStorage` sont deux espaces distincts ; vider l'un n'affecte pas
l'autre.

**Sur iPhone, ajoutez l'app à l'écran d'accueil.** Safari purge le stockage d'un
site après sept jours sans visite. Les applications lancées depuis l'écran d'accueil
ont leur propre compteur d'utilisation et échappent en principe à cette purge, mais
Apple ne le documente nulle part clairement et le comportement a déjà changé.

**Exportez.** Menu → Mémoire → *Exporter la sauvegarde* produit un fichier JSON et
le copie dans le presse-papier. C'est la seule protection qui ne dépende ni de
l'hébergeur ni du navigateur. *Importer* propose ensuite de fusionner (les
statistiques s'additionnent, les scores en double sont ignorés) ou de remplacer.
