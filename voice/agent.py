"""
ALPHA VOICE — agent vocal LiveKit, entrant et sortant.

────────────────────────────────────────────────────────────────────────
Ce que c'est
────────────────────────────────────────────────────────────────────────
Un agent qui décroche ou qui appelle, tient une conversation en français
et rend la main à un humain. Il sert la DÉMONSTRATION : faire entendre au
prospect, sur son propre métier, ce que vivraient ses clients.

Le script vient d'ALPHA (`lib/voice-script.ts` → /api/voice/script), pas
d'ici. Une seule source de vérité : ce que l'app affiche est exactement ce
que l'agent dit.

────────────────────────────────────────────────────────────────────────
La divulgation — article 50 du règlement européen sur l'IA
────────────────────────────────────────────────────────────────────────
Applicable depuis le 2 août 2026. L'agent DOIT faire comprendre qu'il est
une IA et dire pour le compte de qui il agit.

Ici ce n'est pas une consigne dans le prompt — un modèle peut dévier d'une
consigne. La première phrase est PRONONCÉE PAR LE CODE, hors du modèle,
avant que le modèle ait la parole (`say(..., allow_interruptions=False)`).
Le modèle ne peut donc pas l'omettre, la reformuler, ni la sauter.

Et si `audit_script` détecte un script sans les mentions dues, l'agent
refuse de démarrer. Un refus bruyant vaut mieux qu'un appel en faute.

────────────────────────────────────────────────────────────────────────
Installation
────────────────────────────────────────────────────────────────────────
    cd voice && pip install -r requirements.txt
    cp .env.example .env   # puis remplir
    python agent.py download-files      # modèles VAD/turn-detection
    python agent.py dev                 # écoute les dispatches

Appel sortant (déclenché par ALPHA, ou à la main) :
    lk dispatch create --new-room \\
       --agent-name alpha-voice \\
       --metadata '{"phone":"+33612345678","script":"...","company":"Garage X"}'

Prérequis LiveKit : un trunk SIP sortant configuré, son ID dans
SIP_OUTBOUND_TRUNK_ID. Voir voice/README.md.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re

from dotenv import load_dotenv
from livekit import agents, api, rtc
from livekit.agents import Agent, AgentSession, JobContext, RoomInputOptions, WorkerOptions, cli
from livekit.plugins import deepgram, openai, silero

load_dotenv()

logger = logging.getLogger("alpha-voice")
logging.basicConfig(level=logging.INFO)


# ── Divulgation : vérifiée avant tout appel ───────────────────────────
#
# Miroir exact de DISCLOSURE_REQUIREMENTS dans lib/voice-script.ts. Les
# deux doivent rester alignés : c'est le prix d'avoir un service séparé.
DISCLOSURE_REQUIREMENTS = [
    ("se déclare artificiel", re.compile(r"intelligence artificielle|assistant vocal", re.I)),
    ("dit ne pas être une personne", re.compile(r"pas une personne|pas un humain", re.I)),
    ("nomme son mandant", re.compile(r"pour le compte de", re.I)),
]


class DisclosureError(RuntimeError):
    """Le script ne porte pas les mentions imposées par l'article 50."""


# ── Accueil ENTRANT par défaut ────────────────────────────────────────
#
# Un appel entrant n'apporte pas de script construit par ALPHA (il n'y a pas
# de dispatch sortant). Sans script, l'agent refuserait de démarrer et
# l'appelant entendrait le silence. Ce script d'accueil est donc conforme
# d'origine (art. 50 : se déclare artificiel + nomme son mandant) et sert de
# repli quand aucun script n'est fourni sur un appel entrant.
# White-label : le compte qui héberge l'agent met SA marque (défaut EAGLEYE).
_BRAND = os.getenv("VOICE_BRAND_NAME", "EAGLEYE CORP")
_BRAND_CITY = os.getenv("VOICE_BRAND_CITY", "Lyon")
DEFAULT_INBOUND_SCRIPT = f"""## Première phrase
Bonjour, je suis ALPHA, un assistant vocal — une intelligence artificielle, pas une personne. Je réponds pour le compte de {_BRAND}.

## Ton rôle
Tu es l'accueil téléphonique de {_BRAND} ({_BRAND_CITY}). Reste bref, poli,
chaleureux, en français. Tu ne conclus pas de vente : tu qualifies et tu prends
le relais humain.

## Ce que tu fais
1. Demande le nom de la personne et l'entreprise.
2. Demande la raison de l'appel en une phrase.
3. Propose un rappel par un conseiller ou la prise d'un rendez-vous.
4. Recueille un moyen de rappel (téléphone ou e-mail) et l'horaire qui l'arrange.
5. Résume ce que tu as noté, remercie, et raccroche proprement.

## Règles
- Si on te demande si tu es un robot : confirme-le simplement, sans détour.
- Si la demande dépasse la prise de message (litige, urgence, technique) :
  dis que tu transmets à un humain qui rappellera.
- Ne promets aucun prix, délai ou engagement ferme.
"""


