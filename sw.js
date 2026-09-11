/* Krono — service worker.
   Stratégie : on sert d'abord le cache (démarrage instantané, hors ligne),
   et on rafraîchit en arrière-plan pour la prochaine ouverture.
   Changez VERSION à chaque mise à jour du jeu pour purger l'ancien cache. */
const VERSION = 'krono-v200';
const FICHIERS = [
  './', './index.html', './style.css', './script.js', './manifest.json',
  './icone-180.png', './icone-192.png', './icone-512.png', './icone-512-maskable.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FICHIERS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // « event » n'existe pas dans un service worker (ce n'est pas window) :
  // cette vérification levait une ReferenceError à chaque requête, avant
  // même d'atteindre respondWith() plus bas — la stratégie cache-d'abord
  // de tout ce fichier restait donc silencieusement inerte à chaque
  // requête, y compris celles qu'on voulait précisément éviter d'intercepter.
  if (e.request.url.includes('google-analytics.com') || e.request.url.includes('googletagmanager.com')) {
    return; // Laisse la requête passer normalement sans l'intercepter
  }
  if(e.request.method !== 'GET') return;
  // les appels au serveur de salon ne passent jamais par le cache
  if(e.request.url.includes('supabase.co')) return;
  e.respondWith(
    caches.match(e.request).then(cache => {
      const reseau = fetch(e.request).then(rep => {
        if(!rep) return cache;
        // Safari (particulièrement les PWA installées sur l'écran d'accueil)
        // refuse parfois de servir à une navigation une réponse portant des
        // métadonnées de redirection internes, même absentes du drapeau
        // .redirected — erreur « Response served by service worker has
        // redirections ». On reconstruit systématiquement une réponse neuve
        // avant de la mettre en cache ou de la renvoyer, plutôt que de ne le
        // faire que dans le cas déjà identifié : le contenu, le statut et
        // les en-têtes restent identiques, le coût est négligeable.
        const propre = new Response(rep.body, rep);
        if(propre.status === 200 && propre.type === 'basic')
          caches.open(VERSION).then(c => c.put(e.request, propre.clone()));
        return propre;
      }).catch(() => cache);
      return cache || reseau;
    })
  );
});

/* ════════ NOTIFICATIONS PUSH ════════
   La charge envoyée par notifier-push (edge function) est du JSON simple :
   {titre, texte, url}. « url » rouvre l'app au bon endroit — pour un défi,
   c'est le même lien ?duel=CODE que le partage de code gère déjà (voir
   lireInvitation() dans script.js), pas un mécanisme séparé à entretenir. */
self.addEventListener('push', e => {
  let d = {};
  try{ d = e.data ? e.data.json() : {}; }catch(err){ d = {titre:'Krono', texte:e.data ? e.data.text() : ''}; }
  const titre = d.titre || 'Krono';
  e.waitUntil(self.registration.showNotification(titre, {
    body: d.texte || '',
    icon: './icone-192.png',
    badge: './icone-192.png',
    data: {url: d.url || './'}
  }));
});

// un clic ramène sur un onglet déjà ouvert plutôt que d'en empiler un nouveau
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(
    self.clients.matchAll({type:'window', includeUncontrolled:true}).then(liste => {
      for(const c of liste){
        if('focus' in c){ c.navigate(url); return c.focus(); }
      }
      return self.clients.openWindow(url);
    })
  );
});
