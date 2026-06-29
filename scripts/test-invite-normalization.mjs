#!/usr/bin/env node
/**
 * Testes de regressão para normalizeInviteCode / formatInviteCode.
 * Garante que diferentes formatos colados pelo usuário resolvam para o
 * mesmo código canônico de 6 chars, alinhado com UPPER(TRIM(...)) no banco.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(resolve(here, "../src/lib/group.ts"), "utf8");

// Extrai e avalia as duas funções puras sem TS (sintaxe compatível com JS).
const pick = (name) => {
  const m = src.match(new RegExp(`export function ${name}[\\s\\S]*?\\n\\}`));
  if (!m) throw new Error(`Não achei ${name}`);
  return m[0]
    .replace(/export function/, "function")
    .replace(/: \w+(\s*=\s*"[^"]*")?/g, "") // remove anotações de tipo simples
    .replace(/: \{[^}]+\}/g, "")
    .replace(/: string/g, "");
};

const code = `${pick("normalizeInviteCode")}\n${pick("formatInviteCode")}\nexport { normalizeInviteCode, formatInviteCode };`;
const mod = await import(`data:text/javascript,${encodeURIComponent(code)}`);
const { normalizeInviteCode, formatInviteCode } = mod;

let failed = 0;
const eq = (label, got, want) => {
  if (got === want) {
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.log(`  ✗ ${label}\n    got:  ${JSON.stringify(got)}\n    want: ${JSON.stringify(want)}`);
  }
};

console.log("normalizeInviteCode:");
eq("uppercase", normalizeInviteCode("abc123"), "ABC123");
eq("hífen removido", normalizeInviteCode("ABC-123"), "ABC123");
eq("espaços removidos", normalizeInviteCode("ABC 123"), "ABC123");
eq("misto sujo", normalizeInviteCode("  abc - 123  "), "ABC123");
eq("trunca em 6", normalizeInviteCode("ABC1234567"), "ABC123");
eq("filtra símbolos", normalizeInviteCode("AB@C!1#2$3"), "ABC123");
eq("vazio", normalizeInviteCode(""), "");

console.log("formatInviteCode:");
eq("insere hífen", formatInviteCode("ABC123"), "ABC-123");
eq("preserva curtos", formatInviteCode("AB"), "AB");
eq("normaliza antes", formatInviteCode("abc123"), "ABC-123");

console.log("Equivalência (mesmo código canônico):");
const canonical = "DZ34SW";
for (const variant of ["dz34sw", "DZ34SW", "DZ34-SW", "dz34 sw", " DZ34SW ", "dz-34-sw"]) {
  eq(`"${variant}" -> ${canonical}`, normalizeInviteCode(variant), canonical);
}

if (failed > 0) {
  console.error(`\n❌ ${failed} teste(s) falharam.`);
  process.exit(1);
}
console.log(`\n✅ Todos os testes passaram.`);
