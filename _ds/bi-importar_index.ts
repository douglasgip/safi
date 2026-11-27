// Edge Function: bi-importar — porta de entrada do REALIZADO do BI das Lojas.
// Quem chama: a automação em Python que roda no PC do Douglas (lê o Seta e, depois, o e-commerce).
// Autenticação: Authorization: Bearer <BI_IMPORT_TOKEN> (secret no Supabase; o mesmo valor fica no PC do Douglas).
// Implantar com verify_jwt = false (o token é próprio, não é login do Supabase).
//
// POST { "linhas": [ { "operacao": "Exposicao", "data": "2026-11-16", "faturamento": 24330.78,
//                      "margem": 11213.7, "ticket_medio": 190.08, "pecas_atendimento": 4.04, "qtd_vendas": 128, "pecas": 517 } ] }
// ("pecas" é opcional: peças vendidas no dia, para a meta de peças; sem ele, as peças já gravadas ficam.)
// Cada linha é um dia de uma operação; reenviar o mesmo dia SUBSTITUI o anterior (não duplica).
// Ou POST { "planilhas": [ { operacao, data, resumo: [...], listagem: [...] } ], "ensaio"?: true } — o robô do Seta
// (scripts/seta_robo.py) manda as planilhas cruas e as contas são feitas aqui (ver kpiDasPlanilhas). Ensaio não grava.
// Resposta: { ok, recebidas, gravadas, erros: [{ linha, motivo }] } — linhas com erro não impedem as boas.
// Situação do robô (aviso de dado atrasado no BI, 27/11/2026): junto ou sozinho, "situacao": { "Exposicao":
// { "conferido_ate": "2026-11-26" }, "GIP": { "erro": "não consegui ler o GeFinance" } } — até que dia ele conferiu
// cada operação (com ou sem venda) ou o erro da última tentativa. Fica em bi_atualizacao (o BI mostra no topo).
// POST { "consulta": true } devolve bi_atualizacao (o alerta das 10h no WhatsApp do Douglas usa).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.4'

const LIMITE_LINHAS = 1000

// Comparação de token em tempo constante (não vaza, pelo tempo de resposta, quantos caracteres batem).
function tokensIguais(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false
  let d = 0
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return d === 0
}

