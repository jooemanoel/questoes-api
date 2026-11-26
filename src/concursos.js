// Catálogo dos concursos atendidos pela API.
//
// Cada concurso tem uma pasta em data/concursos/<id>/ com:
//   concurso.json   dados do concurso (nome, banca, formato das questões...)
//   conteudo.json   árvore de tópicos do edital
//   questoes/       questões por disciplina (lidas só pelo script de semeadura)
//
// Os JSON são importados como módulos para entrar no pacote da função na Vercel (sem fs).
// Para incluir um concurso novo, crie a pasta e acrescente-o à lista abaixo.
import cgu2026 from "../data/concursos/cgu-2026/concurso.json" with { type: "json" };
import cgu2026Conteudo from "../data/concursos/cgu-2026/conteudo.json" with { type: "json" };
import msPss2026 from "../data/concursos/ms-pss-2026-analista/concurso.json" with { type: "json" };
import msPss2026Conteudo from "../data/concursos/ms-pss-2026-analista/conteudo.json" with { type: "json" };

export const FORMATOS = ["certo-errado", "multipla-escolha"];

/**
 * Concurso atendido pelas rotas antigas (/questoes e /conteudo), da época em que a API
 * tinha um concurso só. Ficam até todos os apps usarem /concursos/:id/...
 */
export const CONCURSO_LEGADO = "cgu-2026";

const lista = [
  { dados: cgu2026, conteudo: cgu2026Conteudo },
  { dados: msPss2026, conteudo: msPss2026Conteudo },
];

/** id -> { id, dados, conteudo, topicoPorId } */
export const concursos = new Map(
  lista.map(({ dados, conteudo }) => [
    dados.id,
    { id: dados.id, dados, conteudo, topicoPorId: new Map(conteudo.map((t) => [t.id, t])) },
  ])
);

// Falha já na inicialização se algum concurso estiver mal configurado.
for (const { id, dados } of concursos.values()) {
  if (!FORMATOS.includes(dados.formato)) {
    throw new Error(`Concurso ${id}: formato "${dados.formato}" inválido (use ${FORMATOS.join(" ou ")})`);
  }
}

/** Middleware: localiza o concurso de req.params.concursoId e o guarda em req.concurso. */
export function resolverConcurso(req, res, next) {
  const concurso = concursos.get(req.params.concursoId);
  if (!concurso) return res.status(404).json({ erro: "Concurso não encontrado" });
  req.concurso = concurso;
  next();
}

/** Middleware: usa sempre o mesmo concurso (rotas antigas). */
export function usarConcurso(id) {
  const concurso = concursos.get(id);
  return (req, res, next) => {
    req.concurso = concurso;
    next();
  };
}
