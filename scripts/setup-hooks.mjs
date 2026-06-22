#!/usr/bin/env node
// Instala .githooks/ como diretório de hooks do git ao rodar `bun install`.
// Silencioso fora de repositórios git (CI, sandboxes).
import { execSync } from "node:child_process";
import { existsSync, chmodSync } from "node:fs";

if (!existsSync(".git")) process.exit(0);
try {
  execSync("git config core.hooksPath .githooks", { stdio: "ignore" });
  if (existsSync(".githooks/pre-commit")) chmodSync(".githooks/pre-commit", 0o755);
  console.log("✓ git hooks instalados (.githooks/)");
} catch {
  // ignorar — não-fatal
}
