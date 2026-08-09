# Accord de traitement des données (DPA) — Article 28 RGPD

**Annexe au contrat d'abonnement ALPHA SALES OS.**

> Projet à faire valider par un·e avocat·e / DPO avant signature. C'est le
> document **le plus important** de ta situation : en hébergeant les fiches
> prospects de tes clients (données personnelles), EAGLEYE CORP est
> **sous-traitant** au sens de l'article 28 du RGPD. Champs `[…]` à compléter.

## Entre

- **Le Client** (« Responsable de traitement ») : la personne morale souscrivant
  l'abonnement, telle qu'identifiée dans son compte.
- **EAGLEYE CORP** (« Sous-traitant »), SIREN 831 729 934, 8 Cours Lafayette
  69003 Lyon, représentée par Zakaria TAZI.

## Article 1 — Objet

Le présent accord encadre le traitement, par le Sous-traitant pour le compte du
Responsable, des données personnelles nécessaires à la fourniture du Service
ALPHA SALES OS, conformément à l'article 28 du RGPD.

## Article 2 — Description du traitement

- **Nature et finalité** : hébergement, organisation et mise à disposition d'un
  CRM/pipeline ; assistance à la rédaction et au suivi de la prospection ; suivi
  d'e-mails ; assistance IA. Le Sous-traitant **ne traite les données que sur
  instruction documentée** du Responsable (usage du Service).
- **Durée** : la durée de l'abonnement, plus les délais de réversibilité et de
  suppression prévus à l'article 9.
- **Catégories de personnes concernées** : prospects et contacts professionnels
  du Responsable, éventuellement ses collaborateurs utilisateurs.
- **Catégories de données** : identité et coordonnées professionnelles (nom,
  entreprise, e-mail, téléphone, ville), historique d'échanges, notes,
  statut/pipeline, métadonnées de suivi (ouvertures, clics). **Pas de catégories
  particulières** (art. 9) ni de données d'infractions ; le Responsable s'engage
  à ne pas en introduire.

## Article 3 — Obligations du Sous-traitant

Le Sous-traitant s'engage à :
1. Traiter les données **uniquement sur instruction** du Responsable (y compris
   pour les transferts), sauf obligation légale ;
2. Garantir la **confidentialité** et n'autoriser l'accès qu'aux personnes
   habilitées et tenues au secret ;
3. Mettre en œuvre les **mesures de sécurité** de l'article 5 (art. 32 RGPD) ;
4. Respecter les conditions de recours à un **sous-traitant ultérieur**
   (article 4) ;
5. **Aider le Responsable** à répondre aux demandes d'exercice de droits des
   personnes (accès, rectification, effacement, opposition, portabilité) via les
   fonctions du Service (export, suppression) ;
6. **Aider le Responsable** à assurer le respect des articles 32 à 36 (sécurité,
   notification de violation, analyses d'impact), compte tenu des informations
   disponibles ;
7. **Notifier au Responsable toute violation** de données concernant ses données
   **dans les meilleurs délais** après en avoir pris connaissance, avec les
   informations utiles ;
8. Mettre à disposition les informations nécessaires pour **démontrer la
   conformité** et permettre des **audits** (article 6).

## Article 4 — Sous-traitants ultérieurs

Le Responsable **autorise** le recours aux sous-traitants ultérieurs listés en
**Annexe 1**. Le Sous-traitant informe le Responsable de tout ajout ou
remplacement, laissant un délai raisonnable pour s'y opposer pour un motif
légitime. Chaque sous-traitant ultérieur est tenu par des obligations de
protection équivalentes.

## Article 5 — Sécurité (art. 32 RGPD)

Mesures mises en œuvre : chiffrement en transit (HTTPS/TLS) ; hachage des mots
de passe ; **isolation stricte par locataire** (Row Level Security par
`user_id`, cloisonnement applicatif des données de suivi) ; contrôle d'accès et
moindre privilège ; journalisation d'audit ; sauvegardes ; en-têtes de sécurité
durcis. Détail technique : `docs/SECURITE.md`, `docs/PREUVE-RLS.md`.

> Le Responsable reste tenu de sécuriser **ses propres accès** (identifiants,
> appareils) et de configurer les options de sécurité proposées (verrou, MFA
> lorsque disponible, hébergement UE).

## Article 6 — Audit

Le Responsable peut, à ses frais, une fois par an et moyennant préavis
raisonnable, vérifier le respect du présent accord (questionnaire, documentation,
ou audit sur pièces). Les audits sur site sont limités à ce qui est strictement
nécessaire et ne doivent pas compromettre la sécurité des autres clients.

## Article 7 — Transferts hors UE

Tout transfert hors UE n'a lieu que vers des sous-traitants offrant des
**garanties appropriées** (clauses contractuelles types, cadre d'adéquation).
Voir Annexe 1. Le Responsable est informé de la localisation des données ; le
choix d'une **région UE** (Supabase) est recommandé et proposé.

## Article 8 — Assistance et coût

L'assistance de base (fonctions d'export/suppression, information) est incluse.
Une assistance exceptionnelle et disproportionnée peut faire l'objet d'une
facturation raisonnable, après information du Responsable.

## Article 9 — Fin du traitement (réversibilité)

À la fin de la prestation, le Sous-traitant, au choix du Responsable :
- **restitue** les données (export dans un format réutilisable), et/ou
- les **supprime** de ses systèmes actifs dans un délai de [30] jours, sauf
  obligation légale de conservation, les sauvegardes étant purgées selon leur
  cycle (au plus [90] jours).
Sur demande, le Sous-traitant atteste par écrit de la suppression.

## Article 10 — Responsabilité

Chaque partie répond des dommages causés par un traitement non conforme, dans les
conditions de l'article 82 du RGPD et des limitations prévues aux CGV. Le
Responsable garantit disposer d'une **base légale** valable pour la prospection
et l'introduction des données dans le Service.

## Article 11 — Droit applicable

Droit français ; compétence des tribunaux de Lyon (voir CGV).

---

## Annexe 1 — Liste des sous-traitants ultérieurs

| Sous-traitant | Rôle | Localisation | Garanties transfert |
|---|---|---|---|
| Vercel Inc. | Hébergement application | USA / [région] | CCT / DPF [à vérifier] |
| Supabase, Inc. | Base de données, auth, stockage | [région — UE recommandé] | CCT [à vérifier] |
| Stripe Payments Europe, Ltd. | Paiement | Irlande (UE) | — (UE) |
| Fournisseur SMTP [nom] | Envoi d'e-mails | [pays] | [à préciser] |
| Anthropic / NVIDIA (si activés) | Assistance IA | USA / [région] | CCT [à vérifier] |
| json2video / LiveKit / Fish Audio / Deepgram (si activés) | Vidéo / voix / transcription | [pays] | [à préciser] |

*Annexe à tenir à jour. Les services « si activés » ne traitent des données que
lorsque le Responsable configure la fonction correspondante.*

---
*EAGLEYE CORP — sous-traitant — SIREN 831 729 934 — [rgpd@eagleyecorp.fr]*
