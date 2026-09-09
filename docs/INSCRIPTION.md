# L'INSCRIPTION — ce qu'un inconnu voit, et ce qu'il reçoit

> **Écrit le 4 septembre 2026**, en réponse à deux questions : « j'ai juste à
> appuyer sur *exiger un compte* et c'est bon ? » et « comment gérer ce qu'il
> voit, et qu'il reçoive le mail de confirmation ».
>
> ⚠ Rien de ce document n'a été vérifié contre un vrai projet Supabase : le
> proxy sortant de ce bac à sable bloque les clés live. Ce qui est corrigé,
> c'est le CODE ; ce qui reste à faire est de la configuration côté tableau de
> bord, et elle se vérifie en s'inscrivant avec une adresse jetable.

---

## 1. NON — le bouton « exiger un compte » n'est pas ce qui ferme le site

C'est le piège, et il a déjà coûté un défaut ici.

| | Ce que c'est | Sur qui ça agit |
|---|---|---|
| **Le bouton dans Réglages** | `settings.security.requireAuth` — un réglage **du navigateur**, rangé dans le `localStorage` | **Toi, sur ce poste.** Personne d'autre |
| **`REQUIRE_AUTH=1` + Supabase, côté serveur** | `verrouDeComptesActif()`, servi par `GET /api/gate` | **Tout le monde**, quel que soit le navigateur |

`AuthGate` ferme sur **l'un OU l'autre** — jamais sur les deux ensemble, c'est
écrit dans le code avec la raison. Donc :

> **Le site est DÉJÀ fermé.** Tu as posé `REQUIRE_AUTH` sur Vercel, tu as
> confirmé `auth.verrou: true` et un 403 en navigation privée. Appuyer sur le
> bouton ne changerait rien pour tes visiteurs — il ne ferme que ton poste.

La vérification qui fait foi reste `GET /api/health` une fois connecté :
`auth.serverEnforced`, `auth.verrou`, `auth.misconfigured`.

---

## 2. LE MAIL DE CONFIRMATION — un défaut de code, et trois réglages

### 2.1 Ce qui était cassé dans le code (corrigé)

`resetPassword` passait un `redirectTo` construit sur l'origine du navigateur.
**`signUp` ne passait rien.** Le lien du mail de confirmation retombait donc
sur la **Site URL** du tableau de bord Supabase, dont la valeur d'usine est
`http://localhost:3000`.

L'inscrit reçoit un mail, clique, et atterrit sur une adresse qui n'existe pas
chez lui. Il ne peut pas confirmer, donc pas se connecter — et de notre côté on
voit un compte créé et jamais confirmé, sans savoir pourquoi.

`signUp` passe maintenant `emailRedirectTo = <origine>/compte`.

### 2.2 Ce qui reste à faire, dans le tableau de bord Supabase

| # | Où | Quoi | Pourquoi ça casse sinon |
|---|---|---|---|
| 1 | Authentication → **Providers → Email** | « Confirm email » **activé** | Sans ça, personne ne confirme rien : n'importe quelle adresse ouvre un compte |
| 2 | Authentication → **URL Configuration → Site URL** | l'URL de production | C'est le repli quand aucune redirection n'est fournie ou autorisée |
| 3 | Authentication → **URL Configuration → Redirect URLs** | ajouter `https://<prod>/**` | **Une URL absente de la liste blanche est IGNORÉE**, et Supabase retombe sur la Site URL. Le correctif du §2.1 ne sert à rien sans cette ligne |
| 4 | Authentication → **SMTP Settings** | **un SMTP à toi** | Voir §2.3 — c'est le point qui décide si tes inscrits reçoivent quoi que ce soit |

### 2.3 ⚠ LE POINT QUI DÉCIDE DE TOUT : le SMTP par défaut n'envoie pas à tes clients

Le service d'email intégré de Supabase est **plafonné à 2 messages par heure**
et **ne délivre qu'aux adresses membres de ton propre projet**. Ce n'est pas
une limite qu'on subit en grandissant : c'est un outil de démonstration.

> **Tel quel, un inconnu qui s'inscrit ne reçoit RIEN.** Pas un mail en retard —
> aucun mail. Et rien ne le signale ni de son côté, ni du nôtre.

Avec un SMTP personnalisé, la limite passe à 30 messages/heure au départ
(réglable dans Rate Limits), puis c'est ton fournisseur qui décide.

> **La procédure complète pour `eagleyecorp.fr` chez Amen.fr — hôte, port,
> SPF, DKIM, DMARC et les pièges qui font échouer ça en silence — vit dans
> [`docs/SMTP-SUPABASE-AMEN.md`](./SMTP-SUPABASE-AMEN.md).**

**Nous avons déjà un SMTP** — `SMTP_HOST/PORT/USER/PASS/FROM`, utilisés par
`/api/send`. Ce sont ces mêmes identifiants qui vont dans Supabase → SMTP
Settings. Attention à deux choses :

