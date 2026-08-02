# SCINTIA — pourquoi vos emails tombent en spam, et comment le corriger

**Constat technique · établi le 2 août 2026 à partir des enregistrements DNS publics de `scintia.ai`**
Zakaria Tazi — EAGLEYE CORP

---

## En une phrase

Votre domaine a **sept enregistrements DMARC concurrents**. La norme impose au
serveur destinataire d'en ignorer la totalité dès qu'il en trouve plus d'un :
`scintia.ai` est donc traité **exactement comme un domaine sans aucun DMARC**,
alors que sept personnes ont pris la peine d'en publier un.

La correction prend cinq minutes et ne demande aucun outil.

---

## Ce qui est bien configuré chez vous

Deux des trois piliers sont en place, et bien :

```
MX      scintia-ai.mail.protection.outlook.com        → Microsoft 365
SPF     v=spf1 include:spf.protection.outlook.com -all
DKIM    selector1 → selector1-scintia-ai._domainkey.scintia1.r-v1.dkim.mail.microsoft
        selector2 → selector2-scintia-ai._domainkey.scintia1.r-v1.dkim.mail.microsoft
```

Le SPF est en `-all` (rejet strict, la bonne pratique) et DKIM signe bien vos
messages. **Le problème n'est ni l'un ni l'autre.**

---

## Le problème

`_dmarc.scintia.ai` renvoie **sept enregistrements** :

```
1. v=DMARC1; p=none; rua=mailto:j.point@scintia.ai
2. v=DMARC1; p=none; rua=mailto:p.lebailly@scintia.ai
3. v=DMARC1; p=none; rua=mailto:m.demir@scintia.ai
4. v=DMARC1; p=none; rua=mailto:a.fekiri@scintia.ai
5. v=DMARC1; p=none
6. v=DMARC1; p=none; rua=mailto:support@scintia.ai
7. v=DMARC1; p=none; rua=mailto:contact@scintia.ai
```

Chacun est **valide pris isolément**. C'est ce qui rend l'erreur invisible :
chaque personne qui a ajouté le sien a vérifié sa syntaxe, et elle était bonne.

Mais la RFC 7489, section 6.6.3, est explicite :

> *If the remaining set contains multiple records or no records, policy
> discovery terminates and DMARC processing is not applied to this message.*

Traduction : dès que le serveur destinataire trouve **plus d'un**
enregistrement, il arrête la recherche et **n'applique pas DMARC du tout**. Il
refuse de deviner lequel des sept fait foi.

**Sept enregistrements valides produisent exactement le même résultat que
zéro.**

---

## Pourquoi ça vous coûte des emails

Depuis février 2024, **Gmail et Yahoo exigent DMARC** de tout expéditeur qui
envoie en volume. Sans politique DMARC applicable :

- vos messages perdent un signal d'authentification majeur au moment du
  filtrage ;
- votre domaine devient usurpable — n'importe qui peut envoyer en votre nom
  sans être bloqué ;
- **vous ne recevez aucun rapport**. Les sept adresses `rua=` ci-dessus
  n'ont jamais rien reçu, et ne recevront jamais rien : la découverte de
  politique s'arrête avant.

Le plus coûteux est le troisième point. Le problème est **silencieux** : rien
ne remonte côté expéditeur. On croit que le message est arrivé, on conclut que
le prospect n'a pas répondu, et on passe à autre chose.

### Un cas documenté, chez un de vos prospects

Cabinet Lamy ***NOM-RETIRE***, juillet 2026, réponse reçue mot pour mot :

> « Le mail est tombé en spam, et on va le transmettre à la bonne personne. »

Un dossier ralenti, une relance de plus, et la chance qu'ils ne l'aient pas
transmis. C'est ce que produit ce défaut, dossier après dossier.

---

## La correction — 5 minutes

L'origine est facile à reconstituer : **chaque personne a ajouté son propre
enregistrement pour recevoir les rapports.** C'est une intention correcte avec
un moyen qui ne marche pas — DMARC n'accepte **qu'un seul enregistrement par
domaine**, mais cet enregistrement peut envoyer ses rapports à **plusieurs
adresses**.

### Étape 1 — supprimer les sept

Dans la zone DNS de `scintia.ai` (chez votre registrar), supprimer **tous** les
enregistrements TXT du sous-domaine `_dmarc`.

### Étape 2 — en publier un seul

```
Type   TXT
Nom    _dmarc
Valeur v=DMARC1; p=none; rua=mailto:contact@scintia.ai,mailto:support@scintia.ai; fo=1
```

Les destinataires des rapports se listent **séparés par une virgule dans le
même enregistrement**. Vous pouvez en mettre plusieurs — c'est exactement ce
que les sept auteurs cherchaient à faire.

### Étape 3 — vérifier

Depuis n'importe quel terminal :

```bash
dig +short TXT _dmarc.scintia.ai
```

**Une seule ligne doit s'afficher.** Si vous en voyez plusieurs, la
suppression n'est pas complète et le problème persiste entièrement.

La propagation prend de quelques minutes à quelques heures.

### Étape 4 — durcir, dans trois à quatre semaines

`p=none` observe mais ne protège pas : il laisse passer les usurpations. Une
fois que les rapports arrivent (ils arriveront enfin) et confirment que tous
vos flux légitimes passent :

```
v=DMARC1; p=quarantine; pct=100; rua=mailto:contact@scintia.ai; fo=1
```

Puis, plus tard, `p=reject`.

> **Ne sautez pas l'étape d'observation.** Passer directement en `reject` avec
> des flux non identifiés — un outil marketing, un CRM, un formulaire du site
> qui envoie en votre nom — bloquerait vos propres messages légitimes.

---

## Ce qu'il faut regarder ensuite

Une fois les rapports reçus, ils diront si des services tiers envoient en votre
nom sans être couverts par votre SPF. Cas fréquents chez une entreprise
équipée : outil d'emailing, CRM, plateforme de signature électronique,
formulaire de contact du site.

Chacun doit soit être ajouté au SPF, soit signer en DKIM — sinon il échouera
DMARC dès que vous durcirez la politique.

---

## Résumé

| | État | Action |
|---|---|---|
| MX | Microsoft 365 | rien à faire |
| SPF | `-all`, strict | rien à faire |
| DKIM | selector1 + selector2 actifs | rien à faire |
| **DMARC** | **7 enregistrements = politique annulée** | **n'en garder qu'un** |

Une seule ligne à changer. C'est le meilleur rapport effort/résultat disponible
sur votre délivrabilité aujourd'hui.

---

*Constat établi à partir d'enregistrements DNS publics, vérifiable par
quiconque avec `dig` ou n'importe quel outil d'analyse DMARC. Aucun accès à vos
systèmes n'a été utilisé ni requis.*
