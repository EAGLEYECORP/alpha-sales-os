> 📌 **La liste courte de ce qui est bloqué sur toi vit dans
> `docs/A-FAIRE-ZAKARIA.md`** — ordre imposé, avec la raison de chaque
> dépendance. Ce document-ci est le détail ; celui-là est le chemin.

# Checklist de lancement — ce qui BLOQUE, dans l'ordre

> Ce document dit **quoi faire et dans quel ordre**. Le **comment** (setup
> machine, gabarit `.env.local`, ordre de démarrage des trois process,
> dépannage) est dans `docs/LANCEMENT.md`, qui reste la référence
> opérationnelle. Les deux se lisent ensemble.
>
> Ordre imposé par les dépendances, pas par le confort. Chaque bloc suppose le
> précédent fait. Rien ici n'a été vérifié en conditions réelles : le sandbox
> de développement n'atteint ni Telnyx, ni LiveKit, ni Vercel, ni Supabase.
>
> **Un seul test compte vraiment : un appel réel qui aboutit.** Tout le reste
> peut attendre.

---

## BLOC 0 — Ce qui est déjà brûlé (à faire aujourd'hui, avant tout)

- [ ] **Faire tourner la clé NVIDIA** (deux ont été collées en clair dans une
      conversation).
- [ ] **Faire tourner la clé Fish Audio** (idem).
- [ ] Ne plus jamais coller une clé dans un chat. Les variables passent par
      Vercel → Environment Variables, jamais par un message.

Une clé exposée reste exposée. Tant que ce n'est pas fait, tout le reste
s'appuie sur des secrets compromis.

### L'historique git a été réécrit le 11/09/2026 — ce qu'il reste à faire

Les fiches, téléphones et rendez-vous réels ont été retirés de **tout**
l'historique (`git filter-repo`, 154 motifs présents avant, 0 après). Deux
gestes ne peuvent pas se faire depuis le code :

- [ ] **Ouvrir un ticket au support GitHub** en demandant un `gc` sur le dépôt.
      Un `push --force` rend les anciens commits orphelins ; il ne les
      **supprime pas**. Ils restent servis par SHA et par l'API tant que GitHub
      ne ramasse pas. SHA concernés : `9d32b81` et `13e3c8c`.
      ⚠ Le dépôt est `private` aujourd'hui, 0 fork — le risque est faible
      **maintenant**, et il ne le sera plus le jour où il repasse public.
- [ ] **Re-cloner tout clone local existant**, ne surtout pas `pull`. Un `pull`
      fusionnerait l'ancienne histoire dans la nouvelle et réintroduirait tout
      ce qui vient d'être retiré.

---

## BLOC 0 bis — CETTE SEMAINE : la campagne maîtrise d'ouvrage

> Ajouté le 13/09/2026, et il passe AVANT les autres blocs parce qu'il ne
> dépend d'aucun d'eux. La campagne en cours vise les **maîtres d'ouvrage à
> permis actif**, dont le canal par défaut est **LinkedIn** — un export de
> permis ne porte aucun numéro, et LinkedIn ne demande **ni SMTP, ni DNS, ni
> clé d'API, ni Vercel**. Les messages se copient à la main.
>
> ⚠ **Conséquence à tenir** : tout ce qui suit peut tourner AUJOURD'HUI, sur
> un déploiement qui n'a rien de configuré. Les blocs 1 à 3 restent nécessaires
> pour l'email et pour la voix — ils ne bloquent pas cette campagne-ci.

### Le seul vrai goulot : le carburant

- [ ] **Extraire les permis de Lyon + Villeurbanne** (`data.grandlyon.com`).
      Sans fiches, il n'y a pas de campagne — et c'est la seule étape que
      personne ne peut faire à ma place depuis le sandbox (le proxy bloque ce
      domaine). Voir `docs/PERMIS-LYON.md`.
