# Journal des modifications

Format inspire de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/).
Versionnement [SemVer](https://semver.org/lang/fr/) : les tags portent le prefixe `v`.

## [v1.2.0] - 2026-09-15

Mise en conformite avec le Systeme de Deploiement Unifie (SDU v1.1) du Groupe
Extern. Aucune modification du contenu editorial du site.

### Ajoute

- Chaine CI : `ci.yml` (lint, tests, assemblage verifie, audit `zizmor` des
  workflows) et `codeql.yml` (analyse statique de securite).
- Chaine conteneur : `Dockerfile` multi-stage (`node:22-alpine` -> `nginx:1.29-alpine`)
  et `docker-build.yml` (build, scan CVE Trivy bloquant, push GHCR avec attestations).
- Deploiement de production `deploy-prod.yml` : deploiement Netlify declenche par
  un tag de version, approbation manuelle via l'environnement GitHub `production`,
  smoke-test d'exposition, et republication du deploiement precedent en cas d'echec.
- `cleanup-dev.yml` : suppression des previsualisations Netlify de la branche a
  la fermeture d'une PR, sans jamais toucher au contexte `production`.
- `auto-label.yml` : label de release deduit du prefixe de branche, et pour une
  PR d'integration `dev` vers `main` du **plus fort des labels portes par les PR
  embarquees** (un lot contenant une PR `breaking` est un lot `breaking`). A
  defaut de toute PR labellisee, repli sur `chore` signale en avertissement. Un
  label deja pose n'est jamais repose.
- Outillage qualite : ESLint, Vitest et 60 tests (comportement du script de
  navigation, integrite des ressources referencees, alignement des en-tetes entre
  `netlify.toml` et `docker/nginx.conf`, image de secours, script d'etiquetage).
- `netlify.toml` : en-tetes de securite (HSTS, CSP, X-Frame-Options, Referrer-Policy,
  Permissions-Policy) et blocage des chemins `.git`, `.env`, `.github`.
- `docker/nginx.conf` : memes en-tetes et `server_tokens off` pour l'image de secours,
  alignement verifie par les tests.
- `scripts/build-dist.mjs` : assemblage du site publiable, en echec si une page
  reference une ressource absente du depot.
- `scripts/ci-smoke-test.sh` : smoke-test d'exposition d'un deploiement.
- `tests/auto-label.test.js` : le script d'etiquetage est extrait du YAML du
  workflow et execute contre des doublures d'API, plutot que teste sur une copie
  qui divergerait. Onze cas, dont la coherence entre les labels que
  `auto-label.yml` peut poser et ceux que `validate-pr.yml` accepte.
- `404.html`, `SECURITY.md`, `LICENSE` (MIT), `README.md`, `.dockerignore`,
  `.trivyignore`, `.github/CODEOWNERS`, `.github/dependabot.yml`.

### Corrige

- `release-tag.yml` creait des tags sans prefixe `v` (`1.1.0`, `1.1.1`), hors du
  format SemVer attendu par le SDU et par les declencheurs `on.push.tags`. Le
  calcul reprend la numerotation existante et publie desormais `vX.Y.Z`.
- `validate-pr.yml` interpolait `github.head_ref` directement dans un `run`, ce
  qui est une injection de commande par nom de branche. Le passage se fait
  maintenant par variable d'environnement.
- `netlify.toml` renvoyait la page d'accueil avec un code 200 pour toute URL
  inconnue. Le catch-all est retire au profit d'une vraie 404.
- Toutes les actions GitHub sont epinglees par empreinte de commit, les images
  de base du Dockerfile par empreinte sha256, et les jetons sont limites au
  minimum necessaire : aucune portee en ecriture en tete de workflow.
- Audit `zizmor` des workflows : `persist-credentials: false` sur tous les
  checkout sauf celui qui pousse le tag, plus aucune interpolation `${{ }}`
  dans un `run`, et aucun cache consomme par le workflow de production.

### Modifie

- `.gitignore` couvre desormais `.env`, `node_modules/`, `dist/`, `coverage/`
  et les caches d'outillage.

## [1.1.1] - 2026-05-06

- Correctifs de contenu.

## [1.1.0] - 2026-05-06

- Mentions legales et premiere version publiee du site.

[v1.2.0]: https://github.com/lbod-sn/wordpress-cest-nul/releases/tag/v1.2.0
[1.1.1]: https://github.com/lbod-sn/wordpress-cest-nul/releases/tag/1.1.1
[1.1.0]: https://github.com/lbod-sn/wordpress-cest-nul/releases/tag/1.1.0
