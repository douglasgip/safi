import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ADMIN_EMAIL = 'douglasgip24@gmail.com'

// Só os domínios reais do SAFI — endpoint privilegiado (apaga conta), sem motivo pra
// aceitar qualquer origem como o '*' anterior.
const ALLOWED_ORIGINS = ['https://painel.topfinds.com.br', 'https://topfinds.com.br', 'https://gruposacomanpainelgerencial.vercel.app']
function corsFor(req: Request) {
  const origin = req.headers.get('Origin') || ''
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return { 'Access-Control-Allow-Origin': allow, 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Vary': 'Origin' }
}

// Rate limit em memória por chamador — protege contra um bug de frontend em loop
// apagando contas em massa. Reseta a cada cold start, é best-effort de propósito
// (só o Douglas tem o JWT admin, não é uma defesa contra atacante externo). Mais
// restrito que create/update porque apagar é irreversível.
const RATE_LIMIT_WINDOW_MS = 10 * 60_000
const RATE_LIMIT_MAX = 15
const callLog = new Map<string, number[]>()
function rateLimited(key: string): boolean {
  const now = Date.now()
  const calls = (callLog.get(key) || []).filter(t => now - t < RATE_LIMIT_WINDOW_MS)
  calls.push(now)
  callLog.set(key, calls)
  return calls.length > RATE_LIMIT_MAX
}

Deno.serve(async (req: Request) => {
  const corsHeaders = corsFor(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  const { data: { user: caller }, error: authErr } = await supabaseAdmin.auth.getUser(token!)
  if (authErr || caller?.email !== ADMIN_EMAIL) {
    return new Response(JSON.stringify({ error: 'Acesso negado' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  if (rateLimited(caller!.id))
    return new Response(JSON.stringify({ error: 'Muitas exclusões em pouco tempo. Aguarde alguns minutos.' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  const { user_id } = await req.json()
  if (!user_id) return new Response(JSON.stringify({ error: 'user_id obrigatório' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  // Snapshot de antes de apagar — depois que o auth.users some, o perfil (FK em cascata)
  // some junto, então é agora ou nunca pra saber quem era.
  const { data: beforeRows } = await supabaseAdmin.from('user_profiles').select('email, full_name, role').eq('id', user_id).limit(1)
  const before = beforeRows?.[0] || null

  const { error } = await supabaseAdmin.auth.admin.deleteUser(user_id)
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  // Log de auditoria — best-effort, nunca bloqueia a resposta se falhar.
  const { error: logErr } = await supabaseAdmin.from('admin_actions_log').insert({
    actor_id: caller!.id, actor_email: caller!.email,
    action: 'delete_user', target_user_id: user_id, target_email: before?.email ?? null,
    detalhes: before ? { full_name: before.full_name, role: before.role } : null,
  })
  if (logErr) console.error('admin_actions_log insert falhou:', logErr)

  return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})
