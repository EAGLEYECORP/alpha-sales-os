#!/usr/bin/env bash
# Installe HyperFrames (HeyGen, Apache-2.0) pour fabriquer nos vidéos — HORS du produit.
#
#   bash scripts/video/hyperframes-bac-a-sable.sh
#   source "${ALPHA_VIDEO_OUTILS:-$HOME/.cache/alpha-video}/env.sh"
#   npx hyperframes init ma-video --example blank --non-interactive --resolution portrait
#
# ⚠ RIEN N'ENTRE DANS package.json. HyperFrames est un outil d'atelier, comme
# ffmpeg : le produit n'en dépend pas, et la règle « aucune dépendance sans
# raison impérieuse » vise ce qui part chez le client. L'installer dans le
# dépôt l'aurait fait monter dans l'image Docker livrée.
#
# Les quatre murs de ce conteneur, mesurés le 20/10/2026 — chacun a fait
# échouer un rendu avant d'être contourné ici :
#  · Chrome : HyperFrames veut télécharger le sien ; on lui donne celui que
#    Playwright a déjà installé (HYPERFRAMES_BROWSER_PATH).
#  · ffprobe : absent du système. Sans lui, aucun média ne se sonde.
#  · GSAP depuis cdn.jsdelivr.net : REFUSÉ par le proxy. Le gabarit d'init le
#    charge de là ; le rendu échoue alors sur « sub_timeline_script_failure ».
#    On copie gsap.min.js à côté de la composition (voir `gsap_local` plus bas).
#  · Télémétrie : HyperFrames envoie des statistiques d'usage par défaut. On la
#    coupe — rien de ce qui se fabrique ici n'a à sortir.
set -euo pipefail

OUTILS="${ALPHA_VIDEO_OUTILS:-$HOME/.cache/alpha-video}"
mkdir -p "$OUTILS/bin"
cd "$OUTILS"
[ -f package.json ] || npm init -y >/dev/null

# Versions FIGÉES : un rendu doit se refaire à l'identique dans trois mois.
npm i -s hyperframes@0.8.181 gsap@3.14.2 ffprobe-static@3.1.0 @ffmpeg-installer/linux-x64@4.1.0 >/dev/null

ln -sf "$OUTILS/node_modules/@ffmpeg-installer/linux-x64/ffmpeg" bin/ffmpeg
ln -sf "$OUTILS/node_modules/ffprobe-static/bin/linux/x64/ffprobe" bin/ffprobe

NAV="${CHROMIUM_HEADLESS:-$(ls -d /opt/pw-browsers/chromium_headless_shell-*/chrome-linux/headless_shell 2>/dev/null | head -1)}"
if [ -z "$NAV" ]; then
  echo "⚠ Aucun Chromium headless trouvé : HyperFrames tentera d'en télécharger un." >&2
fi

cat > env.sh <<EOF
export PATH="$OUTILS/bin:$OUTILS/node_modules/.bin:\$PATH"
export HYPERFRAMES_BROWSER_PATH="$NAV"
# Copie GSAP à côté d'une composition et réécrit le lien CDN (refusé ici).
gsap_local() { cp "$OUTILS/node_modules/gsap/dist/gsap.min.js" "\$1/" && sed -i 's#https://cdn.jsdelivr.net/npm/gsap@[^"]*/dist/gsap.min.js#gsap.min.js#' "\$1/index.html"; }
EOF

# shellcheck disable=SC1091
. ./env.sh
npx hyperframes telemetry disable >/dev/null
npx hyperframes doctor 2>&1 | grep -E "Chrome|FFmpeg|FFprobe|Node" || true
echo "Prêt. Avant chaque session : source $OUTILS/env.sh"
