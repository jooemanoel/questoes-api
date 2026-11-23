# Inclusão de questões

Este documento explica como incluir questões novas no banco do **Questões** e serve
de contexto para gerá-las (por IA ou à mão). Quem gera questões deve seguir as regras
abaixo: elas são as que o validador (`scripts/semear-questoes.js`) e os apps
(`questoes-web` e `questoes-mobile`) esperam.

## Visão geral

- As questões são itens de **Certo ou Errado** no estilo Cebraspe: uma afirmação que o
  candidato julga como certa (C) ou errada (E).
- O banco fica no Firestore (coleção `questoes`). Os apps só leem pela API; quem grava
  é o script de semeadura, com o `ADMIN_TOKEN`.
- A fonte de verdade são os arquivos JSON deste repositório:

| Arquivo | O que guarda |
| --- | --- |
| `data/conteudo.json` | Árvore de tópicos (hoje, o edital da CGU). Cada questão aponta para um tópico. |
| `data/questoes/<disciplina>.json` | Questões de uma disciplina (tópico de nível 2), ex.: `2.3.json`. |

## A árvore de tópicos (`data/conteudo.json`)

Lista plana de tópicos numerados. Exemplo:

```json
{ "id": "2.3.1.2", "parentId": "2.3.1", "nivel": 4, "ordem": 2,
  "titulo": "Dever de fundamentação e limites ao exercício do poder e à revisão de decisões" }
```

| Nível | Papel nos apps | Exemplo |
| --- | --- | --- |
| 1 | Grupo na tela inicial | `2` CONHECIMENTOS COMPLEMENTARES |
| 2 | **Disciplina**: opção de estudo e nome do arquivo de questões | `2.3` FUNDAMENTOS DE DIREITO PÚBLICO APLICADO… |
| 3 | Assunto | `2.3.1` Decisão administrativa |
| 4 | **Subtópico**: onde as questões são penduradas | `2.3.1.2` Dever de fundamentação… |

Regras que os apps assumem:

- A disciplina de uma questão é sempre os dois primeiros números do `topicoId`
  (`"2.3.1.2"` → `"2.3"`).
- Filtrar por um tópico inclui todos os descendentes (`"3.2"` inclui `"3.2.1.4"`).
- Grupos e disciplinas sem nenhuma questão não aparecem na tela inicial.

O `conteudo.json` é gerado a partir de um markdown numerado (hoje, `estudos/conteudo.md`):

```bash
node scripts/gerar-conteudo.js ../estudos/conteudo.md
```

O markdown precisa ter uma linha por tópico, com tantos `#` quanto o nível
(`#### 2.3.1.2 Título`), numeração em sequência e o pai declarado antes do filho.

> O `conteudo.json` é embutido na API: depois de mudar a árvore, é preciso novo deploy
> na Vercel para os apps verem os tópicos novos.

## Formato de uma questão

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

