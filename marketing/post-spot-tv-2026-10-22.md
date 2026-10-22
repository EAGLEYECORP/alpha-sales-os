# Post LinkedIn — le spot TV « Qui appeler ce matin ? » (22/10/2026)

**Statut : PUBLIÉ le 22/10/2026 vers 19 h 10 (Paris)**, sur « Post now » de Zakaria —
`urn:li:ugcPost:7519082695130279936` (vidéo `urn:li:video:D4E10AQEDLuR7-G3Ggw`, 5 441 826 octets,
téléversée depuis l'URL de production, vérifiée au même octet avant l'envoi). Deuxième post
du jour : la règle « un par jour » a été levée par sa demande explicite.

> ⚠⚠ **LA VIGNETTE EST VIDE — mon erreur, vue après publication.** C'est le MASTER TV qui
> est parti, et un master TV commence sur la toile nue (image 0 sans texte) : LinkedIn a pris
> cette image comme couverture (relue : 1280 × 720, aplat crème). Dans le fil la vidéo se lance
> seule et la question apparaît dès 0,15 s ; partout où elle ne se lance pas (profil,
> partages, lecture automatique coupée), la carte est vide. La version web existe désormais —
> `public/media/linkedin/spot-tv-2026-10-22.mp4`, image 0 = l'affiche « Qui appeler ce
> matin ? » (PSNR 43,5 dB contre l'affiche ; 51 dB contre le master sur les images 1 et 50).
> La remplacer en ligne veut dire SUPPRIMER le post et le republier : sa décision.

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
