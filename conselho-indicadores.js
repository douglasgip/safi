// Painel de Indicadores (modelo do Aldemar, 6 pilares) dentro do Painel do Conselho.
// Fontes: DRE do SAFI (acumulado do ano até o mês do filtro) + balanço lançado por data-base
// (normalmente trimestral, tabela conselho_balanco) + Funcionários + BI das Lojas (ticket médio).
// As contas ficam em funções puras (indCalcular, indPilares...) — cobertas por tests/conselho-indicadores.test.js.
// Usa globais da página do conselho: porChave, detalhePorChave, turnoverPorChave, headcountPorOp, TURNOVER_DESDE,
// OP_NOME, MESES, MES_CURTO, opsVisiveis, sb, g, esc, render, showToast (quando existir).

const IND_DIAS_MES = 30;   // convenção comercial: cada mês conta 30 dias (jan–set = 270 dias)
const IND_CAMPOS_BAL = ['estoque_custo', 'estoque_venda', 'emprestimos_cp', 'emprestimos_lp', 'caixa', 'pl', 'limite_estoque', 'credito_vencido', 'credito_perdas', 'credito_recuperado'];

// ── Funções puras ───────────────────────────────────────────────────────────
function indSomaFaixas(f) { return (f || []).reduce((a, x) => a + (+x.valor || 0), 0); }
// Prazo médio ponderado pelo valor de cada faixa: Σ(valor × dias) ÷ Σ valor.
function indPrazoMedio(f) {
  const t = indSomaFaixas(f); if (!t) return null;
  return (f || []).reduce((a, x) => a + (+x.valor || 0) * (+x.dias || 0), 0) / t;
}
// Junta os balanços de várias operações (mesma data-base). Um campo só tem valor se TODAS informaram.
function indConsolidar(rows) {
  if (!rows || !rows.length) return null;
  const out = { clientes: [], fornecedores: [] };
  IND_CAMPOS_BAL.forEach(c => {
    const vs = rows.map(r => r[c]).filter(v => v != null && v !== '');
    out[c] = vs.length === rows.length ? vs.reduce((a, v) => a + (+v), 0) : null;
  });
  rows.forEach(r => { out.clientes = out.clientes.concat(r.clientes || []); out.fornecedores = out.fornecedores.concat(r.fornecedores || []); });
  out.temClientes = rows.every(r => (r.clientes || []).length > 0);
  out.temFornecedores = rows.every(r => (r.fornecedores || []).length > 0);
  return out;
}
// Um balanço serve de data-base quando tem estoque e clientes ou fornecedores (o de abertura do ano só tem estoque).
const indBalancoCompleto = r => r.estoque_custo != null && ((r.clientes || []).length > 0 || (r.fornecedores || []).length > 0);
// Escolhe o balanço da data-base (o mais recente até `ate`, 'aaaa-mm-dd', que exista completo para TODAS as operações)
// e o de abertura daquele ano (o mais recente antes de 1º de janeiro), usado no estoque médio e na geração de caixa.
function indEscolherBalancos(lista, ops, ate) {
  const porData = {};
  (lista || []).filter(r => ops.includes(r.operacao)).forEach(r => { (porData[r.data_base] = porData[r.data_base] || []).push(r); });
  const temTodas = (d, cond) => ops.every(op => porData[d].some(r => r.operacao === op && (!cond || cond(r))));
  const datas = Object.keys(porData).sort();
  const bases = datas.filter(d => temTodas(d, indBalancoCompleto));
  const dataBase = bases.filter(d => d <= ate).pop() || null;
  if (!dataBase) return { dataBase: null, base: null, dataIni: null, ini: null, bases };
  const dataIni = datas.filter(d => d < dataBase.slice(0, 4) + '-01-01' && temTodas(d, r => r.estoque_custo != null)).pop() || null;
  return { dataBase, base: indConsolidar(porData[dataBase]), dataIni, ini: dataIni ? indConsolidar(porData[dataIni]) : null, bases, porData };
}
// Soma meses do DRE: cada item { rb, ded, cv, go, df, ir, cmv, pessoal, grupos: { 'Nome do grupo': valor } }.
function indSomarDre(meses) {
  const s = { rb: 0, ded: 0, cv: 0, go: 0, df: 0, ir: 0, cmv: 0, pessoal: 0, g: {}, n: (meses || []).length };
  (meses || []).forEach(m => {
    ['rb', 'ded', 'cv', 'go', 'df', 'ir', 'cmv', 'pessoal'].forEach(k => { s[k] += +m[k] || 0; });
    Object.entries(m.grupos || {}).forEach(([k, v]) => { s.g[k] = (s.g[k] || 0) + (+v || 0); });
  });
  return s;
}
// Linhas derivadas do DRE (mesmas regras do resto do painel: Resultado = MC − todos os gastos operacionais).
function indDerivar(s) {
  if (!s) return null;
  const opex = s.go - s.df - s.ir, rl = s.rb - s.ded, mc = rl - s.cv;
  return { ...s, opex, rl, mc, mb: rl - s.cmv, ebitda: mc - opex, res: mc - s.go, grupo: k => +(s.g[k] || 0) };
}