- [ ] **Importer**, puis lire le compte rendu de tri : `lirePermis` sépare les
      **retenus**, les **hors zone** (« refiltre à la source ») et les « rien à
      vendre » (particuliers, bailleurs, collectivités — fonctionnement normal).
      Un lot qui sort majoritairement hors zone veut dire que l'export était
      métropolitain, pas que le tri est cassé.
- [ ] **Relever les téléphones à la main** — troisième colonne. Un export n'en
      porte aucun, et poser « tel » sans numéro ferait entrer la fiche dans la
      file d'appels où elle resterait muette.

### Ce qui part cette semaine, et dans quel ordre

- [ ] **LinkedIn d'abord** (`/linkedin`) : la file, le message, copié à la
      main. Aucune dépendance serveur. ⚠ `/linkedin` porte le bandeau
      d'identité d'usine — **vérifier que Réglages → Agence porte ta raison
      sociale et ton nom**, sinon l'invitation part signée « Le Closer ».
- [ ] **Les appels ensuite** (`/appels`, la liste du matin), depuis ton
      téléphone. Chaque résultat consigne une touche réelle dans le CRM : c'est
      cette trace qui rendra les chiffres de fin de semaine mesurables.
- [ ] **L'email seulement si le BLOC 2 est fait.** Sans SMTP ni SPF/DKIM, les
      messages partent et n'arrivent pas, sans qu'aucune alerte ne remonte.
      Mieux vaut zéro email que des emails invisibles.

### Ce qui décide de l'angle, et qu'on se trompe à ignorer

- [ ] **Ne rien vendre à un permis en recours (< 2 mois)** : se faire connaître,
      c'est tout. La fenêtre qui convertit est la **pré-commercialisation
      (2–12 mois)**.
- [ ] **Sous 6 logements : ne pas proposer l'OS.** 10 000 € sur trois lots est
      une part indécente du budget de commercialisation — c'est **Alpha Voice
      seul** qui se propose là.
- [ ] **Ne jamais dire « vous ratez des appels »** à un maître d'ouvrage. C'est
      faux sur ce métier et ça prouve qu'on ne l'a pas compris. Sa perte, ce
      sont des **acquéreurs déjà rencontrés que personne n'a rappelés**.

### Pour que les « résultats financiers » veuillent dire quelque chose

- [ ] **Saisir le montant sur toute affaire signée**, et marquer les paiements
      `payé` quand ils tombent. Sans ça, `/compte` et `/payouts` n'ont rien à
      mesurer — et la part sur le résultat (`lib/part-resultat.ts`) rend `null`
      plutôt qu'un chiffre inventé. C'est voulu, mais ça veut dire qu'un
      encaissement non saisi est un encaissement invisible.
- [ ] **Lire `/preuves` et `/kpis` en fin de semaine**, pas un tableur. Les taux
      y sortent avec leur dénominateur et leur intervalle — un taux nu sur
      douze touches ne dit rien.

---

## BLOC 1 — L'appel qui prouve que ça existe

Sans ça, Alpha Sales OS est un logiciel de gestion. Avec ça, c'est un produit.

- [ ] Poser `VOICE_WEBHOOK_SECRET` (sinon la salle de contrôle affiche
      « journal d'appels : non autorisé » — c'est visible sur la capture).
- [ ] Vérifier le trunk Telnyx → `5mwzznpudte.sip.livekit.cloud`, port 5060 UDP.
      ⚠ Le préfixe SIP LiveKit est **aléatoire**, ce n'est PAS le slug du
      projet — c'est le bug qui a coûté le plus de temps.
- [ ] **Passer UN appel entrant réel** sur `+33451222182`. Écouter la première
      phrase : elle doit annoncer l'IA (art. 50), prononcée par le code.
