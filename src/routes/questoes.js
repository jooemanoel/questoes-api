import { Router } from "express";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase.js";

const router = Router();
const questoesRef = collection(db, "questoes");

// Listar todas
router.get("/", async (req, res, next) => {
  try {
    const snapshot = await getDocs(questoesRef);
    res.json(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
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
    const novo = await addDoc(questoesRef, { ...req.body, criadoEm: serverTimestamp() });
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

    await setDoc(ref, {
      ...dados,
      criadoEm: snap.exists() ? snap.data().criadoEm : serverTimestamp(),
      atualizadoEm: serverTimestamp(),
    });
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
    await updateDoc(ref, { ...req.body, atualizadoEm: serverTimestamp() });
    res.json({ id: req.params.id, ...req.body });
  } catch (err) {
    next(err);
  }
});

// Remover
router.delete("/:id", async (req, res, next) => {
  try {
    await deleteDoc(doc(db, "questoes", req.params.id));
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
