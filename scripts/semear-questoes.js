// Valida e envia as questões de data/questoes/*.json para a API (Firestore).
// Cada questão tem id fixo ("<topicoId>-NN"), então rodar de novo ATUALIZA, não duplica.
//
// Uso:
//   node scripts/semear-questoes.js --validar        só valida e mostra a cobertura
//   node scripts/semear-questoes.js                  valida e envia para http://localhost:3000
//   node scripts/semear-questoes.js --api=https://...  envia para outra URL
//
// O envio precisa do ADMIN_TOKEN (o mesmo configurado na API), lido do .env:
//   npm run semear -- --api=https://questoes-rapidas-api.vercel.app
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const PASTA = "data/questoes";
const args = process.argv.slice(2);
const soValidar = args.includes("--validar");
const apiUrl = (args.find((a) => a.startsWith("--api="))?.slice(6)) || "http://localhost:3000";

// ---------- Leitura ----------
const topicos = JSON.parse(readFileSync("data/conteudo.json", "utf8"));
const topicoPorId = new Map(topicos.map((t) => [t.id, t]));

const arquivos = readdirSync(PASTA).filter((f) => f.endsWith(".json")).sort();
const questoes = arquivos.flatMap((arquivo) =>
  JSON.parse(readFileSync(join(PASTA, arquivo), "utf8")).map((q) => ({ ...q, arquivo }))
);

// ---------- Validação ----------
const erros = [];
const idsVistos = new Set();

for (const q of questoes) {
  const onde = `${q.arquivo} > ${q.id ?? "(sem id)"}`;

  if (!q.id || !/^[\d.]+-\d{2}$/.test(q.id)) erros.push(`${onde}: id deve seguir o formato <topicoId>-NN`);
  else if (!q.id.startsWith(`${q.topicoId}-`)) erros.push(`${onde}: id não corresponde ao topicoId ${q.topicoId}`);
  if (idsVistos.has(q.id)) erros.push(`${onde}: id duplicado`);
  idsVistos.add(q.id);

  if (!topicoPorId.has(q.topicoId)) erros.push(`${onde}: topicoId ${q.topicoId} não existe no conteudo.json`);
  if (!q.enunciado?.trim()) erros.push(`${onde}: enunciado vazio`);
  if (!["C", "E"].includes(q.gabarito)) erros.push(`${onde}: gabarito deve ser "C" ou "E"`);
  if (!q.comentario?.trim()) erros.push(`${onde}: comentário vazio`);
  if (typeof q.revisada !== "boolean") erros.push(`${onde}: campo revisada deve ser true ou false`);
}

if (erros.length) {
  console.error(`${erros.length} problema(s) encontrado(s):\n- ` + erros.join("\n- "));
  process.exit(1);
}

// ---------- Resumo e cobertura ----------
const certas = questoes.filter((q) => q.gabarito === "C").length;
const revisadas = questoes.filter((q) => q.revisada).length;
console.log(`OK: ${questoes.length} questões válidas em ${arquivos.length} arquivo(s)`);
console.log(`Gabaritos: ${certas} Certo / ${questoes.length - certas} Errado | Revisadas: ${revisadas}`);

// Subtópicos (folhas) das disciplinas presentes que ainda não têm questão.
const disciplinas = new Set(arquivos.map((a) => a.replace(/\.json$/, "")));
const temFilho = new Set(topicos.map((t) => t.parentId));
const comQuestao = new Set(questoes.map((q) => q.topicoId));
const semQuestao = topicos.filter(
  (t) => !temFilho.has(t.id) && disciplinas.has(t.id.split(".").slice(0, 2).join(".")) && !comQuestao.has(t.id)
);
console.log(semQuestao.length
  ? `Subtópicos sem questão: ${semQuestao.map((t) => t.id).join(", ")}`
  : "Todos os subtópicos dessas disciplinas têm questão.");

if (soValidar) process.exit(0);

// ---------- Envio ----------
const token = process.env.ADMIN_TOKEN;
if (!token) {
  console.error("Defina ADMIN_TOKEN no .env (o mesmo valor configurado na API) para enviar.");
  process.exit(1);
}
let criadas = 0, atualizadas = 0;
for (const { id, arquivo, ...dados } of questoes) {
  const resposta = await fetch(`${apiUrl}/questoes/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(dados),
  });
  if (resposta.status === 201) criadas++;
  else if (resposta.status === 200) atualizadas++;
  else {
    console.error(`Falha em ${id}: HTTP ${resposta.status}`, await resposta.text());
    process.exit(1);
  }
}
console.log(`Enviado para ${apiUrl}: ${criadas} criada(s), ${atualizadas} atualizada(s).`);