- [ ] **Passer UN appel sortant réel**, sur ton propre numéro d'abord.
- [ ] Tirer l'**export CDR Telnyx** (Reporting → Usage Reports) et reporter le
      tarif minute réel dans `lib/voice-costs.ts` (`telnyx`). Seule ligne du
      modèle jamais vérifiée, et la plus lourde. Ce qu'on sait depuis le
      27/08 : 2,05 $ dépensés sur le mois dont ~1 $ de numéro — un PLAFOND,
      pas un tarif. Selon le volume réel, ça vaut de 0,018 à 0,35 $/min, soit
      ×1,5 à ×29 l'hypothèse. L'écart décide de la marge.
- [ ] Relever le **compteur Fish AVANT et APRÈS un appel isolé** (30 s de
      travail). Fish a été mesuré à ×2,24 l'hypothèse — 4 922 octets pour
      ~3 min, soit plus de parole que l'appel n'a duré. La piste « on paie de
      la synthèse jamais entendue » est **écartée** : `livekit-agents` 1.7.1
      a `preemptive_tts: False` par défaut et l'agent ne le surcharge pas.
      Reste le compteur cumulé sur plusieurs essais — auquel cas le coût réel
      est plus BAS que ce que le modèle retient, et la marge meilleure.

**Ne rien facturer avant ce bloc.** Le tier gratuit NVIDIA interdit
contractuellement l'usage de production ; conduire des transactions
commerciales dessus nous met en infraction. Le modèle de coût retient déjà un
LLM payant, c'est le seul chiffrage honnête.

- [ ] Migrer le LLM vers une offre payante avant la première facture.

---

## BLOC 2 — Le déploiement

- [ ] DNS chez Amen → Vercel.
- [ ] `SITE_PASSWORD` posé. ⚠ **Il ne mure plus l'app entière** (décision du
      27/08) : il garde `ADMIN_PREFIXES` — `/payouts`, `/offre`, `/api/sync` —
      et tout le reste TANT QUE la serrure de remplacement n'est pas en place.
      `/vitrine`, `/souscrire`, `/sw.js`, le manifeste et les crons sont
      publics par conception.
- [ ] **Les quatre variables qui décident de tout**, à poser ensemble :
      `OWNER_EMAILS` et `NEXT_PUBLIC_OWNER_EMAILS` (**la même valeur** — si
      elles divergent, l'écran promet ce que le serveur refuse), plus
      `REQUIRE_AUTH=1` et `SUPABASE_JWT_SECRET`. Sans ces deux dernières, le
      mur ne se lève jamais et tes clients restent dehors **sans erreur
      visible**. Réglages → État système → **Compte propriétaire** le dit.
- [ ] Variables d'environnement : toutes documentées dans `.env.example` (un
      test le vérifie). Utiliser **Réglages → État système**, qui liste
      exactement ce qui manque sur CETTE instance.
      > ⚠ Cette ligne annonçait « il y en a **63** » avec « un test le
      > vérifie » accolé. Le test vérifie qu'elles sont **documentées**, pas
      > combien il y en a — et le compte réel était passé à 66. Un compteur
      > figé dans une doc dérive en silence : `tests/docs-chiffres.test.ts`
      > existe précisément pour refuser ceux-là. On nomme l'écran qui compte,
      > jamais le nombre du jour.
- [ ] `CRON_SECRET` + appliquer `supabase/migrations/004-ordonnanceur.sql`,
      qui planifie `/api/campaign/tick` et `/api/push/tick` via `pg_cron` +
      `pg_net`. ⚠ Sans `CRON_SECRET`, ces routes **refusent tout** — c'est
      voulu, mais rien dans la réponse ne le relie au réglage. Le secret se
      pose dans le **Vault** Supabase (`alpha_cron_secret`), jamais dans le
      SQL versionné, et il doit être **identique** à la variable Vercel.
      ⚠⚠ **Pas de Vercel Cron** : il émet des `GET`, or ces routes réservent
      le `GET` au statut en lecture seule. Un cron Vercel rendrait 200 sans
      jamais rien exécuter.
