// Valida e envia as questões de data/concursos/<id>/questoes/*.json para a API (Firestore).
// Cada questão tem id fixo ("<topicoId>-NN"), então rodar de novo ATUALIZA, não duplica.
//
// Uso:
//   node scripts/semear-questoes.js --concurso=<id> --validar     só valida e mostra a cobertura
//   node scripts/semear-questoes.js --todos --validar             valida todos os concursos
//   node scripts/semear-questoes.js --concurso=<id>               valida e envia para http://localhost:3000
//   node scripts/semear-questoes.js --concurso=<id> --api=https://...  envia para outra URL
//
// O envio precisa do ADMIN_TOKEN (o mesmo configurado na API), lido do .env:
//   npm run semear -- --concurso=cgu-2026 --api=https://questoes-api.vercel.app
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { concursos } from "../src/concursos.js";

const args = process.argv.slice(2);
const valor = (nome) => args.find((a) => a.startsWith(`--${nome}=`))?.slice(nome.length + 3);
const soValidar = args.includes("--validar");
const apiUrl = valor("api") || "http://localhost:3000";
const idConcurso = valor("concurso");

if (!idConcurso && !args.includes("--todos")) {
  console.error(`Informe --concurso=<id> ou --todos. Concursos: ${[...concursos.keys()].join(", ")}`);
  process.exit(1);
}
if (idConcurso && !concursos.has(idConcurso)) {
  console.error(`Concurso ${idConcurso} não está em src/concursos.js. Concursos: ${[...concursos.keys()].join(", ")}`);
  process.exit(1);
}

const alvos = idConcurso ? [concursos.get(idConcurso)] : [...concursos.values()];

// ---------- Leitura e validação ----------
const lidos = alvos.map(lerEValidar);
const erros = lidos.flatMap((l) => l.erros);
if (erros.length) {
  console.error(`${erros.length} problema(s) encontrado(s):\n- ` + erros.join("\n- "));
  process.exit(1);
}
lidos.forEach(resumir);

if (soValidar) process.exit(0);

// ---------- Envio ----------
const token = process.env.ADMIN_TOKEN;
if (!token) {
  console.error("Defina ADMIN_TOKEN no .env (o mesmo valor configurado na API) para enviar.");
  process.exit(1);
}
for (const { concurso, questoes } of lidos) {
  let criadas = 0, atualizadas = 0;
  for (const { id, arquivo, ...dados } of questoes) {
    const url = `${apiUrl}/concursos/${concurso.id}/questoes/${encodeURIComponent(id)}`;
    const resposta = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(dados),
    });
    if (resposta.status === 201) criadas++;
    else if (resposta.status === 200) atualizadas++;
    else {
      console.error(`Falha em ${concurso.id} > ${id}: HTTP ${resposta.status}`, await resposta.text());
      process.exit(1);
    }
  }
  console.log(`${concurso.id}: enviado para ${apiUrl}: ${criadas} criada(s), ${atualizadas} atualizada(s).`);
}

// ---------- Funções ----------

