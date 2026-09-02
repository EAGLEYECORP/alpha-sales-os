# MARCHÉ — où se situe ALPHA, pourquoi il est meilleur, où il ne l'est pas

**EAGLEYE CORP · août 2026**
Document d'analyse concurrentielle honnête. Il sert à deux choses : décider ce
qu'on construit ensuite, et savoir quoi répondre quand un prospect dit
« pourquoi pas Instantly ? ».

Règle du document : **aucune affirmation flatteuse sans contrepartie.** Là où
on est moins bon, c'est écrit noir sur blanc. Un argumentaire qui ment se
retourne au premier rendez-vous technique.

---

## 1. Le paysage réel (août 2026)

Le marché de la prospection outillée se divise en cinq familles. Elles ne se
concurrencent pas vraiment entre elles — elles occupent des étages différents.

### 1.1 L'infrastructure d'envoi — Instantly, Smartlead

Ce qu'ils font très bien : envoyer beaucoup, sans se faire blacklister.
Rotation de boîtes d'envoi, réseau de warmup (des comptes s'écrivent entre eux
pour construire une réputation), rotation de domaines, gestion des rebonds.
Entrée de gamme ~37–39 $/mois, palier supérieur ~94–97 $/mois, et une facture
réelle qui atterrit plutôt entre 200 et 350 $/mois une fois les boîtes
secondaires et l'enrichissement comptés.

Ce qu'ils ne font pas : **savoir quoi dire.** Ce sont des tuyaux. Le message,
l'angle, le diagnostic sectoriel, la préparation d'un rendez-vous, la relance
au bon moment sur le bon prétexte — rien de tout ça n'existe. Tu apportes le
cerveau, ils apportent la plomberie.

### 1.2 L'enrichissement — Clay, Apollo

Clay (~149 $/mois d'entrée + crédits variables ; une recherche profonde sur
1 000 contacts ajoute facilement 80 à 150 $) enrichit, croise, déduit. Apollo
(~99 $/mois/utilisateur) vend surtout une base de contacts.

Ce qu'ils ne font pas : **fermer.** Clay ne t'accompagne pas en tournée, ne
prépare pas ton appel de 14 h, ne te dit pas quoi répondre quand le gérant du
garage dit « on a déjà quelqu'un ». Apollo te donne des emails — dont une part
non négligeable est périmée ou générique.

### 1.3 Les SDR autonomes — 11x, Artisan, AiSDR

La promesse de 2024–2025 : « un commercial IA qui prospecte tout seul ».
La réalité de 2026 : **le marché est largement revenu à des modèles hybrides.**
Les déploiements 100 % autonomes ont produit du volume et peu de rendez-vous
qualifiés, des dégâts de marque, et des désabonnements. Les acteurs qui ont
survécu ont remis l'humain dans la boucle — sur la validation du message, sur
la qualification, sur la conversation.

C'est le point le plus important de ce document, et il valide rétroactivement
le choix de conception d'ALPHA : **20 % d'humain dans la boucle, placé aux
endroits qui décident.** Ce n'était pas une limitation qu'on subissait, c'était
la bonne architecture — le marché l'a découverte à ses frais.

### 1.4 Les CRM — HubSpot, Pipedrive, Salesforce

Ils enregistrent. Ils ne prospectent pas. Un CRM est une mémoire passive : il
sait ce que tu as fait, il ne te dit pas quoi faire ensuite. Le coût réel n'est
pas l'abonnement, c'est la saisie — le temps commercial passé à nourrir un
outil qui ne rend rien en retour.

### 1.5 Les agents vocaux — LiveKit, Pipecat, Vocode, Bolna, TEN

Voir la partie 4 (ALPHA VOICE). C'est l'étage qui bouge le plus vite, et celui
où EAGLEYE a déjà un pied puisqu'on revend Alpha Voice en entrant.

---

## 2. Pourquoi notre véhicule est meilleur

Pas « meilleur en général ». Meilleur **pour un opérateur seul ou une équipe de
2 à 5, qui vend un service à des PME locales, et dont le goulot n'est pas
l'envoi mais le jugement.** Voilà les avantages réels, vérifiables dans le
dépôt.

### 2.1 La doctrine est encodée, pas dans ta tête