- [ ] Appliquer `supabase/migrations/005-presence-agent.sql`, puis poser
      `ALPHA_APP_URL` et `CRON_SECRET` dans l'environnement de l'agent vocal.
      ⚠ Sans battement, l'autopilote REFUSE de composer — c'est voulu : un
      appel sans agent sonne dans le vide et brûle la fiche. Vérifier avec
      `GET /api/voice/presence` → `etat: "vivant"`.
- [ ] Après application : relire `cron.job_run_details` (requête en bas de la
      migration). Un job **planifié** n'est pas un job qui **réussit** — des
      401 ou 412 en boucle veulent dire que le Vault et l'environnement ne
      concordent pas, et rien d'autre ne te le dira.
- [ ] `CALENDAR_TOKEN` pour le flux iCal.
- [ ] `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` pour les notifications.
- [ ] Vérifier que `/vitrine` est bien indexable et que l'app ne l'est pas.

---

## BLOC 3 — Les tables Supabase

Le SQL existe désormais en MIGRATIONS. ⚠ `supabase/schema.sql` est en
`create table if not exists` : sur une base déjà créée **il ne fait rien**, et
le SQL Editor annonce quand même « Success ». Passe les migrations.

- [ ] `supabase/migrations/001-proprietaire-et-tables-serveur.sql` —
      crée `propositions`, `call_sessions`, `push_subscriptions` et corrige
      `prospects.user_id`. Sans `call_sessions`, la salle de contrôle reste
      muette ; sans `push_subscriptions`, aucune notification hors-app.
- [ ] `supabase/migrations/002-entitlements.sql` — crée `entitlements`, la
      table que le middleware interroge à CHAQUE requête. **Sans elle, un
      client paie et l'application le refuse** : le webhook enregistre
      l'abonnement, le middleware ne trouve aucun droit, `DROIT_REFUSE`.
      ⚠ À passer AVANT de poser `REQUIRE_AUTH` : dès que les comptes sont
      actifs, tout compte non provisionné est refusé — y compris le tien si
      `OWNER_EMAILS` n'est pas posé.
- [ ] `supabase/migrations/003` à `007` — organisation, ordonnanceur,
      présence de l'agent, rendez-vous cloisonnés, attribution apporteurs.
- [ ] `supabase/migrations/008-essai-plafond-cout.sql` — **ajoutée le
      13/09/2026**. Elle pose `cout_consomme_eur` sur `entitlements` : c'est la
      SECONDE limite de l'essai 30 jours. Sans elle, `etatEssai()` lit `null`,
      **ferme l'essai en permanence**, et tout essai retombe au socle gratuit
      le premier jour. (Défaut `null` et non `0` : `0` affirmerait « rien
      consommé » sur une colonne jamais alimentée.)
- [ ] `prospects` — **c'est un RÉGLAGE, pas un chantier.**
      Aller dans **Réglages → Synchronisation Supabase** et l'activer.
      `settings.supabaseSync` vaut `false` par défaut ; tant qu'il est éteint,
      `/api/campaign/tick` tourne à vide en renvoyant `ok: true`.
      > ⚠⚠ **CETTE LIGNE DISAIT L'INVERSE**, et je l'ai répétée telle quelle :
      > « elle est lue par l'autopilote et remplie par personne… c'est un
      > chantier, pas un réglage ». C'était vrai quand ça a été écrit. La
      > chaîne est complète depuis : moteur monté dans la coquille
      > (`components/sync-moteur.tsx`, poussée après 8 s de silence +
      > `sendBeacon` au `pagehide`), route `/api/sync/prospects` qui écrit,
      > `lib/lecture-serveur.ts` qui relit sous le même propriétaire, forme de
      > ligne unique (`ligneProspect` / `prospectDepuisLigne`) tenue par
      > `tests/sync-prospects.test.ts`.
      >
      > Le message d'erreur de `/api/campaign/tick` portait la même phrase
      > périmée et envoyait **construire ce qui existe**. Une prose qui dérive
      > du code ne casse rien — elle ment à l'endroit précis où quelqu'un vient
      > chercher quoi faire, et ici elle coûtait plusieurs jours de chantier
      > inutile.
