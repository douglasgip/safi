// Conteúdo do "Sobre esta tela" de cada tela do SAFI (fonte única — também alimenta o GerônIA).
// Para atualizar: edite o texto da tela, aumente `versao` (a pessoa vê um pontinho de "novidade" no botão)
// e rode `node scripts/ajuda-para-sql.js` para atualizar o manual que o GerônIA lê.
//
// Campos: titulo, versao, resumo, passos[{t,d}], dicas[], naoFaz[], termos[{t,d}], quemVe, dados, aviso,
//         tour[{ sel, t, d, clicar?, voltar? }]  (sel = seletor CSS; passo some sozinho se o alvo não estiver visível)
// O HTML simples (<b>) é permitido nos textos.
window.SAFI_AJUDA = { telas: {

  home: {
    titulo: 'Home', versao: 2,
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
      { sel: '.card-geronia', t: 'GerônIA', d: 'Seu conselheiro de IA. Pergunte sobre resultados, orçamento, funcionários ou como usar qualquer tela do SAFI.' },
      { sel: '.dash-section', t: 'Telas por setor', d: 'Cada cartão abre uma tela. Eles seguem os mesmos setores da barra lateral.' },
    ],
  },

  geronia: {
    titulo: 'GerônIA', versao: 2,
    resumo: 'O <b>GerônIA</b> é o conselheiro de inteligência do Grupo Sacoman. Ele lê os dados que <b>o seu acesso permite</b> (DRE, indicadores do conselho, orçamento, funcionários, reuniões…) e também conhece <b>como usar cada tela do SAFI</b>.',
    passos: [
      { t: 'Faça uma pergunta', d: 'Escreva no campo de baixo, em linguagem normal. Ex.: <b>"Como está o EBITDA de agosto?"</b> ou <b>"Como lanço o orçamento de compras?"</b>.' },
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
    titulo: 'Resumo Contábil', versao: 3,
    resumo: 'O <b>Resumo Contábil</b> mostra, por empresa e por competência, o que entrou, o que saiu e o que sobrou — com estoque contábil, alíquota e RBT12 — e soma tudo num consolidado do grupo.',
    passos: [
      { t: 'Escolha a competência', d: 'No topo, selecione o mês de referência (ou o período, conforme a tela).' },
      { t: 'Veja cada empresa', d: 'Os cartões mostram <b>Entrada, Saída, Despesa e Resultado</b> de cada empresa no mês.' },
      { t: 'Some no consolidado', d: '<b>Clique nos cartões</b> das empresas que quer somar: o total do grupo se recalcula na hora.' },
      { t: 'Analise os gráficos', d: 'A seção de gráficos compara entrada, saída e despesa por empresa e mostra a evolução mensal.' },
    ],
    dicas: ['O botão <b>Gerar PDF</b> (no topo) cria um arquivo A4 com os filtros atuais: você escolhe vertical ou horizontal, marca o que incluir (até um resumo do GerônIA) e informa a <b>finalidade</b>.', 'O Resumo Contábil é lançado por empresa na aba <b>Resumo Contábil</b> da tela de Lançamentos.', 'A alíquota é a do mês (pode mudar mês a mês, ex.: Simples Nacional pela receita acumulada).'],
    naoFaz: ['Não substitui a contabilidade oficial — é a visão gerencial dos números lançados.', 'Não edita valores; para corrigir, use Lançamentos.'],
    termos: [{ t: 'Resultado', d: 'Saída − (Despesa + Entrada), calculado automaticamente.' }, { t: 'Estoque contábil', d: 'Valor do estoque informado no lançamento do mês.' }, { t: 'RBT12', d: 'Receita bruta total dos últimos 12 meses (base da alíquota do Simples Nacional), informada mês a mês em Lançamentos.' }],
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
    titulo: 'DRE', versao: 5,
    resumo: 'O <b>DRE</b> (Demonstrativo de Resultados) apresenta faturamento, deduções, custos, margem de contribuição e resultado do período — por operação ou consolidado — com comparativos e gráficos.',
    passos: [
      { t: 'Defina o período', d: 'Escolha o mês inicial e o final no topo. Tudo na tela segue esse intervalo.' },
      { t: 'Escolha as operações', d: 'Ligue e desligue <b>GIP Ecommerce, Exposição Paulista e Via Closet</b> para ver cada uma ou o conjunto. A GIP soma as entidades EP + GIP.' },
      { t: 'Leia os indicadores', d: 'O bloco de topo traz <b>Faturamento, Margem de Contribuição e Resultado Líquido</b>; abaixo, um cartão por operação.' },
      { t: 'Compare períodos', d: 'O botão <b>Comparar</b> abre o painel A × B para confrontar dois períodos ou operações, com as diferenças.' },
      { t: 'Abra o detalhe', d: 'Na tabela do DRE, <b>AV%</b> é a participação vertical e <b>AH%</b> a variação em relação ao mês anterior. <b>Lançamentos Detalhados</b> mostra a composição linha a linha.' },
    ],
    dicas: ['O botão <b>Gerar PDF</b> (no topo) cria um arquivo A4 com os filtros atuais: você escolhe vertical ou horizontal, marca o que incluir (até um resumo do GerônIA) e informa a <b>finalidade</b>.', 'Os números vêm dos Lançamentos: se algo não bate, confira lá.', 'Nos gráficos você pode arrastar para comparar períodos.', 'O EBITDA do grupo = Resultado Líquido + Despesas Financeiras + IR e CSLL — está no Painel do Conselho.', 'A linha <b>Créditos Tributários atuais</b>, quando aparece no fim da tabela (hoje só na EP), é só informativa — não entra em nenhuma conta do DRE. Mostra o total; clique nela para ver a quebra em ICMS, PIS e COFINS.'],
    naoFaz: ['Não é onde se lança — os valores entram em <b>Lançamentos</b>.', 'Não calcula depreciação (o DRE do grupo não tem essa linha).'],
    termos: [
      { t: 'Margem de Contribuição', d: 'Receita líquida menos custos variáveis: o que sobra para cobrir os gastos operacionais.' },
      { t: 'AV% / AH%', d: 'Análise vertical (peso de cada linha no faturamento) e horizontal (variação frente ao mês anterior).' },
      { t: 'Consolidado', d: 'Soma das operações selecionadas.' },
      { t: 'Créditos Tributários atuais', d: 'Soma de ICMS, PIS e COFINS, sempre o valor mais recente (não é por mês/ano). Clique na linha do DRE para expandir e ver os três separados. Editado em Lançamentos, na EP. Meramente informativo — não entra em nenhum cálculo do DRE.' },
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
    titulo: 'Lançamentos', versao: 6,
    resumo: 'Em <b>Lançamentos</b> você alimenta o DRE numa <b>grade de contas × 12 meses</b> (o mesmo padrão da tela de Orçamento): escolhe a empresa e o ano e preenche mês a mês. Também mantém a estrutura de contas e o Resumo Contábil.',
    passos: [
      { t: 'Escolha empresa e ano', d: 'A grade mostra os <b>12 meses de uma vez</b>. Só aparecem as empresas que você pode lançar.' },
      { t: 'Preencha os valores', d: 'Cada linha é uma conta (campo ou subcampo) e cada coluna, um mês. As linhas alternam de tom para você não se perder. <b>Enter</b> ou <b>↓</b> desce na mesma coluna; <b>Tab</b> vai para o mês seguinte.' },
      { t: 'Cole da planilha ou importe', d: 'Copie um bloco no Excel, clique na primeira célula e cole (<b>Ctrl+V</b>): linhas e meses são preenchidos de uma vez. Ou use <b>Baixar modelo</b> e <b>Importar planilha</b>.' },
      { t: 'Confira os totais', d: 'Totais por campo, classe e mês — e as linhas de <b>Receita Líquida, Margem e Resultado</b> — atualizam enquanto você digita. A última coluna é o total do ano.' },
      { t: 'Salve', d: '<b>Salvar Lançamentos</b> grava <b>apenas as células que você mudou</b> (elas ficam com borda âmbar até salvar). O DRE é atualizado sozinho e a alteração fica registrada (quem mudou o quê).' },
    ],
    dicas: ['Célula em branco ao colar ou importar <b>não apaga</b> o que já existe. Para zerar um valor, digite 0 (ou apague a célula e salve).', 'Se trocar de empresa ou ano com alterações não salvas, o SAFI pergunta antes de descartar.', 'A aba <b>Gerenciar Estrutura</b> permite criar/ordenar classes, campos e subcampos; a aba <b>Resumo Contábil</b> guarda entrada, saída, despesa, estoque e alíquota do mês.', 'Ao escolher a empresa <b>EP</b>, aparece embaixo da grade o bloco <b>Créditos Tributários atuais</b> — ICMS, PIS e COFINS separados, com o total somado ao vivo. É informativo (não por mês/ano) e não entra em nenhum cálculo do DRE.'],
    naoFaz: ['Não substitui a contabilidade oficial.', 'Não aparece o que você não tem liberação para lançar.'],
    termos: [{ t: 'Classe / campo / subcampo', d: 'Hierarquia das contas do DRE (ex.: Custos Variáveis → Frete → Frete Pago).' }, { t: 'Célula alterada', d: 'Valor mudado na tela e ainda não salvo (borda âmbar).' }],
    quemVe: 'Quem tem a permissão Lançamentos, empresa por empresa.',
    dados: 'Digitados aqui, colados da planilha ou importados; alimentam DRE, Resumo Contábil, Painel do Conselho e GerônIA.',
    tour: [
      { sel: '#tab-lancar', t: 'Três abas', d: '<b>Lançar DRE</b> (valores do ano), <b>Gerenciar Estrutura</b> (contas) e <b>Resumo Contábil</b>.' },
      { sel: '#entry-filters', t: 'Empresa e ano', d: 'Escolha o que vai lançar. Aqui ficam também <b>Baixar modelo</b>, <b>Importar planilha</b> e o botão <b>Salvar</b>.' },
      { sel: '#entry-tree', t: 'A grade', d: 'Contas nas linhas, meses nas colunas — igual ao Orçamento. Linhas em tons alternados, totais por campo e por classe, e o resultado calculado ao vivo.' },
      { sel: '.lc-in:not(:disabled)', t: 'Cada célula', d: 'Digite o valor do mês. <b>Enter</b> desce, <b>Tab</b> avança, e você pode <b>colar um bloco</b> copiado do Excel. Células alteradas ficam com borda âmbar.' },
      { sel: '#btn-save-valores', t: 'Salvar', d: 'Grava só o que você alterou (o número aparece no botão), atualiza o DRE e registra quem mudou o quê.' },
      { sel: '#manage-tree', clicar: '#tab-gerenciar', voltar: '#tab-lancar', t: 'Gerenciar Estrutura', d: 'Crie, renomeie, exclua e <b>arraste para reordenar</b> classes, campos e subcampos do DRE. A lista segue o mesmo formato da grade de lançamento, e a ordem definida aqui vale para a grade e para o modelo de planilha.' },
      { sel: '#view-resumo', clicar: '#tab-resumo', t: 'Resumo Contábil', d: 'Informe entrada, saída, despesa, estoque, alíquota e RBT12 do mês — alimenta a tela de Resumo Contábil.' },
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
    titulo: 'Funcionários', versao: 2,
    resumo: 'Cadastro dos <b>colaboradores</b> de cada empresa — a fonte da verdade do grupo. Admissões, alterações e desligamentos feitos aqui vão automaticamente para o <b>Conekto</b> (ponto).',
    passos: [
      { t: 'Filtre a lista', d: 'Busque por nome e filtre por situação (ativos, desligados), empresa e tempo de casa.' },
      { t: 'Cadastre ou edite', d: '<b>Novo Colaborador</b>: escolha a <b>gestão</b> (loja/operação) e, se souber, o <b>CNPJ de registro</b>. Gestão, nome, CPF válido e data de admissão são obrigatórios. Ao salvar, o cadastro vai para o Conekto.' },
      { t: 'Desligue quem saiu', d: 'Botão amarelo <b>Desligar</b>: informe o <b>último dia trabalhado</b> e o motivo. A pessoa sai da lista de ativos, mas o histórico fica; no Conekto o ponto é bloqueado a partir do dia seguinte.' },
      { t: 'Readmita, se voltar', d: 'No filtro <b>Desligados</b>, botão verde <b>Readmitir</b> com a nova data de admissão. No Conekto ela volta no mesmo registro.' },
      { t: 'Acompanhe o Conekto', d: 'A coluna <b>Conekto</b> mostra ✓ Enviado, ⚠ Erro (passe o mouse para ver o motivo e clique para reenviar) ou Enviar. No formulário de edição, <b>Conferir no Conekto</b> mostra a situação lá e o que falta configurar (jornada, reconhecimento facial…).' },
      { t: 'Exporte', d: '<b>Exportar XLSX</b> baixa a lista filtrada.' },
    ],
    dicas: ['O <b>tempo de casa</b> é calculado pela data de admissão.', 'Os gráficos mostram o quadro por empresa e por faixa de tempo de casa.'],
    naoFaz: ['Dados pessoais (CPF, telefone, endereço, e-mail) <b>não</b> são enviados ao GerônIA.', 'Excluir de vez é só do administrador e não avisa o Conekto — para quem saiu, use Desligar.', 'Jornada, horário, reconhecimento facial e código Domínio são configurados no próprio Conekto.'],
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
    titulo: 'Painel do Conselho', versao: 8,
    resumo: 'Visão consolidada para o conselho: <b>Faturamento, Receita Líquida, Margem de Contribuição, Gastos Operacionais, EBITDA e Resultado Líquido</b>, com comparativos, evolução de 12 meses, ponte do EBITDA, a <b>cascata de rentabilidade e custos</b> (Margem Bruta, CMV, pessoal, despesas financeiras, tudo em R$ e % do faturamento) e indicadores de Pessoas (admissões, desligamentos, turnover, produtividade por funcionário).',
    passos: [
      { t: 'Escolha mês e operação', d: 'Nos filtros do topo. O mês padrão é o mais recente com dados.' },
      { t: 'Escolha a base de comparação', d: '<b>Mês anterior</b>, <b>mesmo mês do ano anterior</b>, <b>média dos 12 meses</b> ou <b>melhor mês</b> (por EBITDA) dos últimos 12.' },
      { t: 'Leia os indicadores', d: 'Cada cartão mostra o valor, a variação (verde = melhor, vermelho = pior) e, quando lançados em Budget, o atingimento da <b>meta</b> no Faturamento (a meta é a venda prevista).' },
      { t: 'Acompanhe metas e orçamento', d: 'O bloco <b>Metas e Orçamento</b> mostra o progresso da meta de vendas (venda prevista no Budget × faturamento do DRE) no mês, no trimestre e no ano (a marca amarela é quanto do período já passou) e as compras previstas × realizadas por operação, no mês e no acumulado do ano. Só entram as operações que têm valores lançados em Budget.' },
      { t: 'Entenda o que mudou', d: 'A <b>ponte do EBITDA</b> mostra quanto cada linha (receita, deduções, custos, gastos) somou ou subtraiu entre a base e o mês.' },
      { t: 'Veja onde o dinheiro fica', d: 'A tabela <b>Rentabilidade e custos</b> desce do Faturamento até o Resultado Líquido, mostrando cada linha em R$, em % do faturamento e a variação em pontos percentuais contra a base.' },
      { t: 'Acompanhe Pessoas', d: 'Admissões, desligamentos e turnover do mês, calculados a partir de quem entra e sai da tela de Funcionários, mais o faturamento e a margem de contribuição por funcionário.' },
    ],
    dicas: ['O botão <b>Gerar PDF</b> (no topo) cria um arquivo A4 com os filtros atuais: você escolhe vertical ou horizontal, marca o que incluir (até um resumo do GerônIA) e informa a <b>finalidade</b>.', 'Percentuais são sobre o Faturamento.', 'O "× Meta" só aparece para as operações com venda prevista lançada no mês; se for parcial, a tela avisa quais.', 'A faixa "Ações do conselho" leva às decisões pendentes e vencidas.', 'Pessoas só tem dado a partir de <b>set/2026</b> — antes disso o SAFI não registrava admissão/desligamento, e não há como reconstruir.'],
    naoFaz: ['Não é onde se lança nada — os números vêm dos Lançamentos, do Budget e de Funcionários.', 'Não considera depreciação (o DRE do grupo não tem).'],
    termos: [
      { t: 'EBITDA', d: 'Resultado Líquido + Despesas Financeiras + IR e CSLL. Retiradas de Sócios continuam como despesa.' },
      { t: 'Gastos Operacionais', d: 'Nos indicadores e na ponte, sem Despesas Financeiras e IR/CSLL.' },
      { t: 'Ponte do EBITDA', d: 'Gráfico em cascata: parte do EBITDA da base e chega ao do mês passando por cada linha.' },
      { t: 'Turnover', d: '((Admissões + Desligamentos) ÷ 2) ÷ quadro atual de funcionários, em %.' },
      { t: 'Margem Bruta', d: 'Receita Líquida − CMV, em R$ e em % do faturamento.' },
      { t: 'Despesas variáveis e fixas', d: 'Variáveis = custos variáveis do DRE (CMV e demais). Fixas = gastos operacionais. Despesas de pessoal = folha, INSS/FGTS, premiações, temporários e outros.' },
      { t: 'Produtividade por funcionário', d: 'Valor do mês ÷ quadro atual de funcionários. Em meses antigos é uma aproximação, porque o SAFI não guarda o quadro de época.' },
    ],
    quemVe: 'Quem tem acesso ao DRE, limitado às operações liberadas — Pessoas segue a mesma regra (não depende do acesso a Funcionários).',
    dados: 'Lançamentos (realizado) e Budget (vendas previstas e compras); ações vêm de Reuniões e Decisões; Pessoas vem de criar/excluir em Funcionários.',
    tour: [
      { sel: '.co-filters', t: 'Filtros', d: 'Mês, base de comparação (mês anterior, ano anterior, média ou melhor mês) e operação.' },
      { sel: '#kpis', t: 'Indicadores', d: 'Valor do mês, variação contra a base e, havendo meta ou orçamento lançado, o atingimento (meta no Faturamento, orçado nos Gastos Operacionais).' },
      { sel: '#panel-mo', t: 'Metas e Orçamento', d: 'Meta de vendas (mês, trimestre e ano) e compras previstas × realizadas por operação.' },
      { sel: '.co-row > .panel:nth-child(1)', t: 'Evolução de 12 meses', d: 'Faturamento em barras e EBITDA em linha (com a meta de faturamento tracejada, se houver).' },
      { sel: '.co-row > .panel:nth-child(2)', t: 'Ponte do EBITDA', d: 'Mostra o que explica a diferença de EBITDA entre a base e o mês: receita, deduções, custos e gastos.' },
      { sel: '#panel-rentab', t: 'Rentabilidade e custos', d: 'Desce do Faturamento até o Resultado Líquido: cada linha em R$, em % do faturamento e a variação em pontos percentuais contra a base (custo que sobe aparece em vermelho).' },
      { sel: '#panel-pessoas', t: 'Pessoas e produtividade', d: 'Admissões, desligamentos e turnover do mês (contabilizados automaticamente em Funcionários) e o faturamento e a margem de contribuição por funcionário.' },
      { sel: '#panel-ops', t: 'Por operação', d: 'Compare as operações lado a lado, com o total.' },
      { sel: '#sp-btn', t: 'Gerar PDF', d: 'Gera um arquivo PDF (folha A4, vertical ou horizontal) com os <b>filtros que estão selecionados agora</b>. Você escolhe o que incluir e informa a <b>finalidade</b>' + '.' },
    ],
  },

  orcamento: {
    titulo: 'Budget', versao: 5,
    resumo: 'Planilha de orçamento por operação (Exposição Paulista, Via Closet e E-commerce), mês a mês: <b>estoque inicial</b> em peças, <b>vendas</b> previstas × realizadas e <b>compras</b> previstas × realizadas, em R$ e peças. O <b>estoque final</b> de cada mês é calculado e vira o estoque inicial do mês seguinte. Tudo é digitado.',
    passos: [
      { t: 'Escolha o período', d: 'Em <b>De</b> e <b>Até</b> no topo (o padrão é a estação de setembro a março).' },
      { t: 'Digite o estoque inicial', d: 'No primeiro mês, o estoque em peças. Nos meses seguintes pode deixar em branco: ele herda o estoque final do mês anterior (aparece em cinza). Digite só para corrigir, por exemplo depois de um inventário.' },
      { t: 'Lance vendas e compras', d: 'Previstas e realizadas em R$ e a quantidade de peças. Saldo e % são calculados na hora.' },
      { t: 'Salve', d: 'Os campos alterados ficam com borda amarela. Clique em <b>Salvar</b> para gravar tudo de uma vez.' },
    ],
    dicas: ['Vendas: saldo positivo (verde) = vendeu mais que o previsto.', 'Compras: saldo positivo (verde) = comprou menos que o previsto (sobrou verba); o % é o quanto sobrou da verba.', 'A linha <b>Total</b> soma o período; o estoque do total é o inicial do primeiro mês e o final do último.'],
    naoFaz: ['Não puxa nada do DRE nem dos Lançamentos — vendas e compras realizadas também são digitadas aqui (por enquanto).', 'Não orça gastos operacionais.'],
    termos: [{ t: 'Estoque final', d: 'Estoque inicial − peças vendidas + peças compradas.' }, { t: '% das compras', d: '(Previstas − realizadas) ÷ previstas.' }],
    quemVe: 'Quem tem a permissão Budget (no Admin). O Painel do Conselho lê as vendas previstas (como meta do faturamento) e as compras para quem tem acesso ao DRE da operação.',
    dados: 'Tudo digitado nesta tela.',
    tour: [
      { sel: '.or-controls', t: 'Período e salvar', d: 'Escolha de qual mês a qual mês ver, e salve as alterações.' },
      { sel: '#ops', t: 'Uma tabela por operação', d: 'Linhas = meses. Estoque, vendas e compras lado a lado, com o estoque final calculado.' },
    ],
  },
  reunioes: {
    titulo: 'Reuniões e Decisões', versao: 2,
    resumo: 'Registre as <b>reuniões</b> (pauta e ata) e acompanhe o que ficou decidido: <b>quem faz, até quando e em que pé está</b> cada ação.',
    passos: [
      { t: 'Registre a reunião', d: '<b>Nova reunião</b>: título, data, tipo, participantes, pauta e ata.' },
      { t: 'Crie as ações', d: 'Dentro da reunião, <b>Adicionar ação</b>: o que fazer, responsável, prazo, operação e situação.' },
      { t: 'Acompanhe', d: 'Na aba <b>Ações e decisões</b>, filtre por situação, responsável e operação. As <b>vencidas</b> ficam em vermelho.' },
      { t: 'Exporte a ata em PDF', d: 'Com a reunião aberta, clique em <b>Exportar PDF</b> e marque o que deve aparecer (título, data, tipo, participantes, pauta, ata). Por padrão saem só o <b>título</b> e a <b>ata</b>.' },
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

  tesouraria: {
    titulo: 'Tesouraria', versao: 5,
    resumo: 'Duas abas: <b>Cheques</b> (controle dos cheques emitidos, igual à planilha: registro, CNPJ, titular, nº, valor, fornecedor, compensação e OK) e <b>Caixa</b> (cada <b>saque ou sangria</b> entregue a um portador, dividido entre as lojas, com os gastos lançados um a um; saldo final = valor enviado − gastos).',
    passos: [
      { t: 'Cheques: lance e acompanhe', d: 'Aba <b>Cheques</b> → <b>+ Novo cheque</b>. Para uma sequência da mesma compra use <b>Salvar e adicionar outro</b> (mantém titular, fornecedor e valor, e soma 1 no número). Clique no selo da coluna <b>OK?</b> para marcar o cheque como compensado.' },
      { t: 'Caixa: registre o lançamento', d: 'Aba <b>Caixa</b> → <b>+ Novo lançamento</b>: escolha <b>Saque</b> ou <b>Sangria</b>, a data, o <b>portador</b> (os nomes já usados aparecem na lista ao clicar no campo), a finalidade e o <b>valor enviado</b>.' },
      { t: 'Divida entre as lojas', d: 'Marque as lojas que entram no rateio (Exposição Paulista, Via Closet, GIP — uma, duas ou as três). O valor enviado é dividido igualmente entre elas automaticamente.' },
      { t: 'Lance os gastos', d: '<b>+ Adicionar gasto</b>: valor, categoria (escreva livremente — as já usadas e Viagem, Hospedagem, Refeição, Locomoção e Outros aparecem como sugestão) e se foi em <b>Dinheiro</b> ou <b>Pix</b>. Um gasto por linha.' },
      { t: 'Confira o saldo final', d: 'O <b>saldo final</b> (valor enviado − gastos em dinheiro) é calculado na hora. Gasto em <b>Pix</b> não desconta do saldo, porque sai da conta da empresa e não do dinheiro com o portador. Os cartões do topo somam o saldo de cada portador.' },
    ],
    dicas: ['<b>Vencido</b> = passou da data de compensação e ainda não tem OK (fica em vermelho, com contador na aba).', 'Titular, fornecedor e portador são texto livre, mas os já usados aparecem como sugestão ao digitar.', 'O CNPJ do cheque: Guilherme, Juliane, Isa ou EP.', 'Clique numa linha para editar ou excluir.'],
    naoFaz: ['Não lança nada no DRE: o rateio entre lojas é só o controle da tesouraria.'],
    quemVe: 'Quem tem a permissão Tesouraria.',
    dados: 'Cadastro próprio, lançamento por lançamento.',
  },

  admin: {
    titulo: 'Gestão de Acessos', versao: 4,
    resumo: 'Aqui o admin cria usuários, define <b>exatamente o que cada um pode ver e fazer</b> no SAFI — tela por tela e, em vários casos, empresa por empresa — e acompanha quem está usando o sistema.',
    passos: [
      { t: 'Crie o usuário', d: '<b>Novo Usuário</b>: nome, cargo, e-mail e senha inicial.' },
      { t: 'Defina os acessos', d: 'Ligue ou desligue cada área (DRE, Lançamentos, Orçamento, Tesouraria, Reuniões, Funcionários…) e, quando houver, as empresas liberadas.' },
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
