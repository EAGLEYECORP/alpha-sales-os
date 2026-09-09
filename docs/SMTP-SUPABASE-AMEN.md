# SMTP Supabase avec Amen.fr — `eagleyecorp.fr`

> **Ce que ça débloque** : les emails de confirmation d'inscription. Sans ça,
> le SMTP intégré de Supabase ne délivre qu'à toi, deux messages par heure —
> donc **personne ne peut créer de compte**, et rien ne le signale.
>
> Références : [SMTP Amen](https://www.amen.fr/support/configuration-compte-email-logiciel-client/)
> · [SPF Amen](https://www.amen.fr/help/mise-en-place-du-spf-amen/)
> · [DKIM Amen](https://www.amen.fr/help/activation-du-dkim/)

---

## LA CHECKLIST — dans cet ordre, et l'ordre compte

> Coche au fur et à mesure. Chaque ligne dit **où** cliquer et **comment savoir
> que c'est fait** — une étape « faite » qu'on ne peut pas vérifier n'est pas
> faite.

### Chez Amen — la boîte
- [ ] **Créer `noreply@eagleyecorp.fr`** — Espace client → `eagleyecorp.fr` →
      services associés → **EMAIL** → créer une boîte.
      ⚠ Une **vraie boîte**, pas un alias : un alias n'a pas de mot de passe,
      donc pas d'authentification SMTP possible.
- [ ] **Noter le mot de passe** quelque part de sûr, maintenant.
      Supabase le chiffre à l'enregistrement et ne le réaffiche **jamais**.
- [ ] *Vérif* : se connecter au webmail Amen avec cette adresse. Si ça ouvre,
      la boîte existe vraiment.

### Chez Amen — le DNS (c'est ici que ça se joue)
- [ ] **Regarder le SPF EXISTANT** avant d'en ajouter un.
      Domaine et DNS → Configuration DNS → *Gérer les paramètres avancés* →
      chercher un TXT commençant par `v=spf1`.
      ⚠⚠ **Deux SPF valent zéro SPF.** S'il y en a déjà un, tu le **modifies**.
- [ ] **SPF** — TXT sur l'apex : `v=spf1 include:spf.webapps.net ~all`
      (ou fusionné avec l'existant : un seul `v=spf1`, un seul `~all`, les
      `include:` empilés au milieu).
- [ ] **DKIM** — `eagleyecorp.fr` → **EMAIL** → bouton bleu **ACTION** →
      **DKIM**. Amen publie l'enregistrement lui-même.
- [ ] **DMARC** — TXT sur `_dmarc.eagleyecorp.fr` :
      `v=DMARC1; p=none; rua=mailto:postmaster@eagleyecorp.fr`
      ⚠ `p=none` d'abord. `p=reject` avec un SPF mal fusionné ferait rejeter
      tes propres mails partout, d'un coup.

### Chez Supabase — le SMTP
- [ ] Authentication → **Emails → SMTP Settings** → *Enable custom SMTP*
- [ ] Sender email : `noreply@eagleyecorp.fr` — **exactement** la boîte
      authentifiée. Envoyer depuis `contact@` en s'authentifiant avec
      `noreply@` fait rejeter, ou pire : ça part et c'est classé usurpation.
- [ ] Sender name : `ALPHA SALES OS`
- [ ] Host : `smtp-fr.securemail.pro`
- [ ] Port : `465` (si refus → `587` ; **jamais 25**)
- [ ] Username : `noreply@eagleyecorp.fr` — **l'adresse entière**
- [ ] Password : celui de la boîte
- [ ] **Save changes**

### La vérification — et elle ne se fait PAS sur « le mail est arrivé »
- [ ] Authentication → **Users** → *Invite user* vers une adresse **Gmail**
      que tu possèdes.
- [ ] Ouvrir le mail → **⋮ → Afficher l'original**
- [ ] Lire les **trois** lignes :
      `spf=pass` · `dkim=pass` · `dmarc=pass`
      ⚠ Un mail peut arriver avec `spf=fail`. Gmail le tolère au début, puis
      le classe en indésirables quand le volume monte — et les inscriptions
      s'arrêtent sans qu'aucun réglage n'ait changé.
- [ ] Si un `pass` manque : attendre la propagation DNS (minutes à heures)
      avant de conclure que c'est mal configuré.

### Une fois les trois `pass` verts
- [ ] Authentication → Providers → Email → **Confirm email : ✅**
      (la désactiver était le contournement, pas la cible)
- [ ] Authentication → **Rate Limits** → monter à ~100/heure avant un post
      LinkedIn, redescendre après.
      ⚠ **Jamais au-dessus du plafond d'Amen** : Supabase compterait des
      essais refusés contre ton quota.

### Ce qui reste, hors emails
- [ ] Vercel → `REQUIRE_AUTH=1` *(fait — actif au prochain déploiement)*
- [ ] Vercel → **changer `SITE_PASSWORD`** (l'ancien est publié)
- [ ] Supabase → SQL Editor → passer **migration 002** (entitlements) et
      **003** (organisation). Sans la 002, un client paie et l'app le refuse.
- [ ] GitHub → **repo en privé**

---

## ⚠ À lire avant de commencer : la réputation est un actif COMMUN

`eagleyecorp.fr` sert déjà à deux choses très différentes :

| Usage | Qui envoie | Enjeu |
|---|---|---|
| **Confirmations de compte** | Supabase Auth | Elles DOIVENT arriver, sinon personne ne s'inscrit |
| **Prospection** (`/api/send`) | l'application | Elles partent à des gens qui n'ont rien demandé |

**Une seule réputation d'expéditeur pour les deux.** Une campagne de
prospection mal ciblée fait chuter la réputation du domaine — et les mails de
confirmation cessent d'arriver **en même temps**, sans qu'aucun code ne
change et sans que rien ne le dise.

C'est le scénario le plus vicieux du lot : le tunnel d'inscription se casse
à cause d'un envoi commercial fait trois jours plus tôt.

> **La parade, et elle coûte dix minutes** : séparer les domaines d'envoi.
> · **Auth** → `noreply@eagleyecorp.fr` (l'apex, réputation protégée)
> · **Prospection** → un **sous-domaine**, `mail.eagleyecorp.fr` par exemple
>
> Les réputations d'un sous-domaine et de son apex sont largement distinctes
> chez les grands fournisseurs. Brûler `mail.eagleyecorp.fr` ne coupe pas les
> confirmations.
>
> ⚠ Ce n'est pas une garantie absolue — un domaine parent très mal noté finit
> par peser sur ses sous-domaines. Ça réduit fortement le risque, ça ne
> l'annule pas. La seule protection totale serait deux domaines distincts.

**Si tu ne fais qu'une chose aujourd'hui**, fais l'auth. La séparation peut
attendre le premier envoi de masse — mais elle doit être faite **avant**.

---

## 1. Créer la boîte `noreply@eagleyecorp.fr` chez Amen

Espace client Amen → **eagleyecorp.fr** → services associés → **EMAIL**.

Crée une **vraie boîte** (pas un alias). L'authentification SMTP a besoin d'un
mot de passe, et un alias n'en a pas.

> ⚠ Note le mot de passe **maintenant**. Supabase le chiffre à
> l'enregistrement et ne le réaffiche plus jamais : le retrouver veut dire le
> réinitialiser chez Amen, donc casser l'envoi le temps de le refaire.

---

## 2. Les réglages SMTP dans Supabase

Authentication → **Emails → SMTP Settings** → *Enable custom SMTP*.

| Champ | Valeur |
|---|---|
| Sender email address | `noreply@eagleyecorp.fr` |
| Sender name | `ALPHA SALES OS` |
| **Host** | `smtp-fr.securemail.pro` |
| **Port number** | `465` |
| **Username** | `noreply@eagleyecorp.fr` — **l'adresse entière**, pas `noreply` |
| **Password** | celui de la boîte |
| Minimum interval per user | `60` (le défaut convient) |

> ⚠ **Le port 465 est en SSL implicite**, pas en STARTTLS. Si Amen refuse la
> connexion, essaie `587` — certaines offres Amen n'ouvrent que celui-là. Ne
> touche jamais au **25** : il est bloqué par la quasi-totalité des
> fournisseurs pour freiner le spam.

> ⚠ **`Sender email address` doit être EXACTEMENT la boîte authentifiée.**
> Envoyer depuis `contact@` en s'authentifiant avec `noreply@` fait rejeter le
> message par le serveur, ou pire : il part et se fait classer en usurpation à
> l'arrivée. Le second cas ne produit aucune erreur visible.

---

## 3. Les trois enregistrements DNS — sans eux, tout part en indésirables

Espace client Amen → **eagleyecorp.fr** → **Domaine et DNS** → *Configuration
DNS* → **Gérer les paramètres avancés**.

### SPF — dit quels serveurs ont le droit d'envoyer pour toi

| | |
|---|---|
| Nom | `eagleyecorp.fr` (l'apex) |
| Type | `TXT` |
| TTL | `900` |
| Valeur | `v=spf1 include:spf.webapps.net ~all` |

> ⚠⚠ **TU AS DÉJÀ UN SPF, ET DEUX SPF VALENT ZÉRO SPF.**
>
> `contact@eagleyecorp.fr` fonctionne, donc un enregistrement existe
> probablement déjà. La norme (RFC 7208) impose **un seul** enregistrement
> `v=spf1` par domaine : un domaine qui en a deux est traité comme un domaine
> qui n'en a **aucun**. Tu casserais l'existant en croyant l'améliorer.
>
> **Regarde d'abord.** S'il y en a un, tu le **fusionnes** — tu n'en ajoutes
> pas un second :
> ```
> v=spf1 include:spf.webapps.net include:autre-truc.com ~all
> ```
> Un seul `v=spf1` au début, un seul `~all` à la fin, les `include:` empilés
> entre les deux.

### DKIM — signe cryptographiquement tes messages

Espace client Amen → **eagleyecorp.fr** → **EMAIL** → bouton bleu **ACTION** →
**DKIM**. Amen publie l'enregistrement lui-même.

### DMARC — dit quoi faire quand SPF ou DKIM échoue

| | |
|---|---|
| Nom | `_dmarc.eagleyecorp.fr` |
| Type | `TXT` |
| Valeur | `v=DMARC1; p=none; rua=mailto:postmaster@eagleyecorp.fr` |

> `p=none` = on **observe** sans rien rejeter. C'est le bon départ : passer
> directement à `p=reject` avec un SPF mal fusionné ferait rejeter tes propres
> mails par tout le monde, d'un coup. On durcit après avoir lu les rapports.
>
> ⚠ **Même piège que SPF : plusieurs DMARC valent zéro.** La norme impose au
> résolveur d'ignorer le domaine entier s'il en trouve plus d'un.

---

## 4. Vérifier — et ne pas se contenter de « le mail est arrivé »

1. Supabase → Authentication → **Users** → *Invite user*, avec une adresse
   **Gmail** que tu possèdes.
2. Ouvre le mail reçu → **⋮ → Afficher l'original**.
3. Cherche les trois lignes :

```
spf=pass    (google.com: domain of noreply@eagleyecorp.fr ...)
dkim=pass   header.i=@eagleyecorp.fr
dmarc=pass  (p=NONE ...)
```

> ⚠ **« Le mail est arrivé » ne prouve rien.** Un message peut arriver avec
> `spf=fail` : Gmail le tolère au début, puis le classe en indésirables quand
> le volume monte. Le jour où ça bascule, tes inscriptions s'arrêtent sans
> qu'aucun réglage n'ait changé. Ce sont les **trois `pass`** qui prouvent, pas
> la réception.

4. La propagation DNS prend de quelques minutes à quelques heures. Si un
   `pass` manque, attends avant de conclure que c'est mal configuré.

---

## 5. Une fois que ça marche : remettre la confirmation

Authentication → Providers → Email → **Confirm email** : ✅

> La désactiver était le **contournement** tant que rien ne partait. Avec un
> SMTP qui délivre, la confirmation redevient le bon comportement : elle
> prouve que l'adresse existe et appartient à la personne, ce qui évite les
> comptes fantômes et les fautes de frappe dont on ne saura jamais rien.

---

## 6. Les plafonds — deux, et ils ne sont pas au même endroit

| Où | Combien | Comment le changer |
|---|---|---|
| **Supabase** | 30 emails/heure après activation du SMTP custom | Authentication → **Rate Limits** |
| **Amen** | selon l'offre (souvent quelques centaines/jour) | non réglable — c'est le plafond dur |

> ⚠ Sur un lancement à 400 personnes, 30/heure peut suffire (elles ne
> s'inscrivent pas toutes dans la même heure) — mais si ça bouchonne, l'inscrit
> ne voit **rien**, il croit juste que ça ne marche pas. Monte à 100/heure
> avant un post LinkedIn, et redescends après.
>
> ⚠⚠ **Ne monte pas Supabase au-dessus du plafond d'Amen.** Supabase accepterait
> d'envoyer, Amen refuserait, et Supabase compterait quand même l'essai contre
> ton quota. Le plafond le plus bas est le seul vrai.

---

## Ce qui va dans Vercel, et ce qui n'y va pas

Les mêmes identifiants servent à `/api/send` (`SMTP_HOST` · `SMTP_PORT` ·
`SMTP_USER` · `SMTP_PASS` · `SMTP_FROM`) — **mais relis l'encadré du haut avant
de mettre la même adresse des deux côtés.** Si tu comptes prospecter depuis
l'application, c'est le sous-domaine qu'il faut là, pas `noreply@`.

⚠ Ces variables sont des **secrets de serveur**. Jamais de préfixe
`NEXT_PUBLIC_` : il rendrait le mot de passe de ta boîte lisible dans le
navigateur de n'importe quel visiteur.
