#!/usr/bin/env node
/**
 * Assemble le site publiable dans un repertoire de sortie.
 *
 * Deux raisons d'exister plutot que de faire un "COPY . ." dans le Dockerfile :
 *  - la liste des fichiers publies est explicite, donc un fichier d'outillage
 *    ajoute plus tard n'atterrit pas par accident dans le docroot ;
 *  - chaque ressource locale referencee par une page est verifiee avant la copie,
 *    donc une image ne peut pas etre construite sur un site casse.
 *
 * Usage : node scripts/build-dist.mjs [repertoire-de-sortie]
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = process.argv[2] ?? join(root, "dist");

const PUBLIES = [
  "index.html",
  "404.html",
  "mentions-legales.html",
  "styles.css",
  "app.js",
  "favicon.svg",
  "social-card.svg",
  "site.webmanifest",
  "robots.txt",
  "sitemap.xml",
];

const absents = PUBLIES.filter((fichier) => !existsSync(join(root, fichier)));
if (absents.length > 0) {
  console.error(`Fichiers publies manquants : ${absents.join(", ")}`);
  process.exit(1);
}

// Cibles locales referencees par les pages : ni ancre, ni mailto, ni ressource distante.
const casses = [];
for (const page of PUBLIES.filter((fichier) => fichier.endsWith(".html"))) {
  const html = readFileSync(join(root, page), "utf8");
  for (const [, cible] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    if (!/^[./]/.test(cible)) continue;
    const chemin = cible.replace(/^\.?\//, "").split(/[?#]/)[0];
    if (chemin && !existsSync(join(root, chemin))) {
      casses.push(`${page} -> ${cible}`);
    }
  }
}

if (casses.length > 0) {
  console.error(`References locales cassees :\n  ${casses.join("\n  ")}`);
  process.exit(1);
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
for (const fichier of PUBLIES) {
  cpSync(join(root, fichier), join(outDir, fichier));
}

console.log(`${PUBLIES.length} fichiers publies dans ${outDir}`);
