import express from "express";
import cors from "cors";
import concursosRouter from "./routes/concursos.js";

const app = express();

app.disable("x-powered-by");
app.use(cors());
app.use(express.json({ limit: "100kb" }));

app.get("/", (req, res) => {
  res.json({ status: "ok", mensagem: "API Questões no ar" });
});

app.use("/concursos", concursosRouter);

app.use((req, res) => {
  res.status(404).json({ erro: "Rota não encontrada" });
});

app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") return res.status(400).json({ erro: "JSON inválido" });
  if (err.type === "entity.too.large") return res.status(413).json({ erro: "Requisição grande demais" });
  console.error(err);
  // Detalhes de erros internos ficam no log, não na resposta.
  res.status(500).json({ erro: "Erro interno" });
});

export default app;
