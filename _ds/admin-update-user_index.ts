import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.4'

const ADMIN_EMAIL = 'douglasgip24@gmail.com'

// Só os domínios reais do SAFI — endpoint privilegiado (edita conta/permissões), sem
// motivo pra aceitar qualquer origem como o '*' anterior.
const ALLOWED_ORIGINS = ['https://painel.topfinds.com.br', 'https://topfinds.com.br', 'https://gruposacomanpainelgerencial.vercel.app']
function corsFor(req: Request) {
  const origin = req.headers.get('Origin') || ''
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return { 'Access-Control-Allow-Origin': allow, 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Vary': 'Origin' }
}

// Rate limit em memória por chamador — protege contra um bug de frontend em loop
// editando contas em massa. Reseta a cada cold start, é best-effort de propósito
// (só o Douglas tem o JWT admin, não é uma defesa contra atacante externo).
const RATE_LIMIT_WINDOW_MS = 10 * 60_000
const RATE_LIMIT_MAX = 30
const callLog = new Map<string, number[]>()
function rateLimited(key: string): boolean {
  const now = Date.now()
  const calls = (callLog.get(key) || []).filter(t => now - t < RATE_LIMIT_WINDOW_MS)
  calls.push(now)
  callLog.set(key, calls)
  return calls.length > RATE_LIMIT_MAX
}

Deno.serve(async (req: Request) => {
  const cors = corsFor(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { autoRefreshToken: false, persistSession: false } })

  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  const { data: { user: caller } } = await sb.auth.getUser(token!)
  if (caller?.email !== ADMIN_EMAIL)
    return new Response(JSON.stringify({ error: 'Acesso negado' }), { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } })

  if (rateLimited(caller!.id))
    return new Response(JSON.stringify({ error: 'Muitas edições em pouco tempo. Aguarde alguns minutos.' }), { status: 429, headers: { ...cors, 'Content-Type': 'application/json' } })

  const body = await req.json()
  const { user_id, email, password, full_name, role, can_resumo, can_dre, dre_epgip, dre_exposicao, dre_viacloset, can_mapa_societario, can_funcionarios, funcionarios_epgip, funcionarios_exposicao, funcionarios_viacloset, can_fluxo_caixa, can_lancamentos, lancamentos_ep, lancamentos_gip, lancamentos_exposicao, lancamentos_viacloset, can_pedidos, pedidos_epgip, pedidos_exposicao, pedidos_viacloset, pedidos_pode_lancar, pedidos_pode_conferir, pedidos_pode_conciliar, pedidos_pode_baixar, can_despesas_fixas, despesas_fixas_epgip, despesas_fixas_exposicao, despesas_fixas_viacloset, can_calc_importacao, can_fechar_mes, can_orcamento, can_reunioes, can_reunioes_editar, can_produtos, mfa_obrigatorio } = body
  if (!user_id)
    return new Response(JSON.stringify({ error: 'user_id obrigatorio' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })

  // Snapshot de antes, pra logar só o que realmente mudou (não só o que foi enviado —
  // o admin.html sempre manda o formulário inteiro, mesmo campos sem alteração).
  const { data: beforeRows } = await sb.from('user_profiles').select('*').eq('id', user_id).limit(1)
  const before = beforeRows?.[0] || null

  const authUpdate: Record<string, string> = {}
  if (email) authUpdate.email = email
  if (password) authUpdate.password = password
  if (Object.keys(authUpdate).length > 0) {
    const { error } = await sb.auth.admin.updateUserById(user_id, { ...authUpdate, email_confirm: true })
    if (error)
      return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  const up: Record<string, unknown> = {}
  if (email !== undefined) up.email = email
  if (full_name !== undefined) up.full_name = full_name
  if (role !== undefined) up.role = role
  if (can_resumo !== undefined) up.can_resumo = can_resumo
  if (can_dre !== undefined) up.can_dre = can_dre
  if (dre_epgip !== undefined) up.dre_epgip = dre_epgip
  if (dre_exposicao !== undefined) up.dre_exposicao = dre_exposicao
  if (dre_viacloset !== undefined) up.dre_viacloset = dre_viacloset
  if (can_mapa_societario !== undefined) up.can_mapa_societario = can_mapa_societario
  if (can_funcionarios !== undefined) up.can_funcionarios = can_funcionarios
  if (funcionarios_epgip !== undefined) up.funcionarios_epgip = funcionarios_epgip
  if (funcionarios_exposicao !== undefined) up.funcionarios_exposicao = funcionarios_exposicao
  if (funcionarios_viacloset !== undefined) up.funcionarios_viacloset = funcionarios_viacloset
  if (can_fluxo_caixa !== undefined) up.can_fluxo_caixa = can_fluxo_caixa
  if (can_lancamentos !== undefined) up.can_lancamentos = can_lancamentos
  if (lancamentos_ep !== undefined) up.lancamentos_ep = lancamentos_ep
  if (lancamentos_gip !== undefined) up.lancamentos_gip = lancamentos_gip
  if (lancamentos_exposicao !== undefined) up.lancamentos_exposicao = lancamentos_exposicao
  if (lancamentos_viacloset !== undefined) up.lancamentos_viacloset = lancamentos_viacloset
  if (can_pedidos !== undefined) up.can_pedidos = can_pedidos
  if (pedidos_epgip !== undefined) up.pedidos_epgip = pedidos_epgip
  if (pedidos_exposicao !== undefined) up.pedidos_exposicao = pedidos_exposicao
  if (pedidos_viacloset !== undefined) up.pedidos_viacloset = pedidos_viacloset
  if (pedidos_pode_lancar !== undefined) up.pedidos_pode_lancar = pedidos_pode_lancar
  if (pedidos_pode_conferir !== undefined) up.pedidos_pode_conferir = pedidos_pode_conferir
  if (pedidos_pode_conciliar !== undefined) up.pedidos_pode_conciliar = pedidos_pode_conciliar
  if (pedidos_pode_baixar !== undefined) up.pedidos_pode_baixar = pedidos_pode_baixar
  if (can_despesas_fixas !== undefined) up.can_despesas_fixas = can_despesas_fixas
  if (despesas_fixas_epgip !== undefined) up.despesas_fixas_epgip = despesas_fixas_epgip
  if (despesas_fixas_exposicao !== undefined) up.despesas_fixas_exposicao = despesas_fixas_exposicao
  if (despesas_fixas_viacloset !== undefined) up.despesas_fixas_viacloset = despesas_fixas_viacloset
  if (can_calc_importacao !== undefined) up.can_calc_importacao = can_calc_importacao
  if (can_fechar_mes !== undefined) up.can_fechar_mes = can_fechar_mes
  if (can_orcamento !== undefined) up.can_orcamento = can_orcamento
  if (can_reunioes !== undefined) up.can_reunioes = can_reunioes
  if (can_reunioes_editar !== undefined) up.can_reunioes_editar = can_reunioes_editar
  if (can_produtos !== undefined) up.can_produtos = can_produtos
  if (mfa_obrigatorio !== undefined) up.mfa_obrigatorio = mfa_obrigatorio

  if (Object.keys(up).length > 0) {
    const { error } = await sb.from('user_profiles').update(up).eq('id', user_id)
    if (error)
      return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  // Log de auditoria — só os campos que de fato mudaram de valor (não só os enviados),
  // com o antes/depois de cada um. Best-effort, nunca bloqueia a resposta se falhar.
  const diff: Record<string, { de: unknown; para: unknown }> = {}
  if (before) {
    for (const key of Object.keys(up)) {
      const antes = (before as Record<string, unknown>)[key]
      const depois = up[key]
      if (antes !== depois) diff[key] = { de: antes ?? null, para: depois ?? null }
    }
  }
  if (Object.keys(diff).length > 0) {
    const { error: logErr } = await sb.from('admin_actions_log').insert({
      actor_id: caller!.id, actor_email: caller!.email,
      action: 'update_user', target_user_id: user_id, target_email: (up.email as string) ?? before?.email ?? null,
      detalhes: diff,
    })
    if (logErr) console.error('admin_actions_log insert falhou:', logErr)
  }

  return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } })
})
