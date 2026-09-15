#!/usr/bin/env bash
# Smoke-test d'exposition (SDU 8.3).
#
# Verifie trois choses sur un deploiement, avant de le considerer comme bon :
#   1. les pages publiees repondent 200
#   2. les en-tetes de securite attendus sont servis
#   3. les chemins interdits ne sont pas exposes (.git/config d'abord : c'est le
#      premier chemin que teste un scanner, et il livre l'URL du depot d'origine)
#
# Usage : scripts/ci-smoke-test.sh https://exemple.tld
set -uo pipefail

CIBLE="${1:?Usage: $0 <url>}"
CIBLE="${CIBLE%/}"
ECHECS=0

echoue() { echo "  KO  $*"; ECHECS=$((ECHECS + 1)); }
passe()  { echo "  OK  $*"; }

code() { curl -s -o /dev/null -w '%{http_code}' -L --max-time 20 "$1"; }

echo "Cible : $CIBLE"

echo "-- pages publiees"
for chemin in / /mentions-legales.html /robots.txt /sitemap.xml /site.webmanifest; do
  c=$(code "$CIBLE$chemin")
  [ "$c" = "200" ] && passe "$chemin ($c)" || echoue "$chemin renvoie $c, attendu 200"
done

echo "-- en-tetes de securite"
ENTETES=$(curl -s -D - -o /dev/null -L --max-time 20 "$CIBLE/" | tr 'A-Z' 'a-z')
for entete in strict-transport-security x-content-type-options x-frame-options referrer-policy content-security-policy; do
  grep -qi "^$entete:" <<<"$ENTETES" && passe "$entete" || echoue "$entete absent"
done

# Une banniere de version renseigne un attaquant sur les CVE applicables.
if grep -qiE '^(server|x-powered-by):.*[0-9]+\.[0-9]+' <<<"$ENTETES"; then
  echoue "banniere de version exposee dans les en-tetes"
else
  passe "aucune banniere de version"
fi

echo "-- chemins interdits"
for chemin in /.git/config /.git/HEAD /.env /.github/workflows/deploy-prod.yml /package.json /netlify.toml; do
  c=$(code "$CIBLE$chemin")
  [ "$c" = "200" ] && echoue "$chemin est expose (200)" || passe "$chemin non expose ($c)"
done

echo
if [ "$ECHECS" -gt 0 ]; then
  echo "Smoke-test : $ECHECS controle(s) en echec"
  exit 1
fi
echo "Smoke-test : tous les controles passent"
