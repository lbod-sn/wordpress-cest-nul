import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { describe, expect, it } from "vitest";

// Le script vit dans le YAML du workflow : c'est la seule copie, et c'est elle
// qui est testee. Un test ecrit sur une copie ne protege de rien.
const root = fileURLToPath(new URL("..", import.meta.url));
const workflow = parseYaml(readFileSync(join(root, ".github/workflows/auto-label.yml"), "utf8"));
const source = workflow.jobs.label.steps[0].with.script;

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const script = new AsyncFunction("github", "context", "core", source);

/**
 * Monte les doublures d'API dont le script a besoin et rend ce qu'il a fait.
 * `embarquees` decrit les PR deja mergees que la PR d'integration reprend.
 */
async function executer({ head, base, labels = [], embarquees = [] }) {
  const poses = [];
  const avertissements = [];

  const github = {
    paginate: async () => [...new Set(embarquees.map((p) => p.sha))].map((sha) => ({ sha })),
    rest: {
      issues: { addLabels: async ({ labels: ajoutes }) => poses.push(...ajoutes) },
      pulls: { listCommits: "listCommits" },
      repos: {
        listPullRequestsAssociatedWithCommit: async ({ commit_sha }) => ({
          data: embarquees.filter((p) => p.sha === commit_sha),
        }),
      },
    },
  };

  const context = {
    repo: { owner: "lbod-sn", repo: "wordpress-cest-nul" },
    payload: {
      pull_request: {
        number: 9,
        head: { ref: head },
        base: { ref: base },
        labels: labels.map((name) => ({ name })),
      },
    },
  };

  await script(github, context, { warning: (m) => avertissements.push(m) });
  return { poses, avertissements };
}

const pr = (sha, number, ...noms) => ({ sha, number, labels: noms.map((name) => ({ name })) });

describe("label deduit du prefixe de branche", () => {
  it.each([
    ["feature/nouvelle-section", "feature"],
    ["fix/lien-casse", "fix"],
    ["hotfix/entete-manquant", "hotfix"],
  ])("%s donne le label %s", async (head, attendu) => {
    const { poses } = await executer({ head, base: "dev" });

    expect(poses).toEqual([attendu]);
  });

  it("ne devine rien d'une branche hors convention", async () => {
    const { poses } = await executer({ head: "wip", base: "dev" });

    expect(poses).toEqual([]);
  });
});

// Le cas qui manquait : une PR dev -> main n'a pas de nom de branche parlant,
// restait sans label, et se faisait donc refuser par validate-pr.yml.
describe("PR d'integration dev vers main", () => {
  it("reprend le label le plus fort des PR embarquees", async () => {
    const { poses } = await executer({
      head: "dev",
      base: "main",
      embarquees: [pr("a", 1, "fix"), pr("b", 2, "feature"), pr("c", 3, "chore")],
    });

    expect(poses).toEqual(["feature"]);
  });

  it("une seule PR breaking suffit a rendre le lot breaking", async () => {
    const { poses } = await executer({
      head: "dev",
      base: "main",
      embarquees: [pr("a", 1, "feature"), pr("b", 2, "breaking")],
    });

    expect(poses).toEqual(["breaking"]);
  });

  it("ne lit pas son propre label", async () => {
    const { poses } = await executer({
      head: "dev",
      base: "main",
      embarquees: [pr("a", 9, "breaking")],
    });

    expect(poses).toEqual(["chore"]);
  });

  it("retombe sur chore en le signalant quand aucune PR embarquee n'est labellisee", async () => {
    const { poses, avertissements } = await executer({
      head: "dev",
      base: "main",
      embarquees: [pr("a", 1)],
    });

    expect(poses).toEqual(["chore"]);
    expect(avertissements).toHaveLength(1);
    expect(avertissements[0]).toMatch(/chore/);
  });
});

describe("label deja pose", () => {
  it("ne repose pas un label qu'un humain vient peut-etre de retirer", async () => {
    const { poses } = await executer({ head: "dev", base: "main", labels: ["breaking"] });

    expect(poses).toEqual([]);
  });
});

describe("coherence avec validate-pr.yml", () => {
  const validate = parseYaml(
    readFileSync(join(root, ".github/workflows/validate-pr.yml"), "utf8"),
  );
  const exiges = validate.jobs.validate.steps
    .find((etape) => etape.uses?.startsWith("mheap/github-action-required-labels"))
    .with.labels.trim()
    .split("\n")
    .map((l) => l.trim());

  // Si les deux listes divergent, auto-label peut poser un label que
  // validate-pr refuse, et la PR est bloquee sans raison lisible.
  it.each(["feature", "fix", "hotfix", "chore", "breaking"])(
    "%s est accepte par validate-pr.yml",
    (nom) => {
      expect(exiges).toContain(nom);
    },
  );

  it("validate-pr.yml n'exige exactement qu'un seul label", () => {
    const etape = validate.jobs.validate.steps.find((e) =>
      e.uses?.startsWith("mheap/github-action-required-labels"),
    );

    expect(etape.with.mode).toBe("exactly");
    expect(etape.with.count).toBe(1);
  });
});
