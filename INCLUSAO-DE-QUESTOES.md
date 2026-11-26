# Inclusão de concursos e de questões

Este documento explica como incluir concursos e questões novas no banco do **Questões** e
serve de contexto para gerá-las (por IA ou à mão). Quem gera questões deve seguir as regras
abaixo: elas são as que o validador (`scripts/semear-questoes.js`) e os apps
(`questoes-web` e `questoes-mobile`) esperam.

## Visão geral

- A API atende **vários concursos**. Cada um tem seu edital (árvore de tópicos), suas
  questões e um **formato**:
  - `certo-errado`: itens no estilo Cebraspe, uma afirmação que o candidato julga como
    certa (C) ou errada (E);
  - `multipla-escolha`: enunciado com alternativas (A a E) e uma só correta.
- O banco fica no Firestore. Os apps só leem pela API; quem grava é o script de semeadura,
  com o `ADMIN_TOKEN`.
- A fonte de verdade são os arquivos deste repositório, uma pasta por concurso:

| Arquivo | O que guarda |
| --- | --- |
| `data/concursos/<id>/concurso.json` | Dados do concurso: nome, banca, formato, data da prova. |
| `data/concursos/<id>/conteudo.json` | Árvore de tópicos do edital. Cada questão aponta para um tópico. |
| `data/concursos/<id>/conteudo.md` | Origem da árvore (opcional; a da CGU está em `../estudos/conteudo.md`). |
| `data/concursos/<id>/questoes/<disciplina>.json` | Questões de uma disciplina (tópico de nível 2), ex.: `2.3.json`. |
| `src/concursos.js` | Lista dos concursos que a API publica. |

Concursos de hoje:

| id | Concurso | Formato |
| --- | --- | --- |
| `cgu-2026` | CGU 2026, AFFC, cargo 4 (Tecnologia), Cebraspe | `certo-errado` |
| `ms-pss-2026-analista` | PSS do Ministério da Saúde 2026, cargo 403 (conteúdo comum aos cargos 401 a 405), Instituto Avalia | `multipla-escolha` |

No Firestore, cada concurso é um documento da coleção `concursos`:

```
concursos/{id}                 { atualizadoEm }   versão da lista (os apps conferem antes de baixar)
concursos/{id}/questoes/{qid}  uma questão
```

## Incluir um concurso novo

1. Escolha um id curto, em minúsculas e com hífens (`orgao-ano-cargo`). **Ele não muda
   depois**: os apps guardam o histórico de respostas por concurso.
2. Crie `data/concursos/<id>/concurso.json`:

   ```json
   {
     "id": "ms-pss-2026-analista",
     "nome": "MS PSS 2026 · Analista",
     "orgao": "Ministério da Saúde (SAA/MS)",
     "edital": "Edital nº 1, de 11 de novembro de 2026 …",
     "cargo": "403 – Analista de Requisitos …",
     "banca": "Instituto Avalia",
     "dataProva": "2027-01-17",
     "formato": "multipla-escolha",
     "alternativas": 5,
     "distribuicao": { "1.1": 5, "1.2": 5, "1.3": 5, "1.4": 5, "2.1": 20 }
   }
   ```

   | Campo | Obrigatório | Uso |
   | --- | --- | --- |
   | `id`, `nome`, `formato` | sim | `nome` aparece nos apps; `formato` é `certo-errado` ou `multipla-escolha`. |
   | `alternativas` | na múltipla escolha | Quantas alternativas cada questão tem (padrão: 5). |
   | `banca`, `dataProva` | não | Aparecem na escolha do concurso. `dataProva` no formato `AAAA-MM-DD`. |
   | `distribuicao` | não | Questões de cada disciplina na prova; os apps mostram "N questões na prova". |
   | `orgao`, `edital`, `cargo` | não | Referência. |

3. Escreva a árvore em `conteudo.md` e gere o `conteudo.json` (ver abaixo):

   ```bash
   npm run conteudo -- data/concursos/<id>/conteudo.md --concurso=<id>
   ```

4. Acrescente o concurso em `src/concursos.js` (dois `import` e uma linha na lista).
5. Valide com `npm run semear -- --concurso=<id> --validar` e faça o **deploy** da API:
   só depois disso os apps veem o concurso. Um concurso sem questões aparece com o aviso
   "ainda não tem questões".

## A árvore de tópicos (`conteudo.json`)

Lista plana de tópicos numerados. Exemplo:

```json
{ "id": "2.3.1.2", "parentId": "2.3.1", "nivel": 4, "ordem": 2,
  "titulo": "Dever de fundamentação e limites ao exercício do poder e à revisão de decisões" }
```