// Todas as contas do painel. P = { dre, nMeses, dreB, nMesesB, dreTri, base, ini, hc, vend, ticket, turn }
//   dre    = DRE acumulado de janeiro até o mês do filtro (pilares de resultado)
//   dreB   = DRE acumulado de janeiro até a data-base do balanço (prazos e capital, mesma base do balanço)
//   dreTri = DRE dos 3 meses que terminam na data-base (perdas de crédito ÷ vendas do trimestre)
//   dreVend = DRE só das operações com vendedor (produtividade por vendedor)
function indCalcular(P) {
  const D = indDerivar(P.dre), B = indDerivar(P.dreB), T = indDerivar(P.dreTri);
  const bal = P.base, ini = P.ini, n = P.nMeses || 0;
  const nn = v => v != null && isFinite(v);
  const div = (a, b) => (nn(a) && nn(b) && b !== 0 ? a / b : null);
  const I = {};
  // Pilar 1 / 3 / 5 — só DRE e pessoas (período do filtro)
  if (D) {
    const pessoal = D.g['Despesas de Pessoal'] != null ? D.grupo('Despesas de Pessoal') : D.pessoal;
    Object.assign(I, {
      rb: D.rb, rl: D.rl, mb: D.mb, mc: D.mc, res: D.res, ebitda: D.ebitda, cmv: D.cmv, df: D.df, opex: D.opex,
      rlPct: div(D.rl, D.rb), mbPct: div(D.mb, D.rb), mbPctRl: div(D.mb, D.rl), mcPct: div(D.mc, D.rb), resPct: div(D.res, D.rb),
      ebitdaPct: div(D.ebitda, D.rb), cmvPct: div(D.cmv, D.rb), dfPct: div(D.df, D.rb), opexPct: div(D.opex, D.rb),
      pessoal, folhaPct: div(pessoal, D.rb), folhaComPct: div(pessoal + D.grupo('Comissões Colaboradores'), D.rb),
      // Critério do Aldemar: variáveis = deduções + custos variáveis SEM o CMV; diretas = variáveis + pessoal + ocupação + comerciais.
      despVar: D.ded + D.cv - D.cmv,
      comissoesVenda: D.grupo('Comissão/Taxa Maquininha'), frete: D.grupo('Frete Pago'),
      devolucoes: D.grupo('Devoluções/Cancelamentos'), chargebacks: D.grupo('Chargebacks'),
    });
    const ligadasLoja = pessoal + D.grupo('Despesas de Ocupação') + D.grupo('Despesas Comerciais');
    I.despVarPct = div(I.despVar, D.rb);
    I.diretas = I.despVar + ligadasLoja; I.diretasPct = div(I.diretas, D.rb);
    I.indiretas = D.opex - ligadasLoja; I.indiretasPct = div(I.indiretas, D.rb);
    I.comissoesVendaPct = div(I.comissoesVenda, D.rb); I.fretePct = div(I.frete, D.rb);
    I.devolPct = div(I.devolucoes + I.chargebacks, D.rb);
    // Pessoas: médias MENSAIS do período ÷ quadro atual
    I.hc = P.hc || null; I.vend = P.vend || null;
    I.fatFunc = div(div(D.rb, n), I.hc); I.mcFunc = div(div(D.mc, n), I.hc);
    // Por vendedor: só o DRE das operações que têm vendedor (o e-commerce não tem) — P.dreVend; sem ele, o DRE todo.
    const V = indDerivar(P.dreVend) || D;
    I.fatVend = div(div(V.rb, n), I.vend); I.mcVend = div(div(V.mc, n), I.vend);
  }
  if (P.turn && I.hc) { I.adm = P.turn.adm; I.desl = P.turn.desl; I.turnover = ((P.turn.adm + P.turn.desl) / 2) / I.hc; }
  if (P.ticket && P.ticket.qtd > 0) Object.assign(I, { ticket: P.ticket.fat / P.ticket.qtd, ticketQtd: P.ticket.qtd, ticketDe: P.ticket.de, ticketAte: P.ticket.ate });

  // Pilares de balanço — DRE até a data-base
  if (bal) {
    const dias = (P.nMesesB || 0) * IND_DIAS_MES;
    I.diasB = dias; I.nMesesB = P.nMesesB;
    I.cmvDia = B && dias ? B.cmv / dias : null;
    I.vendaDia = B && dias ? B.rb / dias : null;
    I.est = bal.estoque_custo; I.estVenda = bal.estoque_venda; I.estIni = ini ? ini.estoque_custo : null;
    I.estMedio = nn(I.est) ? (nn(I.estIni) ? (I.est + I.estIni) / 2 : I.est) : null;
    I.pme = div(I.estMedio, I.cmvDia);
    I.pmeAtual = div(I.est, I.cmvDia);
    I.giro = B ? div(B.cmv, I.estMedio) : null; I.giroAno = nn(I.giro) && P.nMesesB ? I.giro * 12 / P.nMesesB : null;
    I.cli = bal.temClientes ? indSomaFaixas(bal.clientes) : null;
    I.forn = bal.temFornecedores ? indSomaFaixas(bal.fornecedores) : null;
    I.pmr = bal.temClientes ? indPrazoMedio(bal.clientes) : null;
    I.pmp = bal.temFornecedores ? indPrazoMedio(bal.fornecedores) : null;
    I.cicloOp = nn(I.pme) && nn(I.pmr) ? I.pme + I.pmr : null;
    I.ciclo = nn(I.cicloOp) && nn(I.pmp) ? I.cicloOp - I.pmp : null;
    I.ncg = nn(I.cli) && nn(I.est) && nn(I.forn) ? I.cli + I.est - I.forn : null;
    I.ncgDias = div(I.ncg, I.vendaDia);
    const cp = bal.emprestimos_cp, lp = bal.emprestimos_lp;
    I.empCp = cp; I.empLp = lp;
    I.emp = cp == null && lp == null ? null : (+cp || 0) + (+lp || 0);
    I.caixa = bal.caixa; I.pl = bal.pl;
    I.passCirc = nn(I.forn) ? I.forn + (+cp || 0) : null;
    I.ativoCirc = nn(I.cli) && nn(I.est) ? I.cli + I.est + (+I.caixa || 0) : null;
    I.liqCorrente = div(I.ativoCirc, I.passCirc);
    I.liqSeca = nn(I.cli) ? div(I.cli + (+I.caixa || 0), I.passCirc) : null;
    I.liqGeral = nn(I.passCirc) ? div(I.ativoCirc, I.passCirc + (+lp || 0)) : null;
    I.terceiros = nn(I.forn) ? I.forn + (I.emp || 0) : null;
    I.terceirosPL = div(I.terceiros, I.pl);
    I.estrutura = nn(I.pl) && nn(I.terceiros) ? div(I.pl, I.pl + I.terceiros) : null;   // % capital próprio
    I.perfilCP = div(I.passCirc, I.terceiros);
    I.empPL = div(I.emp, I.pl);
    I.endivLiq = nn(I.emp) && nn(I.caixa) ? I.emp - I.caixa : null;
    I.financEstoque = div(I.forn, I.est);
    I.gap = nn(I.pme) && nn(I.pmp) ? I.pme - I.pmp : null;
    I.gapRs = nn(I.gap) && nn(I.cmvDia) ? I.gap * I.cmvDia : null;
    I.crescEstoque = nn(I.est) && I.estIni ? I.est / I.estIni - 1 : null;
    I.limite = bal.limite_estoque; I.usoLimite = div(I.est, I.limite);
    I.resB = B ? B.res : null; I.rbB = B ? B.rb : null;
    // Geração de caixa operacional: resultado − aumento do estoque (− aumento de clientes + aumento de fornecedores, quando houver o balanço de abertura completo)
    if (B && nn(I.est) && nn(I.estIni)) {
      I.gerCaixa = B.res - (I.est - I.estIni);
      I.gerCaixaCompleta = !!(ini && ini.temClientes && ini.temFornecedores && nn(I.cli) && nn(I.forn));
      if (I.gerCaixaCompleta) I.gerCaixa += -(I.cli - indSomaFaixas(ini.clientes)) + (I.forn - indSomaFaixas(ini.fornecedores));
    }
    // Crediário
    I.credVencido = bal.credito_vencido; I.credPerdas = bal.credito_perdas; I.credRecup = bal.credito_recuperado;
    I.inadimplencia = div(I.credVencido, I.cli);
    I.perdasPct = T ? div(I.credPerdas, T.rb) : null;
  }
  return I;
}

