import { Router } from "express";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../firebase.js";
import { exigirAdmin } from "../admin.js";

// Questões do concurso em req.concurso (ver src/concursos.js).
//
// No Firestore, cada concurso é um documento da coleção "concursos":
//   concursos/{concursoId}                  { atualizadoEm }  (versão da lista)
//   concursos/{concursoId}/questoes/{id}    uma questão
//
// O campo atualizadoEm guarda a data da última alteração nas questões do concurso.
// O front-end consulta só ele (1 leitura) para saber se a lista salva no aparelho
// ainda está atual, sem precisar baixar todas as questões.
const router = Router();
const agora = () => FieldValue.serverTimestamp();

function refs(req) {
  const versaoRef = db.collection("concursos").doc(req.concurso.id);
  return { versaoRef, questoesRef: versaoRef.collection("questoes") };
}

/**
 * Cria um lote de escrita que, além das operações da rota, marca as questões do
 * concurso como alteradas. O lote é atômico: ou grava tudo, ou nada.
 */
function loteComVersao(versaoRef) {
  const lote = db.batch();
  lote.set(versaoRef, { atualizadoEm: agora() }, { merge: true });
  return lote;
}

function corpoVazio(req, res) {
  const vazio = !req.body || typeof req.body !== "object" || Array.isArray(req.body) || Object.keys(req.body).length === 0;
  if (vazio) res.status(400).json({ erro: "Corpo da requisição vazio" });
  return vazio;
}

// ---------- Leitura (pública) ----------

// Listar todas
router.get("/", async (req, res, next) => {
  try {
    const snapshot = await refs(req).questoesRef.get();
    res.json(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
  } catch (err) {
    next(err);
  }
});

// Versão da lista: { atualizadoEm: <milissegundos> | null }
// Declarada antes de "/:id" para não ser confundida com um id de questão.
router.get("/versao", async (req, res, next) => {
  try {
    const snap = await refs(req).versaoRef.get();
    const atualizadoEm = snap.exists ? (snap.data().atualizadoEm?.toMillis() ?? null) : null;
    res.set("Cache-Control", "no-store"); // precisa refletir sempre o valor atual
    res.json({ atualizadoEm });
  } catch (err) {
    next(err);
  }
});

// Buscar por id
router.get("/:id", async (req, res, next) => {
  try {
    const snap = await refs(req).questoesRef.doc(req.params.id).get();
    if (!snap.exists) return res.status(404).json({ erro: "Questão não encontrada" });
    res.json({ id: snap.id, ...snap.data() });
  } catch (err) {
    next(err);
  }
});

// ---------- Escrita (exige Authorization: Bearer <ADMIN_TOKEN>) ----------

// Marca a lista como alterada sem mexer em nenhuma questão.
// Útil para criar o documento de versão pela primeira vez, ou depois de
// editar questões direto no console do Firebase.
router.post("/versao", exigirAdmin, async (req, res, next) => {
  try {
    const { versaoRef } = refs(req);
    await loteComVersao(versaoRef).commit();
    const snap = await versaoRef.get();
    res.json({ atualizadoEm: snap.data().atualizadoEm?.toMillis() ?? null });
  } catch (err) {
    next(err);
  }
});

// Criar
router.post("/", exigirAdmin, async (req, res, next) => {
  try {
    if (corpoVazio(req, res)) return;
    const { versaoRef, questoesRef } = refs(req);
    const { id, criadoEm, atualizadoEm, ...dados } = req.body; // campos controlados pela API
    const novo = questoesRef.doc(); // gera o id antes de gravar
    const lote = loteComVersao(versaoRef);
    lote.set(novo, { ...dados, criadoEm: agora() });
    await lote.commit();
    res.status(201).json({ id: novo.id, ...dados });
  } catch (err) {
    next(err);
  }
});

// Criar ou substituir com id fixo (idempotente: repetir não duplica)
router.put("/:id", exigirAdmin, async (req, res, next) => {
  try {
    if (corpoVazio(req, res)) return;
    const { versaoRef, questoesRef } = refs(req);
    const ref = questoesRef.doc(req.params.id);
    const snap = await ref.get();
    const { id, criadoEm, atualizadoEm, ...dados } = req.body; // campos controlados pela API

    const lote = loteComVersao(versaoRef);
    lote.set(ref, {
      ...dados,
      criadoEm: snap.exists ? snap.data().criadoEm : agora(),
      atualizadoEm: agora(),
    });
    await lote.commit();
    res.status(snap.exists ? 200 : 201).json({ id: req.params.id, ...dados });
  } catch (err) {
    next(err);
  }
});

// Atualizar (parcial)
router.patch("/:id", exigirAdmin, async (req, res, next) => {
  try {
    if (corpoVazio(req, res)) return;
    const { versaoRef, questoesRef } = refs(req);
    const ref = questoesRef.doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ erro: "Questão não encontrada" });
    const { id, criadoEm, atualizadoEm, ...dados } = req.body; // campos controlados pela API
    const lote = loteComVersao(versaoRef);
    lote.update(ref, { ...dados, atualizadoEm: agora() });
    await lote.commit();
    res.json({ id: req.params.id, ...dados });
  } catch (err) {
    next(err);
  }
});

// Remover
router.delete("/:id", exigirAdmin, async (req, res, next) => {
  try {
    const { versaoRef, questoesRef } = refs(req);
    const lote = loteComVersao(versaoRef);
    lote.delete(questoesRef.doc(req.params.id));
    await lote.commit();
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