// Nome da operação → código do SAFI. Aceita o código e os nomes usuais (sem acento, sem diferenciar maiúsculas).
// "EP" NÃO é aceito de propósito: no DRE, EP é parte do GIP, e aqui confundiria com a Exposição Paulista.
const OPERACOES: Record<string, string> = {
  exposicao: 'Exposicao', 'exposicao paulista': 'Exposicao',
  viacloset: 'ViaCloset', 'via closet': 'ViaCloset',
  gip: 'GIP', 'gip ecommerce': 'GIP', ecommerce: 'GIP', 'e-commerce': 'GIP',
}
function normalizarOperacao(v: unknown): string | null {
  const k = String(v ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLowerCase().replace(/\s+/g, ' ')
  return OPERACOES[k] || null
}

// Número opcional: vazio/null → null; texto com ponto decimal ou número → número; qualquer outra coisa → NaN (erro).
function numero(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(String(v).trim())
  return Number.isFinite(n) ? n : NaN
}

// Valida e normaliza uma linha. `hoje` (aaaa-mm-dd) evita gravar dia que ainda não aconteceu.
function validarLinha(l: any, hoje: string): { ok: true; linha: Record<string, unknown> } | { ok: false; motivo: string } {
  if (!l || typeof l !== 'object') return { ok: false, motivo: 'linha vazia' }
  const operacao = normalizarOperacao(l.operacao)
  if (!operacao) return { ok: false, motivo: 'operação desconhecida: ' + JSON.stringify(l.operacao ?? null) + ' (use Exposicao, ViaCloset ou GIP)' }
  const data = String(l.data ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || isNaN(Date.parse(data + 'T12:00:00Z')) || new Date(data + 'T12:00:00Z').toISOString().slice(0, 10) !== data)
    return { ok: false, motivo: 'data inválida: ' + JSON.stringify(l.data ?? null) + ' (use aaaa-mm-dd)' }
  if (data > hoje) return { ok: false, motivo: 'data no futuro: ' + data }
  const campos = ['faturamento', 'margem', 'ticket_medio', 'pecas_atendimento', 'qtd_vendas'] as const
  const out: Record<string, unknown> = { operacao, data, fonte: 'automacao' }
  for (const c of campos) {
    const n = numero(l[c])
    if (Number.isNaN(n)) return { ok: false, motivo: c + ' não é número: ' + JSON.stringify(l[c]) }
    if (n !== null && n < 0 && c !== 'margem') return { ok: false, motivo: c + ' negativo' }
    out[c] = n
  }
  if (out.faturamento === null) return { ok: false, motivo: 'faturamento é obrigatório' }
  // Peças vendidas no dia (meta de peças). Opcional: quando não vem, a linha nem leva o campo e as peças já
  // gravadas continuam (o upsert só mexe nas colunas enviadas).
  const pecas = numero(l.pecas)
  if (Number.isNaN(pecas)) return { ok: false, motivo: 'pecas não é número: ' + JSON.stringify(l.pecas) }
  if (pecas !== null) {
    if (pecas < 0) return { ok: false, motivo: 'pecas negativo' }
    if (!Number.isInteger(pecas)) return { ok: false, motivo: 'pecas tem que ser inteiro' }
    out.pecas = pecas
  }
  return { ok: true, linha: out }
}

// Separa as linhas boas das com erro; a última ocorrência de um mesmo dia/operação vale (sem duplicar no envio).
function prepararLote(linhas: unknown[], hoje: string) {
  const boas = new Map<string, Record<string, unknown>>(), erros: { linha: number; motivo: string }[] = []
  linhas.forEach((l, i) => {
    const r = validarLinha(l, hoje)
    if (r.ok) boas.set(r.linha.operacao + '|' + r.linha.data, r.linha)
    else erros.push({ linha: i + 1, motivo: r.motivo })
  })
  return { boas: [...boas.values()], erros }
}

// Valida a situação mandada pelo robô: operação conhecida, data aaaa-mm-dd que não seja futura, erro até 300 letras.
function normalizarSituacao(sit: unknown, hoje: string) {
  const itens: Record<string, unknown>[] = [], erros: string[] = []
  if (!sit || typeof sit !== 'object') return { itens, erros }
  for (const [nome, v] of Object.entries(sit as Record<string, any>)) {
    const operacao = normalizarOperacao(nome)
    if (!operacao) { erros.push('situação: operação desconhecida ' + JSON.stringify(nome)); continue }
    const it: Record<string, unknown> = { operacao }
    const d = String(v?.conferido_ate ?? '')
    if (/^\d{4}-\d{2}-\d{2}$/.test(d) && d <= hoje) it.conferido_ate = d
    if (v?.erro) it.erro = String(v.erro).slice(0, 300)
    if (it.conferido_ate || it.erro) itens.push(it)
  }
  return { itens, erros }
}

// ---------- Planilhas do Seta (robô do PC do Douglas) ----------
// O robô só exporta, de cada loja e dia, o "01 - Resumo das Vendas" e a "02 - Listagem das Vendas" em Excel e
// manda as linhas cruas: resumo [{ quantidade, total, lucro, frete }] e listagem [{ codigo, data, total }].
// As contas e a conferência ficam aqui (testadas em tests/bi-seta.test.js):
//   faturamento = Σ total do resumo · margem = Σ lucro − Σ frete (o Seta não conta frete na lucratividade)
//   vendas = nº de vendas diferentes com total > 0 na listagem (venda dividida entre vendedoras aparece em
//   várias linhas; devolução/troca vem negativa e não conta) · ticket = fat ÷ vendas · P.A = peças ÷ vendas.
// Conferência: toda linha da listagem tem que ser do dia pedido e o total da listagem tem que bater com o do resumo.

const MESES_EN: Record<string, string> = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' }

// "17-Nov-26" (como o Seta exporta), "17/11/2026" ou "2026-11-17" → "2026-11-17"; o resto → null.
function dataDoSeta(v: unknown): string | null {
  const s = String(v ?? '').trim()
  let m = /^(\d{1,2})-([A-Za-z]{3})-(\d{2})$/.exec(s)
  if (m && MESES_EN[m[2].toLowerCase()]) return '20' + m[3] + '-' + MESES_EN[m[2].toLowerCase()] + '-' + m[1].padStart(2, '0')
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s)
  if (m) return m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0')
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null
}

