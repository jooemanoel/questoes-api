import { Router } from "express";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase.js";

const router = Router();
const questoesRef = collection(db, "questoes");

// Documento único com a data da última alteração na coleção "questoes".
// O front-end consulta só ele (1 leitura) para saber se a lista salva no
// navegador ainda está atual, sem precisar baixar todas as questões.
const versaoRef = doc(db, "meta", "questoes");

/**
 * Cria um lote de escrita que, além das operações da rota, marca a coleção
 * como alterada. O lote é atômico: ou grava tudo, ou nada.
 */
function loteComVersao() {
  const lote = writeBatch(db);
  lote.set(versaoRef, { atualizadoEm: serverTimestamp() }, { merge: true });
  return lote;
}

// Listar todas
router.get("/", async (req, res, next) => {
  try {
    const snapshot = await getDocs(questoesRef);
    res.json(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
  } catch (err) {
    next(err);
  }
});

// Versão da lista: { atualizadoEm: <milissegundos> | null }
// Declarada antes de "/:id" para não ser confundida com um id de questão.
router.get("/versao", async (req, res, next) => {
  try {
    const snap = await getDoc(versaoRef);
    const atualizadoEm = snap.exists() ? (snap.data().atualizadoEm?.toMillis() ?? null) : null;
    res.set("Cache-Control", "no-store"); // precisa refletir sempre o valor atual
    res.json({ atualizadoEm });
  } catch (err) {
    next(err);
  }
});

// Marca a lista como alterada sem mexer em nenhuma questão.
// Útil para criar o documento de versão pela primeira vez, ou depois de
// editar questões direto no console do Firebase.
router.post("/versao", async (req, res, next) => {
  try {
    await loteComVersao().commit();
    const snap = await getDoc(versaoRef);
    res.json({ atualizadoEm: snap.data().atualizadoEm?.toMillis() ?? null });
  } catch (err) {
    next(err);
  }
});

// Buscar por id
router.get("/:id", async (req, res, next) => {
  try {
    const snap = await getDoc(doc(db, "questoes", req.params.id));
    if (!snap.exists()) return res.status(404).json({ erro: "Questão não encontrada" });
    res.json({ id: snap.id, ...snap.data() });
  } catch (err) {
    next(err);
  }
});

// Criar
router.post("/", async (req, res, next) => {
  try {
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({ erro: "Corpo da requisição vazio" });
    }
    const novo = doc(questoesRef); // gera o id antes de gravar
    const lote = loteComVersao();
    lote.set(novo, { ...req.body, criadoEm: serverTimestamp() });
    await lote.commit();
    res.status(201).json({ id: novo.id, ...req.body });
  } catch (err) {
    next(err);
  }
});

// Criar ou substituir com id fixo (idempotente: repetir não duplica)
router.put("/:id", async (req, res, next) => {
  try {
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({ erro: "Corpo da requisição vazio" });
    }
    const ref = doc(db, "questoes", req.params.id);
    const snap = await getDoc(ref);
    const { id, criadoEm, atualizadoEm, ...dados } = req.body; // campos controlados pela API

    const lote = loteComVersao();
    lote.set(ref, {
      ...dados,
      criadoEm: snap.exists() ? snap.data().criadoEm : serverTimestamp(),
      atualizadoEm: serverTimestamp(),
    });
    await lote.commit();
    res.status(snap.exists() ? 200 : 201).json({ id: req.params.id, ...dados });
  } catch (err) {
    next(err);
  }
});

// Atualizar (parcial)
router.patch("/:id", async (req, res, next) => {
  try {
    const ref = doc(db, "questoes", req.params.id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return res.status(404).json({ erro: "Questão não encontrada" });
    const lote = loteComVersao();
    lote.update(ref, { ...req.body, atualizadoEm: serverTimestamp() });
    await lote.commit();
    res.json({ id: req.params.id, ...req.body });
  } catch (err) {
    next(err);
  }
});

// Remover
router.delete("/:id", async (req, res, next) => {
  try {
    const lote = loteComVersao();
    lote.delete(doc(db, "questoes", req.params.id));
    await lote.commit();
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
