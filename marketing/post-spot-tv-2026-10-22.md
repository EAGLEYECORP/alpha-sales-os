# Post LinkedIn — le spot TV « Qui appeler ce matin ? » (22/10/2026)

**Statut : PRÊT, PAS PUBLIÉ.** Création validée par Zakaria (« go », 22/10/2026). Un post est
déjà parti aujourd'hui (« Tu vends quoi ? ») : celui-ci part au plus tôt le lendemain, sur
un « go » explicite pour la PUBLICATION — le « go » du 22/10 portait sur le film.

- Vidéo : `public/media/tv/alpha-spot-30s-2026-10-22.mp4` (1920 × 1080, 25 i/s, 30 s, −23 LUFS).
- Composition : `scripts/video/compositions/spot-tv/` · garde : `tests/film-spot-tv.test.ts` ·
  livraison TV : `docs/SPOT-TV.md`.
- Avant `LINKEDIN_UPLOAD_VIDEO` : vérifier que la production sert le fichier au bon octet
  (5 441 826 octets), `curl -I` via Composio — le contenu servi doit être celui du commit.

## Texte du post

```
Qui appeler ce matin ?

C'est la première question d'une journée de prospection. Voici trente secondes de ce qu'Alpha Sales OS y répond, en vrais écrans.

→ Alpha trie la file. Une société en liquidation judiciaire en sort, avec l'annonce légale qui le dit. Une autre vient de changer de direction : elle remonte en tête. Lu au BODACC, par le SIREN de la fiche, jamais deviné par le nom.
→ Il écrit le script sur ce que TU vends, pas sur ce que nous vendons.
→ Il prépare les messages. Tu les relis : dans une campagne, rien ne part tant que tu n'as pas approuvé ou écarté chacun d'eux.

Les humains closent. Alpha fait tourner la machine.

Tourner ce film a trouvé un défaut. Dans la relecture d'une campagne, le message vers la société liquidée était bien mis de côté, mais la raison ne s'affichait pas, et un clic le remettait dans la pile à envoyer. Corrigé avant de tourner. Filmer le produit, c'est le tester.

Le format est celui de la télévision : 16:9, mentions lisibles, son aux normes. Il n'est pas diffusé : une pub télé passe d'abord par l'avis de l'ARPP.

En ligne, c'est gratuit, sans limite de durée. L'envoi d'emails et l'IA passent par tes propres comptes. Ton CRM vit dans ton navigateur, et Alpha travaille tant que l'onglet est ouvert.

Écrans réels de l'application, données fictives.

alphasalesos.eagleyecorp.fr/vitrine

#prospection #vente #b2b
```

## Ce que le texte ne dit pas, exprès

- Aucun prix, aucun pourcentage, aucun résultat : zéro vente, donc rien à citer.
- Pas « diffusé à la télévision », pas « bientôt à l'antenne » : aucun avis ARPP, aucune régie.
- Pas « chaque fiche est lue au BODACC » : seulement celles qui portent un SIREN, et la
  plupart n'en ont pas encore.
- Pas « rien ne part sans vous » en général : c'est vrai de la relecture de campagne, le
  texte le dit DANS une campagne.
