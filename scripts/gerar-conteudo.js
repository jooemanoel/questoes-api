// Gera data/conteudo.json a partir de um markdown numerado (ex.: "#### 1.1.1.1 Texto").
// Uso: node scripts/gerar-conteudo.js <caminho/conteudo.md> [saida.json]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const [entrada, saida = "data/conteudo.json"] = process.argv.slice(2);
if (!entrada) {
  console.error("Uso: node scripts/gerar-conteudo.js <conteudo.md> [saida.json]");
  process.exit(1);
}

const linhas = readFileSync(entrada, "utf8").split(/\r?\n/);
const topicos = [];
const porId = new Map();
const erros = [];

linhas.forEach((linha, i) => {
  const n = i + 1;
  if (!linha.trim()) return;

  const m = linha.match(/^(#+)\s+(\d+(?:\.\d+)*)\s+(.+?)\s*$/);
  if (!m) {
    erros.push(`linha ${n}: linha fora do padrão "# número título": ${linha}`);
    return;
  }

  const [, hashes, id, tituloBruto] = m;
  const partes = id.split(".");
  const nivel = partes.length;

  if (hashes.length !== nivel) {
    erros.push(`linha ${n}: ${id} tem ${hashes.length} "#", mas a numeração indica nível ${nivel}`);
  }
  if (porId.has(id)) {
    erros.push(`linha ${n}: id ${id} duplicado`);
    return;
  }

  const parentId = nivel > 1 ? partes.slice(0, -1).join(".") : null;
  if (parentId && !porId.has(parentId)) {
    erros.push(`linha ${n}: ${id} sem título pai ${parentId} antes dele`);
  }

  const ordem = Number(partes.at(-1));
  const irmaos = topicos.filter((t) => t.parentId === parentId);
  const esperado = irmaos.length + 1;
  if (ordem !== esperado) {
    erros.push(`linha ${n}: ${id} fora de sequência (esperado ...${esperado})`);
  }

  // Remove ":" ou "." final para padronizar (o texto do edital não muda).
  const titulo = tituloBruto.replace(/[:.]\s*$/, "").trim();

  const topico = { id, parentId, nivel, ordem, titulo };
  topicos.push(topico);
  porId.set(id, topico);
});

if (erros.length) {
  console.error(`Foram encontrados ${erros.length} problema(s):\n- ` + erros.join("\n- "));
  process.exit(1);
}

mkdirSync(dirname(saida), { recursive: true });
writeFileSync(saida, JSON.stringify(topicos, null, 2) + "\n", "utf8");

const porNivel = topicos.reduce((acc, t) => ((acc[t.nivel] = (acc[t.nivel] || 0) + 1), acc), {});
console.log(`OK: ${topicos.length} tópicos gravados em ${saida}`);
console.log("Por nível:", porNivel);