function lerEValidar(concurso) {
  const pasta = join("data/concursos", concurso.id, "questoes");
  const arquivos = existsSync(pasta) ? readdirSync(pasta).filter((f) => f.endsWith(".json")).sort() : [];
  const questoes = arquivos.flatMap((arquivo) =>
    JSON.parse(readFileSync(join(pasta, arquivo), "utf8")).map((q) => ({ ...q, arquivo }))
  );

  const { formato } = concurso.dados;
  const multipla = formato === "multipla-escolha";
  const qtdAlternativas = concurso.dados.alternativas ?? 5;
  const letras = Array.from({ length: qtdAlternativas }, (_, i) => String.fromCharCode(65 + i));

  const erros = [];
  const idsVistos = new Set();

  for (const q of questoes) {
    const onde = `${concurso.id} > ${q.arquivo} > ${q.id ?? "(sem id)"}`;
    const erro = (texto) => erros.push(`${onde}: ${texto}`);

    if (!q.id || !/^[\d.]+-\d{2}$/.test(q.id)) erro("id deve seguir o formato <topicoId>-NN");
    else if (!q.id.startsWith(`${q.topicoId}-`)) erro(`id não corresponde ao topicoId ${q.topicoId}`);
    if (idsVistos.has(q.id)) erro("id duplicado");
    idsVistos.add(q.id);

    if (!concurso.topicoPorId.has(q.topicoId)) erro(`topicoId ${q.topicoId} não existe no conteudo.json`);
    else if (q.arquivo !== `${q.topicoId.split(".").slice(0, 2).join(".")}.json`) {
      erro(`deveria estar no arquivo da disciplina (${q.topicoId.split(".").slice(0, 2).join(".")}.json)`);
    }
    if (!q.enunciado?.trim()) erro("enunciado vazio");
    if (!q.comentario?.trim()) erro("comentário vazio");
    if (typeof q.revisada !== "boolean") erro("campo revisada deve ser true ou false");

    if (multipla) {
      const alternativas = q.alternativas;
      if (!Array.isArray(alternativas) || alternativas.length !== qtdAlternativas) {
        erro(`alternativas deve ser uma lista com ${qtdAlternativas} textos`);
      } else {
        if (alternativas.some((a) => typeof a !== "string" || !a.trim())) erro("há alternativa vazia");
        const normalizadas = alternativas.map((a) => String(a).trim().toLowerCase());
        if (new Set(normalizadas).size !== normalizadas.length) erro("há alternativas repetidas");
      }
      if (!letras.includes(q.gabarito)) erro(`gabarito deve ser uma letra de ${letras[0]} a ${letras.at(-1)}`);
      else if (q.comentario && !q.comentario.startsWith(`Gabarito: ${q.gabarito}.`)) {
        erro(`comentário deve começar com "Gabarito: ${q.gabarito}."`);
      }
    } else {
      if (q.alternativas !== undefined) erro("concurso de Certo ou Errado: a questão não pode ter alternativas");
      if (!["C", "E"].includes(q.gabarito)) erro('gabarito deve ser "C" ou "E"');
      else if (q.comentario && !q.comentario.startsWith(q.gabarito === "C" ? "Certo." : "Errado.")) {
        erro(`comentário deve começar com "${q.gabarito === "C" ? "Certo." : "Errado."}"`);
      }
    }
  }

  return { concurso, arquivos, questoes, erros, multipla, letras };
}

function resumir({ concurso, arquivos, questoes, multipla, letras }) {
  const revisadas = questoes.filter((q) => q.revisada).length;
  console.log(`\n${concurso.id} (${concurso.dados.formato}): ${questoes.length} questões válidas em ${arquivos.length} arquivo(s)`);

  if (multipla) {
    const porLetra = letras.map((l) => `${l} ${questoes.filter((q) => q.gabarito === l).length}`);
    console.log(`Gabaritos: ${porLetra.join(" / ")} | Revisadas: ${revisadas}`);
  } else {
    const certas = questoes.filter((q) => q.gabarito === "C").length;
    console.log(`Gabaritos: ${certas} Certo / ${questoes.length - certas} Errado | Revisadas: ${revisadas}`);
  }

  // Subtópicos (folhas) das disciplinas presentes que ainda não têm questão.
  const disciplinas = new Set(arquivos.map((a) => a.replace(/\.json$/, "")));
  const temFilho = new Set(concurso.conteudo.map((t) => t.parentId));
  const comQuestao = new Set(questoes.map((q) => q.topicoId));
  const semQuestao = concurso.conteudo.filter(
    (t) => !temFilho.has(t.id) && disciplinas.has(t.id.split(".").slice(0, 2).join(".")) && !comQuestao.has(t.id)
  );
  if (!arquivos.length) console.log("Nenhum arquivo de questões ainda.");
  else console.log(semQuestao.length
    ? `Subtópicos sem questão: ${semQuestao.map((t) => t.id).join(", ")}`
    : "Todos os subtópicos dessas disciplinas têm questão.");
}
