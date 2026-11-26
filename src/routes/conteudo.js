import { Router } from "express";

// Árvore de tópicos do concurso em req.concurso (ver src/concursos.js).
const router = Router();

// O conteúdo só muda com novo deploy; a CDN da Vercel pode guardar a resposta
// (o cache é limpo automaticamente a cada deploy).
router.use((req, res, next) => {
  res.set("Cache-Control", "public, max-age=3600, s-maxage=86400");
  next();
});

// Lista completa (plana), na ordem do edital
router.get("/", (req, res) => {
  res.json(req.concurso.conteudo);
});

// Um tópico com seus filhos diretos
router.get("/:id", (req, res) => {
  const { conteudo, topicoPorId } = req.concurso;
  const topico = topicoPorId.get(req.params.id);
  if (!topico) return res.status(404).json({ erro: "Tópico não encontrado" });
  const filhos = conteudo.filter((t) => t.parentId === topico.id);
  res.json({ ...topico, filhos });
});

export default router;
