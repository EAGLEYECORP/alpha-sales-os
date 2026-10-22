#!/usr/bin/env bash
# Mastering d'un spot pour la télévision française — son à −23 LUFS, deux fichiers.
#
#   bash scripts/video/mastering-tv.sh <rendu.mp4> <dossier-de-sortie> <nom>
#
# Produit, depuis le rendu HyperFrames (1920×1080, 25 i/s) :
#   <nom>.mp4       fichier de VISIONNAGE (H.264, AAC 48 kHz, −23 LUFS) — celui du dépôt ;
#   <nom>-prores.mov  MASTER de livraison (ProRes 422 HQ 10 bits, PCM 24 bits 48 kHz, BT.709) ;
#   <nom>-mesures.txt la mesure EBU R128 des deux, relue APRÈS écriture.
#
# ⚠ LE VOLUME SE MESURE, IL NE SE RÈGLE PAS À L'OREILLE. La délibération du CSA du
# 19 juillet 2011 (intensité sonore des programmes ET des messages publicitaires)
# s'appuie sur EBU R128 et CST RT-017 : −23 LUFS intégrés, crête vraie sous −1 dBTP.
# Les valeurs de tolérance exactes d'une régie se lisent dans SA fiche technique. Le `loudnorm` en
# DEUX passes mesure d'abord, puis corrige linéairement : une seule passe comprime
# dynamiquement et écrase la bande-son. On vise −2 dBTP pour garder une marge.
#
# ⚠ LA SORTIE N'EST PAS CRUE SUR PAROLE : la dernière étape RELIT les fichiers écrits
# avec le filtre `ebur128` et échoue si l'intégré sort de −23 ± 0,5 LU ou si la crête
# vraie dépasse −1 dBTP. Le format exact d'une régie (MXF XDCAM, entrelacé, amorce
# noire, claquette) se demande à la régie : ce script ne l'invente pas.
set -euo pipefail
entree="$1"; sortie="$2"; nom="$3"
mkdir -p "$sortie"
CIBLE="I=-23:TP=-2:LRA=11"
# ⚠ LA DURÉE EST CELLE DE L'IMAGE. Le son AAC du rendu porte un rembourrage (≈ 16 ms
# mesurés le 22/10/2026) : sans coupe, le master durait 30,016 s pour 750 images, et
# une régie refuse un fichier dont le son déborde l'image.
duree=$(ffprobe -v error -select_streams v:0 -show_entries stream=duration -of csv=p=0 "$entree")

# 1 · Mesure.
mesure=$(ffmpeg -hide_banner -nostats -i "$entree" -af "loudnorm=${CIBLE}:print_format=json" -f null - 2>&1 | sed -n '/^{/,/^}/p')
val() { printf '%s' "$mesure" | python3 -c "import json,sys;print(json.load(sys.stdin)['$1'])"; }
filtre="loudnorm=${CIBLE}:measured_I=$(val input_i):measured_TP=$(val input_tp):measured_LRA=$(val input_lra):measured_thresh=$(val input_thresh):offset=$(val target_offset):linear=true"

# 2 · Le son corrigé, une fois, en 24 bits : les deux fichiers partent du même.
ffmpeg -hide_banner -loglevel error -y -i "$entree" -vn -af "$filtre" -ar 48000 -t "$duree" -c:a pcm_s24le "$sortie/$nom-son.wav"

# 3 · Visionnage : la vidéo telle que rendue, le son corrigé.
ffmpeg -hide_banner -loglevel error -y -i "$entree" -i "$sortie/$nom-son.wav" -map 0:v:0 -map 1:a:0 \
  -c:v copy -c:a aac -b:a 256k -ar 48000 -t "$duree" -movflags +faststart "$sortie/$nom.mp4"

# 4 · Master : ProRes 422 HQ, 10 bits, étiqueté BT.709 en plage vidéo (16–235).
ffmpeg -hide_banner -loglevel error -y -i "$entree" -i "$sortie/$nom-son.wav" -map 0:v:0 -map 1:a:0 \
  -c:v prores_ks -profile:v 3 -vendor apl0 -pix_fmt yuv422p10le \
  -color_primaries bt709 -color_trc bt709 -colorspace bt709 -color_range tv \
  -c:a pcm_s24le -ar 48000 -t "$duree" -movflags +write_colr "$sortie/$nom-prores.mov"
rm -f "$sortie/$nom-son.wav"

# 5 · Relecture : ce qui est ÉCRIT, pas ce qu'on a demandé.
: > "$sortie/$nom-mesures.txt"
for f in "$sortie/$nom.mp4" "$sortie/$nom-prores.mov"; do
  r=$(ffmpeg -hide_banner -nostats -i "$f" -af ebur128=peak=true -f null - 2>&1 | sed -n '/Summary:/,$p')
  I=$(printf '%s' "$r" | awk '/^ *I:/{print $2; exit}')
  TP=$(printf '%s' "$r" | awk '/Peak:/{print $2; exit}')
  printf '%s : intégré %s LUFS, crête vraie %s dBTP\n' "$(basename "$f")" "$I" "$TP" | tee -a "$sortie/$nom-mesures.txt"
  python3 - "$I" "$TP" "$(basename "$f")" <<'EOF'
import sys
i, tp, f = float(sys.argv[1]), float(sys.argv[2]), sys.argv[3]
assert abs(i + 23) <= 0.5, f"{f} : {i} LUFS, la cible est −23 ± 0,5"
assert tp <= -1.0, f"{f} : crête vraie {tp} dBTP, le plafond est −1"
EOF
done
# Le master se relit aussi : codec et profil (apch = 422 HQ), étiquette de couleur, durées.
ffprobe -v error -show_entries stream=codec_name,codec_tag_string,width,height,r_frame_rate,nb_frames,pix_fmt,color_space,color_primaries,color_transfer,sample_rate,channels,duration -of compact "$sortie/$nom-prores.mov" | tee -a "$sortie/$nom-mesures.txt"
python3 - "$sortie/$nom-prores.mov" <<'EOF'
import json, subprocess, sys
d = json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_streams", "-of", "json", sys.argv[1]], capture_output=True, text=True).stdout)
v = next(s for s in d["streams"] if s["codec_type"] == "video")
a = next(s for s in d["streams"] if s["codec_type"] == "audio")
assert v["codec_tag_string"] == "apch", f"profil ProRes {v['codec_tag_string']}, attendu apch (422 HQ)"
assert v.get("color_space") == "bt709" and v.get("color_primaries") == "bt709", "étiquette BT.709 absente du master"
assert abs(float(a["duration"]) - float(v["duration"])) < 0.02, f"son {a['duration']} s pour image {v['duration']} s"
print(f"master : {v['nb_frames']} images, {v['duration']} s image, {a['duration']} s son, BT.709, ProRes 422 HQ")
EOF
