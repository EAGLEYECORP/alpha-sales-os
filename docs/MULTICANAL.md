# MULTICANAL — le volume par la largeur, pas par la force

> L'objectif : toucher **beaucoup** de prospects par jour SANS jamais
> déclencher les défenses anti-spam d'aucune plateforme. La règle d'or :
> on ne pousse pas un canal au-delà de son seuil de confort — on **ajoute
> des canaux**. 4 canaux × quotas prudents > 1 canal saturé qui te grille.

## Les quotas sûrs par canal (par jour, par compte)

| Canal | Quota prudent | Pourquoi cette limite | Dans l'app |
|---|---|---|---|
| **Email** | 10 → 40/j (warm-up : RUNBOOK) | réputation domaine/IP, filtres Gmail | `MAX_SENDS_PER_HOUR`, dédup 14 j, lint anti-spam, STOP |
| **LinkedIn** | **~25 actions/j** (invitations + DM) | LinkedIn restreint les comptes au-delà (~100/sem. pour les invitations) | bouton LinkedIn (SendBar) : compteur du jour affiché, alerte au-delà de 25 |
| **WhatsApp** | pas de limite dure (manuel, 1-à-1) | part de TON téléphone, conversation réelle | bouton wa.me, message pré-rempli |
| **SMS** | rappels uniquement (RDV, confirmations) | prospection SMS à froid = zone rouge CNIL | Textbelt, opt-in de fait (prospects en conversation) |
| **Téléphone** | selon ton énergie 🙂 | aucun filtre n'arrête une vraie voix | scripts d'appel (Templates), consignation timeline |

**Le calcul du volume** : 40 emails + 25 LinkedIn + 15 WhatsApp/relances +
10 appels = **~90 touches/jour** en régime établi, chaque canal restant
sous ses radars. À 2 comptes d'envoi email (checkpoint 1 000), tu doubles
la colonne email sans toucher aux autres.

## LinkedIn — pourquoi ASSISTÉ et pas automatisé (décision d'architecture)

Tu as demandé « si pas d'API, browse avec les credentials ». Réponse
honnête : **non, et voilà pourquoi.**

1. **LinkedIn n'a pas d'API d'outreach** (l'API officielle sert aux ads et
   au recrutement). Tous les outils « automatiques » (PhantomBuster,
   Linked Helper, Waalaxy en mode agressif…) pilotent un navigateur avec
   tes identifiants — en violation des CGU.
2. **LinkedIn les détecte et bannit** : vitesse de clic, patterns de
   navigation, empreinte du navigateur. Des comptes tombent chaque
   semaine. Ton profil LinkedIn est un actif commercial **irremplaçable**
   (ton réseau, ta preuve sociale, tes recommandations) — on ne le met pas
   en jeu pour gagner 10 secondes par message.
3. **Tes identifiants dans un bot = risque sécurité pur** : la session
   LinkedIn donne accès à ta messagerie privée, ton réseau, tes données.
   Même philosophie que le reste de l'OS : ce secret-là ne se délègue pas.

**Ce que l'app fait à la place** (le patron WhatsApp, éprouvé) :

```
Fiche prospect → message LinkedIn calibré (template ≤ 300 car., doctrine)
      → clic « LinkedIn » : message DANS LE PRESSE-PAPIER
      → le profil s'ouvre (URL de la fiche, sinon recherche nom+société)
      → tu COLLES, tu personnalises 5 secondes, tu ENVOIES
      → la touche est journalisée (timeline, quota du jour, funnel)
```

~15 secondes par touche, 25/jour = 6 minutes. **Indétectable, parce que
c'est réellement toi.** Et chaque touche reste dans le CRM : le funnel
multicanal se mesure comme l'email.

### Le flux quotidien LinkedIn (à enseigner)

1. Remplis la colonne **LinkedIn** des fiches (le sourcing Apollo donne
   souvent l'URL ; sinon 10 s de recherche au premier contact — l'app
   ouvre la recherche pré-remplie).
2. Templates → carte **LinkedIn** → bouton LinkedIn → colle → envoie.
3. Le compteur du jour s'affiche sur le bouton ; à 25, il passe orange :
   **bascule sur l'email/WhatsApp**, ne force jamais.
4. Réponse reçue ? Consigne-la (Campagnes → « Coller une réponse ») —
   le cycle continue comme pour l'email.

### Passage à l'échelle (plus tard, si le canal prouve son taux)

Quand LinkedIn devient ton canal n°1 et que 25/j ne suffit plus :
**Unipile** ou **HeyReach** — des API tierces *légitimes* (payantes,
~50-60 €/mois/compte) où le compte est connecté chez le fournisseur, avec
des garde-fous intégrés. Branchables dans n8n (HTTP Request) sans changer
l'app : le bouton LinkedIn posterait au webhook au lieu d'ouvrir l'onglet.
On construira ce pont le jour où tes chiffres le justifient — pas avant.

## La rotation multicanale (doctrine)

- **1er contact** : email (traçable, tolère la longueur, porte l'audit
  cadeau) OU LinkedIn si le décideur y est actif (taux de réponse souvent
  2-3× supérieur sur les patrons visibles).
- **Relance J+3** : l'AUTRE canal. Un silence email + une touche LinkedIn
  = deux chances, zéro harcèlement.
- **Prospect chaud** : WhatsApp/téléphone — la conversation quitte l'écrit.
- **Client signé** : SMS pour les rappels de RDV, email pour les docs.
- Le champ **Canal privilégié** de la fiche mémorise où IL répond — on
  respecte son terrain, pas nos habitudes.

> Règle CNIL transverse : quel que soit le canal, le STOP/désinscription
> s'applique partout. Un STOP email = on ne le recontacte sur AUCUN canal.
