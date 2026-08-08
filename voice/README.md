# ALPHA VOICE — l'agent qui parle

**EAGLEYE CORP · ALPHA SALES OS®**

Un agent vocal qui décroche ou qui appelle, tient une conversation en français,
et rend la main à un humain. Il sert la **démonstration** : faire entendre au
prospect, sur son propre métier, ce que vivraient ses clients quand personne ne
décroche.

C'est la doctrine maison appliquée — *l'émotion avant le prix* — et c'est
exactement ce qui a converti la Carrosserie des Brotteaux : visite terrain,
démo live, **puis** le prix.

---

## Ce que c'est, et ce que ce n'est pas

| | |
|---|---|
| **Il fait** | La démonstration. Le prospect entend son propre accueil téléphonique. |
| **Il fait** | Rappeler quelqu'un qui a laissé ses coordonnées. |
| **Il ne fait pas** | Du démarchage à froid vers des inconnus. |

Le mode démarchage serait techniquement identique à la démo sortante. **Il
n'est pas exposé, et c'est une décision, pas une limite.** On vend une IA qui
répond bien aux clients de nos prospects : notre propre premier contact ne peut
pas être une IA qui démarche. Voir `docs/MARCHE.md` §4.2.

---

## La divulgation — article 50 du règlement européen sur l'IA

Applicable **depuis le 2 août 2026**. Un système qui interagit avec une
personne doit lui faire comprendre qu'elle parle à une IA, et dire pour le
compte de qui il agit.

Ici ce n'est pas une consigne dans le prompt — un modèle peut dévier d'une
consigne. **La première phrase est prononcée par le code**, hors du modèle,
avant qu'il ait la parole, et sans interruption possible :

```python
await session.say(first_sentence(script), allow_interruptions=False)
```

> « Bonjour, je suis ALPHA, un assistant vocal — une intelligence
> artificielle, pas une personne. J'appelle pour le compte de EAGLEYE CORP. »

Et si le script ne porte pas les trois mentions dues, **l'agent refuse de
démarrer** : il journalise `APPEL REFUSÉ` et sort. Un refus bruyant vaut mieux
qu'un appel en faute. Vérifié des deux côtés — `tests/voice-script.test.ts`
côté app, `audit_script()` côté agent.

---

## Installation

### 1. Le service vocal

```bash
cd voice
pip install -r requirements.txt
cp .env.example .env          # puis remplir
python agent.py download-files   # modèles de détection de tour de parole
python agent.py dev              # l'agent écoute les dispatches
```

### 2. Les comptes

| Service | Pour quoi | Coût |
|---|---|---|
| [LiveKit Cloud](https://cloud.livekit.io) | transport temps réel + SIP | palier gratuit généreux |
| [Deepgram](https://deepgram.com) | transcription française | crédits offerts à l'inscription |
| [NVIDIA NIM](https://build.nvidia.com) | le modèle | **gratuit** — la même clé que le reste d'ALPHA |
| [Fish Audio](https://fish.audio) | la voix (TTS) — bon français | palier peu coûteux |

**La voix (TTS).** Par défaut, si `FISH_API_KEY` est présent, l'agent parle
avec **Fish Audio** (voix multilingues, bon français) ; sinon il retombe sur
OpenAI. Pour la meilleure prononciation, choisis une voix française dans la
bibliothèque fish.audio, copie son *reference id* et mets-le dans
`FISH_VOICE_ID`. `build_tts()` dans `agent.py` fait la bascule automatiquement.
Pile 100 % gratuite : remplace le TTS par un plugin local (Piper, Kokoro).

### 3. Le trunk SIP (seulement pour les appels sortants)

Dans LiveKit Cloud → Telephony → créer un trunk sortant chez un opérateur
(Twilio, Telnyx, OVH Télécom). Coller son identifiant dans
`SIP_OUTBOUND_TRUNK_ID`.

**Sans trunk, tout fonctionne sauf composer un numéro** — l'agent tourne, le
script se relit, la conformité se vérifie.

### 4. Côté ALPHA

Dans `.env.local` :

```
LIVEKIT_URL=wss://<ton-projet>.livekit.cloud
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
```

Puis `/voice` dans l'app.

---

## Comment ça s'articule

```
  /voice (Next.js)          /api/voice/call            voice/agent.py
  ────────────────          ───────────────            ──────────────
  choisir le mode     →     construit le script   →    reçoit le dispatch
  choisir la fiche          VÉRIFIE l'art. 50          re-vérifie l'art. 50
  relire le script          vérifie l'horaire          compose via SIP
  lancer                    vérifie le numéro          DIT la divulgation
                            dispatch LiveKit           puis converse
```

**Le script vient d'ALPHA, jamais de l'agent.** Une seule source de vérité
(`lib/voice-script.ts`) : ce que l'écran affiche est exactement ce qui sera
dit. Et la conformité est vérifiée **deux fois** — dans l'app avant l'envoi,
dans l'agent avant de décrocher. Les deux services peuvent être déployés
séparément ; aucun des deux ne fait confiance à l'autre.

---

## Les quatre garde-fous, vérifiés

| Situation | Ce qui se passe |
|---|---|
| Mode « prospection froide » demandé | `Mode non autorisé. Modes disponibles : demo-entrante, demo-sortante, rappel-entrant.` |
| Numéro incomplet (`06 12`) | `Numéro inexploitable. Attendu un numéro français.` |
| Appel un dimanche | `Hors fenêtre d'appel` — forçable explicitement, jamais par défaut |
| Script sans divulgation | `422` côté app, `APPEL REFUSÉ` côté agent |

Les horaires ne sont pas une obligation légale en B2B — l'encadrement horaire
vise le consommateur. Mais un agent vocal qui appelle une entreprise fermée
n'atteint qu'un répondeur, et un dimanche il donne exactement l'image qu'on
cherche à éviter.

---

## Ce qui n'a PAS été vérifié en conditions réelles

Honnêteté nécessaire : **je n'ai pas pu passer un vrai appel.** Ce
qui est vérifié :

- le script, sa conformité et les quatre garde-fous — testés en HTTP réel ;
- 10 tests automatisés sur la divulgation, dont un qui vérifie qu'**aucun**
  mode ne produit un script sans elle ;
- la syntaxe Python et la logique de refus de `audit_script`, exécutées.

Ce qui ne l'est pas : la chaîne SIP complète, la qualité de la voix française,
la latence réelle. Ça demande un compte LiveKit, un trunk et un numéro — que
je n'ai pas. **Premier appel réel : fais-le vers ton propre portable**, comme
pour l'email. Jamais vers un prospect en première.

---

## Les trois briques vocales d'ALPHA

| Brique | Où | Qui parle à qui |
|---|---|---|
| **Débrief terrain** | `/debrief` | tu parles, l'app t'écoute |
| **Assistant d'appel** | `/appels`, `/closer` | tu parles au prospect, l'app te souffle |
| **Alpha Voice** | `/voice` | l'agent parle au prospect — et se déclare |

Les deux premières ne relèvent pas de l'article 50 : l'IA y parle à son
opérateur. La troisième, si — d'où tout ce qui précède.
