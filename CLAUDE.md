# SAFI — regras do projeto

Responder sempre em português (pt-BR), de forma curta e sem jargão técnico.

## Política de testes (anti-regressão)

Todo ajuste ou correção no SAFI vem com um teste que simula a situação.

- **Correção de bug:** escrever primeiro o teste que reproduz o erro (precisa FALHAR sem a correção), depois corrigir.
- **Funcionalidade nova:** pelo menos um teste do comportamento principal (a conta, a regra, a ligação com menu/permissão).
- **Antes de todo commit/deploy:** rodar `npm test`. Tudo verde ou não sobe. Se um teste antigo quebrar, entender o porquê — não apagar o teste para passar.
- Ao concluir, dizer ao Douglas em uma linha qual teste foi criado/rodado.

### Como são os testes
- Pasta `tests/`, arquivos `*.test.js`, só com o Node (`node:test`) — **sem dependências** e sem `node_modules`.
- `tests/helpers/carregar.js`: lê as telas (`scriptsDaPagina`), pega uma função de dentro de uma tela (`extrairFuncao`) e carrega as funções puras das edge functions (`carregarEdge`).
- Para testar código novo de uma tela, deixar a lógica em função de topo (fora de eventos/DOM) para poder ser extraída.
- `tests/`, `package.json`, `scripts/` e este arquivo ficam fora do deploy (`.vercelignore`).

### O que já está coberto
Sintaxe de todas as telas, paginação do limite de 1000 linhas (DRE e GerônIA), contas do Painel do Conselho,
cheques da Tesouraria, ligação de cada tela (menu, Home, rotas, ajuda) e de cada permissão (Admin, criar/editar usuário),
funções puras do backup e do admin-update-user.

### Trava no push
`scripts/pre-push` roda os testes antes de todo `git push`. Para ativar num clone novo: `sh scripts/instalar-hook.sh`.

## Outros combinados
- Fazer `git push` logo após o commit, sem pedir confirmação.
- Nunca repetir chaves/segredos nas respostas.
- Telas novas: ligar em `sidebar.js` (ITEMS, SECTIONS, PATH_TO_KEY), card na Home, `vercel.json`, `ajuda-conteudo.js` e, se tiver permissão própria, `admin.html` + `admin-create-user` + `admin-update-user` (o teste `permissoes.test.js` cobra isso).