const r2 = (n: number) => Math.round(n * 100) / 100
const brl = (n: number) => n.toFixed(2).replace('.', ',')

function kpiDasPlanilhas(p: any, hoje: string): { ok: true; linha: Record<string, unknown> } | { ok: false; motivo: string; semVendas?: boolean } {
  if (!p || typeof p !== 'object') return { ok: false, motivo: 'planilha vazia' }
  const resumo = Array.isArray(p.resumo) ? p.resumo : null, listagem = Array.isArray(p.listagem) ? p.listagem : null
  if (!resumo || !listagem) return { ok: false, motivo: 'faltou o resumo ou a listagem' }
  if (!resumo.length && !listagem.length) return { ok: false, semVendas: true, motivo: 'sem vendas no dia ' + p.data }
  const soma = (arr: any[], c: string) => arr.reduce((a, l) => a + (Number(l?.[c]) || 0), 0)
  for (const l of listagem) {
    const d = dataDoSeta(l?.data)
    if (d !== p.data) return { ok: false, motivo: 'a listagem tem venda de outro dia (' + (l?.data ?? '?') + '): o filtro de data não pegou' }
  }
  const fat = r2(soma(resumo, 'total')), totLista = r2(soma(listagem, 'total'))
  if (Math.abs(fat - totLista) > 0.05) return { ok: false, motivo: 'resumo (R$ ' + brl(fat) + ') e listagem (R$ ' + brl(totLista) + ') não batem' }
  const vendas = new Set(listagem.filter((l: any) => Number(l?.total) > 0).map((l: any) => String(l.codigo))).size
  const pecas = soma(resumo, 'quantidade')
  return validarLinha({
    operacao: p.operacao, data: p.data, faturamento: fat, margem: r2(soma(resumo, 'lucro') - soma(resumo, 'frete')),
    ticket_medio: vendas ? r2(fat / vendas) : null, pecas_atendimento: vendas ? r2(pecas / vendas) : null, qtd_vendas: vendas,
    pecas: Math.round(pecas),
  }, hoje)
}

function prepararPlanilhas(planilhas: unknown[], hoje: string) {
  const boas = new Map<string, Record<string, unknown>>(), erros: { linha: number; motivo: string }[] = [], semVendas: string[] = []
  planilhas.forEach((p: any, i) => {
    const r = kpiDasPlanilhas(p, hoje)
    if (r.ok) boas.set(r.linha.operacao + '|' + r.linha.data, r.linha)
    else if (r.semVendas) semVendas.push(String(p?.operacao) + ' ' + String(p?.data))
    else erros.push({ linha: i + 1, motivo: String(p?.operacao ?? '?') + ' ' + String(p?.data ?? '?') + ': ' + r.motivo })
  })
  return { boas: [...boas.values()], erros, semVendas }
}

