# VÉRIFIER QUE ÇA MARCHE — la recette en conditions réelles

> 📌 **Ce document ne dit pas QUOI FAIRE** — ça, c'est `docs/A-FAIRE-ZAKARIA.md`
> (l'ordre imposé) et `docs/CHECKLIST-LANCEMENT.md` (le détail). Celui-ci dit
> **COMMENT SAVOIR QUE C'EST FAIT**, ce qui n'est pas la même chose : une
> étape « faite » qu'on ne peut pas vérifier n'est pas faite.
>
> ⚠⚠ **POURQUOI IL EXISTE.** Le 16/09, j'ai frappé un serveur de production et
> vérifié **tous les refus** : rien ne s'ouvre par erreur
> (`docs/BYOK-CHIFFRAGE.md` §9). Mais je n'ai pu vérifier **aucune
> acceptation** — ça demande un compte, une base et de vraies clés, les trois
> hors de portée de la session. **Cette liste est exactement la moitié
> manquante.** Elle ne se délègue pas : elle se clique.

**Règle de lecture** : chaque test dit le geste, le résultat ATTENDU, et la
**signature de la panne** — à quoi ressemble un échec. Sans elle, on confond
« ça ne marche pas » et « ça marche autrement que je croyais ».

---

## 0. AVANT DE TOUCHER À QUOI QUE CE SOIT — l'état de départ

Connecté, ouvre `/api/health` et garde la réponse sous les yeux. C'est le
tableau de bord de tout ce qui suit.

```
capabilities.ai        → configured, engines, origine
capabilities.email     → configured, host, from, auth
auth.serverEnv         → les variables Supabase publiques sont-elles là
auth.serverEnforced    → REQUIRE_AUTH est-il actif
auth.misconfigured     → REQUIRE_AUTH sans SUPABASE_JWT_SECRET (le piège)
auth.verrou            → l'app est-elle réellement protégée
proprietaire.coherent  → les deux listes OWNER_EMAILS concordent-elles
```

**Note l'état AVANT.** La moitié des vérifications qui suivent consistent à
constater qu'un champ a CHANGÉ.

---

## 1. LE SOCLE — sans lui, rien d'autre ne signifie quoi que ce soit

### 1.1 Les quatre variables, et `REQUIRE_AUTH` en DERNIER

☐ `/api/health` → `auth.serverEnforced: true` et `auth.misconfigured: false`

> **Signature de la panne** : `misconfigured: true` ⇒ `REQUIRE_AUTH` est posé
> sans `SUPABASE_JWT_SECRET`. Les API de données répondent **503**. Ce n'est
> pas un bug, c'est le fail-closed : la misconfiguration ferme, elle n'ouvre
> jamais. Pose le secret, ou retire `REQUIRE_AUTH`.

☐ `/api/health` → `proprietaire.coherent: true`

> **Signature** : `false` ⇒ `OWNER_EMAILS` et `NEXT_PUBLIC_OWNER_EMAILS` ne
> disent pas la même chose. Conséquence visible : tu te connectes et tu es au
> socle gratuit, comme n'importe quel inscrit.

### 1.2 Les migrations 002 → 011

Dans le SQL editor. Une seule requête, et elle dit tout :

```sql
select table_name from information_schema.tables
 where table_schema = 'public'
   and table_name in ('tracking_messages','tenant_credentials',
                      'entitlements','organisations')
 order by table_name;
```

☐ `tenant_credentials` apparaît → **010 est passée**

```sql
-- 009 : la colonne qui fait marcher « provenance au premier message seulement »
select column_name from information_schema.columns
 where table_name = 'tracking_messages' and column_name = 'destinataire';

-- 011 : la capacité « email » est-elle autorisée par la contrainte ?
select pg_get_constraintdef(oid) from pg_constraint
 where conname = 'tenant_credentials_capacite_check';
```

☐ La contrainte affiche `('ia'::text, 'email'::text)` → **011 est passée**

> **Signature** : la contrainte ne montre que `'ia'` ⇒ 011 manque. Le panneau
> « Ta boîte d'envoi » rendra une erreur d'écriture en base à
> l'enregistrement — pas un plantage, un refus.

### 1.3 Es-tu VRAIMENT maître ?

☐ Connecté avec `contact@eagleyecorp.fr`, ouvre **`/payouts`** et **`/offre`**.

> **Attendu** : les deux s'ouvrent.
> **Signature** : redirection vers `/gate` ⇒ c'est le mot de passe
> (`SITE_PASSWORD`) qui garde ces pages, normal. Redirection vers
> `/compte?bloque=…` ⇒ **tu n'es pas reconnu comme maître** : reviens en 1.1.

---

## 2. LE BYOK — la moitié que personne n'a jamais vue fonctionner

> ⚠⚠ **LE TEST 2.1 EST LE PLUS IMPORTANT DE TOUT CE DOCUMENT.** Il ne vérifie
> pas que ça marche : il vérifie que **le refus marche**. Si une clé fausse
> est acceptée, alors `verifie_le` est posé sans vérification — et tout
> l'édifice (« une clé non testée n'ouvre rien ») est du théâtre. Fais-le
> AVANT le test avec la vraie clé, jamais après.

