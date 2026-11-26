// Migração única: copia as questões da época de um concurso só para o formato com vários concursos.
//
//   questoes/{id}       ->  concursos/cgu-2026/questoes/{id}   (cópia fiel, com criadoEm e atualizadoEm)
//   meta/questoes       ->  concursos/cgu-2026                 (atualizadoEm = agora)
//
// Copia direto do Firestore (e não dos JSON) para preservar qualquer alteração feita pela
// API ou pelo console. Não apaga nada: a coleção antiga continua lá até você removê-la.
// Rodar de novo apenas sobrescreve a cópia com os mesmos dados.
//
// Uso:
//   npm run migrar              mostra o que seria copiado, sem gravar
//   npm run migrar -- --gravar  copia
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../src/firebase.js";
import { CONCURSO_LEGADO } from "../src/concursos.js";

const gravar = process.argv.includes("--gravar");
const origem = db.collection("questoes");
const destinoVersao = db.collection("concursos").doc(CONCURSO_LEGADO);
const destino = destinoVersao.collection("questoes");

const [docs, jaNoDestino] = await Promise.all([origem.get(), destino.count().get()]);
console.log(`Origem "questoes": ${docs.size} questão(ões).`);
console.log(`Destino "concursos/${CONCURSO_LEGADO}/questoes": ${jaNoDestino.data().count} questão(ões) hoje.`);

if (!gravar) {
  console.log("Simulação: nada foi gravado. Rode com --gravar para copiar.");
  process.exit(0);
}

// Lotes de até 500 operações (limite do Firestore); 400 deixa folga.
const TAMANHO = 400;
for (let i = 0; i < docs.size; i += TAMANHO) {
  const lote = db.batch();
  for (const doc of docs.docs.slice(i, i + TAMANHO)) lote.set(destino.doc(doc.id), doc.data());
  await lote.commit();
  console.log(`Copiadas ${Math.min(i + TAMANHO, docs.size)} de ${docs.size}`);
}

// Data nova: os apps veem uma versão diferente e baixam a lista do novo endereço.
await destinoVersao.set({ atualizadoEm: FieldValue.serverTimestamp() }, { merge: true });

const conferencia = await destino.count().get();
console.log(`Pronto: "concursos/${CONCURSO_LEGADO}/questoes" tem ${conferencia.data().count} questão(ões).`);