`lib/playbook.ts` contient 15 invariants terrain et 9 verticales
(immobilier, auto-école, garage-carrosserie, cabinet de santé, restauration,
bar-pub, ambulance, artisan du bâtiment, générique). Chaque verticale porte son
angle, son estimation de fuite, ses objections types, son vocabulaire.

Aucun outil du marché ne fait ça, pour une raison simple : **ils sont
horizontaux.** Instantly doit marcher pour une SaaS américaine comme pour un
carrossier lyonnais, donc il ne dit rien de spécifique à ni l'un ni l'autre.
Nous, on ne vend qu'à un périmètre — Lyon et sa région, des métiers qui perdent
des appels — donc on peut être précis. La précision est notre avantage
structurel, et elle n'est pas copiable par un acteur horizontal.

Concrètement : l'estimation de fuite d'un carrossier (~5 040 €/mois d'appels
manqués) sort d'un calcul avec des hypothèses affichées, pas d'un chiffre
marketing. Le prospect peut la contester ligne par ligne — et c'est exactement
ce qu'on veut qu'il fasse.

### 2.2 Le terrain est un citoyen de première classe

`/closer` — tournée ordonnée, itinéraire Maps, score de chaleur
(0,45 × probabilité + 0,35 × confiance + 0,2 × affinité), mode closing,
sparring d'objections, `tel:` cliquable.
`/appels` — sessions par verticale, script repliable, angle par cible, et
**chaque bouton de statut écrit dans le CRM**.

Instantly n'a pas de mode voiture. Clay non plus. Le marché outille le SDR
assis ; personne n'outille celui qui pousse une porte à 15 h 20 entre deux
rendez-vous. Pour le tissu PME français — où la visite physique convertit
encore mieux que n'importe quel canal — c'est un écart net.

### 2.3 On possède la donnée

Google Sheets + Supabase + n8n local. Zéro donnée prospect chez un éditeur
tiers, zéro migration à payer si on change d'avis, zéro augmentation
tarifaire subie. Le coût marginal d'un contact supplémentaire est nul.

Face à un prospect soucieux du RGPD — et en France, en 2026, ils le sont —
« vos données ne quittent pas nos serveurs » est un argument qui ferme des
portes chez la concurrence.

### 2.4 L'audit personnalisé comme aimant

`lib/audit-doc.ts` produit un document chiffré, à la charte, avec le calcul
de fuite et le bloc fiscal. Ce n'est pas un lead magnet générique — c'est un
diagnostic nominatif. La posture actuelle (choisie) est **pull** : on ne
propose pas l'audit dans le mail, on le tient prêt pour celui qui répond.

Un outil qui envoie ne peut pas produire ça, parce qu'il ne sait rien du
métier de la cible.

### 2.5 La salle des preuves

`/preuves` calcule uniquement sur l'encaissé, affiche `null` au lieu d'un taux
quand l'échantillon ne décide rien, et donne la médiane du cycle. C'est
l'inverse du tableau de bord de vanité. Un chiffre qu'on ne peut pas défendre
n'est pas affiché.

### 2.6 Le coût

