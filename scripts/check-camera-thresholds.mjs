#!/usr/bin/env node
// Guarda de regressão para os parâmetros da câmera.
// Após calibração em dispositivo real, fixamos faixas aceitáveis para
// HOLD_MS, sharpHard, sharpSoft e exposureCompensation. Mudanças fora
// dessas faixas exigem revisão consciente (atualize os limites aqui).
import { readFileSync } from "node:fs";

const FILE = "src/components/camera-capture.tsx";
const src = readFileSync(FILE, "utf8");

const checks = [
  { name: "HOLD_MS", re: /const HOLD_MS\s*=\s*(\d+)/, min: 900, max: 1500 },
  {
    name: "sharpHard.focusScore",
    re: /const sharpHard\s*=\s*focusScore\s*>\s*(\d+)/,
    min: 60,
    max: 100,
  },
  {
    name: "sharpHard.edgeDensity",
    re: /sharpHard\s*=\s*focusScore\s*>\s*\d+\s*&&\s*edgeDensity\s*>\s*([\d.]+)/,
    min: 5,
    max: 9,
  },
  {
    name: "sharpSoft.focusScore",
    re: /const sharpSoft\s*=\s*focusScore\s*>\s*(\d+)/,
    min: 40,
    max: 70,
  },
  {
    name: "exposureCompensation.lowLight",
    re: /Math\.min\(caps\.exposureCompensation\.max,\s*([\d.]+)\)/,
    min: 0.8,
    max: 2,
  },
];

const failures = [];
for (const c of checks) {
  const m = src.match(c.re);
  if (!m) {
    failures.push(`${c.name}: padrão não encontrado (constante removida?)`);
    continue;
  }
  const value = parseFloat(m[1]);
  if (value < c.min || value > c.max) {
    failures.push(`${c.name} = ${value} fora da faixa [${c.min}, ${c.max}]`);
  } else {
    console.log(`✅ ${c.name} = ${value}`);
  }
}

if (failures.length) {
  console.error(`\n❌ Regressão nos parâmetros da câmera:`);
  for (const f of failures) console.error(`  - ${f}`);
  console.error(
    `\nSe a mudança é intencional, ajuste os limites em scripts/check-camera-thresholds.mjs.`,
  );
  process.exit(1);
}
console.log(`\n✅ Câmera dentro da faixa calibrada.`);
