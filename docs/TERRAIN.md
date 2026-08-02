# Entraîner l'intelligence de l'OS sur le terrain

> Comment la connaissance acquise en rendez-vous devient de la capacité
> logicielle. Réponse courte : **on n'entraîne pas un modèle, on
> capitalise un playbook et on l'injecte.**

---

## 1. Pourquoi pas de fine-tuning

Un fine-tuning demande des milliers d'exemples cohérents, coûte cher, et
fige la connaissance dans un modèle qu'on ne peut plus lire ni corriger.
Nous avons quelques dizaines de documents terrain d'une qualité rare —
c'est trop peu pour entraîner, et bien trop précieux pour être dilué.

La bonne méthode, à notre échelle :

```
RDV réel  →  ce qui a marché / cassé  →  lib/playbook.ts  →  prompt système
   ↑                                                              │
   └────────────── l'IA rejoue la méthode maison ←────────────────┘
```

Le playbook est **lisible, versionné, corrigible en une ligne** et il
s'applique immédiatement — à la génération de scripts, au sparring, aux
briefs de tournée, aux réponses aux messages entrants.

## 2. Ce qui a déjà été extrait

`lib/playbook.ts` contient deux couches, tirées des documents réels
(listes d'appels immobilier et auto-écoles, deep-dive carrosserie,
audits d'accueil téléphonique, emails de suivi) :

**`DOCTRINE_TERRAIN` — les invariants**, vrais quelle que soit la
verticale. Extraits, entre autres :

- la phrase de barrage ne se rejoue jamais au décideur ;
- permission cash avant tout (« 30 secondes, sinon je raccroche ») ;
- le ciblage se dit en critère, jamais en volume ;
- l'observation se pose en question, jamais en affirmation ;
- interdits à froid : les € perdus, la note Google, la liste des
  fonctionnalités ;
- deux questions de diagnostic, puis silence ;
- une seule capacité à la bascule, CTA en choix fermé ;
- le coup du méta, au moment exact du « je n'ai pas le temps » ;
- tout chiffre € est diagnostique et présenté comme tel ;
- chaque donnée d'audit porte son niveau de confiance ;
- relire les noms avant d'envoyer.

**`VERTICALS` — la connaissance par métier** : critère de ciblage,
douleur structurelle, ouverture pas à pas, questions de diagnostic,
miroir, interdits spécifiques, objections travaillées avec leurs
contres, et paramètres de chiffrage de la fuite. Quatre verticales
aujourd'hui : immobilier, auto-écoles, garage/carrosserie, santé.

## 3. Où ça agit

| Surface | Effet |
|---|---|
| `/api/ai` (scripts, résumés, prochaine action, réponses) | Le playbook entre dans le prompt système : l'agent cesse le conseil générique et rejoue la méthode. |
| `/api/sparring` | Le prospect joué par l'IA sort les vraies objections du métier ; le coach corrige selon la méthode maison. |
| Deep-dive & audit cadeau | Chiffrage de la fuite avec les paramètres de la verticale, toujours étiqueté « estimation à valider ». |

## 4. La boucle d'entretien — le seul rituel à tenir

Après chaque rendez-vous qui apprend quelque chose :

1. **Ce qui a marché** — la phrase exacte, pas le résumé. Elle entre
   dans l'ouverture ou le miroir de la verticale.
2. **Ce qui a cassé** — l'objection non prévue, et le contre qu'on
   aurait dû avoir. Elle entre dans `objections`.
3. **Ce qu'on n'aurait pas dû dire** — entre dans `forbidden`.
4. **Une verticale nouvelle** (un métier qu'on ouvre) — on la crée en
   copiant la structure d'une existante, et on la remplit au fil des
   dix premiers appels.

Règle : **une entrée de playbook doit être une phrase prononçable**, pas
un principe abstrait. Si on ne peut pas la dire au téléphone telle
quelle, elle n'a rien à y faire.

## 5. Ce que le playbook ne remplace pas

Il ne remplace pas la vérification humaine avant envoi (un prénom faux
détruit un audit entier), ni le jugement sur qui appeler. Il fait une
chose : garantir que **la centième conversation démarre au niveau de la
meilleure des quatre-vingt-dix-neuf précédentes.**
