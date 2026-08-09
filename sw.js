/* Krono — service worker.
   Stratégie : on sert d'abord le cache (démarrage instantané, hors ligne),
   et on rafraîchit en arrière-plan pour la prochaine ouverture.
   Changez VERSION à chaque mise à jour du jeu pour purger l'ancien cache. */
const VERSION = 'krono-v79';
const FICHIERS = [
  './', './index.html', './manifest.json',
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
  if(e.request.method !== 'GET') return;
  // les appels au serveur de salon ne passent jamais par le cache
  if(e.request.url.includes('supabase.co')) return;
  e.respondWith(
    caches.match(e.request).then(cache => {
      const reseau = fetch(e.request).then(rep => {
        if(!rep) return cache;
        // Safari refuse de servir à une navigation une réponse qui a suivi
        // une redirection en interne (typiquement une redirection posée par
        // l'hébergeur) : erreur « Response served by service worker has
        // redirections ». On reconstruit une réponse neuve, sans cet
        // historique, avant de la mettre en cache ou de la renvoyer — le
        // contenu, le statut et les en-têtes restent identiques.
        const propre = rep.redirected ? new Response(rep.body, rep) : rep;
        if(propre.status === 200 && propre.type === 'basic')
          caches.open(VERSION).then(c => c.put(e.request, propre.clone()));
        return propre;
      }).catch(() => cache);
      return cache || reseau;
    })
  );
});