def audit_script(script: str) -> None:
    """Refuse de démarrer si une mention manque. Bruyant, volontairement."""
    missing = [label for label, pattern in DISCLOSURE_REQUIREMENTS if not pattern.search(script)]
    if missing:
        raise DisclosureError(
            "Script refusé — mentions manquantes : "
            + ", ".join(missing)
            + ". L'article 50 du règlement IA impose que l'agent se déclare artificiel "
            "et dise pour le compte de qui il agit. Aucun appel ne partira."
        )


def first_sentence(script: str) -> str:
    """
    Extrait la phrase de divulgation, que le CODE prononcera.

    On ne laisse pas le modèle la dire : un modèle peut reformuler, écourter
    ou sauter. Ici elle est jouée telle quelle, sans interruption possible.
    """
    lines = [l.strip() for l in script.splitlines()]
    for i, line in enumerate(lines):
        if line.startswith("## Première phrase") and i + 1 < len(lines):
            for candidate in lines[i + 1 :]:
                if candidate and not candidate.startswith("#"):
                    return candidate
    # Sécurité : si la structure du script change, on ne part pas sans rien.
    raise DisclosureError("Phrase de divulgation introuvable dans le script.")


class AlphaVoice(Agent):
    def __init__(self, script: str) -> None:
        audit_script(script)
        super().__init__(instructions=script)


def build_tts():
    """La voix de l'agent. Trois fournisseurs, choisis dans cet ordre :

      · fish   — Fish Audio (voix multilingues, bon français ; voix clonée
                 via FISH_VOICE_ID). Défaut si FISH_API_KEY est présent.
      · piper  — Piper auto-hébergé (100 % gratuit, illimité), pour quand le
                 crédit Fish est épuisé. Actif si PIPER_TTS_URL est renseigné
                 (et Fish absent), ou VOICE_TTS_PROVIDER=piper.
      · openai — repli payant.

    Force le choix avec VOICE_TTS_PROVIDER = fish | piper | openai.
    """
    provider = os.getenv("VOICE_TTS_PROVIDER", "").strip().lower()
    if not provider:
        provider = "fish" if os.getenv("FISH_API_KEY") else ("piper" if os.getenv("PIPER_TTS_URL") else "openai")

    if provider == "fish":
        try:
            from livekit.plugins import fishaudio
        except ImportError as e:  # plugin absent
            raise RuntimeError(
                'FISH activé mais le plugin manque — pip install "livekit-agents[fishaudio]"'
            ) from e
        kwargs = {}
        ref = os.getenv("FISH_VOICE_ID")
        if ref:
            kwargs["reference_id"] = ref  # la voix clonée / choisie
        model = os.getenv("FISH_MODEL")
        if model:
            kwargs["model"] = model
        logger.info("TTS : Fish Audio%s", f" (voix {ref})" if ref else " (voix par défaut)")
        return fishaudio.TTS(**kwargs)

    if provider == "piper":
        url = os.getenv("PIPER_TTS_URL")
        if not url:
            raise RuntimeError("VOICE_TTS_PROVIDER=piper mais PIPER_TTS_URL absent (serveur Piper auto-hébergé).")
        # Plugin communautaire — pip install livekit-plugins-piper-tts.
        # L'API exacte peut varier selon la version : ajuste base_url/voice
        # au premier essai (l'agent journalise l'erreur si un nom diffère).
        try:
            from livekit.plugins import piper  # type: ignore
        except ImportError as e:
            raise RuntimeError(
                "Piper activé mais le plugin manque — pip install livekit-plugins-piper-tts"
            ) from e
        logger.info("TTS : Piper local (%s)", url)
        return piper.TTS(base_url=url, voice=os.getenv("PIPER_VOICE", "fr_FR-siwis-medium"))

    # Repli OpenAI TTS → api.openai.com. Piège fréquent : y coller une clé NVIDIA.
    key = os.getenv("OPENAI_API_KEY", "").strip()
    if not key or key.startswith("nvapi-"):
        raise RuntimeError(
            "TTS OpenAI sélectionnée mais OPENAI_API_KEY est absente ou invalide "
            "(une clé « nvapi- » est une clé NVIDIA, PAS OpenAI — elle ne peut pas "
            "faire parler l'agent). Donne une VRAIE voix, gratuite : Fish "
            "(FISH_API_KEY, voix FR) ou Piper auto-hébergé (PIPER_TTS_URL). "
            "NVIDIA ne sert pas la TTS OpenAI. Voir voice/.env.example."
        )
    logger.info("TTS : OpenAI (%s)", os.getenv("VOICE_TTS_VOICE", "alloy"))
    return openai.TTS(voice=os.getenv("VOICE_TTS_VOICE", "alloy"))


