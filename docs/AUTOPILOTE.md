# Faire tourner ALPHA en continu — mode pilote automatique

> Réponse courte à « est-ce que ça peut tourner tout seul ? » :
> **oui à 80 %, et les 20 % restants sont exactement ceux qui font
> signer.** Ce document dit ce qui tourne sans toi, ce qui ne tournera
> jamais sans toi, et comment mettre la machine en marche pour de bon.

---

## 1. Ce qui tourne sans toi (les 80 %)

| Organe | Ce qu'il fait seul | Condition |
|---|---|---|
| **Tracking** | Compte ouvertures et clics, même app locale éteinte | hébergé (Vercel) + `TRACKING_BASE_URL` |
| **n8n — inbound** | Capte les réponses, détecte les STOP, désinscrit | n8n allumé + `WEBHOOK_SECRET` |
| **n8n — tracking-sync** | Remonte les compteurs Supabase → Sheets (cron 10 min) | n8n allumé |
| **n8n — crm-sync** | Tient le Google Sheet à jour | n8n allumé |
| **n8n — error-alert** | Te prévient quand un workflow rougit | n8n allumé |
| **n8n — payment / signature** | Encaisse les événements Stripe / Documenso | n8n allumé + outils branchés |
| **L'app** | Calcule les routines, l'angle des appels, la cadence LinkedIn, les brouillons IA | app allumée |

**La condition matérielle, sans détour :** l'app et n8n tournent sur ta
machine. **Portable fermé = tout s'arrête**, sauf le tracking qui est
hébergé. Ce n'est pas un défaut de conception — c'est le prix de garder
tes secrets chez toi. Deux façons de vivre avec (§3).

## 2. Ce qui ne partira jamais tout seul — et pourquoi

- **Un envoi** — tu relis avant. Un prénom faux détruit tout le travail
  d'audit qui précède (c'est arrivé, c'est documenté).
- **Une signature** — l'IA ne marque jamais « signé ». C'est un
  engagement contractuel : il se décide, il ne se déduit pas.
- **Un encaissement** — l'argent ne bouge que sur décision humaine.
- **Une conversation** — c'est ton avantage concurrentiel. L'automatiser
  reviendrait à le supprimer.

Ce ne sont pas des limitations techniques : ce sont des choix. Les 80 %
automatisés sont le travail ingrat. Les 20 % qui restent sont ceux qui
font signer.

## 3. Mettre la machine en marche

### Option A — le portable reste éveillé (gratuit, suffisant pour un seul opérateur)

Sur Linux Mint :

```bash
# 1. Empêcher la mise en veille quand le capot est fermé
sudo sed -i 's/^#HandleLidSwitch=.*/HandleLidSwitch=ignore/' /etc/systemd/logind.conf
sudo systemctl restart systemd-logind

# 2. Désactiver la veille système
sudo systemctl mask sleep.target suspend.target hibernate.target

# 3. Lancer n8n et l'app au démarrage (à faire une fois)
#    n8n en service utilisateur :
mkdir -p ~/.config/systemd/user
cat > ~/.config/systemd/user/n8n.service <<'EOF'
[Unit]
Description=n8n — cerveau ALPHA
[Service]
ExecStart=/usr/bin/env n8n start
Restart=always
[Install]
WantedBy=default.target
EOF
systemctl --user daemon-reload
systemctl --user enable --now n8n
loginctl enable-linger "$USER"   # tourne même sans session ouverte
```

Pour l'app, dans le dossier du projet :

```bash
cat > ~/.config/systemd/user/alpha.service <<'EOF'
[Unit]
Description=ALPHA SALES OS
[Service]
WorkingDirectory=/home/neo4tony/Desktop/EAGLEYE CORP/alpha-sales-os
ExecStart=/usr/bin/npm run start
Restart=always
[Install]
WantedBy=default.target
EOF
systemctl --user daemon-reload
systemctl --user enable --now alpha
```

> Le chemin contient un espace : les guillemets dans `WorkingDirectory`
> sont obligatoires si tu le retapes.

### Option B — un petit serveur (5–10 €/mois, quand tu ne seras plus seul)

Un VPS avec n8n + l'app en Docker (`docker-compose.yml` est déjà dans le
repo). À faire le jour où tu ne veux plus dépendre de ton portable, ou
quand un deuxième opérateur arrive. Pas avant : c'est une dépense et une
surface d'attaque en plus pour zéro gain aujourd'hui.

## 4. Le rituel quotidien — tes 20 %

La page **Pilote** (`/pilote`) chiffre ton temps de décision du jour.
Objectif : **moins de 45 minutes**.

| Quand | Quoi | Où |
|---|---|---|
| Matin, 10 min | Vider la file de décision (réponses, brouillons, RDV à confirmer) | `/pilote` |
| Matin, 15 min | Les touches du jour : invitations LinkedIn, lettre, appels prioritaires | `/linkedin` `/newsletter` `/appels` |
| Midi, 5 min | Répondre aux « oui » — l'audit part le jour même | fiche → Audit |
| Soir, 10 min | Débriefer les RDV, poser les next steps datés | `/pilote` |

Si le temps estimé dépasse 90 minutes, c'est que la file s'est
accumulée : traite d'abord tout ce qui est marqué urgent, le reste peut
attendre un jour.

## 5. Les alertes — savoir sans regarder

- **n8n error-alert** t'écrit dès qu'un workflow échoue. C'est ton
  détecteur de panne : tant que tu ne reçois rien, la machine tourne.
- **Le Pilote** affiche l'état des six organes. Un rouge = une
  automatisation qui dort, avec la cause écrite en clair.
- **La Recette** (`/recette`) rejoue la boucle complète bout en bout.
  À relancer après tout changement d'infrastructure.

## 6. Le vrai test de l'autonomie

Ferme l'app deux jours. Reviens. Si à ton retour :

- les réponses entrantes sont là, avec un brouillon prêt,
- le tracking a compté les ouvertures et les clics,
- le Sheet est à jour,
- et la file de décision t'attend, chiffrée en minutes,

alors la machine a tourné sans toi. **Ce qui manque à ton retour, c'est
uniquement ce qui devait te revenir.** C'est l'objectif, et c'est
atteignable dès aujourd'hui.