- l'adresse d'expédition doit être **sur un domaine que tu contrôles**, avec
  SPF/DKIM/DMARC publiés — sinon les confirmations partent en indésirables, ce
  qui est fonctionnellement identique à ne rien envoyer ;
- les deux usages partagent alors la réputation de la même adresse. Une
  campagne mal ciblée peut faire tomber les mails de confirmation. Une adresse
  distincte (`compte@` vs `contact@`) coûte cinq minutes et évite ça.

### 2.4 Le cas qui trompe, et qu'on ne peut pas supprimer

Avec la confirmation active, **Supabase répond à une inscription sur une
adresse déjà enregistrée exactement comme à une inscription neuve** : un
utilisateur, aucune session, aucune erreur. C'est délibéré de leur part — ça
empêche de deviner qui a un compte chez nous en essayant des adresses.

Notre écran disait « Compte créé — confirme l'email reçu ». C'était faux une
fois sur deux, et ça laissait quelqu'un attendre un mail qui n'arriverait
jamais. Il dit maintenant :

> « Si cette adresse n'a pas déjà un compte, un email de confirmation vient de
> partir. »

Vrai dans les deux cas, et ça ne révèle toujours pas si l'adresse existe.

---

## 3. CE QU'IL VOIT, ÉTAPE PAR ÉTAPE

### 3.1 Le parcours existait, mais il ne regardait pas les droits

`/demarrage` déroule quatre phases — **brancher · charger · lancer · tenir** —
et seize étapes. Il est ouvert à tout le monde (`CHEMINS_COMMUNS`).

**Il les affichait toutes, à tout le monde.** Or un inscrit gratuit ne possède
que `crm · closer · cerveau · pilotage`. Les premières étapes qu'il voyait :

1. brancher le SMTP → une variable d'environnement du **serveur**, qu'il ne
   peut pas poser (il n'existe aucun chemin d'identifiants par locataire) ;
2. publier SPF/DKIM/DMARC → sur **notre** domaine ;
3. brancher l'IA, connecter n8n, armer le webhook entrant → des briques
   **payantes**.

Sa première impression du produit était une liste de courses composée de
portes fermées.

### 3.2 Ce qui a changé

Chaque étape porte désormais le **chemin métier** qu'elle sert, et `buildPath`
interroge `peutOuvrir` — **la même fonction que le middleware**, pas une
deuxième table qui finirait par diverger.

- Compte **gratuit** → il ne voit que les étapes qu'il peut réellement faire :
  charger des prospects, la qualité des fiches, les rendez-vous, le rythme.
- Compte **maître** → tout, comme avant.
- **Droits pas encore chargés** → on ne cache rien. Même optimisme que
  `useDroits` : un parcours qui se vide une seconde au chargement ressemble à
  une panne, et le serveur refuse de toute façon les portes fermées.

### 3.3 On COMPTE ce qui est masqué

Le parcours affiche « *N étapes d'installation ne sont pas affichées : elles
servent des briques que ce compte n'a pas encore* », avec un lien vers
`/compte`.

C'est la doctrine de `/controle`, qui montre le lanceur de campagnes à un
compte gratuit alors que le serveur refusera : **voir la porte fermée vaut
mieux que ne pas savoir qu'elle existe.** Un parcours raccourci sans
explication ferait croire à un produit minuscule.

---

## 4. Le trajet complet d'un inscrit, aujourd'hui

1. Il arrive sur l'URL → `AuthGate` se ferme (le serveur l'exige) → écran de
   connexion, avec « Créer un compte ».
2. Il s'inscrit → Supabase envoie la confirmation **si le §2.3 est fait** →
   l'écran affiche le message conditionnel du §2.4.
3. Il clique le lien → il revient sur `<prod>/compte` **si le §2.2 ligne 3 est
   fait** → session ouverte.
4. `resoudreDroits` ne trouve aucune ligne payante → **socle gratuit**
   (`crm · closer · cerveau · pilotage`). C'est l'invariant : on ne descend
   jamais sous le gratuit, on ne monte jamais sans preuve en base.
5. Il voit `/demarrage` **filtré**, plus le jeu de démonstration.
6. Les écrans payants restent visibles dans le menu et **le serveur refuse**
   (403 `brique_absente`).

---

## 5. Ce qui n'est PAS résolu, et qu'il faut savoir

- **Aucun identifiant par locataire.** `/api/send` lit `SMTP_*` dans
  l'environnement du serveur, `/api/voice/call` lit `LIVEKIT_*`. Tant que ça
  n'existe pas, un acheteur d'Alpha Voice a besoin que Zakaria configure sa
  téléphonie à la main — environ une demi-journée par client. C'est la vraie
  limite de la vente en libre-service, pas l'écran d'inscription.
- **Rien de tout ça n'a été testé contre un vrai projet Supabase depuis ici.**
  Le seul test qui vaut : s'inscrire avec une adresse jetable, en navigation
  privée, sur l'URL de production, et aller jusqu'à voir `/demarrage`.
