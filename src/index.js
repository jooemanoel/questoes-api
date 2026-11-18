// Servidor local (npm start / npm run dev). Na Vercel, o ponto de entrada é api/index.js.
import app from "./app.js";

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
