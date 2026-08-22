# Notion — envoyer le pipeline vers une base que l'équipe regarde

> Sens unique : **ALPHA écrit, Notion lit.**
> Une synchro bidirectionnelle demande de décider qui gagne quand les deux
> côtés ont changé. Cette décision se prend mal, silencieusement, en écrasant
> du travail. Tant qu'elle n'est pas tranchée sur de vrais cas, un seul sens
> vaut mieux qu'un mauvais arbitrage automatique.

---

## 1. Créer l'intégration

Pas d'OAuth : Notion propose des **intégrations internes** avec un jeton
secret. Pour un espace de travail qu'on possède, c'est le chemin prévu.

1. [notion.so/my-integrations](https://www.notion.so/my-integrations) →
   **Nouvelle intégration**
2. Type **Interne**, associée à ton espace de travail
3. Capacités : *Lire*, *Insérer*, *Mettre à jour* du contenu
4. Copie le **secret d'intégration** (`ntn_…`)

---

## 2. Créer la base, avec EXACTEMENT ces colonnes

⚠ Notion **refuse** une propriété inconnue au lieu de l'ignorer. Une colonne
manquante fait échouer tout l'envoi, avec un message d'erreur qui ne dit pas
laquelle. La liste est aussi visible dans Réglages → *Envoyer le pipeline vers
Notion*.

| Colonne | Type | Note |
|---|---|---|
| **Société** | Titre | la colonne titre de la base |
| Contact | Texte | |
| Étape | Sélection | les options se créent toutes seules |
| Ville | Texte | |
| Téléphone | Téléphone | |
| Email | E-mail | |
| Probabilité | Nombre | |
| Setup (€) | Nombre | |
| Mensuel (€) | Nombre | |
| Confiance | Nombre | |
| Prochain pas | Date | la colonne sur laquelle une équipe trie vraiment |
| Action | Texte | |
| **ID Alpha** | Texte | **obligatoire** — c'est lui qui évite les doublons |

Sans `ID Alpha`, chaque envoi **recrée** toutes les fiches au lieu de les
mettre à jour : la base double de taille à chaque passage.

---

## 3. Partager la base avec l'intégration

**L'étape qu'on oublie.** Une intégration ne voit *rien* par défaut, même
dans l'espace de travail où elle a été créée.

Ouvre la base → menu `···` → **Connexions** → ajoute ton intégration.

Sans ça, l'API répond « object_not_found » — et on cherche une erreur d'ID
qui n'existe pas.

---

## 4. Configurer et envoyer

```
NOTION_TOKEN=ntn_...
NOTION_DATABASE_ID=...          # les 32 caractères dans l'URL de la base
```

L'ID est dans l'URL : `notion.so/<espace>/**32caractères**?v=…`

Puis Réglages → **Envoyer le pipeline vers Notion**.

---

## Ce qui part, et ce qui ne part pas

**Part** : société, contact, étape, ville, téléphone, email, probabilité,
montants, confiance, prochain pas daté et son action.

**Ne part pas** : les **notes libres** et les **transcriptions d'appels**.
Elles contiennent ce que des gens ont dit au téléphone. Les recopier dans un
espace partagé change qui peut les lire, sans que personne ne l'ait décidé.
Si tu veux les y mettre, ce doit être un choix explicite, pas un effet de
bord d'une synchro.

**Ne part pas non plus** : les fiches de démonstration. Les voir apparaître
dans l'espace d'une équipe le jour de la mise en route décrédibilise tout le
reste.

---

## Limites

- **Débit** : Notion accepte environ 3 requêtes/seconde, et chaque fiche en
  coûte deux (chercher, puis écrire). L'envoi se fait par paquets de 50, et
  la route refuse au-delà de 100 par requête — mieux vaut un refus franc
  qu'un succès partiel silencieux.
- **Version d'API épinglée** (`2022-06-28`) : Notion casse ses formats entre
  versions. Changer cette valeur sans relire le format des propriétés casse
  l'envoi.
- **Rien n'a été testé contre l'API réelle** depuis l'environnement de
  développement — il ne peut pas joindre `api.notion.com`. Ce qui est vérifié,
  c'est le FORMAT des propriétés (types exacts, `null` plutôt que chaîne vide,
  troncatures, aucune fuite de notes) et le fait que le schéma documenté
  corresponde exactement à ce qui est envoyé. Le transport se vérifie au
  premier envoi réel.