Deno.serve(async (req: Request) => {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  if (req.method !== 'POST') return json({ ok: false, erro: 'Use POST.' }, 405)

  const esperado = Deno.env.get('BI_IMPORT_TOKEN') || ''
  if (!esperado) return json({ ok: false, erro: 'Importação ainda não configurada no SAFI (falta o BI_IMPORT_TOKEN).' }, 503)
  const recebido = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
  if (!tokensIguais(recebido, esperado)) return json({ ok: false, erro: 'Não autorizado.' }, 401)

  let corpo: any
  try { corpo = await req.json() } catch { return json({ ok: false, erro: 'JSON inválido.' }, 400) }
  const sbAdm = () => createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { autoRefreshToken: false, persistSession: false } })
  if (corpo?.consulta === true) {
    const { data, error } = await sbAdm().from('bi_atualizacao').select('*').order('operacao')
    return json(error ? { ok: false, erro: error.message } : { ok: true, situacao: data }, error ? 500 : 200)
  }
  const planilhas = Array.isArray(corpo?.planilhas) ? corpo.planilhas : null
  const linhas = planilhas || (Array.isArray(corpo?.linhas) ? corpo.linhas : (corpo?.situacao ? [] : null))
  if (!linhas) return json({ ok: false, erro: 'Envie { "linhas": [ ... ] }, { "planilhas": [ ... ] } ou { "situacao": { ... } }.' }, 400)
  if (linhas.length > LIMITE_LINHAS) return json({ ok: false, erro: 'Máximo de ' + LIMITE_LINHAS + ' linhas por envio.' }, 400)

  // "Hoje" no horário de Brasília (o Supabase roda em UTC).
  const hoje = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10)
  const { boas, erros, semVendas = [] } = planilhas ? prepararPlanilhas(planilhas, hoje) : prepararLote(linhas, hoje) as any

  // Ensaio: calcula e devolve o que SERIA gravado, sem gravar nada (para testar o robô).
  if (corpo?.ensaio === true) return json({ ok: true, ensaio: true, recebidas: linhas.length, gravadas: 0, linhas: boas, erros, semVendas })

  const sb = sbAdm()
  let gravadas = 0, erroBanco: string | null = null
  if (boas.length) {
    const agora = new Date().toISOString()
    const { error } = await sb.from('bi_kpi_diario').upsert(boas.map(b => ({ ...b, atualizado_em: agora })), { onConflict: 'operacao,data' })
    if (error) erroBanco = error.message; else gravadas = boas.length
  }
  // Situação do robô: "conferido_ate" só avança (conferido_ate: maior entre o gravado e o novo) e limpa o erro;
  // "erro" guarda o motivo e a hora, sem mexer no dia conferido.
  const sit = normalizarSituacao(corpo?.situacao, hoje)
  erros.push(...sit.erros.map(m => ({ linha: 0, motivo: m })))
  if (sit.itens.length) {
    const ops = sit.itens.map(i => i.operacao as string)
    const { data: atuais } = await sb.from('bi_atualizacao').select('operacao, conferido_ate').in('operacao', ops)
    const antes: Record<string, string | null> = Object.fromEntries((atuais || []).map((a: any) => [a.operacao, a.conferido_ate]))
    const agoraSit = new Date().toISOString()
    for (const it of sit.itens) {
      const op = it.operacao as string
      const reg: Record<string, unknown> = { operacao: op }
      if (it.conferido_ate) {
        const anterior = antes[op] || ''
        reg.conferido_ate = anterior > (it.conferido_ate as string) ? anterior : it.conferido_ate
        reg.atualizado_em = agoraSit
        if (!it.erro) { reg.ultimo_erro = null; reg.erro_em = null }
      }
      if (it.erro) { reg.ultimo_erro = it.erro; reg.erro_em = agoraSit }
      const { error } = await sb.from('bi_atualizacao').upsert(reg, { onConflict: 'operacao' })
      if (error && !erroBanco) erroBanco = error.message
    }
  }
  const resposta = { ok: !erroBanco, recebidas: linhas.length, gravadas, linhas: boas, erros, semVendas, ...(erroBanco ? { erro: 'Falha ao gravar: ' + erroBanco } : {}) }
  // Envio só de situação (sem linhas e sem erro) não entra no histórico de importações.
  if (linhas.length || erros.length || erroBanco)
    await sb.from('bi_importacoes').insert({ recebidas: linhas.length, gravadas, erros: erros.length ? erros.slice(0, 50) : null, erro: erroBanco })
  return json(resposta, erroBanco ? 500 : 200)
})
