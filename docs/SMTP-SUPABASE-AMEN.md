# SMTP Supabase avec Amen.fr — `eagleyecorp.fr`

> **Ce que ça débloque** : les emails de confirmation d'inscription. Sans ça,
> le SMTP intégré de Supabase ne délivre qu'à toi, deux messages par heure —
> donc **personne ne peut créer de compte**, et rien ne le signale.
>
> Références : [SMTP Amen](https://www.amen.fr/support/configuration-compte-email-logiciel-client/)
> · [SPF Amen](https://www.amen.fr/help/mise-en-place-du-spf-amen/)
> · [DKIM Amen](https://www.amen.fr/help/activation-du-dkim/)

---

## ⚠ DÉCISION DU 10/09/2026 — ON PART SUR `contact@eagleyecorp.fr`

Ce document était bâti sur une boîte `noreply@` à créer. **Elle ne l'a pas
été, et attendre coûtait plus cher que le risque.** `contact@eagleyecorp.fr`
existe, fonctionne, et — c'est l'argument qui décide — **quelqu'un la lit**.

### Ce que ce choix gagne, et ce n'est pas qu'un raccourci

- **Un `noreply@` en expéditeur de prospection est une mauvaise pratique**, pas
  une convention neutre. Il annonce « ne répondez pas » à quelqu'un dont on
  attend précisément une réponse, il fait chuter le taux de réponse, et
  plusieurs filtres le pénalisent explicitement.
- **La réponse arrive au bon endroit.** `contact@` est déjà l'adresse du
  cadrage sur la vitrine et l'adresse d'émission des devis EAGLEYE
  (`lib/accounts-commercial.ts`). Un prospect qui répond tombe là où quelqu'un
  regarde, du premier message jusqu'à la signature.

### ⚠⚠ CE QUE ÇA COÛTE — à savoir avant, pas après

**Le transactionnel et le commercial partagent désormais une seule boîte.**
Supabase enverra les confirmations d'inscription depuis l'adresse qui sert
aussi à la prospection. Conséquence, et c'est le scénario détaillé plus bas :
si un envoi commercial prend des plaintes, **les mails d'inscription cessent
d'arriver en même temps** — aucun code ne change, rien ne le signale, et un
client qui ne reçoit pas son lien de confirmation ne devient jamais client.

Et la même réputation porte **les devis**. Une adresse dégradée touche le
dernier mètre, celui qui rapporte.

### Les deux règles qui rendent ce choix tenable

1. **La montée en charge ne se lève pas** — et il faut savoir exactement ce
   qu'elle borne.

**Ce qui borne réellement les envois, et à quel niveau — vérifié, pas supposé :**

| Garde | Où elle s'applique | Ce qu'elle borne |
|---|---|---|
| `lib/email-ramp.ts` — 5/jour la 1ʳᵉ semaine, +5/semaine, 40 au plafond | **l'ÉCRAN** `/outbox` (la file est coupée) **ET le SERVEUR** `/api/send` (429 au-delà) | tous les envois, quel que soit l'appelant |
| `MAX_SENDS_PER_HOUR` (défaut **40/h**) | **le SERVEUR**, `/api/send` | un pic, quel que soit l'appelant |
| Fenêtre de recontact (défaut **14 jours**) | le SERVEUR | le réenvoi à la même adresse |

> ✅ **BRANCHÉE CÔTÉ SERVEUR LE 10/09/2026.** Elle ne l'était pas : elle
> coupait la FILE de la Boîte d'envoi et rien d'autre, donc les trois autres
> appelants de `/api/send` — revue de campagne, newsletter, recette —
> pouvaient dépasser le palier du jour sans que rien ne le voie. Le garde qui
> protège `contact@` tenait par l'USAGE, pas par une contrainte.
>
> **Deux conséquences pratiques à connaître avant de les rencontrer :**
>
> · Une **newsletter ou une revue de campagne** vers plus de destinataires que
>   le palier du jour sera **coupée au palier**, avec un 429 qui dit le compte
>   et la date du prochain palier. Ce n'est pas une panne — c'est exactement ce
>   qui évite de griller la boîte en un envoi.
> · Le serveur compte sur **24 h glissantes**, pas sur la journée civile. Un
>   jour calendaire autoriserait cinq envois à 23h59 et cinq à 00h01 : dix
>   messages en deux minutes depuis une boîte neuve, soit le schéma exact que
>   les filtres cherchent.
>
> ⚠ `force` **ne passe pas outre**, comme pour le plafond horaire. `force`
> arbitre des jugements — le score anti-spam, la fenêtre de recontact. La
> réputation d'un domaine n'en est pas un.
2. **La séparation reste au programme, elle est juste repoussée.** Le jour où
   `noreply@` existe : le transactionnel y retourne, et la prospection part
   d'un sous-domaine. Voir la parade détaillée plus bas — elle n'est pas
   annulée, elle attend.

> **Ce document décrit donc `contact@` partout.** L'ancienne version disait
> `noreply@` ; la remplacer sans écrire pourquoi aurait laissé la prochaine
> session refaire le choix inverse en croyant corriger un oubli.

---

## LA CHECKLIST — dans cet ordre, et l'ordre compte

> Coche au fur et à mesure. Chaque ligne dit **où** cliquer et **comment savoir
> que c'est fait** — une étape « faite » qu'on ne peut pas vérifier n'est pas
> faite.

### Chez Amen — la boîte
- [x] **La boîte existe déjà** : `contact@eagleyecorp.fr`. Rien à créer.
      ⚠ Vérifier que c'est une **vraie boîte** et pas un alias redirigé : un
      alias n'a pas de mot de passe, donc aucune authentification SMTP
      possible. Si le webmail Amen s'ouvre avec cette adresse, c'est une boîte.
- [ ] **Retrouver ou réinitialiser son mot de passe**, et le noter maintenant.
      Supabase le chiffre à l'enregistrement et ne le réaffiche **jamais**.
      ⚠ Le réinitialiser coupe la réception le temps de reconfigurer les
      clients mail qui l'utilisent déjà — à faire à un moment calme, pas à
      8 h du matin le jour du lancement.

### Chez Amen — le DNS (c'est ici que ça se joue)

> ⚠⚠ **RELEVÉ LE 15/09/2026, EN INTERROGEANT LE DNS PUBLIC — deux des trois
> lignes ci-dessous étaient DÉJÀ FAITES, et ce document disait de les créer.**
> Les appliquer telles qu'elles étaient écrites aurait posé un **second** SPF
> et un **second** DMARC : la norme fait alors traiter le domaine comme s'il
> n'en avait AUCUN. Le document se serait fait casser par son propre
> avertissement. Détail et méthode de relevé : section 3.

- [x] **SPF** — **déjà posé, et correct** : `v=spf1 include:spf.webapps.net ~all`,
      un seul enregistrement. **Ne touche à rien.**
- [x] **DKIM** — **activé le 16/09/2026.** `eagleyecorp.fr` → **EMAIL** →
      bouton bleu **ACTION** → **DKIM**.
- [ ] **Relever le sélecteur et le domaine signé** — le seul point encore
      ouvert, et il prend vingt secondes. Dans l'en-tête `DKIM-Signature`
      d'un message reçu : **`s=`** et **`d=`**.
      ⚠ `d=` doit valoir **exactement `eagleyecorp.fr`** et non
      `securemail.pro` : avec `adkim=s`, une signature qui ne porte pas le bon
      domaine passe le contrôle DKIM et **ne s'aligne pas** — voir l'encadré
      « alignement strict » en section 3.
- [x] **DMARC** — **déjà posé, et PLUS STRICT que ce que ce document
      prescrivait** : `p=quarantine`, `adkim=s`, `aspf=s`, `pct=100`.
      **N'en crée pas un second.** Ce qu'il faut savoir avant d'envoyer quoi
      que ce soit : section 3, encadré « alignement strict ».

### Chez Supabase — le SMTP

> ✅ **FAIT le 16/09/2026 : les mails de confirmation d'inscription partent et
> arrivent.** C'était le bloquant n°1 — personne ne pouvait créer de compte.

- [x] Authentication → **Emails → SMTP Settings** → *Enable custom SMTP*
- [ ] Sender email : `contact@eagleyecorp.fr` — **exactement** la boîte
      authentifiée. Une adresse d'expédition différente de l'adresse
      authentifiée fait rejeter le message, ou pire : ça part et c'est classé
      usurpation à l'arrivée — sans erreur visible.
- [ ] Sender name : `ALPHA SALES OS`
- [ ] Host : `smtp-fr.securemail.pro`
- [ ] Port : `465` (si refus → `587` ; **jamais 25**)
- [ ] Username : `contact@eagleyecorp.fr` — **l'adresse entière**
- [ ] Password : celui de la boîte
- [ ] **Save changes**

### La vérification — et elle ne se fait PAS sur « le mail est arrivé »

> ⚠ **CETTE SECTION RESTE OUVERTE, ET CE N'EST PAS DE LA PRUDENCE DE CONFORT.**
> Que les mails arrivent prouve beaucoup — sous `p=quarantine`, un échec part
> en indésirables, donc **DMARC passe**. Mais ça ne dit pas LEQUEL des deux
> leviers tient : DKIM aligné, ou SPF. Le jour où l'un des deux bouge (un
> changement de plateforme chez Amen, un sous-domaine d'envoi), on saura
> quoi regarder — ou pas.

- [x] Authentication → **Users** → *Invite user* vers une adresse **Gmail**
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
> · **Auth** → une boîte dédiée sur l'apex (réputation protégée)
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

## 1. La boîte `contact@eagleyecorp.fr` — elle existe déjà

Espace client Amen → **eagleyecorp.fr** → services associés → **EMAIL**.

Rien à créer. Ce qu'il faut vérifier : que c'est une **vraie boîte** et pas un
alias redirigé. L'authentification SMTP a besoin d'un mot de passe, et un
alias n'en a pas — le webmail Amen tranche en dix secondes.

> ⚠ Note le mot de passe **maintenant**. Supabase le chiffre à
> l'enregistrement et ne le réaffiche plus jamais : le retrouver veut dire le
> réinitialiser chez Amen, donc casser l'envoi le temps de le refaire.

---

## 2. Les réglages SMTP dans Supabase

Authentication → **Emails → SMTP Settings** → *Enable custom SMTP*.

| Champ | Valeur |
|---|---|
| Sender email address | `contact@eagleyecorp.fr` |
| Sender name | `ALPHA SALES OS` |
| **Host** | `smtp-fr.securemail.pro` |
| **Port number** | `465` |
| **Username** | `contact@eagleyecorp.fr` — **l'adresse entière**, pas `contact` |
| **Password** | celui de la boîte |
| Minimum interval per user | `60` (le défaut convient) |

> ⚠ **Le port 465 est en SSL implicite**, pas en STARTTLS. Ne touche jamais au
> **25** : il est bloqué par la quasi-totalité des fournisseurs pour freiner le
> spam.
>
> ⚠ **Le repli 587 n'est PAS documenté par Amen sur cette plateforme.** Seul le
> **465** l'est. Le 587 apparaît sur l'**ancienne** plateforme Amen (celle où
> les hôtes dérivent de ton domaine : `smtp.eagleyecorp.fr`) et chez des tiers.
> Donc : si le 465 est refusé, essayer le 587 reste raisonnable, mais **ça ne
> prouve rien et ça peut signifier que tu n'es pas sur la plateforme que ce
> document décrit** — auquel cas ce sont TOUS les paramètres qu'il faut revoir,
> pas seulement le port.
>
> **Le marqueur de plateforme, et il se lit en dix secondes** : regarde l'hôte
> **entrant** de la boîte dans l'espace Amen.
> · `mail-fr.securemail.pro` (IMAP 993 / POP 995) → tu es bien sur la
>   plateforme décrite ici, et `smtp-fr.securemail.pro`:465 est le bon couple.
> · `pop.eagleyecorp.fr` / `imap.eagleyecorp.fr` → ancienne plateforme, **rien
>   de ce document ne s'applique**.
> Le MX public dit déjà `mail-fr.securemail.pro` (relevé le 15/09), ce qui rend
> la première hypothèse très probable — mais le MX décrit la réception, pas la
> boîte : c'est la fiche de la boîte qui tranche.

> ⚠ **`Sender email address` doit être EXACTEMENT la boîte authentifiée.**
> Expédier depuis une adresse et s'authentifier avec une autre fait rejeter le
> message par le serveur, ou pire : il part et se fait classer en usurpation à
> l'arrivée. Le second cas ne produit **aucune erreur visible** — c'est celui
> qui coûte une semaine avant qu'on comprenne.

---

## 3. Les trois enregistrements DNS — l'état RELEVÉ, pas l'état supposé

Espace client Amen → **eagleyecorp.fr** → **Domaine et DNS** → *Configuration
DNS* → **Gestion avancée** (et valider l'avertissement).

> ⚠ Ce document disait « Gérer les paramètres avancés ». Le libellé servi par
> Amen est **« Gestion avancée »**. Amen distingue deux niveaux : la
> *Configuration DNS* standard, avec des assistants guidés — dont un assistant
> SPF, qu'il ne faut PAS utiliser ici puisque le SPF est déjà correct — et la
> *Gestion avancée* de la zone, seule à permettre d'ajouter et de supprimer
> des entrées.

> **Relevé le 15/09/2026** en interrogeant le DNS public depuis la session
> (module `node:dns`, pas un service tiers — la réponse vient des serveurs
> faisant autorité). C'est reproductible en dix secondes :
> ```bash
> node -e "const d=require('node:dns').promises;(async()=>{
>   console.log(await d.resolveTxt('eagleyecorp.fr'));
>   console.log(await d.resolveTxt('_dmarc.eagleyecorp.fr'));
>   console.log(await d.resolveMx('eagleyecorp.fr'));})()"
> ```
> ⚠ **Refais-le après chaque modification chez Amen.** L'interface du
> registrar affiche ce que tu as SAISI ; le DNS public rend ce qui est
> effectivement SERVI. Entre les deux il y a la propagation, et parfois une
> faute de frappe que seul le second révèle.

| Enregistrement | État au 15/09/2026 | À faire |
|---|---|---|
| **SPF** (apex, TXT) | `v=spf1 include:spf.webapps.net ~all` — un seul | **rien** |
| **MX** | `mail-fr.securemail.pro` | rien — confirme la plateforme |
| **DMARC** (`_dmarc`, TXT) | `p=quarantine; adkim=s; aspf=s; pct=100` | **rien**, mais lire l'encadré ci-dessous |
| **DKIM** | **activé le 16/09** (rapporté) — sélecteur non relevé | **relever `s=`** dans un en-tête reçu |

### SPF — déjà bon, et c'est le piège inverse qui menace

La valeur servie est exactement celle que ce document prescrivait. **Il n'y a
donc rien à ajouter** — et y ajouter quoi que ce soit serait le défaut que la
version précédente de ce paragraphe avertissait d'éviter : la norme (RFC 7208)
impose **un seul** `v=spf1` par domaine, et un domaine qui en porte deux est
traité comme un domaine qui n'en a **aucun**.

Le jour où un autre expéditeur doit être autorisé, on **fusionne** — un seul
`v=spf1` au début, un seul `~all` à la fin, les `include:` empilés entre les
deux :
```
v=spf1 include:spf.webapps.net include:autre-truc.com ~all
```

> ⚠ Le sondage de sélecteurs DKIM ne **prouve** pas l'absence : un sélecteur
> est une chaîne arbitraire, et on ne peut pas énumérer le DNS. Seize
> sélecteurs courants sans réponse rendent l'absence très probable, pas
> certaine. Ce qui tranche en dix secondes : l'écran EMAIL de l'espace Amen.

### DKIM — la seule des trois qui manque, et celle qui porte tout

Espace client Amen → **eagleyecorp.fr** → **EMAIL** → bouton bleu **ACTION** →
**DKIM**. Le DNS du domaine est géré chez Amen (`ns1`/`ns2.amenworld.com`),
donc Amen publie l'enregistrement lui-même — il n'y a pas de TXT à recopier à
la main.

### ⚠⚠ ALIGNEMENT STRICT — ce que le DMARC déjà en place implique

L'enregistrement servi n'est pas celui d'un domaine qui débute :

```
v=DMARC1; p=quarantine; rua=…; ruf=…; adkim=s; aspf=s; pct=100; ri=86400
```

Trois choses à comprendre **avant** le premier envoi, parce qu'elles ne
produisent aucune erreur visible :

1. **`p=quarantine` ne rejette pas — il range en indésirables.** Un message qui
   échoue part dans le dossier spam du destinataire. Personne ne te prévient,
   et l'expéditeur voit un envoi « réussi ».
2. **DMARC passe si SPF **ou** DKIM passe ET s'aligne.** Sans DKIM, il ne reste
   qu'une jambe : **tout repose sur SPF seul**. C'est ce qui rend l'activation
   DKIM urgente, et pas cosmétique.
3. **`adkim=s` / `aspf=s` = alignement STRICT.** Le domaine authentifié doit
   être **exactement** `eagleyecorp.fr`. En relâché (le défaut de la norme), un
   sous-domaine suffirait ; ici, non.

### ⚠⚠ ET SPF NE POURRAIT DE TOUTE FAÇON PAS S'ALIGNER ICI

C'est le point qui change l'ordre des gestes de la journée, et il ne vient pas
d'une intuition.

> Sur l'hébergement mail Register.it / Amen, **l'adresse de retour (Return-Path)
> porte un domaine du PRESTATAIRE**, pas le tien — et le fournisseur n'expose
> **aucun mécanisme** pour la faire porter ton domaine.
> `[SECONDAIRE — fiche MXToolbox « Register.it Email Hosting », recoupée par
> deux recherches indépendantes. NON TESTÉ ICI : le proxy de développement
> refuse la récupération de page, et aucun message n'a encore été envoyé.]`

Si c'est exact, SPF authentifie `securemail.pro` et non `eagleyecorp.fr` :
en **alignement strict**, ça n'aligne pas — et en relâché non plus, parce que
`securemail.pro` n'est même pas un sous-domaine de `eagleyecorp.fr`.
**SPF ne peut alors JAMAIS contribuer à faire passer DMARC, quelle que soit la
valeur d'`aspf`.**

Additionné à l'état relevé, ça donne la situation exacte d'aujourd'hui :

```
état au 15/09 (avant activation) :
SPF   : passe, mais ne peut pas s'aligner   → ne compte pas pour DMARC
DKIM  : absent                              → ne compte pas pour DMARC
────────────────────────────────────────────────────────────────────
DMARC : échouait sur CHAQUE message
p=quarantine                                → dossier indésirables
```

> ✅ **16/09 — DKIM activé, et les mails d'inscription Supabase arrivent en
> boîte de réception.** Ce fait vaut mieux qu'un simple « c'est arrivé » : sous
> **`p=quarantine`**, un message qui échoue part en indésirables. Arriver au
> bon endroit signifie donc que **DMARC passe** — c'est une politique
> appliquée, pas de la tolérance.
>
> ⚠ **Ce qui reste inconnu, et qui compte** : lequel des deux leviers passe.
> Un sondage DNS n'a trouvé aucun sélecteur parmi 22 courants — ce qui ne
> prouve rien, un sélecteur étant arbitraire. Deux lectures possibles, et
> elles ne demandent pas les mêmes gestes ensuite :
> · **DKIM signe avec `d=eagleyecorp.fr`** → le domaine a ses deux jambes, et
>   l'hypothèse « le Return-Path est réécrit » (secondaire, jamais testée)
>   reste sans conséquence ;
> · **c'est SPF qui aligne** → cette hypothèse était simplement fausse chez
>   Amen, et DKIM n'est pas encore un filet.
>
> **La réponse tient dans l'en-tête `DKIM-Signature` d'un message reçu : `s=`
> (le sélecteur) et `d=` (le domaine signé).** Relève ces deux valeurs — et
> elles seules, `b=` étant la signature. Avec `s=`, la vérification devient
> reproductible :
> ```bash
> node -e "require('node:dns').promises.resolveTxt('<s>._domainkey.eagleyecorp.fr').then(r=>console.log(r.flat().join('')))"
> ```

> ⚠ **`aspf=s` ne coûte rien à relâcher et ne rapporte rien à garder** : si
> l'alignement SPF est structurellement impossible ici, strict et relâché
> donnent le même résultat. Ce n'est donc **pas** le levier. Le levier est
> DKIM, et lui seul.
> `adkim=s`, en revanche, mord pour de bon : il exigera que la signature porte
> **exactement** `d=eagleyecorp.fr`. Si Amen signe avec `d=securemail.pro`,
> DKIM passera et **n'alignera pas** — même résultat qu'aucun DKIM.

### L'ORDRE DES GESTES, ET IL N'EST PAS NÉGOCIABLE

1. **Activer DKIM** chez Amen (EMAIL → ACTION → DKIM).
2. **Relever le sélecteur publié** dans la zone, puis vérifier que la signature
   porte bien `d=eagleyecorp.fr` :
   ```bash
   node -e "require('node:dns').promises.resolveTxt('<sélecteur>._domainkey.eagleyecorp.fr').then(console.log)"
   ```
3. **Un seul message de test vers Gmail**, et lire `Authentication-Results`
   (section 4). C'est **le seul endroit** où tout ce qui précède devient
   visible — ni l'espace Amen ni `/api/health` ne peuvent le dire.
4. **Lire quel domaine apparaît** derrière `spf=`, `dkim=` et `d=`. C'est lui
   qui distingue « l'authentification échoue » de « elle réussit mais n'aligne
   pas » — deux pannes qui se ressemblent et ne se corrigent pas pareil.
5. **Seulement ensuite**, brancher `SMTP_*` et envoyer quoi que ce soit.

> ⚠ **Ne descends pas à `p=none` pour « débloquer ».** Ça n'améliorerait rien
> de mesurable — ça rendrait juste la panne invisible en laissant les messages
> arriver, tout en retirant la seule protection du domaine contre
> l'usurpation. Le défaut d'alignement, lui, resterait entier et reviendrait
> au premier durcissement. **Corrige l'alignement, pas la politique.**
>
> Ce que `p=none` apporterait en revanche, et c'est le seul argument sérieux
> en sa faveur : les rapports `rua=` arrivent dans les deux cas, mais sous
> `p=none` on les lit **sans que le courrier soit déjà en train de partir en
> indésirables** pendant qu'on apprend. C'est un arbitrage à faire en
> connaissance de cause, pas un contournement à prendre par défaut.

---

## 4. Vérifier — et ne pas se contenter de « le mail est arrivé »

1. Supabase → Authentication → **Users** → *Invite user*, avec une adresse
   **Gmail** que tu possèdes.
2. Ouvre le mail reçu → **⋮ → Afficher l'original**.
3. Cherche les trois lignes :

```
spf=pass    (google.com: domain of contact@eagleyecorp.fr ...)
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
| **Amen** | **selon l'offre — 500, 1 000 ou 5 000/jour** (voir ci-dessous) | non réglable en l'état — c'est le plafond dur |

> ⚠ Sur un lancement à 400 personnes, 30/heure peut suffire (elles ne
> s'inscrivent pas toutes dans la même heure) — mais si ça bouchonne, l'inscrit
> ne voit **rien**, il croit juste que ça ne marche pas. Monte à 100/heure
> avant un post LinkedIn, et redescends après.
>
> ⚠⚠ **Ne monte pas Supabase au-dessus du plafond d'Amen.** Supabase accepterait
> d'envoyer, Amen refuserait, et Supabase compterait quand même l'essai contre
> ton quota. Le plafond le plus bas est le seul vrai.

### Le plafond d'Amen : trois chiffres publiés, et il faut savoir lequel est le tien

Relevé le 15/09/2026. Amen publie des valeurs **par offre**, et elles ne
concordent pas entre les pages :

| Offre | Envois/jour | Preuve |
|---|---|---|
| Email **Personal** | **500** | page produit `[SOURCE-PRIMAIRE]` |
| Email **Professional** | **5 000** | page produit `[SOURCE-PRIMAIRE]` |
| **Webmail PRO** | **1 000** (et **100 destinataires** par envoi) | FAQ `[SOURCE-PRIMAIRE]` |

**Aucun de ces chiffres n'est utilisable tant que le nom exact de l'offre
souscrite n'est pas relevé dans l'espace client.** C'est la première ligne à
lire, et c'est elle qui conditionne tout le reste — y compris, probablement,
l'accès au bouton DKIM.

> ⚠⚠ **Deux règles de comptage qui changent le calcul**, tirées des Conditions
> Particulières `[SOURCE-PRIMAIRE]` :
> · **un message à N destinataires compte pour N envois** — le plafond est en
>   destinataires, pas en messages composés ;
> · **quand le plafond du jour est atteint, ça REFUSE** — il n'y a pas de file
>   d'attente, rien ne repart tout seul le lendemain.
>
> Le second est celui qui compte pour nous : `/api/send` recevrait une erreur
> SMTP, pas un différé. À 5-40 envois/jour (`lib/email-ramp.ts`) on est très
> loin du plancher de 500, donc **ce plafond ne nous borne pas** — c'est le
> nôtre qui borne. Mais une newsletter mal cadrée, elle, pourrait y arriver.

> ⚠ **Les CGU email d'Amen ont changé le 08/01/2025** (Amen publie encore la
> version précédente à côté de l'actuelle). Toute valeur de plafond lue dans un
> document antérieur à cette date est suspecte par construction.

### Deux pannes documentées par Amen lui-même, à connaître avant de les vivre

- **Quand le SMTP d'Amen tombe, le webmail continue** (canal de trafic
  différent — Amen l'écrit dans sa page d'incident). Traduction : tu enverras
  très bien tes mails à la main en croyant que tout va bien, pendant que
  `/api/send` échoue. Le webmail n'est **pas** un test de l'envoi applicatif.
- **Un renouvellement de certificat SSL côté Amen a déjà cassé des connexions.**
  Sur un client graphique, ça se présente comme une boîte de dialogue qu'on
  accepte. Sur un envoi programmatique, ça se présente comme un **échec TLS** —
  donc comme une panne obscure de `/api/send`, sans rapport apparent avec Amen.

---

## 7. CE QUI S'APPLIQUE VRAIMENT À 5-40 EMAILS/JOUR

Relevé le 15/09/2026 dans la documentation des fournisseurs de boîtes. **La
ligne de partage est 5 000 messages/jour vers Gmail** — nous en sommes à deux
ordres de grandeur, et ça change ce qu'il faut faire.

### Ce qu'on croyait devoir, et qu'on ne doit pas à ce volume

`[SOURCE-PRIMAIRE — Google, « Email sender guidelines »]`

| Exigence | Qui la doit |
|---|---|
| SPF **et** DKIM (les deux) | bulk seulement — sous le seuil, **l'un OU l'autre** suffit |
| Publier un **DMARC** | bulk seulement |
| **Alignement** DMARC | bulk seulement |
| **Désabonnement en un clic** (RFC 8058) | bulk seulement, et uniquement sur le marketing — le transactionnel en est explicitement exclu |
| Exigences **Microsoft** (rejet `550 5.7.515`) | 5 000+/jour vers outlook/hotmail/live **grand public** uniquement |

> Autrement dit : **le DMARC strict déjà publié sur `eagleyecorp.fr` est un
> choix volontaire, pas une obligation.** On a pris tous les modes de panne du
> régime strict sans en avoir l'obligation. C'est défendable — c'est la bonne
> hygiène — mais il faut le savoir : personne ne nous l'impose, et la panne
> qu'il provoque, elle, est bien réelle.

### Ce qui s'applique bel et bien, quel que soit le volume

`[SOURCE-PRIMAIRE — Google, liste « tous les expéditeurs »]` : SPF **ou** DKIM ·
DNS direct et **inverse (PTR)** valides · **TLS** · format RFC 5322 · **taux de
plainte < 0,3 %**.

> ⚠⚠ **LE TAUX DE PLAINTE EST UNE OBLIGATION SANS INSTRUMENT, ET C'EST LE
> PIÈGE PROPRE AUX PETITS VOLUMES.**
> · La règle des 0,3 % s'applique à nous `[SOURCE-PRIMAIRE]`.
> · Postmaster Tools **n'affiche rien** sous un volume quotidien élevé
>   `[SECONDAIRE]` — donc nous ne la mesurerons jamais.
> · **À 40 envois/jour, UNE seule plainte vaut 2,5 %** — plus de huit fois le
>   plafond. Le petit volume ne protège pas : il rend chaque plainte énorme en
>   proportion, et invisible en instrumentation.
>
> C'est la justification la plus solide qu'ait `lib/email-ramp.ts`, et elle
> n'est pas celle qu'on croyait. Le palier ne sert pas à « chauffer le
> domaine » — il sert à ce qu'**aucune journée ne soit assez petite pour
> qu'une plainte unique la fasse basculer**, sur un compteur que personne ne
> peut lire.

> ⚠ **Le PTR ne nous appartient pas.** Relevé le 15/09 :
> `smtp-fr.securemail.pro` (81.88.58.196) **n'a aucun PTR** ;
> `mail-fr.securemail.pro` (81.88.48.101) en a un — `massenet.register.it`.
> ⚠ **Ça ne prouve rien sur nos envois** : l'IP de *soumission* (celle où le
> client SMTP se connecte) n'est pas forcément l'IP de *sortie* (celle qui
> remet le message à Gmail). Seul l'en-tête `Received` d'un message réellement
> reçu dit quelle IP a livré. C'est encore la même vérification qui tranche.

### Le réchauffement de domaine : presque tout est du folklore

Cherché spécifiquement. **Aucun fournisseur de boîtes ne publie de plan de
warm-up chiffré.** Les calendriers « jour 1 : 20 mails, semaine 4 : 200/jour »
viennent presque tous de sociétés qui vendent l'outil de warm-up — la source
la plus intéressée qui soit. `[FOLKLORE]`

Ce qui existe en source primaire, et c'est tout : Google écrit de commencer
avec un **volume faible vers des destinataires engagés**, d'augmenter
**lentement**, d'éviter les **pics**, et qu'un volume **constant** importe
particulièrement pour un domaine neuf. Le seul chiffre trouvé — **+25 % à
+100 % par jour** — est donné dans un contexte de **reprise après rejet**, pas
comme un plan de démarrage. Ne pas le transformer en calendrier.

> **Conséquence directe** : à 5-40/jour nous sommes déjà, en permanence, au
> niveau que ces plans cherchent à atteindre en semaine 1 ou 2. La question du
> warm-up ne se pose quasiment pas pour nous. Ce qui nous protège est la
> **régularité** et la **pertinence du destinataire**, pas une rampe.

---

## Ce qui va dans Vercel, et ce qui n'y va pas

Les mêmes identifiants servent à `/api/send` (`SMTP_HOST` · `SMTP_PORT` ·
`SMTP_USER` · `SMTP_PASS` · `SMTP_FROM`) — **mais relis l'encadré du haut avant
de mettre la même adresse des deux côtés.** Si tu comptes prospecter depuis
l'application, c'est le sous-domaine qu'il faut là, pas la boîte d'envoi.

⚠ Ces variables sont des **secrets de serveur**. Jamais de préfixe
`NEXT_PUBLIC_` : il rendrait le mot de passe de ta boîte lisible dans le
navigateur de n'importe quel visiteur.

---

## 📡 MESURÉ LE 22/09/2026 — délivrabilité DNS (résolveur système, DoH bloqué)

Relevé réel de `eagleyecorp.fr` (Node `dns.resolve` sur 8.8.8.8/1.1.1.1 ; le
sandbox bloque le DNS-over-HTTPS mais pas l'UDP 53 — corrige la note du handoff
qui disait « DNS non bloqué » sans distinguer).

- **MX** : `mail-fr.securemail.pro` (prio 10) → plateforme securemail confirmée,
  `smtp-fr.securemail.pro:465` est le bon couple.
- **SPF** : `v=spf1 include:spf.webapps.net ~all` — **un seul**, et
  `spf.webapps.net` (→ `spf1/spf2.webapps.net`) autorise les envois securemail.
  **RIEN À CHANGER.**
- **DMARC** : `p=quarantine; adkim=s; aspf=s; pct=100` — **alignement STRICT**,
  le point faible. Sur relais hébergé, DKIM `d=securemail.pro` ou un Return-Path
  réécrit désaligne → quarantine. **À relâcher le temps du rodage :**
  `v=DMARC1; p=none; rua=mailto:contact@eagleyecorp.fr; adkim=r; aspf=r; pct=100`
  puis resserrer à `p=quarantine` quand les rapports `rua` montrent PASS.
- **DKIM** : **INTROUVABLE** — 15 sélecteurs probables testés (securemail, amen,
  default, selector1/2, mail, dkim, k1, dates…), aucun publié. Soit sélecteur
  exotique, soit le DKIM « activé le 16/09 » n'est pas réellement en DNS.
  **Preuve par en-tête** : envoi test → Gmail → « Afficher l'original » →
  lire `DKIM-Signature: d= s=` + les verdicts SPF/DKIM/DMARC. C'est le seul
  moyen fiable de connaître le sélecteur et de vérifier `d=eagleyecorp.fr`.

> ⚠ Ce test d'en-tête est LE MÊME geste que la preuve d'envoi attendue depuis
> le 18/09 : un envoi `/recette` vers `eagleyecorp.ad@gmail.com` prouve le SMTP
> ET révèle l'état DKIM/DMARC. Deux blocages levés d'un seul envoi.