ALPHA : hébergement Vercel gratuit, n8n local, Ollama local, un SMTP.
Coût mensuel réel proche de zéro. La pile équivalente chez la concurrence
(infra d'envoi + enrichissement + CRM) est à 250–500 $/mois avant le premier
rendez-vous.

Sur une activité qui démarre, ce n'est pas une économie — c'est ce qui
détermine combien de mois on peut tenir avant le premier client.

---

## 3. Où ALPHA est objectivement moins bon

Cette section est la plus utile du document. À lire avant chaque promesse
faite à un prospect.

| Faiblesse | Réalité | Conséquence |
|---|---|---|
| **Pas de warmup de boîte** | Instantly et Smartlead chauffent les boîtes via un réseau de comptes. ALPHA n'a rien de tel. | Une boîte neuve qui envoie 40 mails/jour d'emblée se fait classer. Il faut monter en charge à la main : 5/jour la première semaine, +5 par semaine. |
| **Une seule boîte, un seul domaine** | Pas de rotation. | Plafond dur à ~40 mails/jour. Impossible d'aller à 200/jour sans acheter des domaines secondaires et bâtir la rotation — ce qui n'existe pas dans le code. |
| **Pas d'enrichissement** | Aucune source de contacts intégrée. | Le carburant se charge à la main (CSV) ou via n8n. **C'est le goulot réel aujourd'hui, pas l'outil.** |
| **Dépendance au poste local** | SMTP et Ollama tournent sur le MacBook. | Portable éteint = rien ne part. Vercel ne sert que le tracking et la porte d'accès. |
| **Pas de multi-utilisateur** | Un opérateur, un état local persisté. | Ne se vend pas tel quel à une équipe de 10. |
| **Échantillon statistique nul** | ~25 fiches. | Aucun taux de conversion calculé aujourd'hui n'est fiable. Les chiffres de `docs/CHIFFRES.md` sont des hypothèses de dimensionnement, pas des mesures. |
| **Pas d'A/B testing d'objets** | Les concurrents testent les objets sur des milliers d'envois. | À 40/jour, un A/B honnête demande des semaines. On optimise par le jugement, pas par la statistique. |

**Traduction commerciale honnête :** si un prospect veut envoyer 500 mails par
jour, ALPHA n'est pas l'outil, et il faut le dire. Si un prospect veut
transformer 300 PME locales en 4 clients par mois avec un message que personne
d'autre ne sait écrire, ALPHA gagne largement.

---

## 4. ALPHA VOICE — peut-on le créer ?

**Réponse courte : oui techniquement, non tel qu'imaginé.**

### 4.1 L'état de l'art open source

| Pile | Langage / licence | Téléphonie | Remarque |
|---|---|---|---|
| **LiveKit Agents** (~11 k ★) | Python/Node, Apache-2.0 | **SIP et numéros natifs** — plus besoin de pont Twilio | 1.0 en avril 2025, ligne 1.6.x en 2026 : interruption adaptative, support MCP natif. C'est la pile WebRTC sur laquelle tourne la voix de ChatGPT. |
| **Pipecat** (~13 k ★, Daily, BSD-2) | Python | Via Twilio / Daily / Telnyx | Pipeline de processeurs de trames, agnostique au transport. La bibliothèque d'intégrations la plus large ; développement quasi quotidien. |
| **Vocode** | Python, MIT | Twilio, Vonage | Bas niveau, modulaire, contrôle total. |
| **Bolna, TEN** | — | Variable | Plus jeunes, moins de recul en production. |

Un agent d'appel sortant en Python avec LiveKit est documenté et exemplifié
(`livekit-examples/outbound-caller-python`) : on crée un dispatch pour l'agent,
il rejoint la room, puis on compose via `CreateSIPParticipant`. Ce n'est pas de
la recherche — c'est de l'intégration. **Un prototype fonctionnel est une
affaire de jours, pas de mois.**

### 4.2 Les trois murs

**Mur 1 — la loi, en vigueur aujourd'hui.**
L'**article 50 du règlement européen sur l'IA est applicable depuis le
2 août 2026** — c'est-à-dire aujourd'hui. Un système qui interagit directement
avec une personne physique doit faire comprendre à un interlocuteur
raisonnablement informé qu'il parle à une IA. Pour un agent qui appelle afin de
prendre un rendez-vous, la Commission précise qu'il doit **s'identifier comme
artificiel et indiquer pour le compte de qui il agit**. S'y ajoute le marquage
lisible par machine des sorties audio synthétiques.

Ce n'est pas rédhibitoire — c'est une contrainte de conception. Mais un agent
d'appel à froid qui doit ouvrir par « bonjour, je suis une IA qui appelle pour
le compte d'EAGLEYE CORP » a un taux de raccrochage que personne n'a mesuré
honnêtement, et qu'il ne faut pas supposer favorable.

Note distincte : la loi française d'août 2026 sur le consentement préalable en
prospection téléphonique **ne vise que le B2C**. La prospection B2B sur des
lignes professionnelles reste licite au titre de l'intérêt légitime, avec
information et droit d'opposition. C'est notre terrain — mais c'est aussi une
raison de plus de ne pas s'approcher du B2C.

**Mur 2 — le conflit avec Scintia.**
EAGLEYE revend Alpha Voice, une réceptionniste téléphonique IA
**entrante**. Construire un démarcheur IA **sortant** ne nous met pas en
concurrence avec Scintia sur le produit, mais ça brouille le message :
« nous vous vendons une IA qui répond bien à vos clients » perd de sa force si
notre propre premier contact est une IA qui démarche. La cohérence de posture
est un actif commercial ; ne pas la dépenser pour un gain incertain.

**Mur 3 — l'économie.**
Notre goulot n'est pas le nombre d'appels sortants qu'on peut passer. C'est le
nombre de fiches en base (25) et le nombre de conversations qui vont au bout.
Un composeur automatique met de la pression sur le canal le moins saturé de la
pile. Construire ALPHA VOICE aujourd'hui, ce serait optimiser ce qui ne
bloque pas.

### 4.3 Ce qu'il faut construire à la place — ALPHA VOICE, version utile

Trois briques, par ordre décroissant de valeur immédiate, toutes compatibles
avec l'article 50 parce qu'aucune ne fait passer une IA pour un humain auprès
d'un tiers.

**a) Débriefing vocal après appel (valeur la plus haute, coût le plus bas)**
Zakaria sort d'un rendez-vous, appuie sur un bouton, parle 40 secondes :
« garage Bouchon, le gérant s'appelle Marc, ils ratent des appels le samedi, il
veut en parler à son associé, rappeler jeudi ». ALPHA transcrit, extrait
l'interlocuteur, l'objection, la prochaine étape et la date, et écrit dans le
CRM.

