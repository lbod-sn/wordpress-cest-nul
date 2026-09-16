import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { parse as parseToml } from "smol-toml";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("..", import.meta.url));
const netlify = parseToml(readFileSync(join(root, "netlify.toml"), "utf8"));
const nginx = readFileSync(join(root, "docker/nginx.conf"), "utf8");

/** Les en-tetes que le SDU attend sur toute reponse servie publiquement. */
const attendus = [
  "Strict-Transport-Security",
  "X-Content-Type-Options",
  "X-Frame-Options",
  "Referrer-Policy",
  "Content-Security-Policy",
  "Permissions-Policy",
];

const globale = netlify.headers.find((entree) => entree.for === "/*");

describe("en-tetes de securite servis par Netlify", () => {
  it("applique une regle a toutes les reponses", () => {
    expect(globale).toBeDefined();
  });

  it.each(attendus)("declare %s", (nom) => {
    expect(Object.keys(globale.values)).toContain(nom);
  });

  it("ne laisse fuiter aucune banniere de serveur", () => {
    expect(globale.values["X-Powered-By"]).toBe("");
  });

  it("impose HSTS sur au moins un an", () => {
    const hsts = globale.values["Strict-Transport-Security"];

    expect(Number(hsts.match(/max-age=(\d+)/)[1])).toBeGreaterThanOrEqual(31536000);
  });
});

// Les deux cibles servent le meme site : si elles divergent, la conformite du
// site depend de l'hebergeur qui repond, ce qui n'est pas une propriete du site.
describe("alignement Netlify / image de secours", () => {
  it.each(attendus)("%s est aussi servi par nginx", (nom) => {
    expect(nginx).toMatch(new RegExp(`add_header\\s+${nom}\\b`, "i"));
  });

  it("nginx sert exactement la meme politique de securite du contenu", () => {
    const csp = nginx.match(/add_header Content-Security-Policy "([^"]+)"/)[1];

    expect(csp).toBe(globale.values["Content-Security-Policy"]);
  });

  it("nginx masque la banniere de version", () => {
    expect(nginx).toMatch(/server_tokens\s+off;/);
  });
});

describe("chemins interdits", () => {
  const interdits = ["/.git/*", "/.env", "/.github/*"];

  it.each(interdits)("%s est bloque par Netlify", (from) => {
    const regle = netlify.redirects.find((r) => r.from === from);

    expect(regle).toBeDefined();
    expect(regle.status).toBe(404);
    expect(regle.force).toBe(true);
  });

  it.each(interdits)("%s est aussi bloque par nginx", (from) => {
    const nom = from.replace(/^\/\./, "").replace(/\/?\*$/, "");

    expect(nginx).toMatch(new RegExp(`location[^\\n]*\\b${nom}\\b`));
  });

  it("aucune reecriture ne transforme le site en SPA", () => {
    const catchAll = netlify.redirects.find((r) => r.from === "/*" && r.status === 200);

    expect(catchAll).toBeUndefined();
  });
});

describe("conteneur de secours", () => {
  const dockerfile = readFileSync(join(root, "Dockerfile"), "utf8");
  const runtime = [...dockerfile.matchAll(/^FROM\s+(\S+)/gim)].at(-1)[1];

  it("fige une image de runtime du catalogue SDU, jamais latest", () => {
    expect(runtime).toMatch(/^nginx:\d+\.\d+/);
    expect(runtime).not.toMatch(/latest/);
  });

  it("epingle l'image de runtime par empreinte", () => {
    expect(runtime).toMatch(/@sha256:[0-9a-f]{64}$/);
  });

  it("isole la construction du runtime (multi-stage)", () => {
    expect([...dockerfile.matchAll(/^FROM\s+/gim)].length).toBeGreaterThan(1);
  });
});