| Nível | Papel nos apps | Exemplo (CGU) |
| --- | --- | --- |
| 1 | Grupo na tela inicial | `2` CONHECIMENTOS COMPLEMENTARES |
| 2 | **Disciplina**: opção de estudo e nome do arquivo de questões | `2.3` FUNDAMENTOS DE DIREITO PÚBLICO APLICADO… |
| 3 | Assunto (ou subtópico, se não tiver filhos) | `2.3.1` Decisão administrativa |
| 4 | Subtópico | `2.3.1.2` Dever de fundamentação… |

Regras que os apps assumem:

- As questões são penduradas em **folhas** da árvore (tópicos sem filhos), de nível 3 ou 4.
  A árvore não precisa ter a mesma profundidade em todo lugar: no MS, Língua Portuguesa
  para no nível 3 e a Legislação do SUS desce ao nível 4.
- A disciplina de uma questão é sempre os dois primeiros números do `topicoId`
  (`"2.3.1.2"` → `"2.3"`).
- Filtrar por um tópico inclui todos os descendentes (`"3.2"` inclui `"3.2.1.4"`).
- Grupos e disciplinas sem nenhuma questão não aparecem na tela inicial.

O markdown de origem precisa ter uma linha por tópico, com tantos `#` quanto o nível
(`#### 2.3.1.2 Título`), numeração em sequência e o pai declarado antes do filho. Os níveis
1 a 3 devem seguir o edital. Divida em nível 4 os itens que pesam muito na prova ou que
juntam várias normas (no MS, as 20 questões do SUS vêm de 3 itens do edital, então a árvore
separa cada lei em temas, com a faixa de artigos no título).

> O `conteudo.json` é embutido na API: depois de mudar a árvore, é preciso novo deploy
> na Vercel para os apps verem os tópicos novos.

## Formato de uma questão

Campos comuns aos dois formatos:

| Campo | Obrigatório | Regra |
| --- | --- | --- |
| `id` | sim | `<topicoId>-NN`, com `NN` de dois dígitos (`01` a `99`), único no concurso. Para um tópico que já tem `-01` a `-03`, a próxima é `-04`. |
| `topicoId` | sim | Uma folha do `conteudo.json` do concurso. A questão fica no arquivo da disciplina dela. |
| `enunciado` | sim | Ver as regras de cada formato abaixo. |
| `gabarito` | sim | `"C"` ou `"E"` (Certo ou Errado); uma letra de `"A"` a `"E"` (múltipla escolha). |
| `comentario` | sim | Começa com `"Certo."`/`"Errado."` (Certo ou Errado) ou `"Gabarito: X."` (múltipla escolha) e justifica. |
| `revisada` | sim | `false` para questão gerada por IA e não conferida; `true` só depois de uma pessoa conferir. Os apps mostram um aviso nas não revisadas. |
| `origem` | não | Hoje sempre `"ia"`. Os apps não usam o campo; ele serve para controle. |
| `codigo` | não | Trecho de código exibido em fonte monoespaçada, como string com `\n` nas quebras de linha. |
| `textoBase` | não | Texto de apoio exibido antes do enunciado (ex.: um caso, um trecho de lei). |

Os campos `criadoEm` e `atualizadoEm` são preenchidos pela API; qualquer valor enviado é
ignorado.

### Certo ou Errado

```json
{
  "id": "2.3.1.2-01",
  "topicoId": "2.3.1.2",
  "enunciado": "Nos termos da Lei nº 9.784/1999, a motivação deve ser explícita, clara e congruente, podendo consistir em declaração de concordância com fundamentos de anteriores pareceres, informações, decisões ou propostas, que, nesse caso, serão parte integrante do ato.",
  "gabarito": "C",
  "comentario": "Certo. É o art. 50, § 1º, da Lei nº 9.784/1999. É a chamada motivação aliunde (por remissão), comum quando a autoridade acolhe parecer técnico.",
  "revisada": false,
  "origem": "ia"
}
```

A questão não pode ter o campo `alternativas`.

### Múltipla escolha

```json
{
  "id": "2.1.5.2-01",
  "topicoId": "2.1.5.2",
  "enunciado": "De acordo com a Lei Complementar nº 141/2012, os estados e os municípios aplicarão anualmente em ações e serviços públicos de saúde, no mínimo, os seguintes percentuais da arrecadação dos impostos e das transferências constitucionais indicados na lei, respectivamente:",
  "alternativas": ["15% e 12%.", "10% e 15%.", "12% e 25%.", "15% e 15%.", "12% e 15%."],
  "gabarito": "E",
  "comentario": "Gabarito: E. Os estados aplicam, no mínimo, 12% (art. 6º) e os municípios, no mínimo, 15% (art. 7º) … Não confunda com o mínimo de 25% para a educação.",
  "revisada": false,
  "origem": "ia"
}
```

- `alternativas` é uma lista com exatamente o número de alternativas do concurso (5 no MS),
  sem textos vazios ou repetidos. A letra vem da posição: a primeira é A, a segunda é B…