- [ ] Vérifier après activation : la carte de Réglages doit passer à
      **« à jour »**. « jamais synchronisé » et « erreur » sont deux états
      distincts et demandent deux gestes différents — ne pas les confondre.

---

## BLOC 3 bis — OUVRIR LES INSCRIPTIONS (avant tout post public)

Le socle est gratuit et l'inscription est libre. Mais **tant que ce bloc n'est
pas fait, un inconnu qui s'inscrit ne reçoit RIEN** — le service d'email intégré
de Supabase est plafonné à **2 messages/heure** et ne délivre **qu'aux adresses
membres du projet**. Ce n'est pas un mail en retard : c'est aucun mail, et rien
ne le signale ni de son côté ni du nôtre.

Un lancement ne se fait qu'une fois. Vingt inscrits qui ne peuvent pas
confirmer, ce sont vingt contacts brûlés et un post qu'on ne rejoue pas.

- [ ] Supabase → **Authentication → Providers → Email** : « Confirm email »
      **activé**. Sans ça, n'importe quelle adresse ouvre un compte.
- [ ] Supabase → **URL Configuration → Site URL** = l'URL de production. C'est
      le repli quand aucune redirection n'est fournie ou autorisée.
- [ ] Supabase → **URL Configuration → Redirect URLs** : ajouter
      `https://alphasalesos.eagleyecorp.fr/**`. ⚠ **Une URL absente de cette
      liste est IGNORÉE** et Supabase retombe sur la Site URL — le lien de
      confirmation part alors vers `localhost`, et l'inscrit clique dans le
      vide sans aucun moyen de comprendre.
- [ ] Supabase → **SMTP Settings** : poser NOTRE SMTP (les mêmes `SMTP_*` que
      `/api/send`), sur **`contact@eagleyecorp.fr`**.
      > ⚠⚠ **CETTE LIGNE DISAIT L'INVERSE**, et elle avait raison sur le fond :
      > une adresse distincte de celle des campagnes évite qu'un envoi mal
      > ciblé fasse tomber les mails de confirmation avec lui.
      >
      > La décision du 10/09/2026 assume ce risque, pour une raison qui pèse
      > plus lourd aujourd'hui : la boîte séparée n'existe pas, et attendre
      > qu'elle existe bloque tout. `contact@` existe, elle est LUE, et un
      > `noreply@` en expéditeur de prospection est de toute façon une mauvaise
      > pratique.
      >
      > **Ce qui rend le risque tenable** : la montée en charge de
      > `lib/email-ramp.ts` — 5 envois/jour la première semaine, appliquée par
      > le SERVEUR depuis le 10/09, donc sur tous les appelants. ⚠ Une
      > newsletter plus large que le palier sera coupée au palier : c'est le
      > comportement voulu. Et la séparation reste au programme :
      > [`SMTP-SUPABASE-AMEN.md`](./SMTP-SUPABASE-AMEN.md).
- [ ] **Redéployer SANS cache.** Les `NEXT_PUBLIC_*` sont figées au moment du
      build : les poser ne suffit pas, il faut reconstruire.
- [ ] **LE TEST QUI FAIT FOI** : s'inscrire avec une adresse jetable, en
      navigation privée, sur l'URL de production, et aller jusqu'à voir
      `/demarrage`. Tant que ce test n'est pas passé, le reste est une
      hypothèse. Détail complet : [`INSCRIPTION.md`](./INSCRIPTION.md).

### Où envoyer le trafic

- [ ] **`https://alphasalesos.eagleyecorp.fr/vitrine`** — et pas la racine.
      ⚠ La racine `/` est l'APPLICATION : elle est dans `CHEMINS_COMMUNS`, le
      middleware la laisse passer, et `AuthGate` la referme côté navigateur. Un
      visiteur qui arrive par le domaine nu tombe donc sur **une boîte de
      connexion**, sans une ligne expliquant ce qu'est le produit. `/vitrine`
      porte la carte d'essai dans son premier écran et mène à l'inscription.