// Resposta à pergunta-chave do conselho: o estoque está financiando o crescimento ou consumindo caixa?
function indPerguntaChave(I) {
  if (I.gap == null || I.financEstoque == null) return null;
  const d = v => Math.round(v) + ' dias';
  if (I.gap > 0 && I.financEstoque < 1)
    return 'O estoque está <b>consumindo caixa</b>: a mercadoria fica ' + d(I.pme) + ' parada, mas o fornecedor é pago em ' + d(I.pmp) +
      '. Os fornecedores financiam ' + indPct(I.financEstoque) + ' do estoque; o resto (cerca de ' + indBrl(I.gapRs) + ' no gap de prazo) sai do caixa próprio.';
  return 'O estoque está sendo <b>financiado pelos fornecedores</b>: o fornecedor é pago em ' + d(I.pmp) + ' e a mercadoria gira em ' + d(I.pme) + '.';
}

// ── Formatação ──────────────────────────────────────────────────────────────
function indBrl(v) { return v == null || !isFinite(v) ? '—' : (Math.round(v) < 0 ? '-' : '') + 'R$ ' + Math.abs(Math.round(v)).toLocaleString('pt-BR'); }
function indPct(v) { return v == null || !isFinite(v) ? '—' : (v * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%'; }
function indDec(v) { return v == null || !isFinite(v) ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function indDias(v) { return v == null || !isFinite(v) ? '—' : Math.round(v) + ' dias'; }
function indData(iso) { return iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : ''; }

// Monta os 6 pilares: [{ titulo, linhas: [{ l, v, como, falta }] }]. `falta` = texto do que precisa ser lançado.
function indPilares(I, ctx) {
  const c = ctx || {};
  const temBal = I.est != null;
  const fb = 'Falta lançar o balanço';
  const L = (l, v, como, falta) => ({ l, v: falta ? '—' : v, como: falta ? falta : como, falta: !!falta });
  const rs = (v, p) => indBrl(v) + (p != null ? ' (' + indPct(p) + ')' : '');
  const per = c.periodo || 'no período', perB = c.periodoB || 'até a data-base';
  const qtdF = I.hc ? I.hc + ' funcionários (quadro atual)' : null, qtdV = I.vend ? I.vend + ' vendedores (cargo "Vendedor" em Funcionários' + (c.opsVend ? '; só ' + c.opsVend : '') + ')' : null;
  return [
    { titulo: 'Pilar 1 – Comercial & Rentabilidade', linhas: [
      L('Receita Líquida', rs(I.rl, I.rlPct), 'DRE, ' + per + ': faturamento − deduções (taxas, comissões de marketplace, devoluções e impostos)'),
      L('Margem Bruta', rs(I.mb, I.mbPct), 'Receita líquida − CMV. Sobre a receita líquida: ' + indPct(I.mbPctRl)),
      L('Margem de Contribuição', rs(I.mc, I.mcPct), 'Receita líquida − custos variáveis (CMV, frete, comissões, ADS, cashback...)'),
      L('Margem Líquida', rs(I.res, I.resPct), 'Resultado líquido do DRE ÷ faturamento'),
      L('CMV', indPct(I.cmvPct) + ' (' + indBrl(I.cmv) + ')', 'CMV ÷ faturamento'),
      L('Ticket Médio', I.ticket != null ? 'R$ ' + indDec(I.ticket) : '—', I.ticket != null ? 'BI das Lojas: faturamento ÷ nº de vendas, de ' + indData(I.ticketDe) + ' a ' + indData(I.ticketAte) + ' (' + Number(I.ticketQtd).toLocaleString('pt-BR') + ' vendas)' : '', I.ticket == null ? 'Falta o nº de vendas no BI das Lojas para este período' : ''),
      L('Produtividade por Vendedor', indBrl(I.fatVend) + '/mês', 'Faturamento médio por mês ÷ ' + qtdV, I.vend ? '' : 'Falta marcar o cargo "Vendedor" em Funcionários'),
      L('Produtividade por Funcionário', indBrl(I.fatFunc) + '/mês', 'Faturamento médio por mês ÷ ' + qtdF, I.hc ? '' : 'Sem funcionários ativos cadastrados'),
    ] },
    { titulo: 'Pilar 2 – Financeiro & Capital', linhas: [
      L('Geração de Caixa Operacional', (I.gerCaixaCompleta ? '' : 'parcial: ') + indBrl(I.gerCaixa), I.gerCaixaCompleta ? 'Resultado ' + perB + ' − aumento de estoque e clientes + aumento de fornecedores' : 'Resultado ' + perB + ' (' + indBrl(I.resB) + ') − aumento do estoque no ano (' + indBrl(I.est - I.estIni) + '). Para fechar a conta faltam clientes e fornecedores no balanço de abertura', !temBal ? fb : I.gerCaixa == null ? 'Falta o estoque do balanço de abertura do ano' : ''),
      L('NCG', indBrl(I.ncg), 'Clientes + estoque a custo − fornecedores. Equivale a ' + (I.ncgDias != null ? Math.round(I.ncgDias) + ' dias de vendas' : '—'), !temBal ? fb : I.ncg == null ? 'Falta clientes ou fornecedores no balanço' : ''),
      L('EBITDA', rs(I.ebitda, I.ebitdaPct), I.df ? 'Resultado + despesas financeiras + IR/CSLL' : 'Igual ao resultado líquido: o DRE não tem depreciação, juros nem IR separado'),
      L('Endividamento', indBrl(I.emp) + (I.empPL != null ? ' (' + indPct(I.empPL) + ' do PL)' : ''), 'Saldo de empréstimos' + (I.endivLiq != null ? '. Líquido de caixa: ' + indBrl(I.endivLiq) : '. O endividamento líquido precisa do saldo de caixa') + (I.terceirosPL != null ? '. Com fornecedores, terceiros ÷ PL = ' + indPct(I.terceirosPL) : ''), !temBal ? fb : I.emp == null ? 'Falta o saldo de empréstimos no balanço' : ''),
      L('Despesas Financeiras', rs(I.df, I.dfPct), 'DRE, grupo "Despesas Financeiras"'),
      L('Liquidez Corrente', indDec(I.liqCorrente), '(Clientes + estoque' + (I.caixa != null ? ' + caixa' : '') + ') ÷ (fornecedores + empréstimos de curto prazo)' + (I.caixa == null ? '. Sem o caixa, que não foi lançado' : ''), !temBal ? fb : I.liqCorrente == null ? 'Falta clientes ou fornecedores no balanço' : ''),
      L('Liquidez Seca', indDec(I.liqSeca), 'Igual à corrente, sem o estoque', !temBal ? fb : I.liqSeca == null ? 'Falta clientes ou fornecedores no balanço' : ''),
      L('Liquidez Geral', indDec(I.liqGeral), 'Ativo ÷ passivo total (inclui empréstimos de longo prazo)', !temBal ? fb : I.liqGeral == null ? 'Falta clientes ou fornecedores no balanço' : ''),
      L('Estrutura de Capital', I.estrutura != null ? 'Próprio ' + indPct(I.estrutura) + ' x terceiros ' + indPct(1 - I.estrutura) : '—', 'PL ÷ (PL + fornecedores + empréstimos)', !temBal ? fb : I.estrutura == null ? 'Falta o patrimônio líquido no balanço' : ''),
      L('Perfil da Dívida', I.perfilCP != null ? indPct(I.perfilCP) + ' curto prazo' : '—', 'Fornecedores + empréstimos que vencem em até 12 meses ÷ total de terceiros', !temBal ? fb : I.perfilCP == null ? 'Falta fornecedores no balanço' : ''),
    ] },
    { titulo: 'Pilar 3 – Pessoas & Produtividade', linhas: [
      L('Margem de Contribuição por Funcionário', indBrl(I.mcFunc) + '/mês', 'MC média por mês ÷ ' + qtdF, I.hc ? '' : 'Sem funcionários ativos cadastrados'),
      L('Margem de Contribuição por Vendedor', indBrl(I.mcVend) + '/mês', 'MC média por mês ÷ ' + qtdV, I.vend ? '' : 'Falta marcar o cargo "Vendedor" em Funcionários'),
      L('Venda por Vendedor', indBrl(I.fatVend) + '/mês', 'Faturamento médio por mês ÷ ' + qtdV, I.vend ? '' : 'Falta marcar o cargo "Vendedor" em Funcionários'),
      L('Custo da Folha / Vendas', indPct(I.folhaPct), 'DRE, "Despesas de Pessoal" ÷ faturamento. Somando as comissões de colaboradores: ' + indPct(I.folhaComPct)),
      L('Turnover', indPct(I.turnover), I.turnover != null ? '((admissões ' + I.adm + ' + desligamentos ' + I.desl + ') ÷ 2) ÷ quadro atual, ' + (c.periodoTurn || 'no ano') : '', I.turnover == null ? 'O SAFI registra admissões e desligamentos só a partir de set/2026' : ''),
    ] },
    { titulo: 'Pilar 4 – Crédito & Cobrança', linhas: [
      L('Inadimplência da Carteira', indPct(I.inadimplencia) + ' (' + indBrl(I.credVencido) + ')', 'Saldo vencido e não pago ÷ clientes a receber', !temBal ? fb : I.inadimplencia == null ? 'Falta o saldo vencido do crediário no balanço' : ''),
      L('Perdas de Crédito / Vendas', indPct(I.perdasPct) + ' (' + indBrl(I.credPerdas) + ')', 'Valor baixado como perda no trimestre ÷ faturamento do trimestre', !temBal ? fb : I.perdasPct == null ? 'Falta o valor baixado como perda no balanço' : ''),
      L('Recuperação de Perdas', indBrl(I.credRecup), 'Valor recuperado no trimestre', !temBal ? fb : I.credRecup == null ? 'Falta o valor recuperado no balanço' : ''),
      L('Devoluções e Cancelamentos', rs((I.devolucoes || 0) + (I.chargebacks || 0), I.devolPct), 'DRE, devoluções/cancelamentos + chargebacks. No marketplace, é o equivalente à perda de crédito'),
      L('Juros de Mora Recebidos', '—', '', 'Não há linha própria no DRE do SAFI'),
    ] },
    { titulo: 'Pilar 5 – Contábil & Eficiência Operacional', linhas: [
      L('Despesas Operacionais / Vendas', indPct(I.opexPct), 'Gastos operacionais do DRE (sem despesas financeiras e IR) ÷ faturamento'),
      L('Despesas Fixas', rs(I.opex, I.opexPct), 'Todos os gastos operacionais: pessoal, ocupação, comerciais, administrativas e retiradas'),
      L('Despesas Variáveis', rs(I.despVar, I.despVarPct), 'Deduções + custos variáveis SEM o CMV (comissões ' + indPct(I.comissoesVendaPct) + ', frete ' + indPct(I.fretePct) + ', ADS, cashback...)'),
      L('Despesas Diretas', rs(I.diretas, I.diretasPct), 'Ligadas à loja e à venda: variáveis + pessoal + ocupação + comerciais'),
      L('Despesas Indiretas', rs(I.indiretas, I.indiretasPct), 'Estrutura e gestão: administrativas + retiradas dos sócios + demais'),
      L('Ciclo Financeiro', indDias(I.ciclo), 'PME + PMR − PMP (' + indDias(I.pme) + ' + ' + indDias(I.pmr) + ' − ' + indDias(I.pmp) + ')', !temBal ? fb : I.ciclo == null ? 'Falta clientes ou fornecedores no balanço' : ''),
      L('PMR', indDias(I.pmr), 'Prazo médio dos clientes a receber, ponderado pelo valor de cada faixa', !temBal ? fb : I.pmr == null ? 'Falta clientes no balanço' : ''),
      L('Índices de Liquidez (evolução)', c.liqSerie || '—', 'Liquidez corrente em cada balanço lançado', c.liqSerie ? '' : 'Aparece a partir do 2º balanço lançado'),
    ] },
    { titulo: 'Pilar 6 – Estoque, Compras & Capital Empregado', linhas: [
      L('Estoque Total', indBrl(I.est) + ' a custo' + (I.estVenda != null ? ' (' + indBrl(I.estVenda) + ' a preço de venda)' : ''), I.crescEstoque != null ? 'Cresceu ' + indPct(I.crescEstoque) + ' no ano (' + (I.est - I.estIni >= 0 ? '+' : '') + indBrl(I.est - I.estIni) + ')' : 'Balanço da data-base', !temBal ? fb : ''),
      L('Limite de Estoque', indBrl(I.limite) + (I.usoLimite != null ? ' (usando ' + indPct(I.usoLimite) + ')' : ''), 'Limite definido pela diretoria × estoque a custo', !temBal ? fb : I.limite == null ? 'O limite ainda não foi definido' : ''),
      L('Fornecedores a Pagar', indBrl(I.forn), 'Soma das faixas de prazo', !temBal ? fb : I.forn == null ? 'Falta fornecedores no balanço' : ''),
      L('Financiamento do Estoque', indPct(I.financEstoque), 'Fornecedores ÷ estoque a custo', !temBal ? fb : I.financEstoque == null ? 'Falta fornecedores no balanço' : ''),
      L('PME / PMP', indDias(I.pme) + ' / ' + indDias(I.pmp), 'Ver "Prazos e capital de giro"', !temBal ? fb : ''),
      L('Gap PME x PMP', indDias(I.gap) + (I.gapRs != null ? ' (≈ ' + indBrl(I.gapRs) + ')' : ''), 'PME − PMP. Em R$: gap × CMV por dia (o estoque que a empresa financia sozinha)', !temBal ? fb : I.gap == null ? 'Falta fornecedores no balanço' : ''),
      L('Ruptura, Estoque sem Giro, Fora de Linha', '—', '', 'Precisa de relatório de estoque por item (Seta)'),
    ] },
  ];
}

// Etapas do PME, ciclo e NCG (seção "Prazos e capital de giro").
function indEtapas(I) {
  return [
    { titulo: 'PME – Prazo Médio de Estoque', formula: 'Estoque médio a custo ÷ CMV por dia', linhas: [
      ['Estoque inicial a custo (abertura do ano)', indBrl(I.estIni)], ['Estoque atual a custo', indBrl(I.est)],
      ['Estoque médio = (inicial + atual) ÷ 2', indBrl(I.estMedio)], ['CMV até a data-base (DRE)', indBrl(I.cmvDia != null ? I.cmvDia * I.diasB : null)],
      ['CMV por dia = CMV ÷ ' + (I.diasB || '—') + ' dias', indBrl(I.cmvDia)], ['PME', indDias(I.pme), 1]],
      obs: I.pmeAtual != null ? 'Só com o estoque atual, o PME seria de ' + Math.round(I.pmeAtual) + ' dias. Giro: ' + indDec(I.giro) + ' vezes no período (≈ ' + indDec(I.giroAno) + ' ao ano).' : '' },
    { titulo: 'Prazo de giro (ciclo financeiro)', formula: 'PME + PMR − PMP', linhas: [
      ['PME', indDias(I.pme)], ['+ PMR (clientes)', indDias(I.pmr)], ['= Ciclo operacional', indDias(I.cicloOp)], ['− PMP (fornecedores)', indDias(I.pmp)], ['= Ciclo financeiro', indDias(I.ciclo), 1]] },
    { titulo: 'NCG – Necessidade de Capital de Giro', formula: 'Clientes + estoque a custo − fornecedores', linhas: [
      ['Clientes a receber', indBrl(I.cli)], ['+ Estoque atual a custo', indBrl(I.est)], ['− Fornecedores', indBrl(I.forn)], ['= NCG', indBrl(I.ncg), 1]],
      obs: I.ncgDias != null ? 'Equivale a cerca de ' + Math.round(I.ncgDias) + ' dias de vendas.' : '' },
  ];
}

// Cartões do resumo (topo do bloco).
function indResumo(I) {
  return [
    { l: 'PME', v: indDias(I.pme), s: 'prazo médio de estoque' },
    { l: 'Ciclo financeiro', v: indDias(I.ciclo), s: 'PME + PMR − PMP' },
    { l: 'NCG', v: indBrl(I.ncg), s: 'capital de giro necessário' },
    { l: 'Margem de contribuição', v: indPct(I.mcPct), s: 'do faturamento' },
    { l: 'Margem líquida', v: indPct(I.resPct), s: 'do faturamento' },
    { l: 'Estoque financiado por fornecedores', v: indPct(I.financEstoque), s: 'fornecedores ÷ estoque' },
    { l: 'Gap PME x PMP', v: indDias(I.gap), s: I.gapRs != null ? '≈ ' + indBrl(I.gapRs) + ' financiados pela empresa' : '' },
  ];
}

// ── Integração com a página ────────────────────────────────────────────────
let indBalancos = [];          // linhas de conselho_balanco
let indGruposPorChave = {};    // "op|ano|mes" -> { 'Nome do grupo': valor }
let indVendPorOp = {};         // op -> nº de vendedores ativos
let indBi = [];                // bi_kpi_diario (faturamento e nº de vendas por dia)
let indPodeEditar = false;     // só admin lança balanço
let indUltimo = null;          // último cálculo (usado no PDF)

async function indCarregar(y) {
  const [gr, bal, vd, bi] = await Promise.all([
    sb.rpc('conselho_metricas_grupos', { p_de: ym(y - 2, 1), p_ate: ym(y + 1, 12) }).then(r => r, () => ({ data: [] })),
    sb.from('conselho_balanco').select('*').order('data_base').then(r => r, () => ({ data: [] })),
    sb.rpc('funcionarios_vendedores_atual').then(r => r, () => ({ data: [] })),
    sb.from('bi_kpi_diario').select('operacao,data,faturamento,qtd_vendas').gte('data', (y - 1) + '-01-01').then(r => r, () => ({ data: [] })),
  ]);
  indGruposPorChave = {};
  (gr.data || []).forEach(r => { const k = r.operacao + '|' + r.ano + '|' + r.mes; (indGruposPorChave[k] = indGruposPorChave[k] || {})[r.campo] = (indGruposPorChave[k][r.campo] || 0) + (+r.valor || 0); });
  indBalancos = bal.data || [];
  indVendPorOp = {}; (vd.data || []).forEach(r => { indVendPorOp[r.operacao] = r.vendedores; });
  indBi = bi.data || [];
}

// Meses do DRE de `ano` entre mesDe e mesAte, somando as operações.
function indMesesDre(ops, ano, mesDe, mesAte) {
  const out = [];
  for (let m = mesDe; m <= mesAte; m++) {
    let tem = false; const acc = { rb: 0, ded: 0, cv: 0, go: 0, df: 0, ir: 0, cmv: 0, pessoal: 0, grupos: {} };
    ops.forEach(op => {
      const k = op + '|' + ano + '|' + m, r = porChave[k]; if (!r) return;
      const d = detalhePorChave[k] || {};
      acc.rb += +r.receita_bruta; acc.ded += +r.deducoes; acc.cv += +r.custos_variaveis; acc.go += +r.gastos_operacionais;
      acc.df += +r.desp_financeiras; acc.ir += +r.ir_csll; acc.cmv += +d.cmv || 0; acc.pessoal += +d.pessoal || 0;
      Object.entries(indGruposPorChave[k] || {}).forEach(([c, v]) => { acc.grupos[c] = (acc.grupos[c] || 0) + v; });
      if (+r.receita_bruta || +r.custos_variaveis || +r.gastos_operacionais) tem = true;
    });
    if (tem) out.push(acc);
  }
  return out;
}

function indMontar(ops, ano, mes) {
  const fimMes = ano + '-' + String(mes).padStart(2, '0') + '-' + String(new Date(ano, mes, 0).getDate()).padStart(2, '0');
  const esc_ = indEscolherBalancos(indBalancos, ops, fimMes);
  const dreMeses = indMesesDre(ops, ano, 1, mes);
  const P = { dre: indSomarDre(dreMeses), nMeses: mes };
  if (esc_.dataBase) {
    const aB = +esc_.dataBase.slice(0, 4), mB = +esc_.dataBase.slice(5, 7);
    P.dreB = indSomarDre(indMesesDre(ops, aB, 1, mB)); P.nMesesB = mB;
    P.dreTri = indSomarDre(indMesesDre(ops, aB, Math.max(1, mB - 2), mB));
    P.base = esc_.base; P.ini = esc_.ini;
  }
  P.hc = ops.reduce((a, op) => a + (headcountPorOp[op] || 0), 0);
  P.vend = ops.reduce((a, op) => a + (indVendPorOp[op] || 0), 0);
  const opsVend = ops.filter(op => indVendPorOp[op] > 0);
  if (opsVend.length && opsVend.length < ops.length) P.dreVend = indSomarDre(indMesesDre(opsVend, ano, 1, mes));
  let adm = 0, desl = 0, temT = false;
  for (let m = 1; m <= mes; m++) {
    if (ym(ano, m) < TURNOVER_DESDE) continue;
    ops.forEach(op => { const r = turnoverPorChave[op + '|' + ano + '|' + m]; if (r) { adm += r.admissoes; desl += r.desligamentos; } });
    temT = true;
  }
  if (temT) P.turn = { adm, desl };
  const bi = indBi.filter(r => ops.includes(r.operacao) && r.data >= ano + '-01-01' && r.data <= fimMes && +r.qtd_vendas > 0);
  if (bi.length) {
    const ds = bi.map(r => r.data).sort();
    P.ticket = { fat: bi.reduce((a, r) => a + (+r.faturamento || 0), 0), qtd: bi.reduce((a, r) => a + (+r.qtd_vendas || 0), 0), de: ds[0], ate: ds[ds.length - 1] };
  }
  const I = indCalcular(P);
  // Evolução da liquidez corrente nos balanços lançados até o mês
  const serie = esc_.bases.filter(d => d <= fimMes).map(d => {
    const b = indConsolidar(esc_.porData[d]); const cli = indSomaFaixas(b.clientes), forn = indSomaFaixas(b.fornecedores);
    const pc = forn + (+b.emprestimos_cp || 0); return pc ? indData(d) + ': ' + indDec((cli + (+b.estoque_custo || 0) + (+b.caixa || 0)) / pc) : null;
  }).filter(Boolean);
  const periodo = 'jan–' + MES_CURTO[mes - 1].toLowerCase() + '/' + ano;
  const ctx = {
    periodo, periodoB: esc_.dataBase ? 'jan–' + MES_CURTO[+esc_.dataBase.slice(5, 7) - 1].toLowerCase() + '/' + esc_.dataBase.slice(0, 4) : '',
    periodoTurn: (ym(ano, 1) < TURNOVER_DESDE ? MES_CURTO[(TURNOVER_DESDE % 100) - 1].toLowerCase() : 'jan') + '–' + MES_CURTO[mes - 1].toLowerCase() + '/' + ano,
    liqSerie: serie.length > 1 ? serie.join(' · ') : '',
    opsVend: P.dreVend ? opsVend.map(o => OP_NOME[o] || o).join(' + ') : '',
  };
  const opsSemBal = ops.filter(op => !indBalancos.some(r => r.operacao === op && indBalancoCompleto(r) && r.data_base <= fimMes));
  return { I, ctx, dataBase: esc_.dataBase, dataIni: esc_.dataIni, periodo, opsSemBal, ops, ano, mes };
}

function renderIndicadores(ops, ano, mes) {
  const R = indMontar(ops, ano, mes); indUltimo = R;
  const I = R.I;
  g('ind-periodo').textContent = 'DRE ' + R.periodo + (R.dataBase ? ' · Balanço de ' + indData(R.dataBase) : ' · sem balanço lançado');
  g('ind-btn-bal').style.display = indPodeEditar ? '' : 'none';
  let aviso = '';
  if (!R.dataBase) aviso = R.opsSemBal.length && R.opsSemBal.length < ops.length
    ? 'Falta o balanço de ' + esc(R.opsSemBal.map(o => OP_NOME[o] || o).join(' + ')) + ' para mostrar prazos e capital do conjunto. Escolha uma operação ou lance o balanço.'
    : 'Nenhum balanço lançado até este mês: prazos, NCG, liquidez e estoque aparecem quando o balanço da data-base for lançado.';
  else if (R.dataBase.slice(0, 7) !== ano + '-' + String(mes).padStart(2, '0'))
    aviso = 'Prazos, capital e estoque usam o balanço de <b>' + indData(R.dataBase) + '</b> (o último lançado) e o DRE de janeiro até essa data. Os demais indicadores usam o DRE de ' + R.periodo + '.';
  const pk = indPerguntaChave(I);
  let h = (aviso ? '<div class="ind-aviso">' + aviso + '</div>' : '') +
    '<div class="ind-resumo">' + indResumo(I).map(k => '<div class="ind-card"><div class="kpi-l">' + k.l + '</div><div class="ind-v">' + k.v + '</div><div class="ind-s">' + (k.s || '') + '</div></div>').join('') + '</div>' +
    (pk ? '<div class="ind-chave"><span>O estoque está financiando o crescimento ou consumindo caixa?</span> ' + pk + '</div>' : '');
  if (R.dataBase) {
    h += '<div class="ind-sec">Prazos e capital de giro <span>(balanço de ' + indData(R.dataBase) + ', DRE ' + esc(R.ctx.periodoB) + ', ' + I.diasB + ' dias)</span></div><div class="ind-etapas">' +
      indEtapas(I).map(e => '<div class="ind-etapa"><div class="ind-et-t">' + e.titulo + '</div><div class="ind-et-f">' + e.formula + '</div><table class="ind-tbl">' +
        e.linhas.map(l => '<tr' + (l[2] ? ' class="tot"' : '') + '><td>' + l[0] + '</td><td class="r">' + l[1] + '</td></tr>').join('') + '</table>' + (e.obs ? '<div class="ind-et-o">' + e.obs + '</div>' : '') + '</div>').join('') + '</div>';
  }
  h += indPilares(I, R.ctx).map(p => '<div class="ind-sec">' + p.titulo + '</div><div class="table-scroll" style="max-height:none"><table class="tbl ind-pilar"><thead><tr><th>Indicador</th><th class="r">Resultado</th><th>Como foi calculado</th></tr></thead><tbody>' +
    p.linhas.map(l => '<tr><td>' + l.l + '</td><td class="num' + (l.falta ? ' muted' : '') + '">' + l.v + '</td><td class="' + (l.falta ? 'ind-falta' : 'ind-como') + '">' + l.como + '</td></tr>').join('') + '</tbody></table></div>').join('');
  g('ind-corpo').innerHTML = h;
}

// Blocos do PDF (opção "Indicadores do conselho").
function indBlocosPdf(nomeOps) {
  const R = indUltimo; if (!R) return [];
  const I = R.I, blocos = [];
  blocos.push({ tipo: 'kpis', opcao: 'indicadores', titulo: 'Indicadores do conselho - DRE ' + R.periodo + (R.dataBase ? ', balanço de ' + indData(R.dataBase) : '') + ' (' + nomeOps + ')',
    itens: indResumo(I).map(k => ({ l: k.l, v: k.v, linhas: k.s ? [{ t: k.s }] : [] })) });
  const pk = indPerguntaChave(I);
  if (pk) blocos.push({ tipo: 'nota', opcao: 'indicadores', texto: 'O estoque está financiando o crescimento ou consumindo caixa? ' + pk.replace(/<\/?b>/g, '') });
  if (R.dataBase) indEtapas(I).forEach(e => blocos.push({ tipo: 'tabela', opcao: 'indicadores', titulo: e.titulo + ' (' + e.formula + ')',
    colunas: [{ h: 'Etapa', larg: 3 }, { h: 'Valor', al: 'right', larg: 1.2 }], linhas: e.linhas.map(l => ({ k: l[2] ? 'T' : '', c: [l[0], l[1]] })) }));
  indPilares(I, R.ctx).forEach(p => blocos.push({ tipo: 'tabela', opcao: 'indicadores', titulo: p.titulo,
    colunas: [{ h: 'Indicador', larg: 1.6 }, { h: 'Resultado', al: 'right', larg: 1.3 }, { h: 'Como foi calculado', larg: 3.2 }],
    linhas: p.linhas.map(l => ({ c: [l.l, l.v, l.como] })) }));
  return blocos;
}

// ── Lançamento do balanço (admin) ──────────────────────────────────────────
const IND_FORM = [
  ['estoque_custo', 'Estoque a custo'], ['estoque_venda', 'Estoque a preço de venda'],
  ['emprestimos_cp', 'Empréstimos de curto prazo (até 12 meses)'], ['emprestimos_lp', 'Empréstimos de longo prazo'],
  ['caixa', 'Caixa, bancos e saldos a liberar'], ['pl', 'Patrimônio líquido'], ['limite_estoque', 'Limite de estoque (diretoria)'],
  ['credito_vencido', 'Crediário: saldo vencido e não pago'], ['credito_perdas', 'Crediário: baixado como perda no trimestre'], ['credito_recuperado', 'Crediário: recuperado no trimestre'],
];
function indFaixaHtml(tipo, f) {
  return '<div class="ind-faixa" data-tipo="' + tipo + '"><input type="number" min="0" step="1" class="fe-select ind-f-dias" placeholder="dias" value="' + (f && f.dias != null ? f.dias : '') + '" aria-label="Prazo em dias">' +
    '<input inputmode="decimal" class="fe-select ind-f-valor" placeholder="valor" value="' + (f && f.valor != null ? numberToMoneyMasked(+f.valor) : '') + '" aria-label="Valor"><button type="button" class="btn-ghost ind-f-del" title="Remover">×</button></div>';
}
function indBalAbrir() {
  const ov = g('ind-modal');
  const opSel = g('sel-op').value;
  g('ind-b-op').innerHTML = opsVisiveis.map(op => '<option value="' + op + '"' + (op === opSel ? ' selected' : '') + '>' + OP_NOME[op] + '</option>').join('');
  const [a, m] = g('sel-mes').value.split('-').map(Number);
  const tri = Math.floor((m - 1) / 3) * 3; const ref = tri === 0 ? { a: a - 1, m: 12 } : { a, m: tri };
  g('ind-b-data').value = ref.a + '-' + String(ref.m).padStart(2, '0') + '-' + String(new Date(ref.a, ref.m, 0).getDate()).padStart(2, '0');
  indBalPreencher();
  ov.classList.add('open');
}
function indBalPreencher() {
  const op = g('ind-b-op').value, d = g('ind-b-data').value;
  const r = indBalancos.find(x => x.operacao === op && x.data_base === d) || {};
  IND_FORM.forEach(([k]) => { const el = g('ind-b-' + k); el.value = r[k] != null ? numberToMoneyMasked(+r[k]) : ''; });
  ['clientes', 'fornecedores'].forEach(t => { const fs = (r[t] || []).length ? r[t] : [{}]; g('ind-b-' + t).innerHTML = fs.map(f => indFaixaHtml(t, f)).join(''); g('ind-b-' + t).querySelectorAll('.ind-f-valor').forEach(el => attachMoneyMask(el)); });
  g('ind-b-obs').value = r.obs || '';
  g('ind-b-del').style.display = r.id ? '' : 'none';
  g('ind-b-status').textContent = r.id ? 'Balanço já lançado — editando.' : 'Balanço novo.';
}
function indLerFaixas(t) {
  return [...g('ind-b-' + t).querySelectorAll('.ind-faixa')].map(el => ({ dias: el.querySelector('.ind-f-dias').value, valor: moneyToNumber(el.querySelector('.ind-f-valor').value) }))
    .filter(f => f.valor > 0).map(f => ({ dias: Math.max(0, Math.round(+f.dias || 0)), valor: f.valor }));
}
async function indBalSalvar() {
  const linha = { operacao: g('ind-b-op').value, data_base: g('ind-b-data').value, obs: g('ind-b-obs').value.trim() || null,
    clientes: indLerFaixas('clientes'), fornecedores: indLerFaixas('fornecedores'), atualizado_em: new Date().toISOString() };
  if (!linha.data_base) return indToast('Informe a data-base.', 'red');
  IND_FORM.forEach(([k]) => { const v = g('ind-b-' + k).value.trim(); linha[k] = v === '' ? null : moneyToNumber(v); });
  const { error } = await sb.from('conselho_balanco').upsert(linha, { onConflict: 'operacao,data_base' });
  if (error) return indToast('Erro ao salvar: ' + error.message, 'red');
  await indRecarregarBalancos(); g('ind-modal').classList.remove('open'); indToast('Balanço salvo.', 'green'); render();
}
async function indBalExcluir() {
  const op = g('ind-b-op').value, d = g('ind-b-data').value;
  if (!confirm('Excluir o balanço de ' + (OP_NOME[op] || op) + ' em ' + indData(d) + '?')) return;
  const { error } = await sb.from('conselho_balanco').delete().eq('operacao', op).eq('data_base', d);
  if (error) return indToast('Erro ao excluir: ' + error.message, 'red');
  await indRecarregarBalancos(); g('ind-modal').classList.remove('open'); indToast('Balanço excluído.', 'green'); render();
}
async function indRecarregarBalancos() { const { data } = await sb.from('conselho_balanco').select('*').order('data_base'); indBalancos = data || []; }
function indToast(msg, cor) {
  const t = g('toast'); if (!t) return alert(msg);
  g('toast-msg').textContent = msg; g('toast-dot').className = 'toast-dot ' + (cor || 'green');
  t.classList.add('visible'); clearTimeout(indToast._t); indToast._t = setTimeout(() => t.classList.remove('visible'), 3200);
}
function indLigarModal() {
  g('ind-btn-bal').addEventListener('click', indBalAbrir);
  g('ind-b-op').addEventListener('change', indBalPreencher);
  g('ind-b-data').addEventListener('change', indBalPreencher);
  g('ind-b-cancel').addEventListener('click', () => g('ind-modal').classList.remove('open'));
  g('ind-b-save').addEventListener('click', indBalSalvar);
  g('ind-b-del').addEventListener('click', indBalExcluir);
  ['clientes', 'fornecedores'].forEach(t => {
    g('ind-b-add-' + t).addEventListener('click', () => { g('ind-b-' + t).insertAdjacentHTML('beforeend', indFaixaHtml(t, {})); const els = g('ind-b-' + t).querySelectorAll('.ind-f-valor'); attachMoneyMask(els[els.length - 1]); });
    g('ind-b-' + t).addEventListener('click', e => { const b = e.target.closest('.ind-f-del'); if (b) b.closest('.ind-faixa').remove(); });
  });
  IND_FORM.forEach(([k]) => attachMoneyMask(g('ind-b-' + k)));
}