def build_llm():
    """Le LLM de l'agent — endpoint COMPATIBLE OpenAI, joignable CÔTÉ SERVEUR.

    Une seule option à configurer, cohérente (base_url + modèle + clé) :
      · NVIDIA NIM (défaut, gratuit) : base_url .../v1, modèle meta/llama-3.3-70b-instruct,
        clé NVIDIA_API_KEY (nvapi-…).
      · OpenAI : base_url https://api.openai.com/v1, modèle gpt-4o-mini, clé OPENAI_API_KEY.
      · Ollama local : base_url http://localhost:11434/v1, modèle tiré localement,
        aucune clé requise (on en passe une factice, Ollama l'ignore).

    ⚠ Puter (js.puter.com) n'est PAS utilisable ici : c'est un SDK NAVIGATEUR,
    sans endpoint serveur — il ne sert qu'au bouton « Écouter » du web. Ne cherche
    pas d'« URL Puter » pour l'agent : il n'y en a pas.
    """
    base_url = os.getenv("VOICE_BASE_URL", "https://integrate.api.nvidia.com/v1").strip()
    model = os.getenv("VOICE_MODEL", "meta/llama-3.3-70b-instruct").strip()
    host = base_url.lower()
    is_local = any(h in host for h in ("localhost", "127.0.0.1", "0.0.0.0"))

    # Clé choisie SELON l'endpoint — la cause n°1 des échecs est une clé qui ne
    # correspond pas au base_url (clé OpenAI envoyée à NVIDIA, ou l'inverse).
    if "openai.com" in host:
        api_key, provider = os.getenv("OPENAI_API_KEY"), "OpenAI"
    elif "nvidia" in host:
        api_key, provider = os.getenv("NVIDIA_API_KEY") or os.getenv("OPENAI_API_KEY"), "NVIDIA NIM"
    elif is_local:
        api_key, provider = os.getenv("OPENAI_API_KEY") or os.getenv("NVIDIA_API_KEY") or "local", "local (Ollama/compatible)"
    else:
        api_key, provider = os.getenv("OPENAI_API_KEY") or os.getenv("NVIDIA_API_KEY"), "compatible OpenAI"

    # Les deux fautes les plus courantes, dites EN CLAIR avant le premier appel.
    if not api_key and not is_local:
        raise RuntimeError(
            f"LLM vocal : aucune clé API pour {provider} ({base_url}). "
            "Renseigne NVIDIA_API_KEY (gratuit, défaut) ou OPENAI_API_KEY dans voice/.env."
        )
    if "openai.com" in host and "/" in model:
        logger.warning(
            "LLM vocal : base_url OpenAI mais VOICE_MODEL=« %s » a un namespace (id NIM) "
            "→ OpenAI renverra 404. Mets VOICE_MODEL=gpt-4o-mini, ou repasse VOICE_BASE_URL sur NVIDIA NIM.",
            model,
        )
    if "nvidia" in host and "/" not in model:
        # NVIDIA NIM attend un id NAMESPACÉ (vendor/model). « gpt-oss-20b » seul
        # → 404 ; il faut « openai/gpt-oss-20b ». C'est le piège n°1.
        logger.warning(
            "LLM vocal : VOICE_MODEL=« %s » sans namespace — NVIDIA NIM attend un id complet "
            "(ex. openai/gpt-oss-20b, meta/llama-3.3-70b-instruct) → 404 probable. Ajoute le préfixe.",
            model,
        )

    logger.info(
        "LLM vocal : %s · base_url=%s · modèle=%s · clé=%s",
        provider, base_url, model, "OK" if (api_key and api_key != "local") else "aucune (local)",
    )
    return openai.LLM(model=model, base_url=base_url, api_key=api_key, temperature=0.4)


