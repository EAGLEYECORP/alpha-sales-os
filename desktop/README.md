# Alpha Live — overlay transparent desktop

Le vrai overlay « type Cluely » : une fenêtre **transparente, sans cadre,
toujours au-dessus** de n'importe quelle app (Zoom, Meet, Teams…), pendant un
RDV visio. C'est ce que le navigateur seul ne peut pas faire — d'où cet
habillage **Electron**. Il charge la route `/overlay` de ton app déployée.

> Dans le navigateur (Chrome/Edge), tu as déjà la version sans installation :
> bouton **« Alpha Live »** sur une fiche prospect → fenêtre flottante
> (Document Picture-in-Picture). L'Electron ci-dessous ajoute la **vraie
> transparence traversable**.

## Lancer

```bash
cd desktop
npm install
ALPHA_URL="https://ton-app.vercel.app" npm start
# défaut sans variable : http://localhost:3000
```

Une petite fenêtre translucide apparaît, au-dessus de tout. Choisis le prospect
dans le sélecteur, tape/dicte ce que dit le client → Alpha souffle la réponse,
alarme sur la doctrine, remonte tes notes du Cerveau.

## Raccourcis globaux

| Raccourci | Effet |
|---|---|
| `Ctrl/Cmd + Alt + O` | Basculer **traversable** (les clics passent à la visio dessous) |
| `Ctrl/Cmd + Alt + H` | Masquer / afficher l'overlay |

La barre du haut (« déplacer ») déplace la fenêtre.

## Notes

- **Compte requis** : si ton app exige `SITE_PASSWORD` / une connexion, ouvre
  d'abord l'URL dans un navigateur, ou retire la porte pour la route `/overlay`.
- **Transparence** : sous Linux, elle dépend d'un compositeur actif (la plupart
  des bureaux modernes l'ont). Sous Windows/macOS, native.
- Ce dossier est **autonome** : ses dépendances (Electron) ne touchent pas
  l'app web ni son build Vercel.
- Empaqueter en `.exe` / `.app` : ajoute `electron-builder` — non inclus pour
  garder le dossier léger.
