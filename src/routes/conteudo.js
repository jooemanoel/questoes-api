import { Router } from "express";
// Importado como módulo para entrar no pacote da função na Vercel (sem fs).
import conteudo from "../../data/conteudo.json" with { type: "json" };

const router = Router();
const porId = new Map(conteudo.map((t) => [t.id, t]));

// O conteúdo só muda com novo deploy; a CDN da Vercel pode guardar a resposta
// (o cache é limpo automaticamente a cada deploy).
router.use((req, res, next) => {
  res.set("Cache-Control", "public, max-age=3600, s-maxage=86400");
  next();
});

// Lista completa (plana), na ordem do edital
router.get("/", (req, res) => {
  res.json(conteudo);
});

// Um tópico com seus filhos diretos
router.get("/:id", (req, res) => {
  const topico = porId.get(req.params.id);
  if (!topico) return res.status(404).json({ erro: "Tópico não encontrado" });
  const filhos = conteudo.filter((t) => t.parentId === topico.id);
  res.json({ ...topico, filhos });
});

export default router;
