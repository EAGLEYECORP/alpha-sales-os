# Appels ENTRANTS — Telnyx → LiveKit → Alpha

> L'agent (`agent.py`) rejoint la room où on le **dispatch**. Le **nom** et la
> **création** de cette room + le **bridge de l'appelant** = c'est la **Dispatch
> Rule LiveKit**, PAS le code Python. « room disconnected while waiting for
> participant » = personne n'a rejoint la room (dispatch mal câblé, ou room de
> test `lk agent dev` sans vrai appel).

## Le flux
```
Appel entrant → Telnyx → SIP URI LiveKit → Inbound Trunk (numéro reconnu)
   → Dispatch Rule : crée une room « inbound_… », y bridge l'appelant
   → dispatch l'agent « alpha-voice » dans CETTE room
   → agent.py : ctx.connect() → session.start() → divulgation (art. 50) → conversation
```

## 0. LE SIP URI LiveKit — la faute n°1 (Telnyx sonne « dans le vide »)
Telnyx doit envoyer l'INVITE à l'**hôte SIP de TON projet LiveKit**. Cet hôte
a un **préfixe aléatoire propre à LiveKit**, SANS aucun rapport avec le slug du
projet. Exemple réel de ce projet :

```
sip:5mwzznpudte.sip.livekit.cloud        ← le bon (préfixe LiveKit aléatoire)
sip:alpha-voice-os-9pdrl95q.sip.livekit.cloud   ← FAUX (slug projet ≠ hôte SIP)
```

> Trouve le tien : dashboard LiveKit → onglet **SIP**, ou `lk sip inbound list`
> (l'URI y figure). Le préfixe de gauche (`5mwzznpudte`) est la seule partie qui
> change d'un projet à l'autre.

**Où le mettre côté Telnyx** — connexion **FQDN** (pas Credential) →
onglet **Authentication and routing** → **FQDN / SIP URI de destination** :

| Champ | Valeur |
|---|---|
| FQDN / host | `5mwzznpudte.sip.livekit.cloud` (le TIEN, sans `sip:`) |
| Port | `5060` |
| Transport | `UDP` (ou `TLS`/`5061` si tu forces le chiffrement) |

Puis : le **numéro** (`+33451222182`) → onglet **Numbers** → routing vers **cette
connexion FQDN**. Voice Mail **OFF**.

> Symptôme d'un hôte faux : ça **sonne puis raccroche**, et l'agent ne montre
> **jamais** `received job request` (l'INVITE n'atteint pas LiveKit).
> **Outil de vérif Telnyx** : *SIP Call Flow Tool* → réponse `408 / pas de
> réponse` = hôte faux ; `200` = ça atteint LiveKit (le problème est alors trunk
> ou dispatch, §1-2) ; `404 / 403` = ça atteint LiveKit mais aucun trunk ne
> matche le numéro (§1).

## 1. Inbound Trunk (rattache ton numéro Telnyx)
`inbound-trunk.json` :
```json
{ "trunk": { "name": "Telnyx inbound", "numbers": ["+33XXXXXXXXX"] } }
```
```bash
lk sip inbound create inbound-trunk.json
```
> `numbers` = le(s) numéro(s) Telnyx qui pointent vers LiveKit. LiveKit matche le
> numéro **appelé** (le `To`) : selon la config Telnyx il arrive en E.164 (`+33…`),
> sans `+` (`33…`), ou en national (`0…`). Un seul format qui ne matche pas → INVITE
> **rejeté** (mêmes symptômes qu'un hôte faux : sonne puis raccroche). Par sécurité
> on liste **les trois formes** du numéro dans `inbound-trunk.json`. Alternative
> radicale pour tester : `"numbers": []` (vide = matche N'IMPORTE quel numéro).

## 2. Dispatch Rule (crée la room par appel + dispatch l'agent)
`dispatch-rule.json` :
```json
{
  "name": "Inbound → Alpha",
  "rule": { "dispatchRuleIndividual": { "roomPrefix": "inbound" } },
  "room_config": { "agents": [ { "agent_name": "alpha-voice" } ] }
}
```
```bash
lk sip dispatch create dispatch-rule.json
```
> `dispatchRuleIndividual` + `roomPrefix: "inbound"` → chaque appel crée une room
> `inbound_xxxx` (c'est ça, ton « inbound-room-<appel> ») et **dispatch
> alpha-voice dedans**. C'est la ligne `room_config.agents` qui déclenche l'agent
> — sans elle, l'appelant reste seul dans une room muette.
>
> ⚠ Les noms de sous-commandes/champs peuvent varier selon la version du CLI —
> vérifie avec `lk sip --help` / `lk sip dispatch --help` si un champ est rejeté.

## 3. Lance l'agent, PUIS appelle
```bash
python agent.py dev        # ou : lk agent dev   (hot-reload)
```
Puis **compose ton numéro Telnyx depuis ton téléphone**. Dans les logs tu dois voir :
```
Participant : sip_XXXX (kind=SIP)
```
…puis la divulgation prononcée, puis la conversation.

## Diagnostic
| Symptôme | Cause | Fix |
|---|---|---|
| `room disconnected while waiting for participant` sans avoir appelé | room de test `lk agent dev`, aucun appelant | normal — **appelle** le numéro pour un vrai test |
| Tu appelles mais **aucun** `Participant : sip_…` | la Dispatch Rule ne bridge pas / mauvais numéro de trunk | revois trunk `numbers` + `room_config.agents` |
| `Participant : sip_…` mais pas de voix | LLM/TTS (voir logs `LLM vocal :` / `TTS :`) | clé/latence (défaut NVIDIA + openai/gpt-oss-20b, sans latence), crédit Fish |
| Appelant seul, agent jamais dispatché | `room_config.agents` absent de la règle | ajoute `{"agent_name":"alpha-voice"}` |

## Note conformité (art. 50)
La 1re phrase est prononcée par le CODE (`first_sentence(script)`,
`allow_interruptions=False`) et contient « intelligence artificielle / assistant
vocal », « pas une personne », « pour le compte de … ». **Ne la remplace pas** par
un simple « Bonjour, je suis Alpha » : ce serait non conforme.
