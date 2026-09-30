// Edge Function: avisos-diarios
// Deploy target: Supabase project ujsoqyhkebasszwtexmp (painelgerencial_gruposacoman)
// Secrets necessários: RESEND_API_KEY, CRON_SECRET (mesmos da backup-mensal).
//
// Rodada uma vez por dia pelo pg_cron. Cada "regra" abaixo decide, por conta própria,
// quem precisa de um lembrete hoje e manda o e-mail. A tabela avisos_enviados evita
// repetir o mesmo aviso pro mesmo usuário antes do intervalo mínimo (ex.: não manda
// o lembrete de pedidos todo dia pra quem já está inativo há meses — só a cada 7 dias).
// Pra adicionar uma regra nova (ex.: lembrete de lançar o DRE), criar outra função no
// mesmo formato de regraPedidosInatividade e chamar dentro do Deno.serve.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.4'

type SbClient = ReturnType<typeof createClient>

function primeiroNome(nomeCompleto: string): string {
  return (nomeCompleto || '').trim().split(/\s+/)[0] || 'tudo bem'
}

async function jaAvisadoRecentemente(sb: SbClient, userId: string, tipo: string, diasMin: number): Promise<boolean> {
  const desde = new Date(Date.now() - diasMin * 86400000).toISOString()
  const { data } = await sb.from('avisos_enviados').select('id').eq('user_id', userId).eq('tipo', tipo).gte('enviado_em', desde).limit(1)
  return !!(data && data.length)
}

async function enviarEmail(assunto: string, destinatario: string, html: string): Promise<void> {
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + Deno.env.get('RESEND_API_KEY'), 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'SAFI <safi@mail.topfinds.com.br>', to: [destinatario], subject: assunto, html }),
  })
  if (!resp.ok) throw new Error('Resend: ' + (await resp.text()))
}

// Regra: compradora(s) sem acessar o SAFI há 7+ dias — lembra de registrar pedidos.
// Repete a cada 7 dias de inatividade contínua (não manda todo dia).
async function regraPedidosInatividade(sb: SbClient): Promise<{ tipo: string; enviados: string[] }> {
  const TIPO = 'pedidos_inatividade', DIAS_LIMITE = 7
  const { data: candidatos, error } = await sb.from('user_profiles')
    .select('id, full_name, email, last_seen_at, created_at')
    .eq('can_pedidos', true).eq('pedidos_pode_lancar', true).eq('is_admin', false).not('email', 'is', null)
  if (error) throw error

  const enviados: string[] = []
  for (const u of (candidatos as Record<string, unknown>[])) {
    const base = (u.last_seen_at as string) || (u.created_at as string)
    if (!base) continue
    const dias = Math.floor((Date.now() - new Date(base).getTime()) / 86400000)
    if (dias < DIAS_LIMITE) continue
    if (await jaAvisadoRecentemente(sb, u.id as string, TIPO, DIAS_LIMITE)) continue

    const html = '<p>Opa, ' + primeiroNome(u.full_name as string) + '!</p>' +
      '<p>Passando para avisar que você está há <b>' + dias + ' dias</b> sem acessar o SAFI.</p>' +
      '<p>Lembre-se de registrar os pedidos de produtos no painel: <a href="https://topfinds.com.br/pedidos">topfinds.com.br/pedidos</a></p>'
    await enviarEmail('Lembrete do SAFI — registrar pedidos', u.email as string, html)
    await sb.from('avisos_enviados').insert({ user_id: u.id, tipo: TIPO })
    enviados.push(u.email as string)
  }
  return { tipo: TIPO, enviados }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok')
  try {
    const segredo = req.headers.get('x-cron-secret')
    if (!segredo || segredo !== Deno.env.get('CRON_SECRET'))
      return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401, headers: { 'Content-Type': 'application/json' } })

    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { autoRefreshToken: false, persistSession: false } })

    const resultados = [await regraPedidosInatividade(sb)]

    return new Response(JSON.stringify({ ok: true, resultados }), { headers: { 'Content-Type': 'application/json' } })
  } catch (e) {
    console.error('avisos-diarios error:', e)
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Erro interno' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
})