C'est là que le temps se perd réellement aujourd'hui : la saisie post-terrain.
Aucune contrainte AI Act — l'IA parle à son opérateur, pas au prospect.
Réalisable avec Whisper en local, sans nouvelle dépendance lourde.

**b) Assistant d'appel en direct**
Pendant un appel sortant **passé par un humain**, ALPHA écoute, reconnaît
l'objection prononcée et affiche la réponse du playbook à l'écran. L'humain
parle, l'IA souffle. Zéro obligation de divulgation, valeur immédiate pour un
closer débutant.

**c) Qualification entrante — et là, on vend Scintia**
Si le besoin est « quelqu'un doit répondre au téléphone », le produit existe
déjà, il est vendu par EAGLEYE, et il est *entrant* : cadre juridique plus
simple (l'appelant a initié le contact), cohérence de message parfaite.

### 4.4 Verdict

**Ne pas construire de démarcheur téléphonique IA sortant.** Construire le
débriefing vocal (a), puis l'assistant en direct (b). Garder LiveKit Agents en
veille technique : si un client Scintia demande un jour du sortant, la pile
existe, elle est mûre, et l'intégration est une affaire de jours.

### 4.5 État : (a) et (b) sont construits

Les deux briques recommandées existent dans l'app. Détail d'usage complet dans
`docs/VOIX.md`.

**(a) Débrief terrain — `/debrief`.** Quarante secondes de voix, et
l'interlocuteur, le frein et la prochaine étape DATÉE sont extraits, puis
écrits dans la fiche après relecture. Deux moteurs : déterministe hors-ligne
d'abord (il ne peut pas inventer de date), Ollama ensuite pour affiner le
résumé et le nom — jamais la date.

**(b) Assistant d'appel — bouton dans `/appels` et `/closer`.** Il écoute,
reconnaît l'objection et affiche la réponse du playbook, mot pour mot. Aucune
IA générative : l'appariement est local, en quelques millisecondes. Une
réponse qui arrive deux secondes trop tard n'est pas une réponse.

Et une chose qu'aucun outil du marché ne peut copier, parce qu'elle vient de
la doctrine maison : l'assistant écoute aussi **ce que l'opérateur dit** et
alerte quand il casse une règle — prix avant la démo, € perdus annoncés à
froid, note Google citée, ciblage dit en volume au lieu d'un critère,
observation posée en affirmation au lieu d'une question.

---

## 5. Ce qui a été amélioré dans le sillage de cette analyse

L'analyse a mis au jour un écart réel, pas théorique.

**Contrôle de délivrabilité DNS** — `app/api/deliverability/dns/route.ts`,
`components/settings/deliverability.tsx`, plus un 7ᵉ organe dans `/pilote`.

Le constat qui l'a déclenché : une sonde DNS sur `eagleye.fr` a montré un SPF
publié (`v=spf1 include:mx.ovh.com ~all`) mais **aucun enregistrement DMARC**.
Depuis 2024, Gmail et Yahoo exigent DMARC des expéditeurs en volume. Sans lui,
le placement en boîte de réception s'effondre — **et aucun signal ne remonte
côté expéditeur.** On croit envoyer 40 mails, on en délivre une fraction, et on
conclut que « le cold email ne marche pas ».

C'est exactement la classe de problème que les plateformes concurrentes
masquent en gérant l'infrastructure à ta place, et que tout outil auto-hébergé
laisse à l'utilisateur sans prévenir. Maintenant ALPHA prévient, explique
pourquoi, et donne l'enregistrement à copier-coller.

Le lint anti-spam de contenu existait déjà (`lib/deliverability.ts`,
`lintForSpam`) ; c'est le versant DNS qui manquait. Les deux ensemble couvrent
les deux causes de non-délivrance.

> **Action requise côté Zakaria, chez OVH :**
> publier un TXT sur `_dmarc.eagleye.fr` :
> `v=DMARC1; p=none; rua=mailto:postmaster@eagleye.fr`
> Commencer en `p=none` (observation), passer à `p=quarantine` après quelques
> semaines de rapports. C'est cinq minutes de travail pour le gain de
> délivrabilité le plus élevé disponible.

---

## 6. Ce qu'on répond en rendez-vous

**« Pourquoi pas Instantly / Smartlead ? »**
Ce sont des tuyaux, excellents dans leur rôle. Ils envoient — ils ne savent pas
quoi dire à un carrossier lyonnais. Notre valeur n'est pas l'envoi, c'est le
diagnostic. D'ailleurs si un jour vous voulez du volume pur, prenez Smartlead
et gardez notre méthode : les deux se complètent.

**« Pourquoi pas un SDR IA autonome ? »**
Parce que le marché a essayé en 2024–2025 et est largement revenu à l'hybride.
Le volume automatique produit des désabonnements, pas des rendez-vous. Nous, on
automatise la préparation et on laisse l'humain sur la décision — c'est la
configuration qui a survécu.

**« Et vos données ? »**
Elles ne partent pas. Sheets, Supabase et n8n, sous notre contrôle. Aucun
éditeur tiers ne détient votre pipeline.

**« Vous pouvez envoyer 500 mails par jour ? »**
Non. 40, proprement, avec une seule boîte. Au-delà on grille le domaine et on
perd tout d'un coup. Si vous voulez 500/jour, il vous faut une infrastructure
de rotation — ce n'est pas ce qu'on vend, et ce n'est pas ce qui vous fera
signer.

---

## 7. Priorités qui découlent de l'analyse

1. **Charger 300 à 600 fiches.** Le goulot est le carburant, pas le moteur.
   Aucune amélioration logicielle ne compense un pipe vide.
2. **Publier le DMARC** (5 minutes, voir §5).
3. **Monter l'envoi en charge progressivement** — 5/jour semaine 1, +5 par
   semaine — puisqu'on n'a pas de warmup automatique.
4. **Débriefing vocal** (§4.3a) — la seule brique « voix » qui rende du temps
   dès le premier jour.
5. Ne pas construire : rotation de boîtes, enrichissement maison, démarcheur
   vocal sortant. Trois chantiers lourds, aucun ne lève le goulot actuel.

---

## Sources

- [LiveKit — Making outbound calls (SIP)](https://docs.livekit.io/sip/making-calls/)
- [livekit-examples/outbound-caller-python](https://github.com/livekit-examples/outbound-caller-python)
- [LiveKit — Agents telephony integration](https://docs.livekit.io/telephony/agents-integration/)
- [Voice agent frameworks: Pipecat, LiveKit Agents, and friends](https://soniox.com/wiki/voice-agent-frameworks)
- [Pipecat vs LiveKit — key differences](https://www.cekura.ai/blogs/pipecat-vs-livekit-the-real-difference)
- [EU AI Act — Article 50, transparency obligations](https://artificialintelligenceact.eu/article/50/)
- [Commission européenne — FAQ obligations de transparence, article 50](https://digital-strategy.ec.europa.eu/en/faqs/transparency-obligations-under-article-50-ai-act)
- [Cold email tool pricing comparison 2026](https://litemail.ai/blog/cold-email-tool-pricing-comparison-2026)
- [Instantly vs Smartlead vs LGM (2026)](https://lagrowthmachine.com/instantly-vs-smartlead-vs-lgm/)
- [Clay vs Apollo vs Instantly (2026)](https://www.devcommx.com/blogs/clay-vs-apollo-vs-instantly-comparison)
