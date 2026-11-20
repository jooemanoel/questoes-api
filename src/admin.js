// Protege as rotas que gravam no banco. O front-end só lê; quem grava é o script
// scripts/semear-questoes.js (ou você, manualmente), enviando:
//   Authorization: Bearer <ADMIN_TOKEN>
import { createHash, timingSafeEqual } from "node:crypto";

const resumo = (texto) => createHash("sha256").update(texto).digest();

export function exigirAdmin(req, res, next) {
  const esperado = process.env.ADMIN_TOKEN ?? "";
  // Sem um token configurado (ou curto demais), ninguém grava: falha fechada.
  if (esperado.length < 32) {
    return res.status(503).json({ erro: "Escrita desativada: ADMIN_TOKEN não configurado no servidor" });
  }

  const [tipo, token] = (req.get("authorization") ?? "").split(" ");
  // Compara os hashes em tempo constante: o tempo de resposta não revela o token.
  if (tipo !== "Bearer" || !token || !timingSafeEqual(resumo(token), resumo(esperado))) {
    return res.status(401).json({ erro: "Não autorizado" });
  }
  next();
}
