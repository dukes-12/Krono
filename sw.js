/* Krono — service worker.
   Stratégie : on sert d'abord le cache (démarrage instantané, hors ligne),
   et on rafraîchit en arrière-plan pour la prochaine ouverture.
   Changez VERSION à chaque mise à jour du jeu pour purger l'ancien cache. */
const VERSION = 'krono-v88'; 
const FICHIERS = [
  '/', '/manifest.json', // Utilisation de chemins absolus pour éviter les redirections Cloudflare
  '/icone-180.png', '/icone-192.png', '/icone-512.png', '/icone-512-maskable.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VERSION)
      .then(c => c.addAll(FICHIERS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // les appels au serveur de salon ne passent jamais par le cache
  if (e.request.url.includes('supabase.co')) return;

  e.respondWith(
    caches.match(e.request).then(cache => {
      
      // Fonction utilitaire pour nettoyer toute réponse (cache ou réseau)
      // On extrait explicitement les propriétés pour purger les métadonnées Safari
      const nettoyerReponse = (rep) => {
        if (!rep) return null;
        return new Response(rep.body, {
          status: rep.status,
          statusText: rep.statusText,
          headers: rep.headers
        });
      };

      const reseau = fetch(e.request).then(rep => {
        if (!rep) return cache ? nettoyerReponse(cache) : null;
        
        const propre = nettoyerReponse(rep);
        
        if (propre.status === 200 && propre.type === 'basic') {
          caches.open(VERSION).then(c => c.put(e.request, propre.clone()));
        }
        return propre;
      }).catch(() => cache ? nettoyerReponse(cache) : null);

      // On NETTOIE le cache avant de le renvoyer, car il a pu être contaminé 
      // par une redirection lors du addAll() à l'installation.
      return cache ? nettoyerReponse(cache) : reseau;
    })
  );
});

