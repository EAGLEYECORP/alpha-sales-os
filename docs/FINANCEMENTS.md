# ON EST ÉLIGIBLE À QUOI — les autres guichets, instruits

> **Écrit le 4 septembre 2026**, en suite directe du verdict French Tech 2030
> (`docs/DOSSIER-FRENCH-TECH-2030.md` §1 : **non recevable**, seuil de 3 M€).
> La question posée était : *« on est éligible à quoi, regarde les autres
> fonds »*. Voici la réponse, guichet par guichet, avec ce qui disqualifie
> quand ça disqualifie.
>
> ⚠ **Ce document est une instruction sur pièces, pas un accord.** Tout ce qui
> suit vient de recherches publiques faites le 4/09/2026 et des faits vérifiés
> dans ce dépôt. **Aucun organisme n'a été contacté.** Un chargé d'affaires
> Bpifrance ou un comité d'agrément peut trancher autrement — dans les deux
> sens. Les barèmes bougent à chaque loi de finances.

---

## 0. LA SEULE CHOSE À VÉRIFIER AVANT DE LIRE LE RESTE

**Quelle est la date d'immatriculation d'EAGLEYE CORP ?**

Elle décide, à elle seule, de la moitié du tableau. Presque tout ce qui finance
le stade pré-revenu est réservé aux sociétés **jeunes** — moins d'un an, moins
de trois ans, moins de huit ans selon le dispositif.

Ce qu'on sait, écrit dans nos propres mentions légales : **SIREN 831 729 934**,
RCS Lyon (`legal/MENTIONS-LEGALES.md`).

Ce que ça suggère, et **ce n'est qu'une inférence** : les SIREN sont attribués
par l'INSEE dans l'ordre, et la tranche `831 xxx xxx` correspond à des
immatriculations de **2017**. Si c'est exact, EAGLEYE CORP a **environ neuf
ans**, et les guichets « création » sont fermés depuis longtemps.

> **Je n'ai pas pu le vérifier depuis ici** : `recherche-entreprises.api.gouv.fr`
> et l'annuaire des entreprises sont bloqués par le proxy sortant de ce bac à
> sable (`connect_rejected`), et la recherche web ne remonte pas les registres
> français. **Vérification : 10 secondes sur
> `annuaire-entreprises.data.gouv.fr`, tape le SIREN.**

**Note la date, elle commande tout le reste.** Le tableau ci-dessous suppose le
cas défavorable (société de 2017). Chaque ligne dit ce qui change si la société
est en réalité récente.

---

## 1. LE TABLEAU

