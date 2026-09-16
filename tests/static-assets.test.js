import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("..", import.meta.url));

const pages = readdirSync(root).filter((name) => name.endsWith(".html"));

/** Extrait les cibles locales d'une page : ni ancre, ni mailto, ni ressource distante. */
function localTargets(html) {
  return [...html.matchAll(/(?:href|src)="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((value) => /^[./]/.test(value))
    .map((value) => value.replace(/^\.?\//, "").split(/[?#]/)[0])
    .filter(Boolean);
}

describe("integrite des pages", () => {
  it("expose au moins la page d'accueil et les mentions legales", () => {
    expect(pages).toContain("index.html");
    expect(pages).toContain("mentions-legales.html");
  });

  it.each(pages)("%s ne reference que des fichiers presents dans le depot", (page) => {
    const manquants = [...new Set(localTargets(readFileSync(join(root, page), "utf8")))].filter(
      (target) => !existsSync(join(root, target)),
    );

    expect(manquants).toEqual([]);
  });

  it.each(pages)("%s declare la langue et un titre", (page) => {
    const html = readFileSync(join(root, page), "utf8");

    expect(html).toMatch(/<title>[^<]+<\/title>/);
  });
});

describe("referencement", () => {
  const robots = readFileSync(join(root, "robots.txt"), "utf8");
  const sitemap = readFileSync(join(root, "sitemap.xml"), "utf8");

  const hote = (url) => new URL(url).origin;
  const declaredSitemap = robots.match(/^Sitemap:\s*(\S+)$/m)?.[1];
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);

  it("robots.txt declare un sitemap absolu", () => {
    expect(declaredSitemap).toBeDefined();
    expect(() => new URL(declaredSitemap)).not.toThrow();
  });

  it("le sitemap et robots.txt parlent du meme domaine", () => {
    expect(locs.length).toBeGreaterThan(0);

    const hotes = new Set(locs.map(hote));
    hotes.add(hote(declaredSitemap));

    expect([...hotes]).toHaveLength(1);
  });

  it.each(locs)("%s correspond a une page publiee", (loc) => {
    const chemin = new URL(loc).pathname.replace(/^\//, "") || "index.html";

    expect(existsSync(join(root, chemin))).toBe(true);
  });
});

describe("manifeste web", () => {
  const manifest = JSON.parse(readFileSync(join(root, "site.webmanifest"), "utf8"));

  it("declare un nom, une langue et un point d'entree", () => {
    expect(manifest.name).toBeTruthy();
    expect(manifest.lang).toBe("fr-FR");
    expect(manifest.start_url).toBe("/");
  });

  it("ne pointe que vers des icones presentes", () => {
    const manquantes = manifest.icons
      .map((icon) => icon.src.replace(/^\//, ""))
      .filter((src) => !existsSync(join(root, src)));

    expect(manquantes).toEqual([]);
  });
});