### 2.1 La clé FAUSSE doit être REFUSÉE

☐ Réglages → **Ta clé IA** → colle `ceci-nest-pas-une-cle` → *Vérifier et
enregistrer*

> **Attendu** : refus explicite, avec le détail de l'erreur du fournisseur, et
> **aucune clé active** affichée ensuite.
> **Signature de la panne la plus grave** : « Clé vérifiée et enregistrée » ⇒
> **arrête tout et dis-le moi.** Ça voudrait dire qu'on ouvre une capacité sur
> une faute de frappe, et que l'échec se découvrirait devant un prospect.
> **Autre signature, bénigne** : « le serveur ne peut pas chiffrer » ⇒
> `CREDENTIALS_MASTER_KEY` n'est pas posée. Rien n'est enregistré, et c'est
> volontaire : on ne stocke pas en clair « en attendant ».

### 2.2 La vraie clé doit être acceptée — et ne jamais ressortir

☐ Même écran, vraie clé → *Vérifier et enregistrer*

> **Attendu** : « Clé vérifiée et enregistrée », puis **« Clé active … xxxx »**
> avec les quatre derniers caractères. Ça prend quelques secondes : le serveur
> appelle réellement le fournisseur.

☐ **Recharge la page.** Le champ de saisie doit être **VIDE**, et l'empreinte
toujours affichée.

> C'est le test du « on écrit, on ne relit pas ». Si la clé réapparaît dans le
> champ, elle redescend dans le navigateur — ce que le code est censé
> interdire.

### 2.3 La clé OUVRE réellement quelque chose

☐ Va sur **`/closer`** et lance une réponse IA.

> **Attendu** : ça répond. **C'est la seule preuve que la chaîne entière
> fonctionne** — résolution, déchiffrement, appel avec la bonne clé.
> **Signature** : 403 `brique_absente` ⇒ la clé est enregistrée mais n'ouvre
> pas. Dis-le moi : ça mettrait en cause `cleOuvreLeChemin`, que je n'ai
> jamais pu tester en acceptation.

☐ Ouvre **`/agent`** — fermé avant la clé, il doit s'ouvrir maintenant.

### 2.4 « Oublier » referme

☐ Réglages → *Oublier* → retourne sur `/closer`.

> **Attendu** : l'IA ne répond plus (403). Une capacité qui reste ouverte
> après suppression de la clé voudrait dire qu'on paie pour quelqu'un qui
> n'apporte plus rien.

