# Message à envoyer à Scintia — prêt à copier

Trois versions selon le canal. Toutes disent la même chose : le constat, la
correction, et aucune contrepartie demandée.

**La posture qui compte :** tu donnes une information vérifiable et gratuite. Tu
ne vends rien dans ce message. Ce qui suit — la conversation sur le flux Lyon,
le partenariat — vient après, et seulement s'ils l'ouvrent eux-mêmes.

---

## Version courte — Slack, WhatsApp, ou à l'oral

> Salut, un truc technique que j'ai vu en regardant nos domaines.
>
> `scintia.ai` a **sept enregistrements DMARC** au lieu d'un. Chacun est
> valide, mais la norme dit qu'au-delà d'un seul, le serveur destinataire les
> ignore **tous** — donc le domaine est traité comme s'il n'avait aucun DMARC.
> Et depuis 2024 Gmail et Yahoo l'exigent.
>
> Concrètement : une partie de nos mails part en spam sans qu'on le voie, et
> les rapports que les sept adresses `rua=` attendent n'arriveront jamais.
>
> La correction c'est une ligne : supprimer les sept, en publier un seul avec
> plusieurs destinataires dedans. Cinq minutes chez le registrar. Je t'ai fait
> le détail si tu veux, dis-moi à qui l'envoyer.

---

## Version email — à un responsable technique

**Objet :** `scintia.ai` — 7 enregistrements DMARC, correction en 5 minutes

> Bonjour,
>
> En vérifiant la configuration mail de nos domaines, j'ai relevé un point sur
> `scintia.ai` qui vous coûte probablement des emails, et je préfère vous le
> signaler.
>
> **Le constat.** `_dmarc.scintia.ai` renvoie sept enregistrements DMARC
> concurrents. Chacun est syntaxiquement valide — c'est ce qui rend l'erreur
> difficile à voir. Mais la RFC 7489 §6.6.3 impose au serveur destinataire
> d'arrêter la découverte de politique dès qu'il en trouve plus d'un : DMARC
> n'est alors **pas appliqué du tout**. Sept enregistrements valides donnent le
> même résultat que zéro.
>
> **Ce que ça implique.** Depuis 2024, Gmail et Yahoo exigent DMARC des
> expéditeurs en volume. Sans politique applicable, le placement en boîte de
> réception se dégrade — et surtout, c'est silencieux : aucun signal ne remonte
> côté expéditeur. Les rapports que les sept adresses `rua=` attendent ne sont
> jamais générés.
>
> **La correction.** Supprimer les sept TXT sur `_dmarc`, en publier un seul :
>
> `v=DMARC1; p=none; rua=mailto:contact@scintia.ai,mailto:support@scintia.ai; fo=1`
>
> Les destinataires des rapports se listent séparés par une virgule dans le
> même enregistrement — c'est exactement ce que les sept auteurs cherchaient à
> faire. Vérification : `dig +short TXT _dmarc.scintia.ai` doit renvoyer **une**
> ligne.
>
> Le reste de votre configuration est bon : SPF en `-all`, DKIM actif sur
> selector1 et selector2. C'est le seul point à corriger.
>
> Le détail complet est en pièce jointe. Constat établi uniquement à partir
> d'enregistrements DNS publics — aucun accès à vos systèmes.
>
> Bien à vous,
> Zakaria Tazi

*(joindre `docs/SCINTIA-DELIVRABILITE.md`)*

---

## Ce qu'il faut savoir avant d'envoyer

**À qui.** Celui qui a la main sur la zone DNS — souvent le CTO, l'infra, ou le
prestataire IT. Les quatre noms visibles dans les enregistrements
(`j.point`, `p.lebailly`, `m.demir`, `a.fekiri`) ont chacun essayé de recevoir
les rapports : l'un d'eux est probablement le bon interlocuteur, ou saura qui
l'est.

**Le ton.** Factuel, jamais donneur de leçons. Sept personnes ont ajouté leur
enregistrement avec une bonne intention et une syntaxe correcte ; le piège est
subtil et très répandu. Ce n'est pas une négligence, c'est un défaut de
coordination.

**Ne demande rien en échange.** C'est ce qui rend le geste crédible. Si la
conversation s'ouvre ensuite sur le flux Lyon ou un partenariat, tant mieux —
mais ça ne doit pas être dans ce message.

**Vérifie avant d'envoyer.** Quelqu'un a peut-être corrigé entre-temps :

```bash
dig +short TXT _dmarc.scintia.ai
```

Ou depuis ALPHA : *Réglages → Délivrabilité du domaine* → taper `scintia.ai` →
« Vérifier ». Envoyer un constat périmé annulerait tout le bénéfice.

---

## Et pour `eagleye.fr`, le même sujet en miroir

Ton domaine a le problème inverse : **aucun DMARC du tout**, et pas de DKIM
détecté. Corrige le tien avant ou en même temps — c'est plus confortable de
signaler un défaut quand le sien est réglé.

```
TXT  _dmarc.eagleye.fr   v=DMARC1; p=none; rua=mailto:postmaster@eagleye.fr; fo=1
```

Plus DKIM à activer dans l'espace client OVH (une case à cocher). Détail dans
`docs/ENVOI.md`.
