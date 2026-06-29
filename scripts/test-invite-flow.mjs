#!/usr/bin/env node
/**
 * Teste de regressão A→B do fluxo de convite de grupo familiar.
 *
 * Cobre:
 *   1. Usuário A cria grupo → recebe código de 6 chars.
 *   2. Usuário B entra usando o código (normalização XXX-XXX).
 *   3. Auditoria: tentativa registrada como sucesso=true.
 *   4. Brute-force: 6 códigos inválidos pelo B → 6ª retorna rate_limited.
 *
 * Requer variáveis de ambiente (opcionais — pula o teste se ausentes):
 *   VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY
 *   TEST_USER_A_EMAIL, TEST_USER_A_PASSWORD
 *   TEST_USER_B_EMAIL, TEST_USER_B_PASSWORD
 *
 * Uso local:
 *   node scripts/test-invite-flow.mjs
 */
import { createClient } from "@supabase/supabase-js";

const URL = process.env.VITE_SUPABASE_URL;
const KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const A_EMAIL = process.env.TEST_USER_A_EMAIL;
const A_PASS = process.env.TEST_USER_A_PASSWORD;
const B_EMAIL = process.env.TEST_USER_B_EMAIL;
const B_PASS = process.env.TEST_USER_B_PASSWORD;

if (!URL || !KEY || !A_EMAIL || !A_PASS || !B_EMAIL || !B_PASS) {
  console.log("⏭️  test-invite-flow: credenciais de teste ausentes — skip.");
  process.exit(0);
}

const mkClient = () =>
  createClient(URL, KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

function assert(cond, msg) {
  if (!cond) {
    console.error("❌", msg);
    process.exit(1);
  }
  console.log("✅", msg);
}

async function signIn(client, email, password) {
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`signIn(${email}): ${error.message}`);
  return data.user.id;
}

async function main() {
  const a = mkClient();
  const b = mkClient();
  const uidA = await signIn(a, A_EMAIL, A_PASS);
  const uidB = await signIn(b, B_EMAIL, B_PASS);
  console.log(`👤 A=${uidA.slice(0, 8)} B=${uidB.slice(0, 8)}`);

  // Cleanup: B sai de qualquer grupo prévio, A apaga grupos prévios.
  await b.from("membros_grupo").delete().eq("user_id", uidB);
  await a.from("membros_grupo").delete().eq("user_id", uidA);
  await a.from("grupos_familiares").delete().eq("criado_por", uidA);

  // (1) A cria grupo.
  const { data: grupo, error: e1 } = await a
    .from("grupos_familiares")
    .insert({ nome_grupo: "Teste A→B", criado_por: uidA })
    .select("id,codigo_convite")
    .single();
  if (e1) throw new Error(`A criar grupo: ${e1.message}`);
  assert(/^[A-Z0-9]{6}$/.test(grupo.codigo_convite), `Código gerado válido: ${grupo.codigo_convite}`);

  // A entra como dono.
  await a
    .from("membros_grupo")
    .insert({ grupo_id: grupo.id, user_id: uidA, papel: "dono" });

  // (2) B entra com código formatado XXX-XXX (deve normalizar).
  const codeFormatted = `${grupo.codigo_convite.slice(0, 3)}-${grupo.codigo_convite.slice(3)}`;
  const { data: join, error: e2 } = await b.rpc("tentar_entrar_no_grupo", {
    _codigo: codeFormatted.toLowerCase(),
  });
  if (e2) throw new Error(`B entrar: ${e2.message}`);
  assert(join.status === "ok", `B entrou: status=${join.status}`);
  assert(join.grupo_id === grupo.id, "grupo_id retornado bate");

  // (3) Auditoria: B tem tentativa de sucesso registrada.
  const { data: audit } = await b
    .from("tentativas_convite")
    .select("sucesso,motivo")
    .eq("user_id", uidB)
    .order("criado_em", { ascending: false })
    .limit(1);
  assert(audit?.[0]?.sucesso === true, "Auditoria gravou sucesso=true");

  // (4) Brute force: limpa B, sai do grupo, faz 6 tentativas inválidas.
  await b.from("membros_grupo").delete().eq("user_id", uidB);
  await b.from("tentativas_convite").delete().eq("user_id", uidB);

  const results = [];
  for (let i = 0; i < 6; i++) {
    const { data } = await b.rpc("tentar_entrar_no_grupo", { _codigo: "ZZZZZZ" });
    results.push(data.status);
  }
  console.log("brute results:", results);
  assert(
    results.slice(0, 5).every((s) => s === "nao_encontrado"),
    "Primeiras 5 tentativas: nao_encontrado",
  );
  assert(results[5] === "rate_limited", "6ª tentativa: rate_limited");

  // Cleanup final.
  await a.from("grupos_familiares").delete().eq("id", grupo.id);
  await b.from("tentativas_convite").delete().eq("user_id", uidB);

  console.log("\n🎉 Todos os testes do fluxo A→B passaram.");
}

main().catch((err) => {
  console.error("❌ Falha:", err);
  process.exit(1);
});