*(Remets la clé ensuite si tu veux t'en servir.)*

### 2.5 Même série pour la boîte d'envoi

☐ Réglages → **Ta boîte d'envoi** → bon hôte, **mauvais mot de passe** →
*Tester et enregistrer*

> **Attendu** : REFUS, avec le message du serveur SMTP. Le serveur ne résout
> pas l'hôte, il **s'authentifie**.

☐ Puis les vrais identifiants → accepté, « Boîte active ».

---

## 3. L'ENVOI RÉEL — et les trois `pass`

☐ Depuis une fiche, envoie **un** email vers une adresse Gmail que tu possèdes.

☐ Ouvre-le → **⋮ → Afficher l'original** → lis :

```
spf=pass    dkim=pass    dmarc=pass
```

☐ **Relève `s=` et `d=`** dans l'en-tête `DKIM-Signature`. Pas `b=`, qui est
la signature elle-même.

> ⚠ `d=` doit valoir **exactement `eagleyecorp.fr`**. S'il vaut
> `securemail.pro`, DKIM passe et **ne s'aligne pas** (`adkim=s`) — c'est
> alors SPF qui porte tout, sans filet. Détail : `docs/SMTP-SUPABASE-AMEN.md` §3.

☐ Vérifie que le mail est en **boîte principale**, pas en indésirables.

☐ **Clique le lien de désinscription natif** de Gmail (« Se désabonner ») et
regarde où arrive le STOP.

> Il doit arriver dans la boîte **qui a envoyé**. S'il arrive ailleurs, un
> refus ne sera jamais traité par celui qui doit le traiter — et le prospect
> continuera de recevoir des messages après avoir dit non.

☐ **La boucle complète** : l'écran `/recette` teste ouverture, clic, réponse
et STOP en direct. Lance-le une fois, c'est fait pour ça.

---

## 4. LES GARDES DOIVENT MORDRE — en production, pas seulement en test

> Un garde qui n'a jamais refusé en vrai est une intention. Ces quatre-là
> coûtent deux minutes et prouvent que la protection est réelle.

☐ **Écris à une fiche de DÉMONSTRATION** (préfixe `demo-`).
→ attendu : **409**, refus. Un envoi vers ces adresses produit un rebond dur,
et les rebonds comptent contre le domaine pendant des mois.

☐ **Envoie un message SANS « STOP » ni mention de refus.**
→ attendu : **422**, avec la liste de ce qui manque et quoi écrire.

☐ **Premier message à une adresse jamais contactée, sans dire d'où vient
l'adresse.**
→ attendu : **422 provenance**, avec une formulation d'exemple. Sur une
**relance**, le même message doit passer : la mention n'est due qu'au premier.

☐ **Renvoie au même destinataire dans la foulée.**
→ attendu : **409 déjà contacté** (fenêtre de 14 jours).

☐ **Dépasse le palier du jour** (5 envois la première semaine).
→ attendu : **429**, avec le compte et la date du prochain palier. **Ce n'est
pas une panne** — c'est ce qui évite de griller le domaine en un envoi.

---

## 5. LE MULTI-LOCATAIRE — jamais testé par personne

> ⚠ C'est le test qui manque le plus, et le seul qui dise si le produit est
> vendable. Tout le cloisonnement repose dessus.

☐ Crée un **deuxième compte** avec une autre adresse (pas un `OWNER_EMAILS`).

☐ Connecté avec ce compte :

| Ce qu'il tente | Attendu |
|---|---|
| `/payouts`, `/offre` | **refusé** — notre économie |
| `/agent` | **fermé** tant qu'il n'a pas de clé |
| Les campagnes dans la barre | **visibles mais grisées** — on ne peut pas vouloir ce qu'on ne voit pas |
| Alpha CEO | **absent** — griser, c'est annoncer |
| `/aujourdhui`, `/pipeline`, `/closer`, `/cerveau`, `/linkedin`, `/templates` | **ouverts** |

☐ **Il colle SA clé IA** → `/closer` s'ouvre **pour lui**, et ton compte n'est
pas affecté.

☐ ⚠⚠ **Vérifie qu'il ne voit AUCUNE de tes fiches.** C'est la RLS. Si une
seule de tes fiches apparaît chez lui, **arrête tout** : ce n'est plus un bug
d'affichage, ce sont des données de tiers chez un tiers.

---

## 6. CE QUI TOURNE SANS PERSONNE

☐ `python voice/agent.py` lancé → `/moniteur` doit montrer un **battement
récent**.

> Sans lui, la ligne compose, le prospect décroche, **personne ne parle** —
> pire que de ne pas appeler. `lib/presence-agent.ts` refuse de composer sans
> battement, mais vérifie que le voyant dit vrai.

☐ `/moniteur` sur une base **injoignable** doit afficher **un tiret**, jamais
`0`.

> Zéro parce que rien ne tourne, zéro parce qu'on ne voit rien, et zéro parce
> que tout va bien demandent trois gestes opposés. Un écran de supervision qui
> affiche du calme pendant une panne est le pire mode de défaillance qui soit.

---

## CE QUE CETTE LISTE NE COUVRE PAS, ET POURQUOI

- **La téléphonie de bout en bout** (Telnyx → LiveKit → agent → décroché).
  Elle demande un vrai appel vers un vrai numéro, et elle se paie à la minute.
  Elle mérite sa propre séance, pas une ligne au milieu d'une checklist.
- **La charge.** Rien ici ne dit ce qui se passe à 1 000 fiches. Le mur
  `localStorage` (~1 200) et le pipe serveur se testent avec du volume réel,
  qu'on n'a pas.
- **Le taux de plainte.** Obligation réelle (< 0,3 %) et **sans instrument** à
  notre volume : Postmaster Tools n'affiche rien sous plusieurs milliers
  d'envois/jour. À 40 envois/jour, **une seule plainte vaut 2,5 %**. On ne
  saura pas qu'on la dépasse — d'où le palier, qui est la seule protection.

> **Si un seul test de la section 2 ou 5 échoue, dis-le moi avant de
> continuer.** Ce sont les deux zones où je n'ai aucune mesure, et où un
> échec n'est pas un réglage : c'est un défaut de conception que j'aurai
> laissé passer.
