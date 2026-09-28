/**
 * ─────────────────────────────────────────────────────────────────────
 * Service worker d'ALPHA SALES OS — uniquement les notifications.
 *
 * Ce fichier NE MET RIEN EN CACHE, volontairement. Un service worker qui
 * intercepte les requêtes réseau est la première cause de « j'ai déployé
 * mais je vois l'ancienne version » : il sert de vieux fichiers pendant
 * des jours, et le diagnostic prend une demi-journée à chaque fois. On
 * fait une seule chose, et on la fait bien.
 *
 * Son rôle : recevoir une notification poussée par le serveur alors que
 * l'app est FERMÉE, l'afficher, et ouvrir le bon écran au clic.
 * ─────────────────────────────────────────────────────────────────────
 */

// Prendre la main immédiatement plutôt qu'au prochain démarrage : sinon un
// abonnement créé maintenant ne reçoit rien jusqu'à ce que tous les onglets
// soient fermés.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // Charge illisible : on affiche quand même quelque chose. Une
    // notification muette vaut mieux qu'un silence inexpliqué.
    data = { title: "ALPHA SALES OS", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "ALPHA SALES OS";
  const options = {
    body: data.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    // `tag` remplace la notification précédente du même sujet au lieu d'en
    // empiler cinq : un téléphone avec douze rappels identiques finit en
    // mode silencieux, et on perd tout.
    tag: data.tag || "alpha",
    renotify: Boolean(data.renotify),
    requireInteraction: Boolean(data.requireInteraction),
    data: { url: data.url || "/aujourdhui" },
    actions: data.actions || [],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/aujourdhui";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      // Un onglet déjà ouvert : on le remet devant et on navigue. Ouvrir une
      // deuxième fenêtre de la même app est une faute d'ergonomie.
      for (const client of list) {
        if ("focus" in client) {
          client.navigate(url).catch(() => {});
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
