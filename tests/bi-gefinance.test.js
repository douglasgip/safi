'use strict';
// Robô do GeFinance (e-commerce / GIP) → BI das Lojas (26/11/2026).
// O GeFinance não tem API pública conhecida; o robô abre o painel de Margem num Edge escondido (perfil próprio),
// aplica "Últimos 5 dias" e lê a resposta que o próprio site recebe (dia a dia: faturamento, margem bruta, vendas).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const { ler, caminho } = require('./helpers/carregar');

const py = () => ler('scripts/gefinance_robo.py');
const fn = (src, nome) => {
  const m = src.match(new RegExp('def ' + nome + '\\([\\s\\S]*?\\r?\\n\\r?\\n\\r?\\n'));
  assert.ok(m, 'função ' + nome + ' não encontrada');
  return m[0];
};

test('GeFinance: robô existe e usa o Edge já instalado, escondido, com perfil próprio na pasta do robô', () => {
  assert.ok(fs.existsSync(caminho('scripts/gefinance_robo.py')));
  const b = fn(py(), 'buscar');
  assert.match(b, /channel='msedge'/);
  assert.match(b, /headless=not visivel/);
  assert.match(py(), /PERFIL = os\.path\.join\(base\.PASTA, 'gefinance-perfil'\)/);
  assert.match(py(), /URL_MARGEM = 'https:\/\/app\.ge\.finance\/minha-conta\/dashboard\/margem'/);
});

test('GeFinance (26/11): atualiza o MÊS INTEIRO todo dia (o GeFinance vai baixando a margem dos dias passados); nos 5 primeiros dias, desde o mês anterior', () => {
  const per = fn(py(), 'periodo_de_busca');
  assert.match(per, /hoje\.day <= 5/);
  assert.match(per, /hoje - timedelta\(days=1\)/, 'vai até ontem');
  const b = fn(py(), 'buscar');
  assert.doesNotMatch(b, /Últimos 5 dias/);
  assert.match(b, /periodo_de_busca\(/);
  assert.match(b, /expect_response\(/);
  assert.match(b, /dashboard-kpis\/margin/);
  assert.match(b, /firstDate=%s&endDate=%s/, 'confere que o GeFinance filtrou exatamente o período pedido antes de usar');
});

test('GeFinance: dia a dia = faturamento total, margem de lucro bruto e vendas; só dias fechados; operação GIP', () => {
  const f = fn(py(), 'linhas_do_gefinance');
  for (const s of ["'revenueVersusMargin'", "'revenue'", "'contributionMargin'", "'salesQuantity'", "'operacao': 'GIP'"]) assert.ok(f.includes(s), 'falta ' + s);
  assert.match(f, />= hoje\.isoformat\(\)/, 'o dia de hoje (ainda aberto) não vai');
  assert.match(f, /round\(fat \/ vendas, 2\) if vendas else None/, 'ticket = faturamento ÷ vendas');
});

test('GeFinance: login só com o e-mail/senha que o Douglas põe no config.ini ([gefinance]) — nada escrito no código', () => {
  const e = fn(py(), 'entrar_se_preciso');
  assert.match(e, /cfg\.get\('gefinance', 'email'/);
  assert.match(e, /cfg\.get\('gefinance', 'senha'/);
  assert.doesNotMatch(py(), /@gmail|@topfinds|senha\s*=\s*'[^']/i);
});

test('GeFinance: manda ao SAFI como "linhas" (o bi-importar já aceita GIP) e roda uma vez por dia antes do Seta', () => {
  const seta = ler('scripts/seta_robo.py');
  assert.match(fn(py(), 'rodar_gefinance'), /base\.enviar\(cfg, linhas=linhas/);
  assert.match(fn(seta, 'enviar'), /"linhas": linhas/);
  const ag = fn(seta, 'agendado');
  // 26/11: com a barra de progresso, o GeFinance roda ENTRE as lojas e o envio (Exposição -> Via -> E-commerce -> Enviando);
  // sem Seta para rodar agora (lojas em dia, tela bloqueada, Seta aberto, adiado), roda sozinho — não precisa da tela.
  assert.match(ag, /rodar\(cfg, antes_de_enviar=lambda: gefinance_do_dia\(cfg\)\)/);
  assert.match(ag, /tela bloqueada[\s\S]*?gefinance_do_dia\(cfg\)[\s\S]*?return 0/);
  assert.match(ag, /if gefinance_do_dia\(cfg\) and not tela_bloqueada\(\)/);
  const rodar = fn(seta, 'rodar');
  assert.ok(rodar.indexOf('antes_de_enviar()') > 0 && rodar.indexOf('antes_de_enviar()') < rodar.indexOf('r = enviar('), 'GeFinance antes do envio das lojas');
  const dia = fn(seta, 'gefinance_do_dia');
  assert.match(dia, /except Exception/, 'erro no GeFinance não pode atrapalhar o Seta');
  assert.match(dia, /est\.get\('GeFinance'\) == hoje/, 'uma vez por dia');
});

test('GeFinance: o aviso de "pronto" mostra o e-commerce junto com as lojas', () => {
  const t = fn(ler('scripts/seta_robo.py'), 'aviso_pronto');
  assert.match(t, /'GIP': 'E-commerce'/);
});
