import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.4'

const ADMIN_EMAIL = 'douglasgip24@gmail.com'

// Só os domínios reais do SAFI — endpoint privilegiado (cria conta), sem motivo pra
// aceitar qualquer origem como o '*' anterior.
const ALLOWED_ORIGINS = ['https://painel.topfinds.com.br', 'https://topfinds.com.br', 'https://gruposacomanpainelgerencial.vercel.app']
function corsFor(req: Request) {
  const origin = req.headers.get('Origin') || ''
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return { 'Access-Control-Allow-Origin': allow, 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Vary': 'Origin' }
}

// Rate limit em memória por chamador — protege contra um bug de frontend em loop
// criando contas em massa. Reseta a cada cold start, é best-effort de propósito
// (só o Douglas tem o JWT admin, não é uma defesa contra atacante externo).
const RATE_LIMIT_WINDOW_MS = 10 * 60_000
const RATE_LIMIT_MAX = 20
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
    return new Response(JSON.stringify({ error: 'Muitas contas criadas em pouco tempo. Aguarde alguns minutos.' }), { status: 429, headers: { ...cors, 'Content-Type': 'application/json' } })

  const { email, password, full_name, role, can_resumo, can_dre, dre_epgip, dre_exposicao, dre_viacloset, can_mapa_societario, can_funcionarios, funcionarios_epgip, funcionarios_exposicao, funcionarios_viacloset, can_fluxo_caixa, can_lancamentos, lancamentos_ep, lancamentos_gip, lancamentos_exposicao, lancamentos_viacloset, can_pedidos, pedidos_epgip, pedidos_exposicao, pedidos_viacloset, pedidos_pode_lancar, pedidos_pode_conferir, pedidos_pode_conciliar, pedidos_pode_baixar, can_despesas_fixas, despesas_fixas_epgip, despesas_fixas_exposicao, despesas_fixas_viacloset, can_calc_importacao, can_fechar_mes, can_orcamento, can_reunioes, can_reunioes_editar, can_produtos, mfa_obrigatorio } = await req.json()

  const { data: authData, error: authErr } = await sb.auth.admin.createUser({ email, password, email_confirm: true })
  if (authErr)
    return new Response(JSON.stringify({ error: authErr.message }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })

  const { error: profErr } = await sb.from('user_profiles').insert({
    id: authData.user!.id, email,
    full_name: full_name || '', role: role || '',
    can_resumo: can_resumo ?? true, can_dre: can_dre ?? true,
    dre_epgip: dre_epgip ?? true, dre_exposicao: dre_exposicao ?? true, dre_viacloset: dre_viacloset ?? true,
    can_mapa_societario: can_mapa_societario ?? false,
    can_funcionarios: can_funcionarios ?? false,
    funcionarios_epgip: funcionarios_epgip ?? false, funcionarios_exposicao: funcionarios_exposicao ?? false, funcionarios_viacloset: funcionarios_viacloset ?? false,
    can_fluxo_caixa: can_fluxo_caixa ?? false,
    can_lancamentos: can_lancamentos ?? false,
    lancamentos_ep: lancamentos_ep ?? false, lancamentos_gip: lancamentos_gip ?? false, lancamentos_exposicao: lancamentos_exposicao ?? false, lancamentos_viacloset: lancamentos_viacloset ?? false,
    can_pedidos: can_pedidos ?? false,
    pedidos_epgip: pedidos_epgip ?? false, pedidos_exposicao: pedidos_exposicao ?? false, pedidos_viacloset: pedidos_viacloset ?? false,
    pedidos_pode_lancar: pedidos_pode_lancar ?? null,
    pedidos_pode_conferir: pedidos_pode_conferir ?? null,
    pedidos_pode_conciliar: pedidos_pode_conciliar ?? false,
    pedidos_pode_baixar: pedidos_pode_baixar ?? false,
    can_despesas_fixas: can_despesas_fixas ?? false,
    despesas_fixas_epgip: despesas_fixas_epgip ?? false, despesas_fixas_exposicao: despesas_fixas_exposicao ?? false, despesas_fixas_viacloset: despesas_fixas_viacloset ?? false,
    can_calc_importacao: can_calc_importacao ?? false,
    can_fechar_mes: can_fechar_mes ?? false,
    can_orcamento: can_orcamento ?? false,
    can_reunioes: can_reunioes ?? false,
    can_reunioes_editar: can_reunioes_editar ?? false,
    can_produtos: can_produtos ?? false,
    mfa_obrigatorio: mfa_obrigatorio ?? false,
    is_admin: false
  })
  if (profErr) {
    await sb.auth.admin.deleteUser(authData.user!.id)
    return new Response(JSON.stringify({ error: profErr.message }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  return new Response(JSON.stringify({ success: true, id: authData.user!.id }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } })
})
