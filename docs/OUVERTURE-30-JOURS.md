# OUVRIR ALPHA SALES OS 30 JOURS — téléphonie grisée, facture bornée

> Décidé le 16/09/2026. Ce document dit ce qui EST branché, ce que ça coûte au
> pire, et les trois gestes qui restent côté Zakaria. Tous les chiffres
> viennent du code.

---

## 1. CE QUI ÉTAIT FAUX AVANT D'ÉCRIRE UNE LIGNE

L'essai trente jours existait entièrement — durée, plafond de coût, colonne en
base, tests verts — et **il ne s'était jamais ouvert une seule fois**. Mesuré,
pas supposé :

| Pièce | État réel au 16/09 |
|---|---|
| `DUREE_ESSAI_JOURS = 30` | déclarée, appliquée par `etatEssai` |
| `PLAFOND_ESSAI_COUT_EUR = 30` | déclaré, arbitré par `etatEssai` |
| `cout_consomme_eur` | **écrit par ZÉRO fichier du dépôt** |
| un chemin qui DÉMARRE un essai | **aucun** (`finDEssai()` importée nulle part) |
| `ESSAI_JOURS` servi sur `/souscrire` | **14**, pendant que le serveur en applique 30 |

Le troisième point annule les deux premiers, et dans le sens qu'on n'attend
pas : la colonne vaut `null` par défaut, `etatEssai` **ferme** sur `null`
(l'inconnu vaut refus), donc tout compte passé en `statut = 'essai'` retombait
au socle gratuit **le jour même**. Une garde fail-closed parfaitement écrite,
posée sur un compteur qui n'existe pas, ne protège rien : elle interdit tout,
en silence.

---

## 2. CE QUE « SANS QUE ÇA NOUS COÛTE » VEUT DIRE, EXACTEMENT

C'est la partie du raisonnement qui décide de tout, et elle tient en une
multiplication :

```
ce que ça nous coûte  =  (nombre d'essais)  ×  (plafond par compte)
```

**Le seul terme borné était celui qu'une ouverture cherche à faire monter.**
Vingt comptes parfaitement dans les clous à 30 € = 600 €, sans qu'aucune garde
ne se déclenche et sans qu'aucune ligne de code ne soit fausse.

D'où **deux plafonds, et non un** :

| | Valeur | Ce qu'il borne |
|---|---|---|
| `PLAFOND_ESSAI_COUT_EUR` | 30 € | ce qu'UN compte peut consommer |
| `ENVELOPPE_OUVERTURE_EUR` | 300 € | ce que l'OUVERTURE ENTIÈRE peut coûter |

**La dépense totale de l'ouverture est donc connue d'avance, quel que soit le
succès.** C'est la seule forme sous laquelle la phrase se dit sans mentir : ça
ne nous coûte pas *rien*, ça nous coûte **au plus 300 €**.

> ⚠ Ce que l'enveloppe coûte, et il faut le savoir : **le compte qui arrive
> après l'épuisement reçoit un essai dégradé sans avoir rien fait de mal.**
> C'est injuste et c'est assumé — l'inverse (facture ouverte) ne se découvre
> qu'un mois plus tard et ne se répare pas. Il retombe au **socle gratuit**,
> jamais au néant.

> ⚠ **300 € et 30 € sont des DÉCISIONS**, pas des mesures. Ce qui est mesuré,
> c'est le coût/minute (`voice-costs`) et le prix des jetons (`token-budget`).
> Le premier mois dira ce qu'un essai consomme vraiment, et ce chiffre-là
> vaudra plus que tout ce document.

### La sortie qui, elle, est vraiment gratuite : le BYOK

`origine: "locataire"` ⇒ **débit ZÉRO**. Un locataire qui apporte sa clé IA ou
son SMTP dans Réglages ne consomme **ni son plafond ni l'enveloppe** : son
essai peut durer, et il ne nous coûte pas un centime.

Les deux plafonds ne bornent donc que les comptes qui dépensent sur NOTRE clé —
c'est-à-dire exactement la population à convertir, au BYOK ou à l'abonnement.
Quand l'enveloppe se ferme, le message le dit et pointe vers les Réglages.

---

## 3. « TÉLÉPHONIE GRISÉE » — et pourquoi elle seule

`HORS_ESSAI = ["alpha-voice"]`. Le critère n'est pas « c'est cher », sinon on
grise au feeling. C'est le croisement de **deux propriétés qu'aucune autre
brique ne réunit** :

1. **Aucun chemin d'identifiants par locataire.** `Capacite` vaut
   `"ia" | "email"` : l'IA et l'envoi peuvent être payés par le locataire
   lui-même. La téléphonie, non — sa dépense nous revient **toujours**.
2. **Le coût est à la minute, sans plafond naturel.** Un jeton s'arrête avec
   la réponse ; une ligne facture tant que quelqu'un parle. 0,0563 €/min
   mesurés : un seul compte motivé consomme en un après-midi ce que l'essai
   entier prévoit.

Et un troisième motif, qui n'est pas un coût : **`voice/agent.py` tourne en
local chez nous**. Un appel composé sans agent vivant sonne dans le vide. Même
gratuite, on ne l'ouvrirait pas à trente inconnus.

### Ce qui rend la garantie réelle

Le périmètre de l'essai est tenu par **le code**, pas par la base :

- `BRIQUES_ESSAI` se **dérive** (`BRIQUES_CONNUES` moins `HORS_ESSAI`) — une
  brique ajoutée demain entre automatiquement dans l'essai, sauf si quelqu'un
  l'exclut dans un diff qui se voit ;
- `resoudreDroits` **substitue** cette liste à la colonne `bricks` : une ligne
  d'essai écrite à la main avec `{alpha-voice}` **n'ouvre pas** nos minutes ;
- la migration 012 pose `bricks = '{}'` et **ne nomme aucune brique** — deux
  définitions du périmètre finiraient par diverger, et c'est le SQL qui
  gagnerait, parce qu'il s'exécute en premier et que personne ne le relit.

L'écran, lui, n'a rien demandé : `/voice` est **grisé avec son motif et sa
porte d'achat** (`lib/verrous.ts`), parce qu'un compte d'essai ne possède
simplement pas la brique. Doctrine du rail inchangée — `maitreSeul` masque,
`brique` grise.

---

## 4. LE COMPTEUR — comment il débite

Deux points, et **deux seulement**, décident qui paie ; c'est là que le débit
est posé :

| Canal | Point de débit | Montant |
|---|---|---|
| IA | `moteurIADeLaRequete` | budget de jetons de la route × prix indicatif |
| Email | `resoudreSmtp` | `COUT_EMAIL_EUR` (0,01 €) |

Règles qui tiennent l'ensemble :

- **On débite AVANT l'appel.** Un débit a posteriori laisse passer un appel
  énorme puis constate le dépassement — le plafond ne bornerait plus rien, il
  raconterait ce qui s'est déjà produit.
- **On surestime, jamais l'inverse.** Une route qui échoue après résolution
  aura été débitée pour rien : un essai fermé trop tôt se répare en une
  requête, une facture découverte trente jours plus tard ne se répare pas.
- **Un débit qui échoue REFUSE la dépense.** C'est la moitié qui fait que le
  plafond existe : sans elle, il suffit que l'écriture échoue en boucle pour
  consommer sans aucune limite — et c'est précisément la panne qu'un usage
  intensif provoque.
- **L'incrément est atomique** (fonction SQL `debiter_essai`). Lire-puis-écrire
  perd une dépense sur deux appels simultanés, proportionnellement au débit.

> ⚠ **Un envoi d'email n'est pas gratuit, même s'il ne se facture pas au
> message.** Ce qu'il consomme n'est pas de l'argent : c'est la réputation d'un
> domaine **partagé avec les mails de confirmation Supabase**
> (`docs/SMTP-SUPABASE-AMEN.md`). Un débit nul la rendrait invisible, donc
> illimitée. Le montant est arbitraire et le dit ; ce qui ne l'est pas, c'est
> qu'il ne soit pas nul.

> ⚠ Deux routes résolvent **sans** dépenser, et c'est explicite :
> `/api/health` (elle rapporte l'état du moteur) et
> `/api/deliverability/dns` (elle lit du DNS public). Le défaut est de
> débiter — une route qui oublie l'option débite pour rien, ce qui se répare ;
> l'inverse dépense sans compter, ce qui ne se répare pas.

---

## 5. CE QUI RESTE À FAIRE, ET DANS CET ORDRE

1. **Migration `012-ouverture-30-jours.sql`** dans le SQL editor.
   ⚠ Elle crée le trigger d'inscription **et** ouvre un essai aux comptes déjà
   inscrits (trente jours à compter de maintenant, pas de leur inscription —
   un essai rétroactif déjà expiré est une insulte polie).
   ⚠ **Non testée contre un vrai projet Supabase** : le proxy ne l'atteint pas
   d'ici. Relis la sortie de l'éditeur, ne suppose pas que ça a marché.
2. **Vérifier sur un compte de test** : `/voice` grisé, `/campaigns` ouvert,
   `/agent` ouvert. Puis regarder `entitlements.cout_consomme_eur` monter après
   quelques appels — c'est le seul geste qui prouve que le compteur tourne.
3. **Relever, à J+7, ce qu'un essai consomme réellement.** C'est la mesure qui
   remplacera les deux décisions de ce document. Si la médiane est à 2 €,
   l'enveloppe tient 150 comptes et le plafond par compte est trop bas pour
   gêner qui que ce soit. Si elle est à 25 €, il faut trancher autrement.

### ✅ Fait depuis — l'essai se dit à celui qui le vit (17/09)

`components/billing/etat-essai-panel.tsx`, monté sur `/compte`.

Ce document annonçait ici que personne n'affichait la `phrase` d'`etatEssai`.
Le trou était **pire que ça** : un essai fermé retombe au socle gratuit, qui
porte `statut: "actif"`. Vu de l'écran, **un essai terminé était donc
indistinguable d'un compte qui n'en a jamais eu** — le locataire perdait
`/campaigns`, `/agent` et `/audits` du jour au lendemain et en déduisait une
panne.

- L'état d'essai **traverse maintenant la chaîne entière** (droit → route →
  hook → composant → page), et un test suit la chaîne plutôt que les maillons.
- Il repart **même quand l'essai est fermé**, avec sa raison.
- **Trois états, jamais deux** : pas d'essai ⇒ rien à l'écran ; en cours ⇒ les
  **deux** limites affichées ensemble (27 jours restants et 1 € restant est un
  cas réel) ; terminé ⇒ la cause, et « ce n'est pas toi » quand la fermeture
  vient de notre enveloppe.
- **L'enveloppe ne descend jamais** jusqu'au locataire, et un test l'interdit
  dans la route comme dans le composant.
- Le panneau **n'autorise rien** : `autorise()` ne lit pas `essai`, et c'est
  testé.

### Ce qui n'est PAS fait, et qu'il faut savoir

- **L'enveloppe n'alerte personne.** Elle ferme, silencieusement. Le locataire
  l'apprend maintenant sur `/compte` ; NOUS, non — savoir qu'elle s'est fermée
  demande toujours une requête à la main.
- **Rien ne mesure ce que l'ouverture RAPPORTE.** Le compteur dit ce qu'elle
  coûte. Le taux de conversion d'un essai vers une vente reste `null`, comme
  tout le reste : `gagnes: 0`.