| Dispositif | Ce qu'il donne | La condition qui mord | Notre état | Verdict |
|---|---|---|---|---|
| **French Tech 2030** | accompagnement | ≥ 3 M€ levés/CA depuis 2024 | 0 € | ❌ tranché le 3/09 |
| **Bourse French Tech (Bpifrance)** | jusqu'à 30 k€ (50-70 % des dépenses) | société de **moins d'un an**, projet validé par un incubateur/accélérateur **labellisé** | ~9 ans (à vérifier), aucun incubateur | ❌ sauf surprise sur la date |
| **Bourse French Tech Émergence** | jusqu'à 90 k€ | pré-création ou < 1 an, **deeptech** | ni l'un ni l'autre | ❌ |
| **JEI / JEIC / JEIR / JEII** | exonérations de cotisations patronales, CFE, foncier | < 8 ans **et** 15-20 % de dépenses R&D sur les charges totales (20 % depuis le 1/03/2025) | probablement > 8 ans ; **et zéro salaire, donc zéro cotisation à exonérer** | ❌ deux fois |
| **CIR** (crédit d'impôt recherche) | 30 % des dépenses de R&D | de la **recherche** : état de l'art, incertitude scientifique levée | écrire un CRM en Next.js n'est pas de la R&D, quel qu'en soit le soin | ❌ et ne pas insister |
| **CII** (crédit d'impôt innovation) | **20 %** des dépenses, plafond 400 k€/an, **prorogé jusqu'au 31/12/2027** | conception de **prototype d'un produit nouveau**, sur des dépenses **comptabilisées** | le produit qualifie plausiblement ; **les dépenses, non : il n'y a ni salaire, ni amortissement, ni sous-traitance agréée** | ⚠ 20 % de zéro = zéro **aujourd'hui**. Voir §2 |
| **Prêt Amorçage Création (AURA)** | jusqu'à 100 k€ | entreprise innovante de **moins de 3 ans** | probablement > 3 ans | ❌ sauf surprise sur la date |
| **Aides régionales à l'innovation (AURA)** | subvention / avance | siège en AURA ✅ · **fonds propres ≥ aide demandée** | fonds propres proches de zéro | ❌ sur les fonds propres, pas sur le siège |
| **Fonds régional d'amorçage** | ticket 50-200 k€ | c'est de l'**investissement en capital** : il faut céder des parts et présenter une trajectoire | pas de trajectoire chiffrable sans un seul client | ❌ pour l'instant |
| **i-Lab / i-Nov** | jusqu'à 600 k€ | innovation **de rupture**, deeptech, jury national | non | ❌ |
| **Réseau Entreprendre** | prêt d'honneur 30-90 k€ | viser **≥ 5 emplois à 3 ans** | un fondateur seul | ❌ |
| **Initiative France** (Initiative Lyon Métropole) | prêt d'honneur 3-50 k€, **0 %, sans garantie** | création / reprise / **développement** — le volet développement n'est pas fermé aux sociétés établies | à instruire | ⚠ **le seul « oui » plausible du tableau** — voir §2 |

---

## 2. CE QUI RESTE VRAIMENT ATTEIGNABLE — deux lignes, pas douze

### 2.1 Le prêt d'honneur « développement » (Initiative Lyon Métropole)

C'est le seul guichet du tableau qui ne se ferme ni sur l'âge, ni sur la R&D,
ni sur les fonds propres. Prêt personnel **à 0 %, sans garantie**, remboursable,
typiquement **8 000 à 15 000 €**, avec un effet de levier bancaire documenté
(un prêt d'honneur débloque en général un crédit bancaire de 5 à 7 fois son
montant).

**Ce qu'il faut savoir avant d'y aller, et qui n'est pas agréable :**
- c'est un **prêt à la personne**, pas une subvention à la société. Il se
  rembourse, et c'est Zakaria qui le doit ;
- le comité regarde d'abord **le plan de financement et les premières
  recettes**. Zéro client, c'est la question qui tombera en premier ;
- l'effet de levier bancaire ne sert que si on veut emprunter. Emprunter pour
  quoi ? Il n'y a pas d'achat à financer : le produit est écrit, l'infra coûte
  quelques dizaines d'euros par mois.

**Action, si on y va** : un appel à Initiative Lyon Métropole pour poser deux
questions — *« le volet développement est-il ouvert à une société de 2017 ? »*
et *« quel niveau de recettes attend le comité ? »*. Trente minutes, pas huit
heures de dossier.

### 2.2 Le CII — pas maintenant, mais à câbler *avant* de dépenser

20 % des dépenses de conception de prototype, jusqu'à 80 k€ par an, et c'est
**restituable** à une PME (on n'a pas besoin d'être bénéficiaire pour toucher).
Le produit — un agent vocal conforme à l'article 50, une architecture
dé-américanisable — a un dossier défendable.

**Le blocage n'est pas l'éligibilité du produit, c'est l'absence de dépense.**
Un crédit d'impôt est un pourcentage : sans salaire versé, sans amortissement,
sans facture de bureau d'études agréé, il porte sur zéro. Aujourd'hui, il vaut
zéro euro.

**Ce qui le rend réel, dans cet ordre** : le jour où il y a un salaire (même
partiel) ou une première dépense de développement facturée, elle doit être
**comptabilisée comme telle dès le premier euro**. Reconstruire l'assiette a
posteriori est le grand classique du CII refusé. C'est un réflexe comptable à
prendre avant, pas un dossier à monter après.

---

## 3. L'ANGLE QUI VAUT PLUS QUE TOUTES CES LIGNES

**Le client peut être subventionné à notre place.**

La Région Auvergne-Rhône-Alpes finance, via son opérateur *Entreprises &
Numérique*, un dispositif d'accompagnement à la digitalisation et à
l'automatisation — **jusqu'à 16 000 €, soit 50 % de la dépense**, pour des
TPE/PME de moins de 50 salariés dont le siège est en AURA, après un diagnostic
de maturité numérique. France Num tient en parallèle un réseau d'**Activateurs**
référencés.

Notre ICP est exactement cette population : artisans, commerces et PME
d'Auvergne-Rhône-Alpes de moins de dix salariés.

> **Un client à qui on annonce 10 000 € et qui n'en paie que la moitié, c'est
> une objection prix qui tombe. Aucune subvention à nous n'a cet effet-là.**

**Ce qui reste à vérifier, et ce n'est pas un détail** :
1. le périmètre exact — ces dispositifs financent souvent le **conseil et le
   diagnostic** plus volontiers que l'achat d'un logiciel ;
2. les conditions pour être **prestataire référencé** (Activateur France Num,
   référencement régional), et si c'est un prérequis au financement du client ;
3. si le montage est éligible quand le prestataire est lui-même en AURA.

Les sources publiques renvoient explicitement vers la Région, la CCI et la CMA
pour confirmation. **Deux appels — CCI Lyon Métropole et Entreprises &
Numérique — valent plus que n'importe quel dossier de subvention pour nous.**

---

## 4. LA RÈGLE À GARDER

Aucun de ces dispositifs ne finance « pas encore de client ». Tous financent
**une dépense déjà engagée**, **un emploi déjà créé** ou **une R&D déjà faite**.
Ils sont des multiplicateurs, et le nôtre est encore à zéro.

- Un dossier de subvention coûte entre 8 et 40 heures.
- La même semaine passée en appels sortants a produit, elle, des rendez-vous.
- Et la ligne qui débloque **tout le reste**, French Tech 2030 compris, c'est
  la même : **le premier chiffre d'affaires.**

L'ordre est donc : **vendre**, puis instruire le prêt d'honneur avec les
premières recettes en main, puis câbler le CII sur les premières dépenses. Pas
l'inverse.

**La seule action à faire tout de suite, parce qu'elle sert la vente et non la
paperasse : les deux appels du §3.**

---

## Sources (consultées le 4 septembre 2026)

- Bourse French Tech — [catalogue Bpifrance](https://www.bpifrance.fr/catalogue-offres/bourse-french-tech-emergence)
- JEI — [Urssaf](https://www.urssaf.fr/accueil/employeur/beneficier-exonerations/exonerations-secteur-activite/jeunes-entreprises-innovantes.html)
- CII — [Service Public Entreprendre](https://entreprendre.service-public.gouv.fr/vosdroits/F35494?lang=fr) · [Bpifrance Création](https://bpifrance-creation.fr/encyclopedie/aides-a-creation-a-reprise-dentreprise/aides-a-linnovation/cii-credit-dimpot)
- Aides AURA — [France 2030 Auvergne-Rhône-Alpes](https://france2030.auvergnerhonealpes.fr/projets-d-innovation/)
- Numérique AURA — [MAPi / Infogreffe](https://mesaidespubliques.infogreffe.fr/aides/projets/transition-numerique/region-auvergne-rhone-alpes)
- Prêts d'honneur — [Initiative France](https://wisestart.fr/guides/aides/pret-honneur-initiative-france/)
