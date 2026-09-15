import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("..", import.meta.url));
const vercel = JSON.parse(readFileSync(join(root, "vercel.json"), "utf8"));

/** Les en-tetes que le SDU attend sur toute reponse servie publiquement. */
const attendus = [
  "Strict-Transport-Security",
  "X-Content-Type-Options",
  "X-Frame-Options",
  "Referrer-Policy",
  "Content-Security-Policy",
  "Permissions-Policy",
];

const globale = vercel.headers.find((entree) => entree.source === "/(.*)");

describe("en-tetes de securite servis par Vercel", () => {
  it("applique une regle a toutes les reponses", () => {
    expect(globale).toBeDefined();
  });

  it.each(attendus)("declare %s", (nom) => {
    expect(globale.headers.map((h) => h.key)).toContain(nom);
  });

  it("ne laisse fuiter aucune banniere de serveur", () => {
    const poweredBy = globale.headers.find((h) => h.key === "X-Powered-By");

    expect(poweredBy?.value).toBe("");
  });

  it("impose HSTS sur au moins un an", () => {
    const hsts = globale.headers.find((h) => h.key === "Strict-Transport-Security");

    expect(Number(hsts.value.match(/max-age=(\d+)/)[1])).toBeGreaterThanOrEqual(31536000);
  });
});

describe("chemins interdits", () => {
  const interdits = ["/.git/(.*)", "/.env"];

  it.each(interdits)("%s est bloque au niveau de la plateforme", (source) => {
    const regle = vercel.rewrites.find((r) => r.source === source);

    expect(regle).toBeDefined();
    expect(regle.destination).toBe("/404.html");
  });
});

describe("conteneur de secours", () => {
  const dockerfile = readFileSync(join(root, "Dockerfile"), "utf8");

  it("fige une image de runtime du catalogue SDU, jamais latest", () => {
    const runtime = [...dockerfile.matchAll(/^FROM\s+(\S+)/gim)].at(-1)[1];

    expect(runtime).toMatch(/^nginx:\d+\.\d+/);
    expect(runtime).not.toMatch(/latest/);
  });

  it("isole la construction du runtime (multi-stage)", () => {
    expect([...dockerfile.matchAll(/^FROM\s+/gim)].length).toBeGreaterThan(1);
  });
});
