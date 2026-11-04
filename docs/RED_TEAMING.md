# Red teaming — ce qui est testé, ce qui reste à tester
**Chaque case cochée nomme le test qui la tient ; une case vide est un travail à faire.**

## Priorité 1 — avant le premier client payant

### Injection de consignes
- [x] Un texte entrant ne peut pas refermer son cadre de données — `tests/prompt-injection.test.ts`
- [x] Les routes IA encadrent le contenu entrant — `tests/prompt-injection.test.ts`
- [ ] Batterie d'injections contre la sortie d'un **vrai** modèle (base64, caractères invisibles, faux appels d'outil)

### Transparence (art. 50)
- [x] Script vocal sans divulgation refusé — `tests/art50-disclosure.test.ts`
- [x] Écrit autonome sans divulgation refusé, et « IA » sur un message humain refusé aussi — `tests/art50-disclosure.test.ts`

### Humain dans la boucle
- [x] Prix non déclaré, signature, doute → remontent — `tests/closing-inscrit.test.ts`
- [x] Refus, plafond légal, fenêtre d'envoi — `tests/autopilote-inscrit.test.ts`

### Coûts et droits
- [x] Le gratuit n'atteint ni `/api/send`, ni `/api/voice/call`, ni les jetons — `tests/entitlements-routes.test.ts`
- [x] Production sans serrure → gratuit, jamais « tout ouvert » — `tests/entitlements.test.ts`

### Isolation entre comptes
- [ ] Deux vrais comptes ne se lisent pas — `npm run verify:rls` (`docs/PREUVE-RLS.md`)

## Priorité 2

- [x] Le pilote serveur ne lit aucune cible reçue de l'extérieur — `tests/trouver-clients.test.ts`
- [x] Les ticks refusent tout sans `CRON_SECRET` — `tests/pilote-serveur.test.ts`
- [ ] Revue `npm audit` documentée à chaque version

## Comment lancer

`npm test` (compile puis lance `node --test`). Le dossier lui-même est tenu par
`tests/dossier-conformite.test.ts` : un fichier ou un symbole cité qui disparaît
fait tomber la suite.
