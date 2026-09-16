# Image de secours du site statique.
#
# Netlify reste la plateforme de production : ce conteneur existe pour que le site
# soit deployable ailleurs sans reecriture, et pour que la chaine
# build + scan CVE + push du SDU 8.1 ait un artefact a produire.
#
# Multi-stage : l'etape de build porte Node et verifie le site avant de l'assembler,
# l'etape de runtime ne recoit que le contenu publiable. Aucun fichier d'outillage
# (tests, configuration de lint, .git) n'atteint le docroot.

# ---------- build ----------
# Image figee par empreinte : un tag alpine bouge, une empreinte non. Dependabot
# ouvre une PR quand l'empreinte du tag change, ce qui rend la mise a jour tracee.
FROM node:22-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32 AS build

WORKDIR /src

COPY scripts/build-dist.mjs ./scripts/
COPY index.html 404.html mentions-legales.html styles.css app.js \
     favicon.svg social-card.svg site.webmanifest robots.txt sitemap.xml ./

# Echoue si un fichier publie manque ou si une page reference une ressource absente.
RUN node scripts/build-dist.mjs /dist

# ---------- runtime ----------
FROM nginx:1.31-alpine@sha256:17ad11d84df6c69e327c0894125f712ec1f1de627b5e5ed7e12ca2ed8cd5daf8

# Les CVE de cette image sont presque toutes des paquets de base d'Alpine, deja
# corrigees en amont : l'image officielle est simplement plus ancienne que l'index
# de paquets. On rafraichit donc l'index et on met a niveau des la construction.
#
# APK_CACHE_DATE n'est pas decoratif : sans lui, le cache de couches Docker
# reutilise indefiniment le resultat du premier "apk upgrade", et le rebuild
# hebdomadaire ne corrige plus rien. Le faire avancer force la mise a niveau.
ARG APK_CACHE_DATE=2026-09-15
RUN apk upgrade --no-cache

# Bannieres serveur supprimees et en-tetes de securite servis : voir docker/nginx.conf.
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /dist /usr/share/nginx/html

# L'image officielle est prevue pour demarrer en root puis deposer ses privileges.
# On la fait tourner entierement en non-privilegie : il faut donc rendre
# inscriptibles les repertoires temporaires et deplacer le fichier de pid,
# sinon nginx echoue au demarrage sur "mkdir /var/cache/nginx/client_temp".
RUN mkdir -p /var/cache/nginx/client_temp \
 && chown -R nginx:nginx /var/cache/nginx \
 && sed -i 's|^pid .*|pid /tmp/nginx.pid;|' /etc/nginx/nginx.conf \
 && sed -i '/^user  *nginx;/d' /etc/nginx/nginx.conf

# nginx:alpine fournit deja l'utilisateur non privilegie "nginx".
USER nginx

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1
