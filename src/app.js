import express from "express";
import cors from "cors";
import questoesRouter from "./routes/questoes.js";
import conteudoRouter from "./routes/conteudo.js";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ status: "ok", mensagem: "API Questões Rápidas no ar" });
});

app.use("/questoes", questoesRouter);
app.use("/conteudo", conteudoRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ erro: err.message || "Erro interno" });
});

export default app;