## BLOC 4 — La première vente

Rien de technique ici, et c'est le bloc qui compte.

- [ ] ~~**Envoyer le devis du revendeur**~~ — **caduc, accord terminé**. ⚠ Ce qui suit reste vrai pour tout devis : le devis
      historique est 3 500 € + 364 €/mois, mais la grille publique propose
      désormais un **essai terrain à 290 € HT** (mise en route + 100 appels
      réels, déduits du 1er mois). Le parcours recommandé dans
      `docs/PRICING.md` est démo gratuite → essai payant → mensualité — c'est
      l'essai qui donne le premier taux de décroché mesuré, celui qui remplace
      l'hypothèse à 20 % dans toute l'app. Décide lequel part, mais décide.
- [x] ~~**Dépôt French Tech** — échéance 2026-09-04 23:59~~ — **NON RECEVABLE**,
      vérifié le 03/09/2026 par deux recherches indépendantes : le seuil
      d'éligibilité est de **3 000 000 €** de financements et/ou de chiffre
      d'affaires cumulés depuis le 1er janvier 2024, plus TRL 6 minimum. Nous
      sommes à 0 €. Ce n'est pas « refusé de peu », c'est écarté à la première
      ligne du filtre. Les huit heures prévues n'ont pas d'objet — le
      raisonnement complet et les guichets réellement ouverts sont dans
      [`DOSSIER-FRENCH-TECH-2030.md`](./DOSSIER-FRENCH-TECH-2030.md) et
      [`FINANCEMENTS.md`](./FINANCEMENTS.md).
> ⚠⚠ **CE BLOC POINTAIT ENCORE SUR LE MARCHÉ D'AVANT.** La cible a changé le
> 09/09/2026 — **le maître d'ouvrage professionnel à permis de construire
> actif, sur Lyon et Villeurbanne** (`lib/permis-construire.ts`) — et ce
> document, qui est le seul à dire quoi faire ensuite, continuait d'envoyer
> vers les garages et auto-écoles de juillet. Le pipe de juillet reste
> travaillable (il existe, il est chaud), mais ce n'est plus là que se
> construit la suite.

**Les trois marches qui manquent, et aucune n'est du code** — elles sont dans
cet ordre parce que chacune dépend de la précédente :

- [ ] **Extraire les permis Lyon + Villeurbanne.** Les arrêtés sont publics et
      datés. Sans cette liste, tout le module de ciblage tourne sur un jeu de
      démonstration. ⚠ Le sandbox de développement n'atteint pas
      `data.grandlyon.com` — c'est un geste qui se fait de ton côté.
- [ ] **Relever les téléphones à la main.** Un export de permis n'en porte
      **aucun** : c'est la troisième colonne, celle qu'Alpha ne fait pas et
      l'assume (`docs/PERMIS-LYON.md`). Le canal par défaut reste **LinkedIn**
      tant que le numéro n'est pas relevé — mettre « tel » sur une fiche muette
      la fait entrer dans la file d'appels où elle ne sonnera jamais.
- [ ] **Appeler, et écrire ce qui a été dit.** C'est ce qui remplace les trois
      hypothèses non mesurées (décroché 30 %, intérêt qualifié 20 %, tarif
      minute) et les seuils décidés sans mesure (6 logements, score 55, poids
      par phase).

- [ ] Et **un** prospect du pipe de juillet, closé. Un seul. Il est déjà chaud.

**Zéro vente à ce jour.** Et zéro permis converti. Une suite de tests complète,
et aucun euro. Tout ce qui est construit est une hypothèse tant que ce bloc
n'est pas entamé — le code n'a jamais été le facteur limitant.

---

## BLOC 5 — Avant de facturer un CLIENT de l'OS

À ne faire qu'après le bloc 4.

- [ ] Tester à **deux comptes réels** : un client mono-brique, un maître.
      Le test qui compte n'est **pas** la navigation, c'est un `fetch` direct
      vers une API interdite → doit renvoyer 403.
