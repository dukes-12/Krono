# Krono — activer le mode en ligne

Le jeu fonctionne parfaitement sans rien de tout ça. Ce guide sert uniquement à
ajouter **les salons** : un code à cinq lettres que plusieurs téléphones partagent
pour alimenter un classement commun.

Tant que les deux clés du fichier `index.html` restent vides, aucune ligne de
réseau ne s'exécute et l'interface ne montre rien de tout ceci.

Comptez trente minutes. Aucun code à écrire — que du copier-coller.

---

## 1. Créer le projet Supabase

1. Allez sur `supabase.com`, créez un compte gratuit.
2. **New project**. Nom : `krono`. Choisissez une région en Europe (Frankfurt ou
   Paris) : plus le serveur est proche, plus les classements se chargent vite.
3. Notez le mot de passe de base de données qu'il vous demande. Vous n'en aurez
   pas besoin ici, mais le perdre est pénible.
4. Attendez deux minutes que le projet se provisionne.

Le niveau gratuit couvre très largement un usage entre amis : 500 Mo de base et
5 Go de trafic mensuel, là où une partie pèse quelques centaines d'octets.

---

## 2. Créer les tables

Dans le menu de gauche : **SQL Editor** → **New query**. Collez ce bloc en entier,
puis **Run**.

```sql
-- un salon = un code à cinq lettres
create table salons (
  code       text primary key,
  cree_le    timestamptz not null default now()
);

-- une ligne par joueur et par partie terminée
create table resultats (
  id       bigint generated always as identity primary key,
  salon    text not null references salons(code) on delete cascade,
  pseudo   text not null,
  mode     text,
  config   text,
  tours    int  not null default 0,
  somme    int  not null default 0,
  biais    int  not null default 0,
  carres   bigint not null default 0,
  piles    int  not null default 0,
  gorgees  int  not null default 0,
  culs     int  not null default 0,
  points   int  not null default 0,
  cree_le  timestamptz not null default now()
);

create index resultats_salon_idx on resultats (salon, config);
```

---

## 3. Poser les règles d'accès

C'est l'étape que tout le monde saute et qui fait les fuites de données. Sans
elle, n'importe qui peut vider vos tables.

Nouvelle requête SQL, collez, **Run** :

```sql
alter table salons    enable row level security;
alter table resultats enable row level security;

-- tout le monde peut lire et écrire…
create policy lire_salons   on salons    for select using (true);
create policy creer_salons  on salons    for insert with check (true);
create policy lire_result   on resultats for select using (true);
create policy ecrire_result on resultats for insert with check (true);

-- …mais personne ne peut modifier ni effacer.
-- Un score publié devient immuable : aucun joueur ne peut effacer le record
-- d'un autre, même en bidouillant la console de son navigateur.
```

Vérifiez ensuite dans **Authentication → Policies** que les deux tables affichent
bien « RLS enabled ».

---

## 4. Récupérer les deux clés

**Project Settings** (roue dentée) → **API**. Deux valeurs à copier :

| Champ affiché | Ce que c'est |
|---|---|
| **Project URL** | `https://xxxxxxxx.supabase.co` |
| **anon public** | une longue chaîne commençant par `eyJ...` |

⚠️ Prenez bien la clé **anon public**. Il existe une clé `service_role` juste en
dessous : elle contourne toutes les règles de sécurité et ne doit **jamais**
sortir d'un serveur.

La clé `anon` est publique par conception. Elle vivra dans votre HTML, visible de
tous, et c'est normal : ce sont les règles de l'étape 3 qui protègent les données,
pas le secret de la clé.

---

## 5. Renseigner les clés dans le jeu

Ouvrez `index.html` dans un éditeur de texte. Tout en haut du bloc `<script>`,
une quinzaine de lignes après le début, vous trouverez :

```js
const SUPABASE_URL = '';   // ex. https://abcdefgh.supabase.co
const SUPABASE_KEY = '';   // la clé « anon public », pas la clé service
```

Collez vos deux valeurs entre les guillemets :

```js
const SUPABASE_URL = 'https://abcdefgh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6...';
```

---

## 6. Redéployer

Changez `VERSION` dans `sw.js` (par exemple `krono-v21`), puis déposez le dossier
sur l'onglet **Deploys** de votre site Netlify existant — pas sur la page Drop,
qui créerait un site neuf avec une nouvelle adresse et un panthéon local vide.

---

## 7. Vérifier que ça marche

1. Ouvrez le jeu. Un bloc **Salon en ligne** est apparu dans le menu.
2. **Créer un salon** → un code à cinq lettres s'affiche.
3. Jouez une partie courte et terminez-la.
4. Dans Supabase, **Table Editor → resultats** : vos lignes doivent y être.
5. Panthéon → **Panthéon du salon** : le classement s'affiche.

Sur un deuxième téléphone : menu → **Rejoindre**, saisir le code. Les deux
appareils alimentent désormais le même classement.

---

## Ce qu'il faut savoir

**Le code de salon est le seul mot de passe.** Qui le connaît peut publier dedans.
Pour un groupe d'amis, c'est le bon compromis : zéro friction, zéro compte à créer.
Ne l'affichez pas sur les réseaux sociaux.

**La triche est possible.** Le score est calculé sur le téléphone, donc n'importe
qui sachant ouvrir une console peut publier 9 999 points. Un classement mondial
serait mort-né ; un classement entre gens qui se voient fonctionne très bien —
la pression sociale fait le travail.

**Sans réseau, rien ne casse.** Les résultats attendent dans une file locale et
repartent au lancement suivant. Le menu indique combien sont en attente.

**Données personnelles.** Vous ne stockez qu'un prénom saisi librement et des
statistiques de jeu. Pas de mail, pas d'identifiant d'appareil, pas de
géolocalisation. C'est volontairement minimal : moins vous collectez, moins vous
avez d'obligations.

**Pour supprimer un salon** et tout ce qu'il contient, une requête SQL suffit :

```sql
delete from salons where code = 'ABCDE';
```

Les résultats associés partent avec, grâce au `on delete cascade`.
