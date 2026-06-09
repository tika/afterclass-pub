#!/usr/bin/env node
/**
 * Reads orgs.json and writes a single text file with one org per line.
 * Usage: tsx src/formatOrgs.ts [input.json] [output.txt]
 * Default: reads orgs.json, writes orgs.txt in same directory.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const inputPath = process.argv[2] || path.join(__dirname, "orgs.json");
const outputPath = process.argv[3] || path.join(__dirname, "orgs.txt");

const orgs = JSON.parse(fs.readFileSync(inputPath, "utf8"));
if (!Array.isArray(orgs)) {
  console.error("Expected orgs.json to be an array of orgs");
  process.exit(1);
}

const lines = orgs.map((org: { name?: string }) => org.name ?? String(org));
fs.writeFileSync(outputPath, lines.join("\n"), "utf8");

console.log(`Wrote ${orgs.length} orgs to ${outputPath}`);
