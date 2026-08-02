# Krono — le guide complet de la mise en ligne

Tout se fait depuis Safari sur iPhone. Aucun ordinateur nécessaire, aucune
application à installer.

Ce document remplace les précédents. Il couvre l'installation, les mises à jour,
le mode en ligne et les problèmes courants.

---

## Sommaire

1. [Comment tout s'articule](#1-comment-tout-sarticule)
2. [La question de `sw.js`](#2-la-question-de-swjs)
3. [Modifier un fichier au quotidien](#3-modifier-un-fichier-au-quotidien)
4. [Activer le mode en ligne](#4-activer-le-mode-en-ligne)
5. [Installer le jeu sur le téléphone](#5-installer-le-jeu-sur-le-téléphone)
6. [Sauvegarder le panthéon](#6-sauvegarder-le-panthéon)
7. [Quand ça ne marche pas](#7-quand-ça-ne-marche-pas)

---

## 1. Comment tout s'articule

Trois services, trois rôles distincts :

| Service | Rôle |
|---|---|
| **GitHub** | Garde les fichiers. C'est là que vous éditez. |
| **Netlify** | Publie le site. Se met à jour tout seul quand GitHub change. |
| **Supabase** | Stocke les scores des salons. Facultatif. |

Le cycle est toujours le même : **vous modifiez sur GitHub → Netlify redéploie
tout seul en une minute.** Vous ne déposez plus jamais de zip.

---

## 2. La question de `sw.js`

`sw.js` est le *service worker* : le composant qui garde une copie du jeu dans le
téléphone pour qu'il fonctionne sans réseau. Sa ligne `VERSION` sert d'étiquette
de fraîcheur.

```js
const VERSION = 'krono-v20';
```

**La valeur exacte n'a aucune importance. Ce qui compte, c'est qu'elle change.**

Un téléphone qui a déjà installé le jeu compare son étiquette à celle du serveur.
Identiques, il garde sa copie — et vous croyez que votre modification n'est pas
partie. Différentes, il télécharge la nouvelle version.

**La règle : à chaque modification d'`index.html`, incrémentez le numéro.**

```
krono-v20  →  krono-v21  →  krono-v22  →  …
```

Vous pouvez écrire `krono-mardi` ou `krono-essai-3`, ça marcherait aussi. Le
numéro qui monte est juste plus facile à suivre.

> Vous venez de modifier `index.html` sans toucher à `sw.js` ? Passez-le
> maintenant à `krono-v21`. C'est la seule chose qui vous manque.

---

## 3. Modifier un fichier au quotidien

1. Ouvrir **github.com** dans Safari, aller sur le dépôt `krono`
2. Toucher le nom du fichier — par exemple `index.html`
3. Toucher l'icône **crayon** en haut à droite
4. Modifier le texte
5. Descendre, bouton vert **Commit changes**, confirmer
6. Faire de même sur `sw.js` pour incrémenter `VERSION`
7. Attendre une minute

Pour vérifier que c'est parti : sur Netlify, onglet **Deploys**. La ligne du haut
doit afficher **Published** avec l'heure qu'il est.

**Astuce de recherche.** `index.html` fait plus de deux mille lignes. Dans
l'éditeur GitHub, ne faites pas défiler : utilisez la recherche de Safari
(bouton Partager → *Rechercher sur la page*) pour aller droit au but.

---

## 4. Activer le mode en ligne

Facultatif. Le jeu fonctionne parfaitement sans. Cette section n'ajoute qu'une
chose : **les salons**, un code à cinq lettres que plusieurs téléphones partagent
pour alimenter un classement commun.

Tant que les deux clés restent vides, aucune ligne de réseau ne s'exécute et
l'interface ne montre rien de tout ceci.

### 4.1 Créer le projet Supabase

1. `supabase.com`, compte gratuit
2. **New project**. Nom : `krono`. Région : Frankfurt ou Paris
3. Notez le mot de passe de base de données qu'il propose
4. Attendez deux minutes que le projet se provisionne

### 4.2 Créer les tables

Menu de gauche → **SQL Editor** → **New query**. Coller, puis **Run** :

```sql
create table salons (
  code    text primary key,
  cree_le timestamptz not null default now()
);

create table resultats (
  id       bigint generated always as identity primary key,
  salon    text not null references salons(code) on delete cascade,
  pseudo   text not null,
  mode     text,
  config   text,
  tours    int    not null default 0,
  somme    int    not null default 0,
  biais    int    not null default 0,
  carres   bigint not null default 0,
  piles    int    not null default 0,
  gorgees  int    not null default 0,
  culs     int    not null default 0,
  points   int    not null default 0,
  cree_le  timestamptz not null default now()
);

create index resultats_salon_idx on resultats (salon, config);
```

### 4.3 Poser les règles de sécurité

**Ne sautez pas cette étape.** Sans elle, n'importe qui peut vider vos tables.

Nouvelle requête, coller, **Run** :

```sql
alter table salons    enable row level security;
alter table resultats enable row level security;

create policy lire_salons   on salons    for select using (true);
create policy creer_salons  on salons    for insert with check (true);
create policy lire_result   on resultats for select using (true);
create policy ecrire_result on resultats for insert with check (true);
```

Ces règles autorisent la lecture et l'écriture, mais **pas la modification ni la
suppression**. Un score publié devient immuable : personne ne peut effacer le
record d'un autre, même en bidouillant la console de son navigateur.

Vérifiez dans **Authentication → Policies** que les deux tables affichent
« RLS enabled ».

### 4.4 Récupérer les deux clés

**Project Settings** (roue dentée) → **API** :

| Champ | Ce que c'est |
|---|---|
| **Project URL** | `https://xxxxxxxx.supabase.co` |
| **anon public** | longue chaîne commençant par `eyJ...` |

⚠️ Prenez bien **anon public**. Juste en dessous se trouve `service_role`, qui
contourne toutes les règles de sécurité et ne doit jamais quitter Supabase.

La clé `anon` est publique par conception. Elle sera visible dans le HTML de
votre site, et c'est normal : ce sont les règles de l'étape 4.3 qui protègent les
données, pas le secret de la clé.

### 4.5 Renseigner les clés

Sur GitHub, éditez `index.html`. Cherchez `SUPABASE_URL` — c'est une quinzaine de
lignes après le début du bloc `<script>` :

```js
const SUPABASE_URL = '';   // ex. https://abcdefgh.supabase.co
const SUPABASE_KEY = '';   // la clé « anon public », pas la clé service
```

Collez vos valeurs **entre les guillemets**, sans les supprimer :

```js
const SUPABASE_URL = 'https://abcdefgh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6...';
```

**Commit changes**, puis incrémentez `VERSION` dans `sw.js`.

### 4.6 Vérifier

1. Ouvrez le jeu. Un bloc **Salon en ligne** est apparu dans le menu.
2. **Créer un salon** → un code à cinq lettres s'affiche.
3. Jouez une partie courte, terminez-la.
4. Sur Supabase : **Table Editor → resultats**. Vos lignes doivent y être.
5. Dans le jeu : Panthéon → **Panthéon du salon**.

Sur un deuxième téléphone : menu → **Rejoindre**, saisir le code.

---

## 5. Installer le jeu sur le téléphone

**iPhone.** Ouvrez l'adresse **dans Safari** — l'ajout à l'écran d'accueil
n'existe pas depuis Chrome sur iOS. Bouton Partager → *Sur l'écran d'accueil*.

**Android.** Chrome, menu ⋮ → *Installer l'application*.

Une fois installé, le jeu s'ouvre en plein écran, sans barre d'adresse, et
fonctionne sans réseau.

---

## 6. Sauvegarder le panthéon

Les profils vivent dans le navigateur, attachés à **l'adresse du site**. Ils
survivent aux mises à jour, mais disparaissent si l'adresse change ou si
quelqu'un efface les données du site.

Deux précautions :

**Ne changez plus le nom du site Netlify** une fois qu'on y joue. Changer le
sous-domaine change l'adresse, donc perd le stockage.

**Exportez de temps en temps.** Menu → Mémoire → *Exporter la sauvegarde*. Ça
produit un fichier JSON et le copie dans le presse-papier. *Importer* propose
ensuite de fusionner — les statistiques s'additionnent, les doublons sont
ignorés — ou de remplacer.

Sur iPhone, Safari purge le stockage d'un site après sept jours sans visite. Les
applications ajoutées à l'écran d'accueil y échappent en principe, mais Apple ne
le garantit nulle part. Pour un jeu ouvert une fois par mois, l'export est la
seule protection fiable.

---

## 7. Quand ça ne marche pas

**« J'ai modifié, rien ne change sur mon téléphone. »**
Neuf fois sur dix, `VERSION` dans `sw.js` n'a pas bougé. Incrémentez, attendez
une minute, fermez complètement le jeu et rouvrez-le. En dernier recours,
désinstallez de l'écran d'accueil et réinstallez depuis Safari.

**« Le déploiement ne part pas. »**
Netlify → **Deploys**. Si la dernière ligne est en rouge, touchez-la pour voir le
motif. Si rien n'apparaît du tout, la connexion GitHub s'est perdue :
**Site configuration → Build & deploy → Link to a different repository**.

**« Le bloc Salon n'apparaît pas dans le menu. »**
Les deux clés ne sont pas remplies, ou une guillemet a sauté à la copie. Vérifiez
que les deux lignes se terminent bien par `';` — une erreur de syntaxe fait
échouer tout le script, et le jeu ne se lance plus du tout.

**« Salon introuvable. »**
Le code fait cinq lettres, sans O ni I — ces deux-là ont été retirés de
l'alphabet parce qu'on les confond avec 0 et 1 à l'oral. La casse n'a pas
d'importance.

**« Les scores ne remontent pas. »**
Le menu indique combien de résultats attendent le réseau. S'ils restent bloqués,
c'est en général l'étape 4.3 qui manque : sans règle d'écriture, Supabase refuse
silencieusement les insertions. Vérifiez dans **Table Editor** que les policies
existent.

**« J'ai tout cassé. »**
GitHub garde chaque version. Onglet **Commits** du dépôt, touchez un état
antérieur, bouton **Revert**. Netlify redéploie la version d'avant en une minute.

---

## L'essentiel en trois lignes

1. On édite sur **GitHub**, jamais ailleurs.
2. On incrémente **`VERSION` dans `sw.js`** à chaque fois.
3. On **exporte le panthéon** avant toute manipulation risquée.
