# wordpress-cest-nul

Site statique editorial : pourquoi WordPress n'est pas toujours le bon choix.
Pas de framework, pas d'etape de compilation, pas de base de donnees. Des fichiers
HTML, une feuille de style, un script de navigation.

> Le site se moque d'un CMS qui accumule la dette technique. Il serait malvenu
> qu'il en accumule lui-meme : d'ou la chaine CI/CD ci-dessous, alignee sur le
> **Systeme de Deploiement Unifie (SDU v1.1)** du Groupe Extern.

## Demarrage

```bash
nvm use            # Node 22 (voir .nvmrc)
npm ci
npm run serve      # http://localhost:8080
```

| Commande | Effet |
|---|---|
| `npm run lint` | ESLint sur `app.js`, `scripts/` et `tests/` |
| `npm test` | Suite Vitest (comportement du script, integrite des ressources, exposition) |
| `npm run test:coverage` | Idem avec rapport de couverture |
| `npm run build` | Assemble le site publiable dans `dist/` et echoue si une reference est cassee |
| `npm run serve` | Sert le depot en local sur le port 8080 |

## Structure

```
index.html              page principale
mentions-legales.html   mentions legales
404.html                page d'erreur (referencee par les regles de reecriture)
styles.css  app.js      feuille de style et script de navigation
docker/nginx.conf       configuration de l'image de secours
scripts/build-dist.mjs  assemblage verifie du site publiable
scripts/ci-smoke-test.sh smoke-test d'exposition d'un deploiement
tests/                  suite Vitest
vercel.json             en-tetes et regles de la cible de production
netlify.toml            memes en-tetes pour la cible historique
```

## Deploiement

**Production : Vercel.** Le deploiement part d'un **tag de version**, jamais d'une
branche : l'artefact promu est immuable et identifiable. Le workflow
`deploy-prod.yml` passe par l'environnement GitHub `production`, qui porte
l'approbation manuelle et les secrets (`VERCEL_TOKEN`, `VERCEL_ORG_ID`,
`VERCEL_PROJECT_ID`).

Apres promotion, `scripts/ci-smoke-test.sh` verifie que le deploiement repond,
sert les en-tetes de securite attendus, et n'expose ni `.git` ni `.env`. En cas
d'echec, le job `rollback` repromeut le deploiement precedent sans rebuild.

**Secours : conteneur.** `Dockerfile` produit une image nginx qui sert le meme
site avec les memes en-tetes, publiee sur `ghcr.io/lbod-sn/wordpress-cest-nul`.
Elle existe pour que le site reste deployable ailleurs sans reecriture.

```bash
docker build -t wordpress-cest-nul:dev .
docker run --rm -p 8080:8080 wordpress-cest-nul:dev
```

## Flux de travail

```
feature/* fix/* hotfix/*  --PR-->  dev  --PR-->  main  --tag vX.Y.Z-->  production
```

1. Brancher depuis `dev` en `feature/`, `fix/` ou `hotfix/`.
2. `auto-label.yml` pose le label de release depuis le prefixe de branche ;
   `chore` et `breaking` se posent a la main.
3. `validate-pr.yml` refuse une PR mal nommee ou sans label ; `ci.yml` et
   `docker-build.yml` doivent passer.
4. Au merge sur `main`, `release-tag.yml` cree le tag `vX.Y.Z` selon le label
   (`breaking` majeur, `feature` mineur, le reste patch) et declenche le
   deploiement de production.
5. A la fermeture de la PR, `cleanup-dev.yml` supprime la previsualisation
   Vercel et l'image de conteneur associees.

## Workflows

| Workflow | Declencheur | Role |
|---|---|---|
| `ci.yml` | PR, push `dev`/`main` | Lint, tests, assemblage verifie |
| `docker-build.yml` | PR, push `dev`, tag `v*` | Build, scan CVE Trivy bloquant, push GHCR |
| `codeql.yml` | PR, push `main`, hebdomadaire | Analyse statique de securite |
| `validate-pr.yml` | PR | Nommage de branche et label de release |
| `auto-label.yml` | Ouverture de PR | Label deduit du prefixe de branche |
| `release-tag.yml` | Push `main` | Tag SemVer `vX.Y.Z` et declenchement aval |
| `deploy-prod.yml` | Tag `v*`, manuel | Deploiement Vercel, smoke-test, rollback |
| `cleanup-dev.yml` | Fermeture de PR | Suppression previsualisation et image de PR |

## Securite

Politique de signalement : [SECURITY.md](SECURITY.md).

Les en-tetes de securite sont declares en trois endroits (`vercel.json`,
`netlify.toml`, `docker/nginx.conf`) et verifies par les tests et par le
smoke-test. Toute modification de l'un doit etre reportee dans les deux autres,
sinon la conformite du site depend de l'hebergeur qui repond.

## Licence

[MIT](LICENSE).
