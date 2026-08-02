#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# Pousse les variables d'environnement sur Vercel, en production.
#
# Écrit parce que je ne peux pas me connecter à ton Vercel : aucun
# connecteur, aucun jeton. Ce script fait le travail à ma place — tu
# t'authentifies une fois, il pose tout le reste.
#
#   bash scripts/vercel-env.sh
#
# Il lit .env.local, ne pousse QUE les variables qui doivent vivre en
# production, et saute celles qui n'ont aucun sens sur Vercel (le SMTP
# local, Ollama sur localhost).
# ─────────────────────────────────────────────────────────────────────
set -euo pipefail

ENV_FILE="${1:-.env.local}"
TARGET="${TARGET:-production}"

if ! command -v vercel >/dev/null 2>&1; then
  echo "→ CLI Vercel absente. Installe-la puis relance :"
  echo "     npm i -g vercel && vercel login"
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "→ $ENV_FILE introuvable. Copie .env.example et remplis-le d'abord."
  exit 1
fi

# Les variables qui ONT du sens sur le déploiement public.
#
# SITE_PASSWORD est la plus importante : sans elle, l'UI et tout le CRM
# sont publics. Les autres font vivre le tracking et l'IA côté serveur.
KEYS=(
  SITE_PASSWORD
  TRACKING_BASE_URL
  APP_BASE_URL
  WEBHOOK_SECRET
  SUPABASE_SERVICE_ROLE_KEY
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY
  NVIDIA_API_KEY
  NVIDIA_MODEL
  ANTHROPIC_API_KEY
  AI_MODEL
  MAX_SENDS_PER_HOUR
  CONTACT_COOLDOWN_DAYS
  TRACKING_WEBHOOK_URL
  CLOSER_NAME
  SMTP_FROM
)

# Volontairement EXCLUS : SMTP_HOST/USER/PASS et OLLAMA_URL.
# Le SMTP tourne sur ta machine, Ollama sur localhost — les pousser sur
# Vercel ferait croire à l'app qu'elle peut envoyer depuis le cloud, et
# elle échouerait à chaque tentative.

echo "→ Cible : $TARGET · source : $ENV_FILE"
echo

pushed=0
skipped=0
for key in "${KEYS[@]}"; do
  # Lit la valeur sans exécuter le fichier (pas d'interpolation surprise).
  value="$(grep -E "^${key}=" "$ENV_FILE" | head -1 | cut -d= -f2- || true)"
  value="${value%\"}"; value="${value#\"}"

  if [ -z "$value" ]; then
    echo "   ○ $key — vide, ignorée"
    skipped=$((skipped + 1))
    continue
  fi

  # `vercel env add` échoue si la variable existe déjà : on la retire d'abord.
  vercel env rm "$key" "$TARGET" --yes >/dev/null 2>&1 || true
  printf '%s' "$value" | vercel env add "$key" "$TARGET" >/dev/null
  echo "   ✓ $key"
  pushed=$((pushed + 1))
done

echo
echo "→ $pushed poussée(s), $skipped ignorée(s)."
echo
echo "Il reste DEUX choses que ce script ne peut pas faire :"
echo
echo "  1. Vérifier la branche de production."
echo "     Vercel → Settings → Git → Production Branch"
echo "     doit valoir : claude/crm-n8n-email-tracking-4qxtwr"
echo "     Sinon Vercel déploie main, qui n'a rien de tout ça."
echo
echo "  2. Redéployer pour que les variables soient prises en compte :"
echo "     vercel --prod"
echo
echo "Puis contrôle : curl -s https://<ton-domaine>/api/health | head -c 400"
