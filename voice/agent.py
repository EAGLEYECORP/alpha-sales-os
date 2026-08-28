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
from livekit.agents import (
    Agent,
    AgentServer,
    AgentSession,
    JobContext,
    RoomInputOptions,
    WorkerOptions,
    cli,
    function_tool,
)
from livekit.plugins import deepgram, openai, silero

# Les plugins DOIVENT s'enregistrer sur le thread principal (à l'import du
# module), pas paresseusement dans build_tts() qui tourne dans le thread du job
# (sinon « Plugins must be registered on the main thread »). Fish et Piper sont
# optionnels : import gardé, on vérifie la présence au moment du choix.
try:
    from livekit.plugins import fishaudio  # type: ignore
except ImportError:
    fishaudio = None  # type: ignore
try:
    from livekit.plugins import piper_tts  # type: ignore
except ImportError:
    piper_tts = None  # type: ignore

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
    """L'agent, et le SEUL moyen qu'il a de déclarer un oui.

    ─────────────────────────────────────────────────────────────────────
    ⚠ SANS CET OUTIL, LA NOUVELLE DOCTRINE ÉTAIT MORTE EN PRODUCTION.

    Doctrine du 28/08/2026 : Alpha Voice mène l'appel à froid entier et ne
    passe la main que sur INTÉRÊT QUALIFIÉ (`outcome: "interesse"`). Toute la
    chaîne TypeScript a été câblée pour ça — `cadenceFor`, `masterRappel`,
    `RESULTATS_MANUELS`, la capacité d'appels.

    Sauf que CE fichier écrivait toujours `outcome = "repondu"`, en dur. Il ne
    pouvait donc JAMAIS émettre `interesse` : le prospect disait oui, la
    chaîne le lisait comme un simple décroché, `handoffToHuman` restait faux —
    et personne n'était prévenu. J'ai changé la chaîne et laissé l'émetteur
    derrière : exactement le défaut que ce dépôt corrige partout.

    ── POURQUOI UN OUTIL ET PAS UNE ANALYSE DE TRANSCRIPTION ──

    Détecter l'accord en relisant le français produit par le modèle, c'est
    remettre une expression régulière sur du texte libre. Le même jour, un
    `\b` après une lettre accentuée avait rendu un motif d'intérêt
    silencieusement mort — le piège est réel et il ne prévient pas.

    Ici le modèle DÉCLARE. C'est explicite, c'est vérifiable dans le journal,
    et ça ne dépend d'aucune tournure.
    ─────────────────────────────────────────────────────────────────────
    """

    def __init__(self, script: str) -> None:
        audit_script(script)
        super().__init__(instructions=script)
        # Le résultat vit sur l'agent : l'outil l'écrit, la clôture le lit.
        self.resultat_declare: str | None = None
        self.creneau_obtenu: str | None = None

    @function_tool()
    async def rendez_vous_obtenu(self, creneau: str) -> str:
        """À appeler UNIQUEMENT quand la personne a accepté un rendez-vous.

        C'est le seul cas qui mobilise un humain. Ne l'appelle pas sur un
        « peut-être », un « rappelez-moi » ou une simple politesse.

        Args:
            creneau: le jour et l'heure convenus, tels que la personne les a dits.
        """
        self.resultat_declare = "interesse"
        self.creneau_obtenu = (creneau or "").strip() or None
        logger.info("Alpha Voice — INTÉRÊT QUALIFIÉ déclaré, créneau : %s", self.creneau_obtenu)
        return "Rendez-vous noté. Confirme-le à voix haute, remercie, et termine l'appel."

    @function_tool()
    async def refus_definitif(self) -> str:
        """À appeler quand la personne demande à ne plus être contactée.

        Coupe TOUTE relance, définitivement. À ne pas confondre avec un simple
        « pas intéressé » : celui-là autorise encore une réactivation plus tard.
        """
        self.resultat_declare = "opposition"
        logger.info("Alpha Voice — OPPOSITION déclarée : plus aucun appel.")
        return "C'est noté. Confirme qu'elle ne sera plus contactée, remercie, et raccroche."


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
        if fishaudio is None:
            raise RuntimeError(
                'FISH activé mais le plugin manque — pip install "livekit-agents[fishaudio]"'
            )
        kwargs = {}
        ref = os.getenv("FISH_VOICE_ID")
        if ref:
            # Le nom du paramètre a changé selon la version du plugin :
            # anciennes → reference_id, récentes → voice_id. On détecte celui
            # que la TTS installée accepte (fin des « unexpected keyword »).
            import inspect

            params = inspect.signature(fishaudio.TTS.__init__).parameters
            if "reference_id" in params:
                kwargs["reference_id"] = ref
            elif "voice_id" in params:
                kwargs["voice_id"] = ref
            else:
                kwargs["reference_id"] = ref  # défaut si signature en **kwargs
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
        # Module = piper_tts ; l'URL du serveur Piper est POSITIONNELLE (la voix
        # est choisie par le serveur au lancement, pas par le plugin).
        if piper_tts is None:
            raise RuntimeError(
                "Piper activé mais le plugin manque — pip install livekit-plugins-piper-tts"
            )
        logger.info("TTS : Piper local (%s)", url)
        return piper_tts.TTS(url)

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
      · NVIDIA NIM (défaut, gratuit) : base_url .../v1, modèle openai/gpt-oss-20b,
        clé NVIDIA_API_KEY (nvapi-…). Ce petit modèle répond SANS latence en
        conversation (testé terrain) — contrairement au 70B qui fait la file
        d'attente sur l'offre gratuite. Garde le namespace « openai/ ».
      · OpenAI : base_url https://api.openai.com/v1, modèle gpt-4o-mini, clé OPENAI_API_KEY.
      · Ollama local : base_url http://localhost:11434/v1, modèle tiré localement,
        aucune clé requise (on en passe une factice, Ollama l'ignore).

    ⚠ Puter (js.puter.com) n'est PAS utilisable ici : c'est un SDK NAVIGATEUR,
    sans endpoint serveur — il ne sert qu'au bouton « Écouter » du web. Ne cherche
    pas d'« URL Puter » pour l'agent : il n'y en a pas.
    """
    # ── L'ORDRE DES FOURNISSEURS : OpenAI D'ABORD, NVIDIA EN REPLI ──
    #
    # Deux raisons, une mesurée et une contractuelle.
    #
    #  1. TERRAIN : sur un vrai appel entrant, la conversation servie par
    #     OpenAI est nettement plus fluide que celle du NIM gratuit. Le tier
    #     gratuit NVIDIA met les requêtes EN FILE quand la charge monte, et
    #     une seconde d'attente au milieu d'une phrase s'entend.
    #  2. LICENCE : l'accès gratuit build.nvidia.com est réservé au
    #     développement, aux tests et à l'évaluation. Servir des appels
    #     CLIENTS avec exige NVIDIA AI Enterprise. Le repli gratuit reste
    #     donc bon pour la mise au point, jamais pour la production facturée.
    #
    # Le choix se DÉDUIT des clés présentes — pas d'un drapeau à penser à
    # basculer le jour du lancement. `VOICE_BASE_URL` reste prioritaire pour
    # forcer la main (Groq, Cerebras, Ollama…).
    forced = os.getenv("VOICE_BASE_URL", "").strip()
    # `VOICE_API_KEY` est la clé GÉNÉRIQUE : elle peut viser Groq (gsk_…),
    # NVIDIA (nvapi-…) ou autre. La prendre pour un signal « OpenAI » enverrait
    # une clé Groq à api.openai.com. Seul le préfixe OpenAI (sk-) compte ici.
    generique = os.getenv("VOICE_API_KEY", "").strip()
    a_openai = bool(os.getenv("OPENAI_API_KEY", "").strip()) or generique.startswith("sk-")
    base_url = forced or (
        "https://api.openai.com/v1" if a_openai else "https://integrate.api.nvidia.com/v1"
    )
    # Le modèle par défaut suit l'endpoint : un id namespacé (« openai/… »)
    # envoyé à api.openai.com rend un 404, et l'inverse aussi.
    defaut_modele = "gpt-4o-mini" if "openai.com" in base_url.lower() else "openai/gpt-oss-20b"
    # ⚠ `VOICE_MODEL=` (déclarée VIDE dans .env) n'est PAS une variable absente :
    # `os.getenv(x, defaut)` rend alors "" et non le défaut. L'agent partait
    # avec un modèle vide → 400 du fournisseur, appel mort. On retombe donc sur
    # le défaut aussi bien pour l'absence que pour la chaîne vide.
    model = (os.getenv("VOICE_MODEL") or "").strip() or defaut_modele
    host = base_url.lower()
    is_local = any(h in host for h in ("localhost", "127.0.0.1", "0.0.0.0"))

    # Clé choisie SELON l'endpoint — la cause n°1 des échecs est une clé qui ne
    # correspond pas au base_url (clé OpenAI envoyée à NVIDIA, ou l'inverse).
    # VOICE_API_KEY = clé générique, prioritaire (n'importe quel endpoint
    # compatible OpenAI : Groq, Cerebras, Together…). Sinon, clé par fournisseur.
    generic = os.getenv("VOICE_API_KEY")
    if "openai.com" in host:
        api_key, provider = generic or os.getenv("OPENAI_API_KEY"), "OpenAI"
    elif "groq.com" in host:
        api_key, provider = generic or os.getenv("GROQ_API_KEY") or os.getenv("OPENAI_API_KEY"), "Groq"
    elif "nvidia" in host:
        api_key, provider = generic or os.getenv("NVIDIA_API_KEY") or os.getenv("OPENAI_API_KEY"), "NVIDIA NIM"
    elif is_local:
        api_key, provider = generic or os.getenv("OPENAI_API_KEY") or os.getenv("NVIDIA_API_KEY") or "local", "local (Ollama/compatible)"
    else:
        api_key, provider = generic or os.getenv("OPENAI_API_KEY") or os.getenv("NVIDIA_API_KEY"), "compatible OpenAI"

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
            "(ex. openai/gpt-oss-20b) → 404 probable. Ajoute le préfixe.",
            model,
        )

    logger.info(
        "LLM vocal : %s · base_url=%s · modèle=%s · clé=%s",
        provider, base_url, model, "OK" if (api_key and api_key != "local") else "aucune (local)",
    )
    return openai.LLM(model=model, base_url=base_url, api_key=api_key, temperature=0.4)


# AgentServer : requis par le CLI moderne « lk agent dev » (découverte de la
# variable `server` au niveau module). Le `python agent.py` classique passe, lui,
# par cli.run_app(WorkerOptions(...)) plus bas — les deux enregistrent le worker
# sous le nom « alpha-voice », donc les dispatches (entrants comme sortants) le
# visent nommément.
server = AgentServer()


@server.rtc_session(agent_name="alpha-voice")
class SessionReporter:
    """Pousse la session d'appel vers ALPHA SALES, en direct.

    Trois événements : `start`, `turn` (chaque tour de parole transcrit),
    `end`. La transcription vient de Deepgram, déjà payée pour le STT — on
    ne dépense donc rien de plus pour obtenir l'historique de conversation.

    RÈGLE : le journal ne doit JAMAIS casser un appel. Tout échec réseau est
    avalé et journalisé. Un appel qui se coupe parce que le CRM ne répond pas
    serait un bug bien plus grave que l'absence de trace.

    Sans ALPHA_SESSION_URL configurée, l'objet est inerte (mode local).
    """

    def __init__(self, session_id: str, room: str, direction: str, meta: dict) -> None:
        self.url = os.getenv("ALPHA_SESSION_URL", "").strip()
        self.secret = os.getenv("VOICE_WEBHOOK_SECRET", "").strip()
        self.id = session_id
        self.room = room
        self.direction = direction
        self.meta = meta
        self.enabled = bool(self.url)

        # Deux pièges opérationnels qui coûtent tout l'historique de
        # conversation, sans jamais faire échouer un appel — donc invisibles
        # si on ne les dit pas ICI, au démarrage.
        if self.enabled and not self.secret:
            logger.error(
                "ALPHA_SESSION_URL est configurée mais VOICE_WEBHOOK_SECRET est VIDE. "
                "En production, /api/voice/session refuse tout appel non signé : les "
                "transcriptions seront perdues en silence (l'appel, lui, se déroulera "
                "normalement). Renseigne le même secret des deux côtés."
            )
        if self.enabled and self.url.startswith("http://") and "localhost" not in self.url and "127.0.0.1" not in self.url:
            logger.error(
                "ALPHA_SESSION_URL est en http:// vers un hôte distant : le secret et "
                "les transcriptions d'appels circuleraient en clair. Passe en https://."
            )

    async def _post(self, payload: dict) -> None:
        if not self.enabled:
            return
        payload = {"id": self.id, **payload}
        try:
            import urllib.request

            data = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(self.url, data=data, method="POST")
            req.add_header("Content-Type", "application/json")
            if self.secret:
                req.add_header("x-voice-secret", self.secret)
            # Appel bloquant déporté dans un thread : la boucle audio ne doit
            # jamais attendre le réseau.
            await asyncio.to_thread(urllib.request.urlopen, req, timeout=5)
        except Exception as e:  # noqa: BLE001 — on avale TOUT, c'est voulu
            logger.warning("Journal de session indisponible (%s) — l'appel continue.", e)

    async def start(self) -> None:
        await self._post(
            {
                "event": "start",
                "room": self.room,
                "direction": self.direction,
                "prospectId": self.meta.get("prospectId"),
                "accountId": self.meta.get("accountId"),
                "peer": self.meta.get("phone"),
                # L'enregistrement audio n'est PAS activé par défaut : il exige
                # d'informer l'interlocuteur (mention distincte de l'art. 50).
                "recordingAnnounced": False,
            }
        )

    async def turn(self, speaker: str, text: str) -> None:
        if not text or not text.strip():
            return
        await self._post({"event": "turn", "speaker": speaker, "text": text.strip()})

    async def end(self, outcome: str | None = None, error: str | None = None) -> None:
        await self._post({"event": "end", "outcome": outcome, "error": error})


async def entrypoint(ctx: JobContext) -> None:
    """
    Point d'entrée. Les métadonnées du job portent tout :
        phone    numéro E.164 à appeler (absent = appel entrant)
        script   le script complet, produit par ALPHA
        company  nom affiché dans les journaux

    Entrant  : la Dispatch Rule LiveKit crée la room, y bridge l'appelant SIP
               et dispatch cet agent dedans. Pas de `phone` → accueil par défaut.
    Sortant  : ALPHA fournit `phone` + `script` ; on compose via le trunk SIP,
               on attend le décroché, puis la divulgation part.
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

    # Visibilité inbound : trace chaque participant qui rejoint la room. Sur un
    # vrai appel entrant tu dois voir « Participant : sip_… » — si rien n'arrive,
    # c'est la Dispatch Rule LiveKit qui ne bridge pas l'appelant (pas le code).
    @ctx.room.on("participant_connected")
    def _on_participant(p: rtc.RemoteParticipant) -> None:
        logger.info("Participant : %s (kind=%s)", p.identity, p.kind)

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

    # ── Journal de session : visible en direct dans ALPHA SALES ──
    reporter = SessionReporter(
        session_id=ctx.room.name,
        room=ctx.room.name,
        direction="sortant" if phone else "entrant",
        meta=meta,
    )
    await reporter.start()

    # Chaque tour de parole transcrit part vers ALPHA. C'est CE flux qui
    # constitue l'historique de conversation réinjecté au prochain contact.
    @session.on("conversation_item_added")
    def _on_item(ev) -> None:  # noqa: ANN001 — type interne au SDK
        try:
            item = getattr(ev, "item", ev)
            role = str(getattr(item, "role", "") or "")
            text = getattr(item, "text_content", None) or getattr(item, "content", "")
            if isinstance(text, (list, tuple)):
                text = " ".join(str(x) for x in text)
            speaker = "agent" if role == "assistant" else "prospect"
            asyncio.create_task(reporter.turn(speaker, str(text)))
        except Exception as e:  # noqa: BLE001 — jamais casser l'appel
            logger.debug("Tour non journalisé : %s", e)

    # ─────────────────────────────────────────────────────────────────
    # LA FIN DE L'APPEL SE DÉCLARE À LA FIN DE L'APPEL.
    #
    # ⚠ DEUX DÉFAUTS CORRIGÉS ICI, et ils se voyaient au téléphone.
    #
    #  1. `end` PARTAIT TROP TÔT. L'ancienne version postait
    #     `end(outcome="repondu")` juste après `generate_reply()`, c'est-à-dire
    #     dès la PREMIÈRE réponse de l'agent — alors que la conversation
    #     continue. Conséquences en chaîne : la session passait en
    #     « terminee » côté CRM pendant que la personne parlait encore, l'écran
    #     Live Assist arrêtait de suivre l'appel en cours, et surtout
    #     `applyOutcome` réconciliait l'événement de timeline AVANT la fin —
    #     donc un « ne me rappelez plus » prononcé ensuite n'était plus
    #     appliqué. L'appel avait l'air coupé alors qu'il tournait toujours.
    #
    #     La fin réelle, c'est l'arrêt du job (l'interlocuteur a raccroché, la
    #     room se ferme). D'où le callback d'extinction.
    #
    #  2. UNE ERREUR RACCROCHAIT. Le `raise` faisait tomber le job : la
    #     personne au bout du fil entendait un silence puis la tonalité, sans
    #     un mot. Un LLM qui répond 429, une TTS à court de crédit, un
    #     hoquet réseau — tout coupait l'appel. Maintenant l'incident est
    #     journalisé, l'agent le DIT, et la session reste ouverte : le tour de
    #     parole suivant relance un appel au modèle, qui passe souvent.
    # ─────────────────────────────────────────────────────────────────
    resultat: dict[str, str | None] = {"outcome": None, "error": None}

    async def _cloturer(*_args) -> None:
        """Poste `end` au vrai raccroché. Ne lève JAMAIS : on est en extinction.

        ⚠ Le résultat DÉCLARÉ par l'agent prime sur le provisoire. Sans cette
        ligne, l'outil `rendez_vous_obtenu` écrirait dans le vide et la chaîne
        continuerait de lire « repondu » — donc personne ne serait réveillé sur
        un oui. C'est le point exact où la doctrine se perdait.
        """
        try:
            final = agent.resultat_declare or resultat["outcome"]
            await reporter.end(outcome=final, error=resultat["error"])
        except Exception as e:  # noqa: BLE001
            logger.warning("Clôture de session non journalisée : %s", e)

    ctx.add_shutdown_callback(_cloturer)

    # Démarrage de la pile audio. Si CELUI-CI échoue, rien ne fonctionne et il
    # n'y a pas d'appel à sauver : on relance.
    try:
        await session.start(
            room=ctx.room,
            agent=agent,
            room_input_options=RoomInputOptions(),
        )
    except Exception as e:  # noqa: BLE001
        resultat["error"] = f"démarrage de session : {e}"
        logger.error("Alpha Voice — la session n'a pas démarré (%s) : %s", company, e, exc_info=True)
        raise

    try:
        # ── LA divulgation — prononcée par le code, pas par le modèle ──
        #
        # allow_interruptions=False : même si l'interlocuteur parle en même
        # temps, la phrase va au bout. C'est ce qui rend l'obligation tenue.
        await session.say(first_sentence(script), allow_interruptions=False)

        # La divulgation est passée : quelqu'un est au bout du fil. C'est le
        # moment où le résultat devient « repondu » — mais il ne sera POSTÉ
        # qu'au raccroché, et l'agent peut encore le RELEVER entre-temps.
        #
        # ⚠ « repondu » est PROVISOIRE, jamais définitif. C'est le plancher :
        # quelqu'un a décroché. Si l'agent obtient un rendez-vous ou essuie un
        # refus définitif, il le déclare par un outil (`rendez_vous_obtenu`,
        # `refus_definitif`) et c'est CETTE déclaration qui part.
        resultat["outcome"] = "repondu"

        # Le modèle prend la main ensuite, avec le script en instructions.
        await session.generate_reply()
    except Exception as e:  # noqa: BLE001 — un incident ne doit pas raccrocher
        resultat["error"] = str(e)
        logger.error(
            "Alpha Voice — incident pendant l'appel (%s) : %s. "
            "L'appel CONTINUE ; regarde ce message pour la cause exacte "
            "(429 = quota, 404 = modèle inconnu, timeout = fournisseur lent).",
            company, e, exc_info=True,
        )
        # Ne jamais laisser un silence : la personne doit entendre quelque
        # chose. Phrase neutre — elle ne prétend pas être un humain (art. 50).
        try:
            await session.say(
                "Pardon, j'ai eu une coupure technique. Je vous écoute.",
                allow_interruptions=True,
            )
        except Exception as e2:  # noqa: BLE001
            # Là, même la voix est morte : il n'y a plus rien à sauver.
            logger.error("Alpha Voice — la voix ne répond plus non plus : %s", e2)
            raise


if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            # Nom explicite : les dispatches d'ALPHA le visent nommément,
            # donc l'agent ne se déclenche jamais par accident sur une room.
            agent_name="alpha-voice",
        )
    )