async def entrypoint(ctx: JobContext) -> None:
    """
    Point d'entrée. Les métadonnées du job portent tout :
        phone    numéro E.164 à appeler (absent = appel entrant)
        script   le script complet, produit par ALPHA
        company  nom affiché dans les journaux
    """
    raw = ctx.job.metadata or "{}"
    try:
        meta = json.loads(raw)
    except json.JSONDecodeError:
        logger.error("Métadonnées illisibles : %s", raw[:200])
        return

    script: str = meta.get("script", "")
    phone: str | None = meta.get("phone")
    company: str = meta.get("company", "inconnu")

    # Appel ENTRANT sans script → on sert l'accueil par défaut (déjà conforme).
    # Appel SORTANT sans script → on laisse échouer : un appel de démo/rappel
    # doit porter le script produit par ALPHA, jamais un accueil générique.
    if not script and not phone:
        script = DEFAULT_INBOUND_SCRIPT
        logger.info("Appel entrant — accueil par défaut (aucun script fourni).")

    try:
        agent = AlphaVoice(script)
    except DisclosureError as e:
        # On journalise en ERREUR et on sort : mieux vaut un appel qui
        # n'a pas lieu qu'un appel en infraction.
        logger.error("APPEL REFUSÉ (%s) — %s", company, e)
        return

    await ctx.connect()

    session = AgentSession(
        # Reconnaissance : français, ponctuation activée pour que le modèle
        # comprenne les questions.
        stt=deepgram.STT(model="nova-2-general", language="fr"),
        # LLM : compatible OpenAI (NVIDIA NIM / OpenAI / Ollama). build_llm()
        # choisit la clé selon l'endpoint, journalise la config et alarme sur
        # les mismatch (la cause n°1 du « LLM can't be fetched »).
        llm=build_llm(),
        tts=build_tts(),
        vad=silero.VAD.load(),
    )

    # ── Appel sortant : on compose AVANT de démarrer la session ──
    if phone:
        trunk = os.getenv("SIP_OUTBOUND_TRUNK_ID")
        if not trunk:
            logger.error("SIP_OUTBOUND_TRUNK_ID absent — impossible d'appeler %s", phone)
            return
        try:
            await ctx.api.sip.create_sip_participant(
                api.CreateSIPParticipantRequest(
                    room_name=ctx.room.name,
                    sip_trunk_id=trunk,
                    sip_call_to=phone,
                    participant_identity="prospect",
                    # Attendre le décroché : sans ça, l'agent parle dans le vide
                    # pendant la sonnerie et la divulgation se perd.
                    wait_until_answered=True,
                )
            )
            logger.info("Décroché — %s (%s)", company, phone)
        except api.TwirpError as e:
            logger.error("Appel non abouti vers %s : %s", phone, e.message)
            ctx.shutdown()
            return

    await session.start(
        room=ctx.room,
        agent=agent,
        room_input_options=RoomInputOptions(),
    )

    # ── LA divulgation — prononcée par le code, pas par le modèle ──
    #
    # allow_interruptions=False : même si l'interlocuteur parle en même
    # temps, la phrase va au bout. C'est ce qui rend l'obligation tenue.
    await session.say(first_sentence(script), allow_interruptions=False)

    # Le modèle prend la main ensuite, avec le script en instructions.
    await session.generate_reply()


if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            # Nom explicite : les dispatches d'ALPHA le visent nommément,
            # donc l'agent ne se déclenche jamais par accident sur une room.
            agent_name="alpha-voice",
        )
    )