- [x] ~~Brancher le webhook Stripe sur `entitlements.bricks`~~ — **fait le
      27/08**. Le webhook provisionne les droits à l'encaissement (et
      seulement à l'encaissement), et les REFERME à la résiliation. Reste à
      le prouver sur un vrai compte Stripe : `docs/FACTURATION.md`, étape 4,
      qui vérifie LES DEUX tables et la résiliation.
- [ ] Créer les **six** prix Stripe (`STRIPE_PRICE_VOIX_ESSENTIEL`,
      `_VOIX_INTENSIF`, `_OMNICANAL`, `_VOIX_1000`, `_BUSINESS`, `_LIFETIME`).
      ⚠ `_LIFETIME` est un paiement **UNIQUE** : le créer en récurrent
      prélèverait tous les mois quelqu'un qui croyait payer une seule fois.
- [ ] **Archiver** `STRIPE_PRICE_SOLO` et `STRIPE_PRICE_PRO` dans le tableau de
      bord Stripe : les offres sont retirées de la grille (« solo » facturait un
      périmètre devenu gratuit). Les retirer du code les rend inatteignables
      depuis l'app ; ça n'annule aucun abonnement déjà en cours.
      ⚠⚠ `_BUSINESS` est l'inverse : c'est un abonnement d'étalement qui doit
      **s'arrêter après 10 prélèvements**, sinon les 800 € continuent en plus
      de l'abonnement de 1 000 € qui prend le relais.
- [ ] **Ce qu'on peut vendre** : « accès limité à ce que tu as payé ».
      **Ce qu'on ne peut pas encore promettre** : « le code des autres briques
      t'est invisible ». Le JavaScript reste téléchargeable — le serveur
      refuse la donnée et l'action, pas la lecture de l'interface.
- [ ] Décider si le découpage du bundle par brique vaut le chantier.

---

## Les limites connues, à dire plutôt qu'à découvrir

| Limite | Où ça casse |
|---|---|
| **~500 fiches** | la frappe dans les Notes devient perceptible |
| **~1 500 fiches** | quota localStorage → les écritures échouent (une alerte s'affiche, rien n'est perdu en silence) |
| **2 000 prospects** | l'autopilote tronque — il le dit maintenant dans sa réponse |
| **400 leçons** | plafond de la mémoire de terrain ; au-delà, les plus anciennes partent |

Le correctif de fond — sortir les prospects de localStorage vers Supabase —
n'a de sens qu'après les premières ventes.

---

## Ce qui est prêt et qui n'attend rien

Pour mémoire, parce que la liste ci-dessus donne une impression sombre :

- **Chaque garde-fou vérifié par MUTATION** — on casse la
  garde, on confirme que le test échoue, on restaure ;
- **le tunnel de vente complet** : `/vitrine` → `/souscrire` → compte →
  paiement Stripe → encaissement → ouverture des droits → onboarding daté →
  résiliation qui referme. Chaque maillon a été cassé et retesté ;
- la doctrine tenue **par construction** — le générateur de présentation ne
  peut pas produire un prix avant l'étape offre ;
- l'article 50 prononcé par le code, et `audit_script` qui refuse un script
  non conforme ;
- aucune dépendance tierce sur les briques qui touchent la donnée métier —
  ce qui reste à auditer, c'est notre propre code ;
- la grille tarifaire, les données de prospects réels et l'économie du
  portefeuille **hors** des bundles navigateur (mesuré sur le build) — ET
  hors de portée d'un client connecté depuis le 27/08 : `/api/pipeline`,
  `/api/voice-costs` et `/api/knowledge` sont réservés au compte maître, ce
  qui n'était pas le cas (une brique `crm` suffisait à charger nos fiches
  réelles) ;
- un **taux horaire** relevé sur le marché (71 €/h, TJM 500 €), qui débloque
  le chiffrage des dix briques et de tout devis de setup.
