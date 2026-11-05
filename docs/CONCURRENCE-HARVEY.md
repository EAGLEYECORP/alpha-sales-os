# Harvey (ethanplusai/harvey) — lu le 05/11/2026, code cloné en lecture seule

Vu par Zakaria sur Instagram (« bro we're getting fucked »). Lu dans le dépôt, pas dans la pub.

## Ce que c'est, vérifié
- **MIT, Python, ~150 fichiers, ~59 000 lignes**, dernier commit le 01/11/2026. Agent de
  prospection par email qui tourne **sur la machine de l'utilisateur**, en boucle (15 min),
  décision **déterministe** (pas de modèle pour choisir quoi faire) — notre doctrine, mot pour mot.
- **Modèle payé par l'abonnement Claude / ChatGPT de l'utilisateur** (CLI `claude` / `codex`),
  pas de clé d'API. Sources : OpenStreetMap gratuit (couverture faible, ils le disent), Google Maps
  payant. Boîte Gmail / M365 / SMTP. Tableau de bord local.
- **Par défaut, rien ne part sans approbation** (outbox à valider). Opt-out reconnu (anglais,
  hébreu, espagnol), liste noire, coupe-circuit sur rebonds.
- **Marché : les États-Unis et les petits commerces locaux** (CAN-SPAM, TCPA). RGPD traité en un
  paragraphe + un service tiers (Precleared). **Pas d'EU AI Act** : l'IA se déclare *si on lui
  demande* — l'art. 50 exige qu'elle se déclare d'elle-même. Pas de registre français, pas de
  BODACC, pas du décret 2022-1313, pas de français dans l'opt-out. **Pas de voix sortante**, et
  c'est un choix assumé (FCC 24-17).

## Ce que ça change pour nous, sans fard
- **Le logiciel de prospection par email devient une commodité gratuite.** Notre « en ligne,
  gratuit » n'a plus d'avantage de prix ; notre « chez vous » à 10 000 € n'est plus défendable
  sur le CODE devant un acheteur qui sait ouvrir un terminal. Il ne l'est que sur le SERVICE.
- **Ce qu'ils n'ont pas et qui est à nous, vérifiable** : sans installation (navigateur) ·
  français de bout en bout · registre de l'État + annonces légales · divulgation IA d'office
  (art. 50) et dossier falsifiable · plafonds du décret · voix (ALPHA VOICE) · installation faite
  par un humain. **Leur avance** : ~4 000 étoiles, finition, communauté, et ils pourraient
  ajouter le français vite.
- **Leur preuve sociale n'est pas des ventes non plus** : des étoiles. Le vrai écart, des deux
  côtés, reste le premier client.

## À reprendre (idées, pas du code — Python, et aucune dépendance)
- Le **contrôle par destinataire avant le premier envoi** (pays, statut juridique) avec un
  verdict qui RETIENT l'email : chez nous, ça s'appuierait sur le SIREN déjà lu.
- Le **coupe-circuit global sur taux de rebond**.
- La phrase « Harvey dit dans l'écran quand la source est mince plutôt que de sous-livrer en
  silence » : déjà notre règle (`null` ≠ `0`).
