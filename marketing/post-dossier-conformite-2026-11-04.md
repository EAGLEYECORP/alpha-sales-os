# Post LinkedIn — « Le dossier qui se vérifie » (04/11/2026)

**Statut : PUBLIÉ le 04/11/2026 au soir**, sur le « go » de Zakaria —
`urn:li:ugcPost:7523852479122362368` (vidéo `urn:li:video:D4E10AQFfVp6AsRx9bQ`, 3 090 182 octets,
téléversée depuis l'URL de production).

Vérifié AVANT de publier : le MP4 servi par la production a la même empreinte SHA-256 que celui du
dépôt (`b3a7b65f…`) ; la vignette renvoyée par LinkedIn est l'affiche (empreinte réduite 16 × 20 :
écart moyen 2,9/255, contre ~15 pour une image du milieu du film).

- Vidéo : `public/media/linkedin/dossier-2026-11-04.mp4` (1080 × 1350, son synthétisé, 26 s).
- Composition : `scripts/video/compositions/dossier/` · partition : `scripts/video/partitions/dossier.json` ·
  garde : `tests/film-dossier.test.ts`.
- Rien n'est illustratif dans le FOND : les quatre citations, le nombre de citations, la citation
  cassée et la sortie de `npm test` sont relus par le test dans le dépôt (`docs/*.md`,
  `tests/dossier-conformite.test.ts`). Seule la mise en page est composée — d'où
  « EXTRAITS RÉELS DU DÉPÔT » à l'écran.
- Le sujet est choisi parce qu'il se PROUVE : un dossier EU AI Act qui refuse les phrases sans code.
  Le post ne dit pas « conforme » : le dossier n'est pas un avis juridique, et il le dit.

## Avant de publier (chemin de `.claude/skills/alpha-motion` § 5)

1. Attendre le déploiement Vercel, vérifier l'URL du MP4 en production (200, `video/mp4`, même empreinte).
2. `LINKEDIN_UPLOAD_VIDEO` → vérifier la VIGNETTE renvoyée (LinkedIn prend l'image 3) AVANT de publier.
3. Texte en Little Text Format (échapper `# _ ( ) [ ]`…), hashtags `{hashtag|\#|mot}`.

## Texte du post

```
Une documentation qui ment ne casse aucun build.

C'est le problème de presque tous les dossiers de conformité IA : ils décrivent ce que le produit devrait faire. Personne ne vérifie que le code le fait encore six mois plus tard.

On a écrit le nôtre autrement. Le dossier EU AI Act d'ALPHA SALES OS cite, pour chaque règle, le fichier et la fonction qui l'appliquent, sous la forme fichier#symbole. 59 citations.

Et un test les rouvre toutes, à chaque npm test :
· la fonction citée doit exister et être exportée par ce fichier ;
· chaque chemin et chaque lien du dossier doit exister ;
· chaque case cochée du red teaming doit nommer le test qui la tient.

Dans la vidéo, on retire une seule lettre à une citation. La suite tombe, avec le message exact.

Le même test refuse aussi ce qu'on avait trop vite écrit dans une première version : une bibliothèque qui n'est pas dans le code, des sous-agents qui n'existent pas, un seuil de confiance inventé, une latence jamais mesurée. Tout ça sonnait bien. Rien ne le prouvait.

Ce que dit le dossier :
· risque limité, article 50 : l'IA se déclare au téléphone et par écrit, et c'est le code qui l'impose, pas une consigne ;
· un texte entrant (site, email, document) reste une donnée, jamais une instruction ;
· le prix, la signature et le doute remontent à un humain.

Et ce qu'il dit aussi, en toutes lettres : ce qui n'est pas prouvé. L'isolation entre comptes n'a pas encore été rejouée sur deux vrais comptes en production. La latence vocale n'a jamais été mesurée de bout en bout. Ce dossier n'est pas un avis juridique : il décrit ce que le logiciel fait.

Une phrase sans code n'est qu'une intention.

Les extraits de la vidéo sont réels, tirés du dépôt.
→ alphasalesos.eagleyecorp.fr/vitrine

#EUAIAct #IA #Conformité #Vente
```
