#!/usr/bin/env node
// Verifica que todo destino `to="..."` ou `to: "..."` usado em src/
// corresponde a uma rota declarada em src/routeTree.gen.ts.
// Falha o build quando uma rota inexistente é referenciada.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const ROOT = process.cwd();
const ROUTE_TREE = join(ROOT, "src/routeTree.gen.ts");
const SRC = join(ROOT, "src");

function extractRoutes() {
  const src = readFileSync(ROUTE_TREE, "utf8");
  const match = src.match(/fullPaths:\s*([^]*?)fileRoutesByTo/);
  if (!match) throw new Error("Não consegui localizar fullPaths em routeTree.gen.ts");
  const routes = [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  return new Set(routes);
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "routeTree.gen.ts") continue;
    const full = join(dir, name);
    const s = statSync(full);
    if (s.isDirectory()) walk(full, out);
    else if ([".ts", ".tsx"].includes(extname(full))) out.push(full);
  }
  return out;
}

function findRefs(file) {
  const src = readFileSync(file, "utf8");
  const refs = [];
  const patterns = [
    /\bto=["'](\/[^"'\s]*)["']/g,
    /\bto:\s*["'](\/[^"'\s]*)["']/g,
  ];
  for (const re of patterns) {
    for (const m of src.matchAll(re)) {
      const path = m[1].replace(/\/$/, "") || "/";
      const line = src.slice(0, m.index).split("\n").length;
      refs.push({ path, line });
    }
  }
  return refs;
}

const valid = extractRoutes();
const files = walk(SRC);
const issues = [];

for (const file of files) {
  for (const { path, line } of findRefs(file)) {
    // Tolera dinâmicos com $param ou externos
    if (path.startsWith("/$") || path.includes("$")) continue;
    if (!valid.has(path)) {
      issues.push({ file: file.replace(ROOT + "/", ""), line, path });
    }
  }
}

if (issues.length) {
  console.error(`\n❌ ${issues.length} referência(s) a rotas inexistentes:\n`);
  for (const i of issues) console.error(`  ${i.file}:${i.line}  →  ${i.path}`);
  console.error(`\nRotas válidas:\n  ${[...valid].sort().join("\n  ")}\n`);
  process.exit(1);
}

console.log(`✅ ${files.length} arquivos verificados — todas as rotas existem (${valid.size}).`);
