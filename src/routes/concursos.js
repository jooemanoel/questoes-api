import { Router } from "express";
import { concursos, resolverConcurso } from "../concursos.js";
import conteudoRouter from "./conteudo.js";
import questoesRouter from "./questoes.js";

const router = Router();

// O catálogo só muda com novo deploy (mesma regra do conteúdo).
function cacheDoCatalogo(req, res, next) {
  res.set("Cache-Control", "public, max-age=3600, s-maxage=86400");
  next();
}

// Catálogo: dados de cada concurso, sem a árvore de tópicos
router.get("/", cacheDoCatalogo, (req, res) => {
  res.json([...concursos.values()].map((c) => c.dados));
});

// Tudo abaixo de /concursos/:concursoId recebe req.concurso (ou 404).
const doConcurso = Router();
doConcurso.get("/", cacheDoCatalogo, (req, res) => res.json(req.concurso.dados));
doConcurso.use("/conteudo", conteudoRouter);
doConcurso.use("/questoes", questoesRouter);

router.use("/:concursoId", resolverConcurso, doConcurso);

export default router;
