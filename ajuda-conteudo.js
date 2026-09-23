// Conteúdo do "Sobre esta tela" de cada tela do SAFI (fonte única — também alimenta o GerônIA).
// Para atualizar: edite o texto da tela, aumente `versao` (a pessoa vê um pontinho de "novidade" no botão)
// e rode `node scripts/ajuda-para-sql.js` para atualizar o manual que o GerônIA lê.
//
// Campos: titulo, versao, resumo, passos[{t,d}], dicas[], naoFaz[], termos[{t,d}], quemVe, dados, aviso,
//         tour[{ sel, t, d, clicar?, voltar? }]  (sel = seletor CSS; passo some sozinho se o alvo não estiver visível)
// O HTML simples (<b>) é permitido nos textos.
window.SAFI_AJUDA = { telas: {

  home: {
    titulo: 'Home', versao: 1,
    resumo: 'A <b>Home</b> é a porta de entrada do SAFI: mostra o resumo do mês e leva você para cada tela, organizadas por <b>setor</b>. Só aparece o que o seu acesso libera.',
    passos: [
      { t: 'Veja o resumo do mês', d: 'Para quem tem acesso ao DRE ou ao Resumo Contábil, a faixa de indicadores no topo mostra os números do período. Use as setas <b>‹ ›</b> para trocar de mês.' },
      { t: 'Escolha o setor', d: 'Os cartões estão agrupados em <b>Conselho, Financeiro, Contábil, Compras, Pessoal e Gestão</b>. Clique no cartão para abrir a tela.' },
      { t: 'Converse com o GerônIA', d: 'O cartão do <b>GerônIA</b> abre o conselheiro de IA, que responde sobre os números do grupo e sobre como usar o SAFI.' },
      { t: 'Navegue pelo menu', d: 'O botão de menu (☰) abre a barra lateral com as mesmas telas, agrupadas por setor, em qualquer página.' },
    ],
    dicas: ['Um setor sem nenhuma tela liberada para você simplesmente não aparece.', 'A barra lateral lembra quais grupos você deixou recolhidos.'],
    naoFaz: ['Não é onde se lançam dados — cada tela tem o seu próprio fluxo.'],
    quemVe: 'Todos os usuários (o conteúdo depende do acesso de cada um).',
    dados: 'Resumo do mês vem do DRE consolidado (Lançamentos).',
    tour: [
      { sel: '#kpi-bar', t: 'Resumo do mês', d: 'Os números-chave do período. Troque de mês com as setas <b>‹ ›</b>.' },
      { sel: '.card-geronia', t: 'GerônIA', d: 'Seu conselheiro de IA. Pergunte sobre resultados, pedidos, despesas ou como usar qualquer tela do SAFI.' },
      { sel: '.dash-section', t: 'Telas por setor', d: 'Cada cartão abre uma tela. Eles seguem os mesmos setores da barra lateral.' },
    ],
  },

  geronia: {
    titulo: 'GerônIA', versao: 1,
    resumo: 'O <b>GerônIA</b> é o conselheiro de inteligência do Grupo Sacoman. Ele lê os dados que <b>o seu acesso permite</b> (DRE, pedidos, despesas, funcionários, orçamento, reuniões, produtos…) e também conhece <b>como usar cada tela do SAFI</b>.',
    passos: [
      { t: 'Faça uma pergunta', d: 'Escreva no campo de baixo, em linguagem normal. Ex.: <b>"Como está o EBITDA de agosto?"</b> ou <b>"Como faço para travar um mês?"</b>.' },
      { t: 'Use as sugestões', d: 'Ao fim de cada resposta ele sugere próximas perguntas — clique para enviar direto.' },
      { t: 'Escolha o modelo', d: '<b>Pleno</b> é rápido; <b>Sênior</b> pensa mais e é melhor para análises longas ou listas grandes.' },
      { t: 'Organize por conversas', d: 'Cada assunto vira uma conversa (menu ☰ à esquerda). Ele só lembra o que foi dito na conversa atual.' },
    ],
    dicas: ['Os dados são lidos ao vivo a cada pergunta — o que você acabou de lançar já entra.', 'Peça listas completas com calma; para contagens grandes, prefira o modelo <b>Sênior</b>.', 'Há um limite de mensagens por 10 minutos para evitar abuso.'],
    naoFaz: ['Não mostra dados fora do seu acesso — ele recusa e oferece ajuda no que você pode ver.', 'Não vê CPF, telefone, endereço ou e-mail de funcionários.', 'É uma IA e pode errar: confira números importantes na tela de origem.'],
    quemVe: 'Todos os usuários; cada um recebe respostas conforme o próprio acesso.',
    dados: 'Lidos ao vivo do banco do SAFI, respeitando as permissões de quem pergunta.',
    tour: [
      { sel: '#gr-messages', t: 'A conversa', d: 'As respostas aparecem aqui. Números importantes vêm em <b>negrito</b> e a conclusão vem primeiro.' },
      { sel: '#gr-input', t: 'Sua pergunta', d: 'Escreva como falaria com uma pessoa. Enter envia.' },
      { sel: '#gr-model-switch', t: 'Pleno ou Sênior', d: '<b>Pleno</b> é rápido; <b>Sênior</b> pensa mais e é melhor para análises e listas grandes.' },
      { sel: '#gr-menu-btn', t: 'Suas conversas', d: 'Abra o menu para trocar de conversa ou começar uma nova.' },
    ],
  },

  resumo: {
    titulo: 'Resumo Contábil', versao: 2,
    resumo: 'O <b>Resumo Contábil</b> mostra, por empresa e por competência, o que entrou, o que saiu e o que sobrou — com estoque contábil e alíquota — e soma tudo num consolidado do grupo.',
    passos: [
      { t: 'Escolha a competência', d: 'No topo, selecione o mês de referência (ou o período, conforme a tela).' },
      { t: 'Veja cada empresa', d: 'Os cartões mostram <b>Entrada, Saída, Despesa e Resultado</b> de cada empresa no mês.' },
      { t: 'Some no consolidado', d: '<b>Clique nos cartões</b> das empresas que quer somar: o total do grupo se recalcula na hora.' },
      { t: 'Analise os gráficos', d: 'A seção de gráficos compara entrada, saída e despesa por empresa e mostra a evolução mensal.' },
    ],
    dicas: ['O botão <b>Gerar PDF</b> (no topo) cria um arquivo A4 com os filtros atuais: você escolhe vertical ou horizontal, marca o que incluir (até um resumo do GerônIA) e informa a <b>finalidade</b>.', 'O Resumo Contábil é lançado por empresa na aba <b>Resumo Contábil</b> da tela de Lançamentos.', 'A alíquota é a do mês (pode mudar mês a mês, ex.: Simples Nacional pela receita acumulada).'],
    naoFaz: ['Não substitui a contabilidade oficial — é a visão gerencial dos números lançados.', 'Não edita valores; para corrigir, use Lançamentos.'],
    termos: [{ t: 'Resultado', d: 'Saída − (Despesa + Entrada), calculado automaticamente.' }, { t: 'Estoque contábil', d: 'Valor do estoque informado no lançamento do mês.' }],
    quemVe: 'Quem tem acesso ao Resumo Contábil (liberado por padrão; o admin pode desativar).',
    dados: 'Lançamentos → aba Resumo Contábil.',
    tour: [
      { sel: '#dc-nav-right', t: 'Competência', d: 'Escolha o mês que quer ver. Todos os números da tela seguem essa escolha.' },
      { sel: '#resumo-empresas-grid', t: 'Cartões por empresa', d: 'Entrada, saída, despesa e resultado de cada empresa. <b>Clique nos cartões</b> para somar apenas as que quiser no consolidado.' },
      { sel: '#resumo-totais-5col', t: 'Consolidado', d: 'O total do que você selecionou: entrada, saída, despesa, resultado e estoque.' },
      { sel: '#chart-bar', t: 'Gráficos', d: 'Compare entrada, saída e despesa entre as empresas.' },
      { sel: '#sp-btn', t: 'Gerar PDF', d: 'Gera um arquivo PDF (folha A4, vertical ou horizontal) com os <b>filtros que estão selecionados agora</b>. Você escolhe o que incluir e informa a <b>finalidade</b>' + '.' },
    ],
  },

  dre: {
    titulo: 'DRE', versao: 2,
    resumo: 'O <b>DRE</b> (Demonstrativo de Resultados) apresenta faturamento, deduções, custos, margem de contribuição e resultado do período — por operação ou consolidado — com comparativos e gráficos.',
    passos: [
      { t: 'Defina o período', d: 'Escolha o mês inicial e o final no topo. Tudo na tela segue esse intervalo.' },
      { t: 'Escolha as operações', d: 'Ligue e desligue <b>GIP Ecommerce, Exposição Paulista e Via Closet</b> para ver cada uma ou o conjunto. A GIP soma as entidades EP + GIP.' },
      { t: 'Leia os indicadores', d: 'O bloco de topo traz <b>Faturamento, Margem de Contribuição e Resultado Líquido</b>; abaixo, um cartão por operação.' },
      { t: 'Compare períodos', d: 'O botão <b>Comparar</b> abre o painel A × B para confrontar dois períodos ou operações, com as diferenças.' },
      { t: 'Abra o detalhe', d: 'Na tabela do DRE, <b>AV%</b> é a participação vertical e <b>AH%</b> a variação em relação ao mês anterior. <b>Lançamentos Detalhados</b> mostra a composição linha a linha.' },
    ],
    dicas: ['O botão <b>Gerar PDF</b> (no topo) cria um arquivo A4 com os filtros atuais: você escolhe vertical ou horizontal, marca o que incluir (até um resumo do GerônIA) e informa a <b>finalidade</b>.', 'Os números vêm dos Lançamentos: se algo não bate, confira lá (e se o mês está travado).', 'Nos gráficos você pode arrastar para comparar períodos.', 'O EBITDA do grupo = Resultado Líquido + Despesas Financeiras + IR e CSLL — está no Painel do Conselho.'],
    naoFaz: ['Não é onde se lança — os valores entram em <b>Lançamentos</b>.', 'Não calcula depreciação (o DRE do grupo não tem essa linha).'],
    termos: [
      { t: 'Margem de Contribuição', d: 'Receita líquida menos custos variáveis: o que sobra para cobrir os gastos operacionais.' },
      { t: 'AV% / AH%', d: 'Análise vertical (peso de cada linha no faturamento) e horizontal (variação frente ao mês anterior).' },
      { t: 'Consolidado', d: 'Soma das operações selecionadas.' },
    ],
    quemVe: 'Quem tem acesso ao DRE (liberado por padrão), limitado às operações permitidas para cada usuário.',
    dados: 'Lançamentos (DRE consolidado, atualizado automaticamente ao salvar).',
    tour: [
      { sel: '#dc-nav-right', t: 'Período', d: 'Defina o mês inicial e o final. Os indicadores, gráficos e a tabela seguem esse intervalo.' },
      { sel: '.dc-op-btn', t: 'Operações', d: 'Escolha quais operações entram na conta: <b>GIP, Exposição e Via Closet</b>.' },
      { sel: '#dre-hero-kpi-card', t: 'Indicadores do período', d: '<b>Faturamento, Margem de Contribuição e Resultado</b>. O botão <b>Comparar</b> abre o painel A × B.' },
      { sel: '#dre-minicards-grid', t: 'Uma operação por cartão', d: 'Veja como cada operação contribuiu para o total.' },
      { sel: '#chart-dre-evo', t: 'Evolução mensal', d: 'Acompanhe o resultado mês a mês.' },
      { sel: '#dre-table-scroll', t: 'Tabela do DRE', d: 'Conta a conta, com <b>AV%</b> e <b>AH%</b>. O botão <b>Lançamentos Detalhados</b> (acima) mostra a composição de cada linha.' },
      { sel: '#sp-btn', t: 'Gerar PDF', d: 'Gera um arquivo PDF (folha A4, vertical ou horizontal) com os <b>filtros que estão selecionados agora</b>. Você escolhe o que incluir e informa a <b>finalidade</b>' + '.' },
    ],
  },

  lancamentos: {
    titulo: 'Lançamentos', versao: 2,
    resumo: 'Em <b>Lançamentos</b> você alimenta o DRE numa <b>grade de contas × 12 meses</b> (o mesmo padrão da tela de Orçamento): escolhe a empresa e o ano e preenche mês a mês. Também mantém a estrutura de contas e o Resumo Contábil.',
    passos: [
      { t: 'Escolha empresa e ano', d: 'A grade mostra os <b>12 meses de uma vez</b>. Só aparecem as empresas que você pode lançar.' },
      { t: 'Preencha os valores', d: 'Cada linha é uma conta (campo ou subcampo) e cada coluna, um mês. As linhas alternam de tom para você não se perder. <b>Enter</b> ou <b>↓</b> desce na mesma coluna; <b>Tab</b> vai para o mês seguinte.' },
      { t: 'Cole da planilha ou importe', d: 'Copie um bloco no Excel, clique na primeira célula e cole (<b>Ctrl+V</b>): linhas e meses são preenchidos de uma vez. Ou use <b>Baixar modelo</b> e <b>Importar planilha</b>.' },
      { t: 'Confira os totais', d: 'Totais por campo, classe e mês — e as linhas de <b>Receita Líquida, Margem e Resultado</b> — atualizam enquanto você digita. A última coluna é o total do ano.' },
      { t: 'Salve', d: '<b>Salvar Lançamentos</b> grava <b>apenas as células que você mudou</b> (elas ficam com borda âmbar até salvar). O DRE é atualizado sozinho e a alteração fica na trilha de auditoria (<b>Fechamento do Mês → aba Histórico</b>, para quem tem acesso ao Fechamento).' },
    ],
    dicas: ['Mês <b>Travado</b> no Fechamento aparece com 🔒 e a coluna fica bloqueada — peça a quem fecha para destravar (fica registrado).', 'Mês <b>Aprovado</b> ainda aceita edição; só o Travado bloqueia.', 'Célula em branco ao colar ou importar <b>não apaga</b> o que já existe. Para zerar um valor, digite 0 (ou apague a célula e salve).', 'Se trocar de empresa ou ano com alterações não salvas, o SAFI pergunta antes de descartar.', 'A aba <b>Gerenciar Estrutura</b> permite criar/ordenar classes, campos e subcampos; a aba <b>Resumo Contábil</b> guarda entrada, saída, despesa, estoque e alíquota do mês.'],
    naoFaz: ['Não substitui a contabilidade oficial.', 'Não aparece o que você não tem liberação para lançar.'],
    termos: [{ t: 'Classe / campo / subcampo', d: 'Hierarquia das contas do DRE (ex.: Custos Variáveis → Frete → Frete Pago).' }, { t: 'Travado', d: 'Mês fechado: bloqueado para edição no banco de dados.' }, { t: 'Célula alterada', d: 'Valor mudado na tela e ainda não salvo (borda âmbar).' }],
    quemVe: 'Quem tem a permissão Lançamentos, empresa por empresa.',
    dados: 'Digitados aqui, colados da planilha ou importados; alimentam DRE, Resumo Contábil, Painel do Conselho e GerônIA.',
    tour: [
      { sel: '#tab-lancar', t: 'Três abas', d: '<b>Lançar DRE</b> (valores do ano), <b>Gerenciar Estrutura</b> (contas) e <b>Resumo Contábil</b>.' },
      { sel: '#entry-filters', t: 'Empresa e ano', d: 'Escolha o que vai lançar. Aqui ficam também <b>Baixar modelo</b>, <b>Importar planilha</b> e o botão <b>Salvar</b>.' },
      { sel: '#entry-tree', t: 'A grade', d: 'Contas nas linhas, meses nas colunas — igual ao Orçamento. Linhas em tons alternados, totais por campo e por classe, e o resultado calculado ao vivo. Meses travados aparecem com 🔒.' },
      { sel: '.lc-in:not(:disabled)', t: 'Cada célula', d: 'Digite o valor do mês. <b>Enter</b> desce, <b>Tab</b> avança, e você pode <b>colar um bloco</b> copiado do Excel. Células alteradas ficam com borda âmbar.' },
      { sel: '#btn-save-valores', t: 'Salvar', d: 'Grava só o que você alterou (o número aparece no botão), atualiza o DRE e registra quem mudou o quê. Para consultar esse registro, quem tem acesso ao Fechamento do Mês vai em <b>Fechamento do Mês → Histórico</b>.' },
      { sel: '#manage-tree', clicar: '#tab-gerenciar', voltar: '#tab-lancar', t: 'Gerenciar Estrutura', d: 'Crie, renomeie, exclua e <b>arraste para reordenar</b> classes, campos e subcampos do DRE. A lista segue o mesmo formato da grade de lançamento, e a ordem definida aqui vale para a grade e para o modelo de planilha.' },
      { sel: '#view-resumo', clicar: '#tab-resumo', t: 'Resumo Contábil', d: 'Informe entrada, saída, despesa, estoque e alíquota do mês — alimenta a tela de Resumo Contábil.' },
    ],
  },

  fluxocaixa: {
    titulo: 'Fluxo de Caixa', versao: 3,
    resumo: 'O <b>Fluxo de Caixa</b> tem duas abas: <b>Contas a Pagar</b> (parcelas de pedidos já chegados e ainda não pagas) e <b>Contas a Receber</b> (as vendas do grupo — ainda em definição de como entram no SAFI).',
    passos: [
      { t: 'Contas a Pagar: veja o que vence', d: 'A lista traz empresa, fornecedor, parcela, valor e vencimento, das mais urgentes para as mais distantes.' },
      { t: 'Contas a Pagar: marque como paga', d: 'Ao pagar uma parcela, use o botão da coluna <b>Ação</b> — ela sai da lista e o pedido avança de status.' },
      { t: 'Contas a Receber: em definição', d: 'Vai representar as vendas do grupo. Por enquanto essa aba só mostra um aviso, até formularmos como isso entra no SAFI.' },
    ],
    dicas: ['A parcela só entra em Contas a Pagar depois que o pedido é marcado como <b>chegou</b> (conferido).', 'Parcelas com vencimento anterior a hoje estão <b>atrasadas</b>.'],
    naoFaz: ['Contas a Receber ainda não traz dados — só o aviso de que está em definição.', 'Não cadastra pedidos — isso é na tela de Pedidos.'],
    quemVe: 'Quem tem a permissão Fluxo de Caixa; as parcelas de Contas a Pagar exibidas dependem das empresas liberadas em Pedidos.',
    dados: 'Contas a Pagar vem de Pedidos → parcelas. Contas a Receber ainda não tem fonte de dados definida.',
    tour: [
      { sel: '#fc-tabs', t: 'Duas abas', d: '<b>Contas a Pagar</b> (funciona hoje) e <b>Contas a Receber</b> (em definição, ligada às vendas do grupo).' },
      { sel: '#cap-panel', t: 'Contas a Pagar', d: 'As parcelas de pedidos que já chegaram e ainda não foram pagas.' },
      { sel: '#cap-tbody', t: 'Parcelas', d: 'Empresa, fornecedor, valor e vencimento. Use a coluna <b>Ação</b> para registrar o pagamento.' },
    ],
  },

  despfixas: {
    titulo: 'Despesas Fixas', versao: 1,
    resumo: 'As <b>Despesas Fixas</b> são contas recorrentes (honorários, assinaturas, sistemas…). Você cadastra uma vez e todo mês ela entra sozinha em <b>Conferir Mês</b> para ser confirmada.',
    passos: [
      { t: 'Cadastre a despesa', d: 'Em <b>Gerenciar Despesas</b> → <b>Nova Despesa Fixa</b>: nome, empresa, CNPJ, dia de vencimento e valor padrão.' },
      { t: 'Confira o mês', d: 'Em <b>Conferir Mês</b>, escolha mês/ano e lance o <b>valor pago</b> e a <b>data</b> de cada despesa.' },
      { t: 'Trate as divergências', d: 'Se o valor pago difere do previsto, a linha fica <b>Divergente</b> e precisa do crivo de alguém (reajuste ou erro?).' },
    ],
    dicas: ['Ajustar o previsto na conferência vale <b>só para aquele mês</b> — não muda o padrão da despesa.', 'Remover uma despesa a tira da lista, mas o histórico permanece.'],
    naoFaz: ['Não paga nada — só registra e confere.', 'Não é a conciliação de pedidos (aqui quem cadastra costuma conferir).'],
    termos: [{ t: 'Pendente', d: 'Ainda sem valor pago informado.' }, { t: 'Pago conforme previsto', d: 'Valor pago igual ao previsto.' }, { t: 'Divergente', d: 'Valor pago diferente do previsto.' }],
    quemVe: 'Quem tem a permissão Despesas Fixas, empresa por empresa.',
    dados: 'Cadastro próprio (despesas e lançamentos mensais).',
    tour: [
      { sel: '.mode-tab[data-mode="conferir"]', t: 'Dois modos', d: '<b>Conferir Mês</b> para lançar o que foi pago; <b>Gerenciar Despesas</b> para cadastrar e editar as recorrentes.' },
      { sel: '.summary-row', t: 'Resumo do mês', d: 'Quantidade, previsto, pago, pendentes e divergentes de relance.' },
      { sel: '#conf-tbody', t: 'Lista do mês', d: 'Clique em uma linha para informar o valor pago e a data. Divergências ficam destacadas.' },
      { sel: '#btn-new-despesa', clicar: '.mode-tab[data-mode="gerenciar"]', voltar: '.mode-tab[data-mode="conferir"]', t: 'Nova despesa fixa', d: 'Cadastre uma vez; ela entra sozinha todo mês em Conferir Mês.' },
    ],
  },

  pedidos: {
    titulo: 'Pedidos', versao: 1,
    resumo: 'Em <b>Pedidos</b> você registra as compras feitas para as operações, com as parcelas de pagamento, e acompanha até a chegada, a conferência e o pagamento.',
    passos: [
      { t: 'Lance o pedido', d: 'Clique em <b>Novo Pedido</b>: empresa, CNPJ de compra, fornecedor, nº do pedido no ERP, valor previsto, quantidade prevista de produtos e data.' },
      { t: 'Monte as parcelas', d: 'Use <b>Automático</b> (nº de parcelas, frequência e 1º vencimento) ou <b>Personalizado</b> para valores e datas diferentes.' },
      { t: 'Confira quando chegar', d: 'Marque <b>Chegou</b> e faça a conferência: valor real de cada parcela, quantidade real de produtos e nº da nota fiscal.' },
      { t: 'Acompanhe o status', d: '<b>Aguardando chegada → Aguardando pagamento → Pago</b>. Use os filtros por empresa, status e período.' },
    ],
    dicas: ['Quem lança vê o previsto; quem confere lança o real <b>sem ver o previsto</b> — a diferença aparece na Conciliação.', 'Pode deixar parcela em branco e completar depois.', 'As parcelas dos pedidos que chegaram alimentam a aba Contas a Pagar do Fluxo de Caixa.'],
    naoFaz: ['Não paga fornecedor — só registra e acompanha.', 'Não mostra empresas que não foram liberadas para você.'],
    termos: [{ t: 'Pedido ERP', d: 'Número do pedido no sistema de gestão (IdWorks/Olist), diferente do nº da NF.' }, { t: 'CNPJ', d: 'Razão social usada na compra (Guilherme, Juliane, Isa ou EP).' }],
    quemVe: 'Quem tem a permissão Pedidos, empresa por empresa; lançar e conferir são permissões separadas.',
    dados: 'Cadastro próprio; alimenta Conciliação, Fluxo de Caixa e GerônIA.',
    tour: [
      { sel: '#summary-row', t: 'Resumo', d: 'Quantidade de pedidos, valor total e quanto está aguardando chegada, aguardando pagamento e já pago.' },
      { sel: '#f-search', t: 'Filtros', d: 'Busque por fornecedor e filtre por empresa, status e período.' },
      { sel: '#btn-new-ped', t: 'Novo pedido', d: 'Cadastre o pedido e monte as parcelas (automáticas ou personalizadas).' },
      { sel: '#ped-tbody', t: 'Lista de pedidos', d: 'Acompanhe status, marque a chegada e faça a conferência por aqui.' },
    ],
  },

  conciliacao: {
    titulo: 'Conciliação', versao: 1,
    resumo: 'A <b>Conciliação</b> compara o que foi <b>previsto</b> com o que foi <b>conferido de verdade</b> — nos Pedidos (valor e quantidade de produtos) e nas Despesas Fixas — e destaca as diferenças.',
    passos: [
      { t: 'Escolha a empresa', d: 'Use o filtro do topo de cada seção.' },
      { t: 'Veja as divergências', d: 'Os cartões de resumo mostram total, quantas divergem e a diferença em R$.' },
      { t: 'Filtre só o que diverge', d: 'Marque <b>Só divergências</b> para focar no que precisa de atenção.' },
    ],
    dicas: ['Em Despesas Fixas, escolha também mês e ano.', 'Divergência não é necessariamente erro: pode ser reajuste. Ela só pede que alguém confirme.'],
    naoFaz: ['Não corrige os valores — a correção é feita em Pedidos ou Despesas Fixas.'],
    quemVe: 'Quem tem a permissão de conciliar Pedidos e/ou acesso a Despesas Fixas.',
    dados: 'Pedidos (previsto × real) e Despesas Fixas (previsto × pago).',
    tour: [
      { sel: '#section-pedidos', t: 'Pedidos', d: 'Compara o valor previsto com o valor real de cada parcela e a quantidade prevista com a real de produtos.' },
      { sel: '#f-so-divergencias', t: 'Só divergências', d: 'Esconde o que está batendo para você focar no que precisa de atenção.' },
      { sel: '#section-despesas', t: 'Despesas Fixas', d: 'Compara previsto × pago mês a mês, por empresa.' },
    ],
  },

  calcimport: {
    titulo: 'Calculadora de Importação', versao: 1,
    resumo: 'A calculadora estima o <b>custo real de desembarque</b> (landed cost) de um produto ou container importado — somando frete, seguro, impostos (II, IPI, PIS, COFINS, ICMS) e despesas do processo — para você decidir, antes de comprar, se vale a pena.',
    passos: [
      { t: 'Confira os Dados Gerais do Processo', d: 'A <b>Taxa Cambial</b> vem preenchida com a cotação do dia (↻ atualiza). Preencha a modalidade da empresa (<b>Real/Presumido</b> ou <b>Simples</b>), frete, seguro e as despesas do processo.' },
      { t: 'Adicione os produtos', d: 'Clique em <b>"+ Adicionar Produto"</b> e informe NCM, descrição, quantidade, valor unitário (US$) e peso líquido. Ao sair do NCM, <b>II e IPI</b> são sugeridos automaticamente.' },
      { t: 'Veja o resultado em tempo real', d: 'O <b>Custo Total</b> e o <b>Custo Unitário</b> atualizam a cada valor digitado. A setinha (▾) da linha abre o detalhamento fiscal completo.' },
      { t: 'Salve no Histórico', d: '<b>"Salvar no Histórico"</b> guarda o cálculo com um nome (ex.: "Container Julho — Fio Viscose") para toda a equipe com acesso.' },
    ],
    dicas: [
      '<b>Capatazia/THC</b> não entra na base de II/IPI/PIS/COFINS — só na do ICMS. É automático.',
      'O botão <b>"calcular"</b> ao lado da Taxa SISCOMEX estima o valor pelo nº de adições da DI.',
      'Trocou o <b>NCM</b>? II/IPI são buscados de novo. Se você editar a alíquota à mão, ela sempre respeita o que digitou.',
      '<b>"Salvar Configuração"</b> guarda os Dados Gerais para reusar — é <b>privado</b> (só você vê em "Minhas Configurações").',
      'No <b>Simples Nacional</b> normalmente não há crédito de ICMS/IPI/PIS/COFINS; o II <b>nunca</b> gera crédito.',
      'Salvar no Histórico <b>não sobrescreve</b> o anterior: cada salvamento cria um registro novo.',
    ],
    naoFaz: [
      'Não é a <b>Declaração de Importação (DI)</b> oficial nem documento fiscal — é uma <b>estimativa</b> para decisão de compra.',
      'II e IPI vêm sugeridos por NCM (TIPI/TEC), mas <b>sempre confira</b>; PIS/COFINS/ICMS são 100% manuais.',
      'Benefícios fiscais específicos (crédito presumido, suspensão de ICMS) não são calculados.',
    ],
    quemVe: 'Quem tem a permissão Calculadora de Importação.',
    dados: 'Digitados aqui; câmbio do dia buscado automaticamente; II/IPI sugeridos por NCM.',
    tour: [
      { sel: '.ci-toolbar-actions', t: 'Ações', d: '<b>Histórico</b> (cálculos salvos), <b>Novo Cálculo</b> e <b>Salvar no Histórico</b>.' },
      { sel: '#h-cambio', t: 'Dados gerais', d: 'A taxa cambial vem sozinha; preencha modalidade, frete, seguro e despesas do processo.' },
      { sel: '#prod-tbody', t: 'Produtos', d: 'Adicione os itens (NCM, quantidade, valor em US$, peso). II e IPI são sugeridos pelo NCM.' },
      { sel: '#sum-total', t: 'Resultado', d: 'Custo total e unitário atualizam em tempo real a cada valor digitado.' },
    ],
  },

  funcionarios: {
    titulo: 'Funcionários', versao: 1,
    resumo: 'Cadastro dos <b>colaboradores</b> de cada empresa, com tempo de casa, filtros, gráficos e exportação para Excel.',
    passos: [
      { t: 'Filtre a lista', d: 'Busque por nome e filtre por empresa e por tempo de casa.' },
      { t: 'Cadastre ou edite', d: '<b>Novo Colaborador</b> abre o formulário (empresa, nome, cargo, nascimento, contato, CPF, admissão…). Clique numa linha para editar.' },
      { t: 'Exporte', d: '<b>Exportar XLSX</b> baixa a lista filtrada.' },
    ],
    dicas: ['O <b>tempo de casa</b> é calculado pela data de admissão.', 'Os gráficos mostram o quadro por empresa e por faixa de tempo de casa.'],
    naoFaz: ['Dados pessoais (CPF, telefone, endereço, e-mail) <b>não</b> são enviados ao GerônIA.'],
    quemVe: 'Quem tem a permissão Funcionários, empresa por empresa.',
    dados: 'Cadastro próprio.',
    tour: [
      { sel: '#f-search', t: 'Busca e filtros', d: 'Localize por nome e filtre por empresa e tempo de casa.' },
      { sel: '#btn-new-func', t: 'Novo colaborador', d: 'Cadastre quem entrou. Para editar, clique na linha da pessoa.' },
      { sel: '#btn-export-func', t: 'Exportar', d: 'Baixa a lista (já filtrada) em planilha Excel.' },
      { sel: '#charts-row', t: 'Gráficos', d: 'Quadro por empresa e por tempo de casa.' },
    ],
  },

  mapasoc: {
    titulo: 'Mapa Societário', versao: 1,
    resumo: 'O <b>Mapa Societário</b> desenha a estrutura de participações entre as empresas e pessoas do grupo. A aba <b>Holding</b> vai mostrar a nova estrutura proposta, ainda em definição.',
    passos: [
      { t: 'Navegue pelo mapa', d: 'Use <b>+</b> e <b>−</b> para aproximar/afastar e <b>1:1</b> para voltar ao tamanho normal. Arraste para mover.' },
      { t: 'Veja a Holding', d: 'A aba <b>Holding</b> mostrará o desenho proposto quando a estruturação for concluída.' },
    ],
    dicas: ['As linhas indicam o sentido da participação entre as entidades.'],
    naoFaz: ['Não é um documento societário oficial — é uma visualização de apoio.'],
    quemVe: 'Quem tem a permissão Mapa Societário.',
    dados: 'Desenho mantido no próprio SAFI.',
    tour: [
      { sel: '#subtab-mapa', t: 'Mapa e Holding', d: 'Alterne entre a estrutura atual e a proposta da holding (em definição).' },
      { sel: '#map-inner', t: 'O mapa', d: 'Arraste para mover e use <b>+</b>, <b>−</b> e <b>1:1</b> para ajustar o zoom.' },
    ],
  },

  conselho: {
    titulo: 'Painel do Conselho', versao: 2,
    resumo: 'Visão consolidada para o conselho: <b>Faturamento, Receita Líquida, Margem de Contribuição, EBITDA, Resultado Líquido e Gastos Operacionais</b>, com comparativos, evolução de 12 meses e ponte do EBITDA.',
    passos: [
      { t: 'Escolha mês e operação', d: 'Nos filtros do topo. O mês padrão é o mais recente com dados.' },
      { t: 'Escolha a base de comparação', d: '<b>Mês anterior</b>, <b>mesmo mês do ano anterior</b>, <b>média dos 12 meses</b> ou <b>melhor mês</b> (por EBITDA) dos últimos 12.' },
      { t: 'Leia os indicadores', d: 'Cada cartão mostra o valor, a variação (verde = melhor, vermelho = pior) e, havendo orçamento, o <b>atingimento do orçado</b>.' },
      { t: 'Entenda o que mudou', d: 'A <b>ponte do EBITDA</b> mostra quanto cada linha (receita, deduções, custos, gastos) somou ou subtraiu entre a base e o mês.' },
    ],
    dicas: ['O botão <b>Gerar PDF</b> (no topo) cria um arquivo A4 com os filtros atuais: você escolhe vertical ou horizontal, marca o que incluir (até um resumo do GerônIA) e informa a <b>finalidade</b>.', 'Percentuais são sobre o Faturamento.', 'O "× Orçado" só aparece para as operações com meta lançada no mês; se for parcial, a tela avisa quais.', 'A faixa "Ações do conselho" leva às decisões pendentes e vencidas.'],
    naoFaz: ['Não é onde se lança nada — os números vêm dos Lançamentos e do Orçamento.', 'Não considera depreciação (o DRE do grupo não tem).'],
    termos: [
      { t: 'EBITDA', d: 'Resultado Líquido + Despesas Financeiras + IR e CSLL. Retiradas de Sócios continuam como despesa.' },
      { t: 'Gastos Operacionais', d: 'Nos indicadores e na ponte, sem Despesas Financeiras e IR/CSLL.' },
      { t: 'Ponte do EBITDA', d: 'Gráfico em cascata: parte do EBITDA da base e chega ao do mês passando por cada linha.' },
    ],
    quemVe: 'Quem tem acesso ao DRE, limitado às operações liberadas.',
    dados: 'Lançamentos (realizado) e Orçamento (metas); ações vêm de Reuniões e Decisões.',
    tour: [
      { sel: '.co-filters', t: 'Filtros', d: 'Mês, base de comparação (mês anterior, ano anterior, média ou melhor mês) e operação.' },
      { sel: '#kpis', t: 'Indicadores', d: 'Valor do mês, variação contra a base e, com orçamento lançado, o atingimento do orçado.' },
      { sel: '.co-row > .panel:nth-child(1)', t: 'Evolução de 12 meses', d: 'Faturamento em barras e EBITDA em linha (com o orçado tracejado, se houver).' },
      { sel: '.co-row > .panel:nth-child(2)', t: 'Ponte do EBITDA', d: 'Mostra o que explica a diferença de EBITDA entre a base e o mês: receita, deduções, custos e gastos.' },
      { sel: '#panel-ops', t: 'Por operação', d: 'Compare as operações lado a lado, com o total.' },
      { sel: '#sp-btn', t: 'Gerar PDF', d: 'Gera um arquivo PDF (folha A4, vertical ou horizontal) com os <b>filtros que estão selecionados agora</b>. Você escolhe o que incluir e informa a <b>finalidade</b>' + '.' },
    ],
  },

  orcamento: {
    titulo: 'Orçamento', versao: 1,
    resumo: 'Cadastre a <b>meta mensal</b> de cada operação na mesma estrutura do DRE. As metas alimentam o comparativo <b>"× Orçado"</b> do Painel do Conselho.',
    passos: [
      { t: 'Escolha operação e ano', d: 'Nos seletores do topo.' },
      { t: 'Preencha as metas', d: 'Digite o valor de cada campo do DRE por mês. Valores sempre positivos, como nos Lançamentos. Célula vazia = sem meta.' },
      { t: 'Use os atalhos', d: '<b>Preencher com realizado do ano anterior</b> (com % de reajuste) completa só as células vazias; a seta <b>→</b> repete o primeiro valor da linha.' },
      { t: 'Confira e salve', d: 'Receita Líquida, Margem, Resultado e EBITDA são recalculados ao vivo. Clique em <b>Salvar orçamento</b>.' },
    ],
    dicas: ['Células alteradas ficam com borda âmbar até você salvar.', 'O nível de detalhe e quem preenche serão definidos com o conselho — a estrutura está pronta para qualquer um dos caminhos.'],
    naoFaz: ['Não altera o realizado nem o DRE.', 'Não trava nem versiona metas (por enquanto).'],
    quemVe: 'Quem tem a permissão Orçamento (Aldemar, Guilherme e o admin, inicialmente).',
    dados: 'Digitado aqui; o realizado do ano anterior vem dos Lançamentos.',
    tour: [
      { sel: '.or-controls', t: 'Operação e ano', d: 'O orçamento é por operação e por ano.' },
      { sel: '#btn-copy', t: 'Atalho: realizado do ano anterior', d: 'Preenche as células vazias com o realizado de ontem, com o reajuste que você informar.' },
      { sel: '#or-tbl', t: 'Grade de metas', d: 'Campo do DRE × 12 meses. As linhas de Receita Líquida, Margem, Resultado e EBITDA se recalculam ao vivo.' },
      { sel: '#btn-save', t: 'Salvar', d: 'Só grava o que você alterou. Vazio significa "sem meta".' },
    ],
  },

  fechamento: {
    titulo: 'Fechamento do Mês', versao: 2,
    resumo: 'Aprove e <b>trave</b> cada mês por operação. Mês travado não aceita mais edição nos Lançamentos. Tudo fica registrado em log, com o motivo quando o mês é reaberto — ou quando é travado com pendências.',
    passos: [
      { t: 'Escolha o mês', d: 'No seletor do topo. Cada operação tem o seu próprio status.' },
      { t: 'Rode as conferências', d: 'Na aba <b>Conferências</b>, veja os alertas automáticos (ex.: despesas fixas sem pagamento, pedidos sem conferência).' },
      { t: 'Aprove e trave', d: 'Passe de <b>Aberto → Aprovado → Travado</b> pelo cartão da operação.' },
      { t: 'Reabra só com motivo', d: 'Voltar um status exige um <b>motivo</b> (mín. 5 caracteres), que fica no <b>Histórico</b>.' },
    ],
    dicas: ['<b>Aprovado</b> ainda permite editar; só <b>Travado</b> bloqueia.', 'Se a operação ainda tem conferência com alerta, <b>travar exige motivo</b> — assim dá pra travar mesmo assim, mas fica registrado por quê.', 'A aba Histórico traz também a trilha de quem alterou cada Lançamento.', 'A matriz dos últimos 12 meses dá a visão geral — clique num mês para abri-lo.'],
    naoFaz: ['Não corrige os números — apenas controla se eles ainda podem ser editados.'],
    termos: [{ t: 'Aberto', d: 'Editável.' }, { t: 'Aprovado', d: 'Revisado, mas ainda editável.' }, { t: 'Travado', d: 'Bloqueado para edição no banco de dados.' }],
    quemVe: 'Quem tem a permissão Fechar Mês (Aldemar, Guilherme e o admin).',
    dados: 'Status próprios; conferências calculadas a partir de Pedidos, Despesas Fixas e Lançamentos.',
    tour: [
      { sel: '#sel-periodo', t: 'Mês de referência', d: 'Todos os cartões e conferências seguem este mês.' },
      { sel: '#op-grid', t: 'Uma operação por cartão', d: 'Veja o status, os alertas e aprove ou trave cada operação.' },
      { sel: '#matrix', t: 'Últimos 12 meses', d: 'Visão geral de todos os meses. Clique numa célula para abrir aquele mês.' },
      { sel: '#chk-list', clicar: '.tab[data-tab="conferencias"]', voltar: '.tab[data-tab="fechamento"]', t: 'Conferências', d: 'Alertas automáticos antes de fechar: pendências em despesas fixas, pedidos e mais.' },
      { sel: '#tbl-log', clicar: '.tab[data-tab="historico"]', t: 'Histórico', d: 'Quem fechou, travou ou reabriu — e por quê — além da trilha de alterações dos Lançamentos.' },
    ],
  },

  reunioes: {
    titulo: 'Reuniões e Decisões', versao: 1,
    resumo: 'Registre as <b>reuniões</b> (pauta e ata) e acompanhe o que ficou decidido: <b>quem faz, até quando e em que pé está</b> cada ação.',
    passos: [
      { t: 'Registre a reunião', d: '<b>Nova reunião</b>: título, data, tipo, participantes, pauta e ata.' },
      { t: 'Crie as ações', d: 'Dentro da reunião, <b>Adicionar ação</b>: o que fazer, responsável, prazo, operação e situação.' },
      { t: 'Acompanhe', d: 'Na aba <b>Ações e decisões</b>, filtre por situação, responsável e operação. As <b>vencidas</b> ficam em vermelho.' },
      { t: 'Atualize o andamento', d: 'O responsável muda a situação da própria ação: <b>Aberta → Em andamento → Concluída</b> (ou Cancelada).' },
    ],
    dicas: ['O histórico de cada ação (criada, prazo, responsável, situação) fica registrado e não pode ser apagado.', 'O responsável pode ser alguém sem conta no SAFI — digite o nome.', 'Só o admin exclui; prefira marcar como <b>Cancelada</b>.'],
    naoFaz: ['Não envia notificações nem e-mails (por enquanto).'],
    quemVe: 'Quem tem a permissão Reuniões (ver) ou Reuniões (registrar).',
    dados: 'Cadastro próprio; o Painel do Conselho mostra a faixa de ações em andamento/vencidas.',
    tour: [
      { sel: '#chips', t: 'Painel de ações', d: 'Quantas estão em andamento, vencidas e concluídas no mês. Clique para filtrar.' },
      { sel: '#tbl-acoes', t: 'Ações e decisões', d: 'Responsável, prazo e situação. Clique numa ação para ver detalhes e histórico.' },
      { sel: '#re-actions', t: 'Novos registros', d: 'Crie uma ação ou uma reunião (quem tem permissão para registrar).' },
      { sel: '#re-cards', clicar: '#tabs [data-tab="reunioes"]', voltar: '#tabs [data-tab="acoes"]', t: 'Reuniões', d: 'Cada reunião guarda pauta, ata e as ações que saíram dela.' },
    ],
  },

  produtos: {
    titulo: 'Produtos & Estoque', versao: 1,
    resumo: 'Acompanhe <b>estoque, giro, cobertura, valor médio de venda e sazonalidade</b> por produto (SKU). Os dados entram por <b>planilha</b> exportada do Tiny/Olist ou do Seta.',
    passos: [
      { t: 'Importe o estoque', d: 'Na aba <b>Importar dados</b>, envie a planilha de cadastro/posição de estoque de uma operação. O sistema reconhece as colunas e você confere a prévia.' },
      { t: 'Importe as vendas', d: 'Envie as vendas por produto (data, quantidade e valor). Meses completos: os meses do arquivo <b>substituem</b> os já gravados.' },
      { t: 'Analise', d: 'Em <b>Visão geral</b>, veja valor em estoque, cobertura, itens sem giro e em ruptura, e filtre por fornecedor, categoria e situação.' },
      { t: 'Veja a sazonalidade', d: 'Em <b>Sazonalidade</b>, o índice mostra quais meses vendem acima ou abaixo da média (por fornecedor, categoria ou SKU).' },
    ],
    dicas: ['Cobertura, giro e valor médio de venda só aparecem depois que as vendas forem importadas.', 'Com menos de 12 meses de histórico, o índice sazonal é provisório.', 'Arquivos CSV podem estar em UTF-8 ou Windows-1252, com separador vírgula, ponto e vírgula ou tab.'],
    naoFaz: ['Não se conecta sozinho ao Tiny/Olist ou ao Seta (por enquanto, importação por planilha).', 'O "prazo médio de estocagem" real exigiria histórico de entradas — aqui usamos a cobertura.'],
    termos: [
      { t: 'Cobertura (dias)', d: 'Estoque ÷ média diária de vendas dos últimos 3 meses.' },
      { t: 'Sem giro', d: 'Tem estoque, mas não vendeu nos últimos 3 meses.' },
      { t: 'Ruptura', d: 'Estoque zerado em produto que vem vendendo.' },
      { t: 'Valor médio de venda', d: 'Receita ÷ unidades vendidas nos últimos 12 meses.' },
    ],
    quemVe: 'Quem tem a permissão Produtos & Estoque.',
    dados: 'Planilhas importadas nesta tela (Tiny/Olist e Seta).',
    tour: [
      { sel: '#sel-op', t: 'Operação', d: 'Veja todas as operações ou uma só.' },
      { sel: '#kpis', t: 'Indicadores', d: 'SKUs, unidades e valor em estoque, cobertura média, itens sem giro (com o valor parado) e rupturas.' },
      { sel: '#tbl-prod', t: 'Lista de produtos', d: 'Custo, venda, margem, estoque, vendas dos 3 últimos meses, cobertura e valor médio de venda.' },
      { sel: '#s-forn', clicar: '#tabs [data-tab="saz"]', voltar: '#tabs [data-tab="geral"]', t: 'Sazonalidade', d: 'Escolha fornecedor, categoria ou SKU e veja o índice de cada mês do ano.' },
      { sel: '#e-file', clicar: '#tabs [data-tab="imp"]', t: 'Importar dados', d: 'Envie a planilha de estoque e a de vendas. As colunas são reconhecidas sozinhas e você confere a prévia antes de importar.' },
    ],
  },

  admin: {
    titulo: 'Gestão de Acessos', versao: 3,
    resumo: 'Aqui o admin cria usuários, define <b>exatamente o que cada um pode ver e fazer</b> no SAFI — tela por tela e, em vários casos, empresa por empresa — e acompanha quem está usando o sistema.',
    passos: [
      { t: 'Crie o usuário', d: '<b>Novo Usuário</b>: nome, cargo, e-mail e senha inicial.' },
      { t: 'Defina os acessos', d: 'Ligue ou desligue cada área (DRE, Lançamentos, Pedidos, Fechamento, Orçamento, Reuniões, Produtos…) e, quando houver, as empresas liberadas.' },
      { t: 'Acompanhe a lista', d: 'A barra de cada usuário mostra o percentual de áreas liberadas.' },
    ],
    dicas: ['<b>Resumo Contábil e DRE</b> vêm liberados por padrão; as demais áreas começam desligadas.', 'A GerônIA respeita as mesmas permissões ao responder.', '"Usuários online" considera alguém online se o navegador mandou sinal nos últimos 2 minutos — só conta enquanto a aba está em primeiro plano.'],
    naoFaz: ['Só o admin do painel acessa esta tela.'],
    quemVe: 'Somente o administrador do SAFI.',
    dados: 'Cadastro de usuários e permissões. Presença (online agora, última vez online, tempo online) é calculada a partir de um sinal que cada tela manda enquanto está aberta.',
    tour: [
      { sel: '#exp-panel', t: 'Exportações de PDF', d: 'Aqui chega o aviso de cada PDF gerado no SAFI: <b>quem</b> exportou, de <b>qual tela</b>, <b>quando</b> e a <b>finalidade</b> que a pessoa informou. Use "Marcar todas como lidas" depois de conferir.' },
      { sel: '#presenca-panel', t: 'Usuários online', d: 'Quem está online agora, quando cada um foi visto pela última vez e quanto tempo ficou online nos últimos 7 dias.' },
      { sel: '.btn-new', t: 'Novo usuário', d: 'Cadastre a pessoa e depois defina os acessos.' },
      { sel: '.user-table', t: 'Usuários', d: 'Veja quem tem acesso, o percentual de áreas liberadas e edite as permissões de cada um.' },
    ],
  },

} };
