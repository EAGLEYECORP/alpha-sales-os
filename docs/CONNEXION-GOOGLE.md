# Activer « Continuer avec Google » (27/10/2026)

Le bouton est codé et en production. **Il reste invisible tant que Supabase ne sert pas Google**
(`connexionGoogleDisponible`, `lib/auth.ts`) : un inscrit ne voit jamais un bouton qui échoue.
Il apparaît tout seul dès que le fournisseur est activé — aucun redéploiement.

Pourquoi Google plutôt que couper la confirmation d'email : voir `CLAUDE.md`, « Essayer sans compte ».

## Les gestes (≈ 15 min, sur ordinateur)

1. **Google Cloud** — https://console.cloud.google.com → créer un projet « Alpha Sales OS ».
2. **Écran de consentement** (Google Auth Platform → Branding / Audience) :
   - nom de l'application : `Alpha Sales OS` ; e-mail d'assistance : `contact@eagleyecorp.fr` ;
   - domaines autorisés : `eagleyecorp.fr` **et** `ofcrtjdkkxehzxjiawfq.supabase.co` ;
   - autorisations : celles par défaut (`email`, `profile`, `openid`) — rien d'autre ;
   - public **Externe**, puis **Publier l'application** (sinon seuls les testeurs déclarés entrent) ;
   - **ne pas ajouter de logo** : un logo déclenche une vérification de marque par Google.
3. **Identifiants** → Créer des identifiants → ID client OAuth → **Application Web** :
   - origine JavaScript autorisée : `https://alphasalesos.eagleyecorp.fr` ;
   - URI de redirection autorisée : `https://ofcrtjdkkxehzxjiawfq.supabase.co/auth/v1/callback`
     (c'est l'adresse que Supabase affiche lui-même dans le panneau Google — la recopier de là
     si elle diffère).
4. **Supabase** → Authentication → Sign In / Providers → **Google** → activer, coller l'ID client
   et le secret → Enregistrer.
   ⚠ **Ne colle le secret nulle part ailleurs** — ni dans une conversation, ni dans le dépôt.
5. **Vérifier** : navigation privée → `alphasalesos.eagleyecorp.fr` → « Créer un compte » →
   « Continuer avec Google » est en tête.

## Ce qui est déjà en place, et ce qui ne l'est pas

- **Le retour** se fait sur `/?bienvenue=1`, la même adresse que la confirmation d'email : elle est
  déjà dans la liste blanche de Supabase (`https://alphasalesos.eagleyecorp.fr/**`, lue le 27/10).
- **Un compte Google ouvre l'essai comme un compte email** (le déclencheur d'inscription ne
  distingue pas le fournisseur), et nos adresses `OWNER_EMAILS` restent maître par Google aussi.
- **⚠ Ce que Google affichera** : « continuer vers `ofcrtjdkkxehzxjiawfq.supabase.co` », pas
  `eagleyecorp.fr`. Le corriger demande un domaine personnalisé chez Supabase (option payante)
  ou une vérification de marque Google. Ça ne bloque rien ; ça se voit.
- **Non testé en vrai** : le bouton, la disponibilité et le départ vers Supabase sont prouvés au
  rendu sur un Supabase simulé (`provider=google`, retour `/?bienvenue=1`). L'aller-retour complet
  avec Google ne se prouvera qu'après les gestes ci-dessus — le premier compte créé est le test.