| Campo | Obrigatório | Regra |
| --- | --- | --- |
| `id` | sim | `<topicoId>-NN`, com `NN` de dois dígitos (`01` a `99`), único em todo o banco. Para um tópico que já tem `-01` a `-03`, a próxima é `-04`. |
| `topicoId` | sim | Id existente no `conteudo.json`. Use um subtópico (folha da árvore, normalmente nível 4). |
| `enunciado` | sim | A afirmação a ser julgada. Ver [Como escrever](#como-escrever-o-enunciado). |
| `gabarito` | sim | `"C"` ou `"E"`. |
| `comentario` | sim | Começa com `"Certo."` ou `"Errado."` (igual ao gabarito) e justifica. |
| `revisada` | sim | `false` para questão gerada por IA e não conferida; `true` só depois de uma pessoa conferir. Os apps mostram um aviso nas não revisadas. |
| `origem` | não | Hoje sempre `"ia"`. Os apps não usam o campo; ele serve para controle. |
| `codigo` | não | Trecho de código exibido em fonte monoespaçada, como string com `\n` nas quebras de linha. |
| `textoBase` | não | Texto de apoio exibido antes do enunciado (ex.: um caso, um trecho de lei). Os apps já exibem, mas nenhuma questão usa ainda. |

Os campos `criadoEm` e `atualizadoEm` são preenchidos pela API; qualquer valor enviado é
ignorado.

## Como escrever o enunciado

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
- **Equilíbrio dos gabaritos:** o banco tem 61% de itens certos. Em lotes novos, mire
  em algo perto de metade certos e metade errados.
- **Não repita** questões já existentes no tópico: leia o arquivo da disciplina antes.
  Cada questão nova deve cobrar um aspecto diferente do subtópico.
- Com código: o enunciado se refere a ele ("Considere o trecho de código Java
  apresentado. Sua execução imprime 3.5."), e o código vai no campo `codigo`, nunca no
  enunciado.

## Como escrever o comentário

- Comece com `Certo.` ou `Errado.`, conforme o gabarito.
- Diga **por que**: cite a base (artigo, inciso, súmula, autor, conceito) e, nos itens
  errados, mostre o que estaria certo.
- Entre 90 e 400 caracteres; a mediana do banco é de uns 200.
- Pode acrescentar uma dica de diferenciação útil para a prova ("Não confunda com…").
- Não invente artigos, números de lei nem jurisprudência. Na dúvida sobre a base, prefira
  um item conceitual a um item de literalidade.

## Fluxo de inclusão

### Recomendado: arquivo + script de semeadura

1. Abra (ou crie) `data/questoes/<disciplina>.json`, um array JSON, e acrescente as
   questões. Mantenha a ordem por `id`.
2. Valide, sem gravar nada:

   ```bash
   npm run semear -- --validar
   ```

   O script confere o formato de cada questão, mostra quantas são C e E e lista os
   subtópicos das disciplinas presentes que ainda não têm questão.
3. Envie para a API publicada (precisa do `ADMIN_TOKEN` no `.env`):

   ```bash
   npm run semear -- --api=https://questoes-api.vercel.app
   ```

   Cada questão é gravada com `PUT /questoes/<id>`. Rodar de novo **atualiza**, não
   duplica. O script envia todas as questões dos arquivos, não só as novas.
4. Faça o commit dos JSON. Os apps passam a baixar a lista nova na próxima abertura (a
   API marca a coleção como alterada em `meta/questoes`).

### Pontual: direto pela API

Útil para corrigir uma questão sem rodar o script. Todas as rotas de escrita exigem
`Authorization: Bearer <ADMIN_TOKEN>`.

| Rota | Efeito |
| --- | --- |
| `PUT /questoes/:id` | Cria ou substitui a questão com esse id. **Use esta.** |
| `PATCH /questoes/:id` | Altera só os campos enviados (ex.: `{ "revisada": true }`). |
| `DELETE /questoes/:id` | Remove a questão. |
| `POST /questoes` | Cria com id aleatório. **Evite**: o id foge do padrão e o script não o reconhece. |
| `POST /questoes/versao` | Só marca a lista como alterada (depois de editar no console do Firebase). |

```bash
curl -X PUT https://questoes-api.vercel.app/questoes/2.3.1.2-04 \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"topicoId":"2.3.1.2","enunciado":"…","gabarito":"E","comentario":"Errado. …","revisada":false,"origem":"ia"}'
```

Leve a mesma alteração para o arquivo JSON. Senão, a próxima semeadura desfaz a mudança.

## Cuidados

- **O `id` é a chave do histórico.** Os apps guardam acertos e erros por `id` da questão.
  Mudar o `id` (ou o `topicoId` que o forma) faz a questão parecer nova e perde o
  histórico dela.
- **A semeadura não apaga.** Remover uma questão do JSON não a remove do Firestore: use
  `DELETE /questoes/:id`.
- **Tópico novo exige deploy.** Questão com `topicoId` que não está no `conteudo.json`
  falha na validação; e, sem deploy, os apps não mostram o tópico novo.

## Modelo de pedido para gerar questões

Para pedir questões a uma IA, junte este documento, o trecho do `conteudo.json` com o
tópico e as questões que já existem nele, e use um pedido como:

> Gere 4 questões novas de Certo ou Errado para o subtópico `2.3.1.2` ("Dever de
> fundamentação e limites ao exercício do poder e à revisão de decisões"), seguindo o
> `INCLUSAO-DE-QUESTOES.md`. Já existem `2.3.1.2-01` a `2.3.1.2-03` (abaixo); continue
> a partir de `-04` e não repita o que elas cobram. Metade certas, metade erradas.
> Responda só com o array JSON.

A resposta deve ser um array JSON pronto para colar no arquivo da disciplina, com
`"revisada": false` e `"origem": "ia"` em todas as questões.
