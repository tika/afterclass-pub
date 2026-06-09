#!/usr/bin/env node
/**
 * Audits pnpm workspace dependencies and catalog usage.
 * Rule: catalog is for deps in 2+ workspaces. Single-use deps use direct versions.
 * Run: node scripts/audit-deps.mjs
 */

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

function findWorkspacePackages() {
  const workspaces = [];
  try {
    for (const app of readdirSync(join(ROOT, "apps"))) {
      const p = join(ROOT, "apps", app, "package.json");
      try {
        readFileSync(p);
        workspaces.push(`apps/${app}`);
      } catch {
        /* skip */
      }
    }
  } catch {
    /* skip */
  }
  try {
    for (const pkg of readdirSync(join(ROOT, "packages"))) {
      const p = join(ROOT, "packages", pkg, "package.json");
      try {
        readFileSync(p);
        workspaces.push(`packages/${pkg}`);
      } catch {
        /* skip */
      }
    }
  } catch {
    /* skip */
  }
  try {
    readFileSync(join(ROOT, "infra", "package.json"));
    workspaces.push("infra");
  } catch {
    /* skip */
  }
  return workspaces;
}

function getCatalogEntries() {
  const yaml = readFileSync(join(ROOT, "pnpm-workspace.yaml"), "utf-8");
  const catalog = [];
  let inCatalog = false;
  for (const line of yaml.split("\n")) {
    if (line.startsWith("catalog:")) {
      inCatalog = true;
      continue;
    }
    if (inCatalog) {
      const m = line.match(/^\s+"?([^":]+)"?\s*:/);
      if (m) catalog.push(m[1]);
      else if (line.trim() && !line.startsWith(" ")) break;
    }
  }
  return catalog;
}

const workspaces = [
  { path: ROOT, label: "root" },
  ...findWorkspacePackages().map((ws) => ({
    path: join(ROOT, ws),
    label: ws,
  })),
];

const deps = new Map();
const catalogRefs = new Map();

for (const { path: pkgDir, label } of workspaces) {
  try {
    const pkgJson = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf-8"));
    const allDeps = { ...pkgJson.dependencies, ...pkgJson.devDependencies };
    for (const [name, spec] of Object.entries(allDeps)) {
      if (typeof spec !== "string") continue;
      const set = deps.get(name) ?? new Set();
      set.add(label);
      deps.set(name, set);
      if (spec === "catalog:" || spec.startsWith("catalog:")) {
        const catSet = catalogRefs.get(name) ?? new Set();
        catSet.add(label);
        catalogRefs.set(name, catSet);
      }
    }
  } catch (e) {
    console.error(`Failed ${label}:`, e);
  }
}

const catalogEntries = getCatalogEntries();

console.log(
  "=== Catalog entries used in only 1 workspace (remove from catalog, use direct version) ===\n",
);
for (const entry of [...catalogEntries].sort()) {
  const refs = catalogRefs.get(entry);
  const count = refs?.size ?? 0;
  if (count < 2) {
    const where = refs ? [...refs].join(", ") : "nowhere (orphan)";
    console.log(`  ${entry} -> ${where}`);
  }
}

console.log("\n=== Catalog entries used in 2+ workspaces (keep) ===\n");
for (const entry of [...catalogEntries].sort()) {
  const refs = catalogRefs.get(entry);
  const count = refs?.size ?? 0;
  if (count >= 2) {
    console.log(`  ${entry} -> ${[...refs].join(", ")}`);
  }
}

console.log("\n=== catalog: refs to packages NOT in catalog (add or fix) ===\n");
for (const [name, refs] of catalogRefs) {
  if (!catalogEntries.includes(name)) {
    console.log(`  ${name} -> ${[...refs].join(", ")}`);
  }
}

console.log("\n=== Tooling that could be hoisted to root ===\n");
const tooling = ["@biomejs/biome", "typescript", "turbo", "husky", "drizzle-kit", "esbuild", "tsx"];
for (const t of tooling) {
  const refs = deps.get(t);
  if (refs) {
    console.log(`  ${t} -> ${[...refs].join(", ")}`);
  }
}