- Os apps mostram as alternativas **na ordem do arquivo** (não embaralham), então o
  comentário pode citar letras.

## Como escrever o enunciado

### Certo ou Errado

- **Uma afirmação, julgável sozinha.** Não use alternativas, "assinale" nem perguntas.
  O candidato só deve precisar do enunciado (e do `textoBase`/`codigo`, se houver).
- **Português formal**, no tom das provas do Cebraspe. Cite a norma pelo nome oficial
  quando ela for a base: "Nos termos da Lei nº 9.784/1999, …", "Conforme a CF, …".
- **Tamanho:** entre 70 e 330 caracteres; a mediana do banco é de uns 180.
- **Itens errados devem ter um erro só e plausível**, do tipo que pega quem estudou mal:
  - trocar conceitos vizinhos (impedimento × suspeição, eficácia × eficiência);
  - inverter a regra e a exceção;
  - trocar prazo, percentual, competência ou órgão;
  - generalizar indevidamente ("sempre", "em qualquer hipótese", "exclusivamente") ou
    restringir ("apenas", "somente") o que a norma não restringe.
  Evite erros óbvios ou de pegadinha gramatical.
- **Itens certos não devem ser triviais**: prefira a literalidade da norma com um
  detalhe relevante, ou uma consequência que exija entender o conceito.
- **Equilíbrio dos gabaritos:** o banco da CGU tem 61% de itens certos. Em lotes novos,
  mire em algo perto de metade certos e metade errados.

### Múltipla escolha

