import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { beforeEach, describe, expect, it } from "vitest";

const source = readFileSync(new URL("../app.js", import.meta.url), "utf8");

const markup = `
<main>
  <nav class="nav">
    <a href="#hero">Hero</a>
    <a href="#verdict">Verdict</a>
  </nav>
  <button class="toggle" data-target="wp" aria-selected="true">WordPress</button>
  <button class="toggle" data-target="static" aria-selected="false">Statique</button>
  <div class="comparison-panel" id="panel-wp"></div>
  <div class="comparison-panel" id="panel-static" hidden></div>
  <p class="reveal">Un</p>
  <p class="reveal">Deux</p>
  <section id="hero"></section>
  <section id="verdict"></section>
</main>`;

/**
 * Monte le DOM puis execute app.js dedans. app.js est un script classique qui
 * s'accroche au document au chargement : il faut donc un document par test.
 */
function boot({ reducedMotion = false, withObserver = true } = {}) {
  const dom = new JSDOM(`<!doctype html><html><body>${markup}</body></html>`, {
    runScripts: "outside-only",
  });
  const { window } = dom;

  window.matchMedia = () => ({ matches: reducedMotion, addEventListener() {}, removeEventListener() {} });

  const observed = [];
  if (withObserver) {
    window.IntersectionObserver = class {
      constructor(callback) {
        this.callback = callback;
        observed.push(this);
      }
      observe(element) {
        (this.elements ??= []).push(element);
      }
      unobserve() {}
      disconnect() {}
    };
  } else {
    delete window.IntersectionObserver;
  }

  window.eval(source);
  return { window, document: window.document, observers: observed };
}

describe("activation des onglets", () => {
  let ctx;

  beforeEach(() => {
    ctx = boot();
  });

  it("marque l'onglet clique comme actif et sort les autres du parcours clavier", () => {
    const [wp, statique] = [...ctx.document.querySelectorAll(".toggle")];

    statique.dispatchEvent(new ctx.window.MouseEvent("click", { bubbles: true }));

    expect(statique.classList.contains("is-active")).toBe(true);
    expect(statique.getAttribute("aria-selected")).toBe("true");
    expect(statique.getAttribute("tabindex")).toBe("0");

    expect(wp.classList.contains("is-active")).toBe(false);
    expect(wp.getAttribute("aria-selected")).toBe("false");
    expect(wp.getAttribute("tabindex")).toBe("-1");
  });

  it("n'affiche que le panneau correspondant a l'onglet actif", () => {
    const statique = ctx.document.querySelector('.toggle[data-target="static"]');

    statique.dispatchEvent(new ctx.window.MouseEvent("click", { bubbles: true }));

    expect(ctx.document.querySelector("#panel-static").hidden).toBe(false);
    expect(ctx.document.querySelector("#panel-wp").hidden).toBe(true);
  });
});

describe("animations d'apparition", () => {
  it("observe les elements a reveler quand le mouvement est autorise", () => {
    const ctx = boot({ reducedMotion: false });

    expect(ctx.observers.length).toBeGreaterThan(0);
    expect([...ctx.document.querySelectorAll(".reveal.is-visible")]).toHaveLength(0);
  });

  it("revele tout immediatement si l'utilisateur refuse les animations", () => {
    const ctx = boot({ reducedMotion: true });

    expect([...ctx.document.querySelectorAll(".reveal.is-visible")]).toHaveLength(2);
  });

  it("revele tout immediatement si IntersectionObserver est indisponible", () => {
    const ctx = boot({ withObserver: false });

    expect([...ctx.document.querySelectorAll(".reveal.is-visible")]).toHaveLength(2);
  });
});
