# Post LinkedIn — « ce qui empêche l'IA de mentir » (27/10/2026)

**Statut : PUBLIÉ le 27/10/2026 vers 16 h (Paris)** — `urn:li:share:7520861629224402944`,
sur « Go post » de Zakaria. Écrit au retour d'un entretien : un post de PREUVE (ce qu'il
construit, comment il le vérifie), pas une annonce.
https://www.linkedin.com/feed/update/urn:li:share:7520861629224402944/

- **Publié en texte seul**, sans visuel : le spot est déjà parti le 22/10, le reposter aurait
  fait doublon.
- **Le texte envoyé est celui du bloc ci-dessous, au caractère près** : produit PAR SCRIPT
  (Little Text Format : les deux parenthèses échappées, rien d'autre à échapper), empreinte
  SHA-256 comparée avant l'envoi.
- **Vérifié sur la page publique** : « (AI Act, article 50) » rendu avec ses parenthèses, aucun
  backslash visible, fin du texte présente, lien raccourci par LinkedIn (`lnkd.in`). `/vitrine`
  répondait 200 juste avant. La relecture par l'API a répondu 403 — même piège que le 21/10.
- **Supprimer le post** (si besoin) : `LINKEDIN_DELETE_POST` avec l'URN ci-dessus.

- Aucun visuel obligatoire. S'il en faut un : la vidéo du spot
  (`public/media/linkedin/spot-tv-2026-10-22.mp4`, vignette vérifiée).
- Garde : `tests/post-builder-ia.test.ts` — mêmes interdits que les films, et chaque fait du
  texte recompté dans le dépôt.

## Texte du post

```
Quand on me demande ce que je sais faire avec l'IA, je ne montre pas une démo. Je montre ce qui l'empêche de mentir.

Je conçois et je pilote Alpha Sales OS, un logiciel de prospection pour les entreprises françaises. Je le construis avec des agents IA. Et c'est précisément pour ça que rien n'y entre sans preuve :

→ plus de 2 600 tests automatisés. Un garde-fou ne compte qu'une fois cassé exprès : si le test ne tombe pas, il ne protège rien.
→ la conformité est dans le code, pas dans un PDF : la phrase qui annonce qu'un appel est mené par une IA (AI Act, article 50), le plafond légal de sollicitations, les mentions obligatoires d'un email, une campagne bloquée tant qu'un humain n'a pas relu les messages.
→ les annonces légales du BODACC, lues par le SIREN : une société en liquidation sort de la file d'appels, celle qui vient de changer de direction remonte en tête.
→ rien d'inventé : aucun prix, aucun client, aucun résultat que je ne pourrais pas prouver en rendez-vous.

Mon rôle n'est pas d'écrire chaque ligne. C'est de décider ce qui est vrai, de le rendre vérifiable, et de dire non quand un agent produit quelque chose qui a l'air juste et ne l'est pas.

La semaine dernière, j'ai filmé un spot au format télévision avec les vrais écrans de l'application. Le tournage a trouvé un défaut que les tests ne voyaient pas. Corrigé avant de publier. C'est ça, le métier : architecte, product owner, et premier testeur.

Si vous construisez avec l'IA et qu'il faut que ce soit juste, pas seulement impressionnant : parlons-en.

alphasalesos.eagleyecorp.fr/vitrine
```

## Ce que le texte ne dit pas, exprès

- Aucun client, aucun chiffre d'affaires, aucun « leader » : zéro vente.
- Pas « je l'ai codé seul » : il est écrit avec des agents IA, et c'est dit — pour un poste
  d'architecte IA, c'est l'argument, pas un aveu.
- Pas « chaque garde-fou a été cassé » : c'est la MÉTHODE (« un garde-fou ne compte qu'une
  fois cassé »), pas un inventaire que personne n'a fait sur tout le dépôt.
- Pas « diffusé à la télévision » : au format télévision, et pas diffusé.