- **O enunciado é o comando**: uma pergunta ou o começo de uma frase que cada alternativa
  completa ("Segundo a Lei nº 8.080/1990, a direção do SUS, no âmbito dos municípios, é
  exercida pela"). Cite a norma pelo nome oficial quando ela for a base.
- **Comandos negativos** ("NÃO", "EXCETO") vão em maiúsculas e com moderação, no máximo
  uma em cada cinco questões.
- **Uma só alternativa correta**, sem margem de dúvida. Não use "todas as anteriores",
  "nenhuma das anteriores" nem alternativas que dependam de outras.
- **Alternativas paralelas**: mesma estrutura gramatical, todas completando o enunciado,
  com tamanhos parecidos. A correta não deve ser sempre a mais longa nem a mais detalhada.
- **Distratores plausíveis**, do tipo que pega quem estudou mal:
  - a definição de um instituto vizinho (RENASES no lugar de RENAME, Conselho no lugar
    de Conferência);
  - prazo, percentual, competência ou órgão trocados;
  - a regra com a exceção invertida, ou generalizada ("exclusivamente", "em qualquer
    hipótese");
  - uma confusão comum com outra área ("25%, como na educação").
- **Equilíbrio dos gabaritos:** distribua as letras corretas (cerca de 20% cada). O
  validador mostra a contagem por letra.

### Para os dois formatos

- **Não repita** questões já existentes no tópico: leia o arquivo da disciplina antes.
  Cada questão nova deve cobrar um aspecto diferente do subtópico.
- Com código: o enunciado se refere a ele ("Considere o trecho de código Java
  apresentado. Sua execução imprime 3.5."), e o código vai no campo `codigo`, nunca no
  enunciado.

## Como escrever o comentário

- Comece com `Certo.` ou `Errado.` (Certo ou Errado) ou `Gabarito: X.` (múltipla escolha),
  conforme o gabarito. O validador confere.
- Diga **por que**: cite a base (artigo, inciso, súmula, autor, conceito). Nos itens de
  Certo ou Errado errados, mostre o que estaria certo. Na múltipla escolha, diga por que
  os principais distratores estão errados (de onde vem cada um, quando for o caso).
- Tamanho: de 90 a 400 caracteres no Certo ou Errado (mediana de uns 200); de 150 a 500 na
  múltipla escolha.
- Pode acrescentar uma dica de diferenciação útil para a prova ("Não confunda com…").
- Não invente artigos, números de lei nem jurisprudência. Na dúvida sobre a base, prefira
  um item conceitual a um item de literalidade. Para legislação, confira a redação atual
  no Planalto: as leis do SUS, por exemplo, mudam com frequência.

## Fluxo de inclusão

### Recomendado: arquivo + script de semeadura

1. Abra (ou crie) `data/concursos/<id>/questoes/<disciplina>.json`, um array JSON, e
   acrescente as questões. Mantenha a ordem por `id`.
2. Valide, sem gravar nada:

   ```bash
   npm run semear -- --concurso=<id> --validar
   npm run semear -- --todos --validar        # todos os concursos
   ```

   O script confere o formato de cada questão conforme o formato do concurso, mostra a
   distribuição dos gabaritos e lista os subtópicos das disciplinas presentes que ainda não
   têm questão.
3. Envie para a API publicada (precisa do `ADMIN_TOKEN` no `.env`):

   ```bash
   npm run semear -- --concurso=<id> --api=https://questoes-api.vercel.app
   ```

   Cada questão é gravada com `PUT /concursos/<id>/questoes/<qid>`. Rodar de novo
   **atualiza**, não duplica. O script envia todas as questões do concurso, não só as novas.
4. Faça o commit dos JSON. Os apps passam a baixar a lista nova na próxima abertura (a
   API marca o concurso como alterado em `concursos/<id>`).

### Pontual: direto pela API

Útil para corrigir uma questão sem rodar o script. Todas as rotas de escrita exigem
`Authorization: Bearer <ADMIN_TOKEN>`. Abaixo, `…` é `/concursos/<id>/questoes`.

| Rota | Efeito |
| --- | --- |
| `PUT …/:qid` | Cria ou substitui a questão com esse id. **Use esta.** |
| `PATCH …/:qid` | Altera só os campos enviados (ex.: `{ "revisada": true }`). |
| `DELETE …/:qid` | Remove a questão. |
| `POST …` | Cria com id aleatório. **Evite**: o id foge do padrão e o script não o reconhece. |
| `POST …/versao` | Só marca a lista como alterada (depois de editar no console do Firebase). |

```bash
curl -X PUT https://questoes-api.vercel.app/concursos/cgu-2026/questoes/2.3.1.2-04 \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"topicoId":"2.3.1.2","enunciado":"…","gabarito":"E","comentario":"Errado. …","revisada":false,"origem":"ia"}'
```

Leve a mesma alteração para o arquivo JSON. Senão, a próxima semeadura desfaz a mudança.

Rotas de leitura (públicas): `GET /concursos` (catálogo), `GET /concursos/<id>`,
`GET /concursos/<id>/conteudo[/<topicoId>]`, `GET /concursos/<id>/questoes[/<qid>]` e
`GET /concursos/<id>/questoes/versao`.

> As rotas antigas `/questoes` e `/conteudo` continuam respondendo pelo `cgu-2026`, para as
> versões dos apps anteriores aos vários concursos (APK 1.2). Podem sair quando ninguém
> mais as usar.

## Cuidados

- **O `id` é a chave do histórico.** Os apps guardam acertos e erros por concurso e por
  `id` da questão. Mudar o `id` (ou o `topicoId` que o forma), ou o id do concurso, faz a
  questão parecer nova e perde o histórico dela.
- **A semeadura não apaga.** Remover uma questão do JSON não a remove do Firestore: use
  `DELETE /concursos/<id>/questoes/<qid>`.
- **Tópico ou concurso novo exige deploy.** Questão com `topicoId` que não está no
  `conteudo.json` falha na validação; e, sem deploy, os apps não mostram o tópico novo.
- **Mudar o formato de um concurso** invalida as questões já gravadas: não faça.

## Migração para vários concursos (uma vez só)

Até novembro de 2026 havia um concurso só, com as questões na coleção raiz `questoes` e a
versão em `meta/questoes`. O script `npm run migrar` mostra o que seria copiado, e
`npm run migrar -- --gravar` copia tudo para `concursos/cgu-2026` (direto do Firestore,
preservando alterações feitas pela API). Ele não apaga a coleção antiga.

Ordem: migrar → deploy da API → publicar web e APK novos → mais tarde, remover as rotas
antigas e a coleção `questoes`.

## Modelo de pedido para gerar questões

Para pedir questões a uma IA, junte este documento, o `concurso.json`, o trecho do
`conteudo.json` com o tópico e as questões que já existem nele, e use um pedido como:

> Gere 4 questões novas de Certo ou Errado para o subtópico `2.3.1.2` ("Dever de
> fundamentação e limites ao exercício do poder e à revisão de decisões") do concurso
> `cgu-2026`, seguindo o `INCLUSAO-DE-QUESTOES.md`. Já existem `2.3.1.2-01` a `2.3.1.2-03`
> (abaixo); continue a partir de `-04` e não repita o que elas cobram. Metade certas,
> metade erradas. Responda só com o array JSON.

> Gere 5 questões de múltipla escolha (5 alternativas) para o subtópico `2.1.3.2`
> ("Planejamento da saúde, RENASES e RENAME") do concurso `ms-pss-2026-analista`,
> seguindo o `INCLUSAO-DE-QUESTOES.md`. Já existe `2.1.3.2-01` (abaixo); continue a partir
> de `-02` e não repita o que ela cobra. Use gabaritos em letras diferentes. Responda só
> com o array JSON.

A resposta deve ser um array JSON pronto para colar no arquivo da disciplina, com
`"revisada": false` e `"origem": "ia"` em todas as questões.
