# Politique de securite

## Perimetre

Ce depot heberge un site statique editorial : des pages HTML, une feuille de style,
un script de navigation, et la chaine CI/CD qui les publie. Il ne traite aucune
donnee personnelle, n'expose aucune API et ne stocke aucun secret.

Sont dans le perimetre :

- le contenu servi publiquement (pages, ressources statiques) ;
- la configuration d'exposition (`netlify.toml`, `docker/nginx.conf`) ;
- les workflows GitHub Actions et l'image de conteneur publiee sur GHCR.

## Signaler une vulnerabilite

Ouvrir un **avis de securite prive** :
<https://github.com/lbod-sn/wordpress-cest-nul/security/advisories/new>

A defaut, par courriel : <lbodelet@extern-sn.fr>.

Ne pas ouvrir d'issue publique : une issue est indexee avant d'etre lue.

| Etape | Delai vise |
|---|---|
| Accuse de reception | 5 jours ouvres |
| Qualification et reponse sur la recevabilite | 10 jours ouvres |
| Correctif publie ou position argumentee | 45 jours |
| Divulgation publique coordonnee | apres correctif, ou 90 jours |

Merci d'inclure : l'URL ou le chemin concerne, les etapes de reproduction, et
l'impact constate. Un rapport sans etapes de reproduction ne peut pas etre traite.

## Ce qui est deja traite

| Risque | Traitement | Ou |
|---|---|---|
| En-tetes de securite absents | HSTS, CSP, X-Frame-Options, Referrer-Policy, Permissions-Policy servis sur toutes les reponses | `netlify.toml`, `docker/nginx.conf` |
| Exposition de `.git` ou `.env` | Chemins bloques au niveau de la plateforme et de nginx, verifies a chaque deploiement | `scripts/ci-smoke-test.sh` |
| Banniere de version du serveur | `server_tokens off`, `X-Powered-By` vide | `docker/nginx.conf`, `netlify.toml` |
| CVE de l'image de base | Scan Trivy bloquant (CRITICAL, HIGH) a chaque build, y compris sur les PR | `.github/workflows/docker-build.yml` |
| Dependances figees | Actions GitHub epinglees par empreinte, mises a jour par Dependabot | `.github/dependabot.yml` |
| Injection dans les workflows | Aucune interpolation `${{ }}` directe dans un `run` : passage par variables d'environnement | `.github/workflows/` |

## Hors perimetre

- Les rapports issus d'un scanner automatique sans preuve d'exploitabilite.
- L'absence d'en-tetes sur des domaines tiers (Google Fonts).
- Le denombrement de versions de bibliotheques front sans vecteur demontre.
