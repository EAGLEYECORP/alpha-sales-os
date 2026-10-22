# Post LinkedIn — « Tu vends quoi ? » (22/10/2026)

**Statut : PRÊT, PAS PUBLIÉ.** Aucun envoi sans le « go » de Zakaria.

- Vidéo : `public/media/linkedin/tu-vends-quoi-2026-10-22.mp4` (1080 × 1350, 25,7 s, son synthétisé).
- Composition : `scripts/video/compositions/tu-vends-quoi/` · garde : `tests/film-tu-vends-quoi.test.ts`.
- Les écrans sont RÉELS (`capturer.mjs` : l'app servie en mode inscrit, le métier tapé
  dans le vrai champ, une capture par lettre). Les trois métiers sont des exemples.

## ⚠ Avant de publier — dans cet ordre

1. **Déployer.** Le film montre le comportement corrigé le 22/10 (script de l'inscrit,
   verdict prouvé, grammaire). La production ne l'a qu'après « Trigger deploy ».
2. **Lever le mur des inscriptions** (`docs/SMTP-SUPABASE-AMEN.md`) : Supabase envoie
   **2 confirmations par heure**. Un post qui marche fabrique des inscrits sans lien de
   confirmation dès le troisième de l'heure — le pire moment pour décevoir.

## Texte du post

```
Tu vends quoi ?

Alpha Sales OS te pose la question pour une seule raison : écrire TON script d'appel, pas le nôtre.

Dans la vidéo, trois métiers tapés dans le vrai champ de l'app : un logiciel de paie, des cuisines sur mesure, du conseil en recrutement. À chaque fois, le script se réécrit sur ce que tu vends et à qui tu t'adresses :
→ la phrase qui passe le barrage
→ la permission : « si ce n'est pas pour vous, je raccroche »
→ le ciblage, avec ta cible à toi
→ une seule question à la bascule
→ un créneau en choix fermé

Ce qu'il ne fait pas, et c'est voulu :
— il n'invente aucun prix ;
— il n'invente aucun client, aucun résultat ;
— tes messages partent sous ton nom, jamais sous le nôtre.

Jusqu'à cette semaine, ce n'était pas vrai partout : un inscrit qui vend autre chose que nous recevait encore, à quelques endroits, NOTRE argumentaire. On l'a cherché écran par écran. Et on en a encore trouvé en tournant cette vidéo : une phrase mal accordée, et un script servi avant que le serveur ait répondu. Corrigés avant de publier.

En ligne, c'est gratuit. Ton CRM vit dans ton navigateur, et Alpha travaille tant que l'onglet est ouvert.

Écrans réels de l'application, métiers pris en exemple (illustratifs).

alphasalesos.eagleyecorp.fr/vitrine

#prospection #vente #b2b
```

## Ce que le texte ne dit pas, exprès

- Aucun prix, aucun pourcentage, aucun résultat : zéro vente, donc rien à citer.
- Pas « vos données ne quittent jamais nos serveurs » : une clé d'IA envoie du texte à son
  fournisseur. Ce qui est vrai et se dit : le CRM d'un compte en ligne vit dans le navigateur.
- Pas « la première question à l'inscription » : `/bienvenue` demande d'abord le site.
