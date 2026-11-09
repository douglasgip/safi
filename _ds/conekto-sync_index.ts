// Edge Function: conekto-sync — SAFI → Conekto (contrato integracao-safi.md).
// Chamada pela tela Funcionários depois de salvar, desligar ou readmitir, ou para conferir o status.
// Secret necessário: CONEKTO_INTEGRATION_TOKEN (cadastrado pelo Douglas no Supabase; nunca no código).
// Chave liga/desliga: integracao_config.conekto_modo = 'desligado' | 'teste' | 'producao'.
// Erros de negócio voltam com HTTP 200 e { ok: false, mensagem } para a tela mostrar a mensagem (o supabase-js descarta o corpo em não-2xx).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.4'

const BASE = 'https://www.conekto.com.br/api/integracao'
const ALLOWED_ORIGINS = ['https://painel.topfinds.com.br', 'https://topfinds.com.br', 'https://gruposacomanpainelgerencial.vercel.app']
function corsFor(req: Request) {
  const origin = req.headers.get('Origin') || ''
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return { 'Access-Control-Allow-Origin': allow, 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Vary': 'Origin' }
}

const soDigitos = (v: unknown) => String(v ?? '').replace(/\D/g, '')

// Cadastro completo que o Conekto espera no POST /colaboradores (campo opcional não enviado fica vazio lá,
// por isso vai sempre tudo; vazio no SAFI vai como null).
function montarPayload(f: Record<string, unknown>) {
  return {
    safi_id: String(f.id),
    cpf: soDigitos(f.cpf),
    nome: String(f.nome ?? '').trim(),
    gestao: f.empresa,
    admissao: f.data_admissao ?? null,
    cnpj: f.cnpj ? soDigitos(f.cnpj) : null,
    nascimento: f.data_nascimento ?? null,
    cargo: f.cargo ? String(f.cargo).trim() : null,
    email: f.email ? String(f.email).trim() : null,
    telefone: f.telefone ? soDigitos(f.telefone) : null,
  }
}

// O que fazer em cada ação. Colaborador desligado no SAFI nunca recebe POST (o POST readmite no Conekto):
// editar alguém desligado só reenvia a data de desligamento.
function planejarChamada(acao: string, f: Record<string, unknown>): { metodo: string; caminho: string; corpo: unknown } | { erro: string } {
  const cpf = soDigitos(f.cpf)
  if (!cpf) return { erro: 'Colaborador sem CPF: preencha o CPF para enviar ao Conekto.' }
  if (acao === 'consultar') return { metodo: 'GET', caminho: '/colaboradores/' + cpf, corpo: null }
  if (acao === 'desligar' || (acao === 'enviar' && f.status === 'desligado')) {
    if (!f.data_desligamento) return { erro: 'Informe o último dia trabalhado para desligar no Conekto.' }
    return { metodo: 'PATCH', caminho: '/colaboradores/' + cpf + '/desligamento', corpo: { data: f.data_desligamento } }
  }
  if (acao === 'enviar') {
    if (!f.data_admissao) return { erro: 'Informe a data de admissão: o Conekto exige esse campo.' }
    return { metodo: 'POST', caminho: '/colaboradores', corpo: montarPayload(f) }
  }
  return { erro: 'Ação desconhecida.' }
}

// Modo teste: só colaboradores fictícios (nome começando por TESTE) vão ao Conekto.
function liberadoNoModo(modo: string, f: Record<string, unknown>): boolean {
  if (modo === 'producao') return true
  if (modo === 'teste') return /^teste\b/i.test(String(f.nome ?? '').trim())
  return false
}

// Erro 500 ou falha de rede: tenta de novo (o contrato garante que as chamadas são idempotentes).
const deveRepetir = (status: number | null) => status === null || status >= 500

Deno.serve(async (req: Request) => {
  const cors = corsFor(req)
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const sb = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { autoRefreshToken: false, persistSession: false } })
    const token = req.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) return json({ ok: false, mensagem: 'Não autenticado' }, 401)
    const { data: { user } } = await sb.auth.getUser(token)
    if (!user) return json({ ok: false, mensagem: 'Não autenticado' }, 401)

    const { funcionario_id, acao } = await req.json()
    if (!funcionario_id || !['enviar', 'desligar', 'consultar'].includes(acao)) return json({ ok: false, mensagem: 'Pedido inválido' }, 400)

    // Só mexe em quem a pessoa logada enxerga (a RLS de funcionarios decide).
    const userSb = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { autoRefreshToken: false, persistSession: false } })
    const { data: vis } = await userSb.from('funcionarios').select('id').eq('id', funcionario_id).limit(1)
    if (!vis?.length) return json({ ok: false, mensagem: 'Sem permissão para esse colaborador.' })

    const { data: rows } = await sb.from('funcionarios').select('*').eq('id', funcionario_id).limit(1)
    const f = rows?.[0]
    if (!f) return json({ ok: false, mensagem: 'Colaborador não encontrado.' }, 404)

    const { data: cfg } = await sb.from('integracao_config').select('valor').eq('chave', 'conekto_modo').limit(1)
    const modo = cfg?.[0]?.valor || 'desligado'
    if (!liberadoNoModo(modo, f)) return json({ ok: true, ignorado: true, mensagem: modo === 'teste' ? 'Integração com o Conekto em teste: só colaboradores "TESTE…" são enviados.' : 'Integração com o Conekto desligada.' })

    const apiToken = Deno.env.get('CONEKTO_INTEGRATION_TOKEN')
    if (!apiToken) return json({ ok: false, mensagem: 'Integração com o Conekto ainda não configurada (falta o token).' })

    const plano = planejarChamada(acao, f)
    if ('erro' in plano) {
      if (acao !== 'consultar') await sb.from('funcionarios').update({ conekto_status: 'erro', conekto_msg: plano.erro, conekto_em: new Date().toISOString() }).eq('id', f.id)
      return json({ ok: false, mensagem: plano.erro })
    }

    const { data: prof } = await sb.from('user_profiles').select('full_name').eq('id', user.id).limit(1)
    const usuario = prof?.[0]?.full_name || user.email || null

    let status: number | null = null, resposta: any = null, ms = 0
    for (let tentativa = 1; tentativa <= 3; tentativa++) {
      const t0 = Date.now()
      try {
        const r = await fetch(BASE + plano.caminho, {
          method: plano.metodo,
          headers: { 'Authorization': 'Bearer ' + apiToken, 'Content-Type': 'application/json' },
          body: plano.corpo ? JSON.stringify(plano.corpo) : undefined,
          signal: AbortSignal.timeout(20000),
        })
        status = r.status
        resposta = await r.json().catch(() => null)
      } catch (e) {
        status = null; resposta = { erro: { codigo: 'FALHA_DE_REDE', mensagem: 'Não foi possível falar com o Conekto agora. Tente de novo em instantes.' } }
      }
      ms = Date.now() - t0
      if (!deveRepetir(status) || tentativa === 3) break
      await new Promise(ok => setTimeout(ok, 800 * tentativa))
    }

    await sb.from('conekto_log').insert({ direcao: 'saida', acao: plano.metodo + ' ' + plano.caminho.replace(/\d{11}/, '{cpf}'), funcionario_id: f.id, cpf: soDigitos(f.cpf), http_status: status, requisicao: plano.corpo, resposta, ms, usuario })

    const ok = status !== null && status >= 200 && status < 300
    const mensagem = ok ? null : (resposta?.erro?.mensagem || 'O Conekto não respondeu como esperado (HTTP ' + status + ').')
    if (acao !== 'consultar' || ok) {
      // Não mexe em updated_at: é a data da última alteração de cadastro (usada para ordenar os avisos do Conekto).
      const up: Record<string, unknown> = { conekto_em: new Date().toISOString() }
      if (acao !== 'consultar') { up.conekto_status = ok ? 'ok' : 'erro'; up.conekto_msg = mensagem }
      if (ok && resposta?.colaborador?.id) up.conekto_id = String(resposta.colaborador.id)
      await sb.from('funcionarios').update(up).eq('id', f.id)
    }
    return json({ ok, http: status, resultado: resposta?.resultado ?? null, existe: resposta?.existe ?? null, mensagem, colaborador: resposta?.colaborador ?? null })
  } catch (e) {
    console.error('conekto-sync error:', e)
    return json({ ok: false, mensagem: 'Erro interno ao falar com o Conekto.' }, 500)
  }
})
