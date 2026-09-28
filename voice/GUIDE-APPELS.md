# Guide — activer les appels SORTANTS et ENTRANTS (ALPHA VOICE)

Pas à pas, pour passer du « ça tourne à blanc » à « ça téléphone pour de vrai ».

> ⚠️ **Honnêteté** : la chaîne SIP complète (trunk + numéro + latence réelle)
> n'a pas pu être testée ici — pas de compte LiveKit ni de numéro. Le code est
> prêt et vérifié ; **ton premier appel réel : vers TON propre portable**, jamais
> vers un prospect.

---

## Vue d'ensemble

```
  App /voice ──► /api/voice/call ──► LiveKit (dispatch "alpha-voice") ──► voice/agent.py
   (SORTANT)     construit+vérifie      route l'appel                      parle + se déclare
                 le script

  Numéro entrant ──► Trunk SIP entrant ──► Dispatch Rule ──► voice/agent.py (accueil par défaut)
   (ENTRANT)                                                  (script d'accueil déjà conforme)
```

L'agent Python (`voice/agent.py`) est le **même** pour les deux sens. Il doit
**tourner en permanence** sur une machine (PAS sur Vercel — voir §4).

---

## 0. Prérequis (comptes, une fois)

| Service | Pour quoi | Coût |
|---|---|---|
| **LiveKit Cloud** (cloud.livekit.io) | transport temps réel + SIP | palier gratuit |
| **Opérateur SIP** : Twilio, Telnyx **ou** OVH Télécom | le numéro + la ligne | à l'usage |
| **NVIDIA NIM** (build.nvidia.com) | le modèle (LLM) | gratuit |
| **Fish Audio** (fish.audio) | la voix française | palier peu cher |
| **Deepgram** (deepgram.com) | la transcription FR | crédits offerts |

Récupère : `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`,
`NVIDIA_API_KEY`, `FISH_API_KEY` (+ `FISH_VOICE_ID` d'une voix FR), `DEEPGRAM_API_KEY`.

---

## PARTIE A — Appels SORTANTS (démo / rappel)

### A1. Lance l'agent
```bash
cd voice
pip install -r requirements.txt
cp .env.example .env          # puis remplis-le (voir §0)
python agent.py download-files
python agent.py dev           # l'agent s'enregistre sous le nom "alpha-voice"
```

### A2. Crée le trunk SIP SORTANT
1. Chez ton opérateur (Twilio/Telnyx/OVH) : achète un **numéro** et récupère les
   identifiants SIP (adresse, user, password).
2. LiveKit Cloud → **Telephony → Outbound Trunk** → renseigne l'opérateur et le
   numéro d'affichage → **copie l'ID du trunk**.
3. Mets-le dans `voice/.env` : `SIP_OUTBOUND_TRUNK_ID=ST_xxx`.

> Alternative CLI : `lk sip outbound create` (voir docs LiveKit).

### A3. Côté app
Dans `.env.local` (local) ou Vercel :
```
LIVEKIT_URL=wss://<projet>.livekit.cloud
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
```
Redémarre l'app.

### A4. Lance un appel
`/voice` → choisis le mode (**démo sortante** / **rappel entrant**), la fiche,
**relis le script** (la conformité art. 50 est vérifiée), puis **Lancer**.
L'app dispatch vers `alpha-voice`, l'agent compose via SIP, **dit la divulgation
par le code**, puis converse.

### A5. Teste en sécurité
Mets **ton propre numéro** sur une fiche test et appelle-toi d'abord. Vérifie :
décroché, phrase de divulgation entière, voix FR, latence.

---

## PARTIE B — Appels ENTRANTS (accueil téléphonique IA)

### B1. Numéro + trunk SIP ENTRANT
1. Chez l'opérateur : configure le **numéro entrant** pour router vers LiveKit
   (URI d'origination = point d'entrée SIP de ton projet LiveKit).
2. LiveKit Cloud → **Telephony → Inbound Trunk** → déclare le(s) numéro(s)
   autorisé(s) à entrer.

### B2. La Dispatch Rule (LA pièce qui manquait)
LiveKit doit savoir **quoi faire** d'un appel entrant : créer une salle et y
**dispatcher l'agent `alpha-voice`**.

LiveKit Cloud → **Telephony → Dispatch Rules → New** :
- Type : *Individual* (une salle par appelant) ou *Direct* selon ton besoin.
- **Agent name : `alpha-voice`** (doit correspondre exactement au worker).
- (Optionnel) metadata : laisse vide → l'agent utilise l'**accueil par défaut**.

> CLI équivalent : `lk sip dispatch create` avec un fichier de règle
> (`{"agent_name":"alpha-voice", ...}`).

### B3. L'accueil par défaut (déjà en place)
Un appel entrant n'apporte pas de script construit par ALPHA. **L'agent utilise
maintenant `DEFAULT_INBOUND_SCRIPT`** (voir `agent.py`) : accueil EAGLEYE conforme
d'origine (se déclare IA + nomme son mandant), qualifie l'appelant, prend le
message, propose un rappel/RDV. Rien à faire — c'est branché.

> Pour personnaliser l'accueil, édite `DEFAULT_INBOUND_SCRIPT` dans `agent.py`
> (garde impérativement le bloc `## Première phrase` + les 3 mentions art. 50).

### B4. L'agent doit tourner
Comme pour le sortant : `python agent.py dev` (ou `start` en prod) doit être
lancé. Sans lui, l'appel entrant sonne dans le vide.

### B5. Teste
Appelle ton numéro entrant depuis un autre téléphone. Tu dois entendre la phrase
de divulgation, puis l'accueil.

---

## 4. Héberger l'agent (indispensable, PAS sur Vercel)

Vercel est serverless → il ne peut pas faire tourner un process vocal permanent.
L'agent (`agent.py`) doit vivre sur une machine **toujours allumée** :

- **LiveKit Cloud Agents** (le plus simple : LiveKit héberge ton agent), ou
- un petit **VPS** / **Fly.io** / **Railway** / **Render** :
  ```bash
  python agent.py start        # mode production (au lieu de dev)
  ```
  Garde le process vivant (systemd, pm2, ou le supervisor de la plateforme).

Mets les mêmes variables `voice/.env` sur cet hôte (LiveKit, NVIDIA, Fish,
Deepgram, `SIP_OUTBOUND_TRUNK_ID`).

---

## 5. Ce qui reste à faire (récap honnête)

**Prêt dans le code :**
- ✅ Sortant : app → dispatch → agent → SIP → divulgation → conversation.
- ✅ Entrant : agent + **accueil par défaut conforme** (ajouté).
- ✅ Conformité art. 50 vérifiée des deux côtés ; 4 garde-fous.

**À FAIRE par toi (config, hors code) :**
1. Créer le projet LiveKit + coller les 3 clés dans l'app et l'agent.
2. Ouvrir les comptes voix (Fish, Deepgram) + NVIDIA (gratuit).
3. **Sortant** : trunk SIP sortant → `SIP_OUTBOUND_TRUNK_ID`.
4. **Entrant** : numéro + trunk entrant + **Dispatch Rule → `alpha-voice`**.
5. **Héberger l'agent** sur une machine toujours allumée (§4).
6. **Tester vers ton propre numéro** avant tout prospect.

**Non vérifié ici (à valider en réel) :** qualité voix FR, latence, chaîne SIP
de bout en bout. Fais un appel test dès que les trunks sont en place.

**Conformité, à ne pas oublier :** en B2C, respecte Bloctel et les horaires ; la
divulgation art. 50 est obligatoire (elle est déjà tenue par le code).
