// Edge Function: bi-importar — porta de entrada do REALIZADO do BI das Lojas.
// Quem chama: a automação em Python que roda no PC do Douglas (lê o Seta e, depois, o e-commerce).
// Autenticação: Authorization: Bearer <BI_IMPORT_TOKEN> (secret no Supabase; o mesmo valor fica no PC do Douglas).
// Implantar com verify_jwt = false (o token é próprio, não é login do Supabase).
//
// POST { "linhas": [ { "operacao": "Exposicao", "data": "2026-11-16", "faturamento": 24330.78,
//                      "margem": 11213.7, "ticket_medio": 190.08, "pecas_atendimento": 4.04, "qtd_vendas": 128 } ] }
// Cada linha é um dia de uma operação; reenviar o mesmo dia SUBSTITUI o anterior (não duplica).
// Resposta: { ok, recebidas, gravadas, erros: [{ linha, motivo }] } — linhas com erro não impedem as boas.

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

Deno.serve(async (req: Request) => {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  if (req.method !== 'POST') return json({ ok: false, erro: 'Use POST.' }, 405)

  const esperado = Deno.env.get('BI_IMPORT_TOKEN') || ''
  if (!esperado) return json({ ok: false, erro: 'Importação ainda não configurada no SAFI (falta o BI_IMPORT_TOKEN).' }, 503)
  const recebido = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
  if (!tokensIguais(recebido, esperado)) return json({ ok: false, erro: 'Não autorizado.' }, 401)

  let corpo: any
  try { corpo = await req.json() } catch { return json({ ok: false, erro: 'JSON inválido.' }, 400) }
  const linhas = Array.isArray(corpo?.linhas) ? corpo.linhas : null
  if (!linhas) return json({ ok: false, erro: 'Envie { "linhas": [ ... ] }.' }, 400)
  if (linhas.length > LIMITE_LINHAS) return json({ ok: false, erro: 'Máximo de ' + LIMITE_LINHAS + ' linhas por envio.' }, 400)

  // "Hoje" no horário de Brasília (o Supabase roda em UTC).
  const hoje = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10)
  const { boas, erros } = prepararLote(linhas, hoje)

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { autoRefreshToken: false, persistSession: false } })
  let gravadas = 0, erroBanco: string | null = null
  if (boas.length) {
    const agora = new Date().toISOString()
    const { error } = await sb.from('bi_kpi_diario').upsert(boas.map(b => ({ ...b, atualizado_em: agora })), { onConflict: 'operacao,data' })
    if (error) erroBanco = error.message; else gravadas = boas.length
  }
  const resposta = { ok: !erroBanco, recebidas: linhas.length, gravadas, erros, ...(erroBanco ? { erro: 'Falha ao gravar: ' + erroBanco } : {}) }
  await sb.from('bi_importacoes').insert({ recebidas: linhas.length, gravadas, erros: erros.length ? erros.slice(0, 50) : null, erro: erroBanco })
  return json(resposta, erroBanco ? 500 : 200)
})
