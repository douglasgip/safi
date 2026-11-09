// Edge Function: conekto-webhook — Conekto → SAFI (seção "Webhook do Conekto para o SAFI" do contrato).
// Recebe "colaborador.alterado" quando um gestor edita alguém no Conekto e aplica só os campos de "alteracoes".
// Autenticação: Authorization: Bearer <CONEKTO_WEBHOOK_TOKEN> (secret no Supabase; o mesmo valor é cadastrado no Conekto).
// Implantar com verify_jwt = false (o token é próprio, não é login do Supabase).
// Sem laço: o que chega aqui é gravado direto no banco e NUNCA dispara envio de volta ao Conekto
// (o envio SAFI → Conekto só acontece pela tela Funcionários, via conekto-sync).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.4'

const soDigitos = (v: unknown) => String(v ?? '').replace(/\D/g, '')
const GESTAO: Record<string, string> = { gip_ecommerce: 'GIP Ecommerce', via_closet: 'Via Closet', exposicao_paulista: 'Exposição Paulista' }
const EMPRESA_CNPJ: Record<string, string> = { isa: '54098011000185', ep_comercio: '08297302000185', juliane: '02688541000180', guilherme: '47023165000142' }
const ehData = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)

// Comparação de token em tempo constante (não vaza, pelo tempo de resposta, quantos caracteres batem).
function tokensIguais(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false
  let d = 0
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return d === 0
}

// Traduz "alteracoes" do Conekto para as colunas do SAFI. Campo desconhecido ou inválido vai para "ignorados".
function mapearAlteracoes(alt: Record<string, unknown>): { campos: Record<string, unknown>; ignorados: string[] } {
  const campos: Record<string, unknown> = {}, ignorados: string[] = []
  for (const [k, v] of Object.entries(alt || {})) {
    if (k === 'full_name' && typeof v === 'string' && v.trim()) campos.nome = v.trim()
    else if (k === 'cpf' && soDigitos(v).length === 11) campos.cpf = soDigitos(v)
    else if (k === 'email') campos.email = v ? String(v).trim() : null
    else if (k === 'telefone') campos.telefone = v ? String(v).trim() : null
    else if (k === 'cargo') campos.cargo = v ? String(v).trim() : null
    else if (k === 'nascimento' && (v === null || ehData(v))) campos.data_nascimento = v
    else if (k === 'admissao_date' && ehData(v)) campos.data_admissao = v
    else if (k === 'desligamento_date' && (v === null || ehData(v))) { campos.data_desligamento = v; campos.status = v ? 'desligado' : 'ativo' }
    else if (k === 'gestao' && GESTAO[String(v)]) campos.empresa = GESTAO[String(v)]
    else if (k === 'empresa' && EMPRESA_CNPJ[String(v)]) campos.cnpj = EMPRESA_CNPJ[String(v)]
    else if (k === 'is_active' && typeof v === 'boolean') { if (!('status' in campos)) campos.status = v ? 'ativo' : 'desligado' }
    else ignorados.push(k)
  }
  return { campos, ignorados }
}

// Vale a última alteração: se o SAFI mudou o cadastro depois do que o Conekto informa (um reenvio atrasado,
// por exemplo), o aviso é confirmado mas não sobrescreve.
function avisoAtrasado(alteradoEm: unknown, atualizadoNoSafi: unknown): boolean {
  const a = Date.parse(String(alteradoEm || '')), s = Date.parse(String(atualizadoNoSafi || ''))
  return !isNaN(a) && !isNaN(s) && s > a
}

Deno.serve(async (req: Request) => {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  if (req.method !== 'POST') return json({ erro: 'Use POST.' }, 405)

  const esperado = Deno.env.get('CONEKTO_WEBHOOK_TOKEN') || ''
  if (!esperado) return json({ erro: 'Webhook ainda não configurado no SAFI.' }, 503)
  const recebido = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
  if (!tokensIguais(recebido, esperado)) return json({ erro: 'Não autorizado.' }, 401)

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { autoRefreshToken: false, persistSession: false } })
  const t0 = Date.now()
  let corpo: any = null
  const registrar = (http: number, resposta: unknown, fid: string | null) =>
    sb.from('conekto_log').insert({ direcao: 'entrada', acao: String(corpo?.evento || 'desconhecido'), funcionario_id: fid, cpf: soDigitos(corpo?.cpf) || null, http_status: http, requisicao: corpo, resposta, ms: Date.now() - t0, usuario: corpo?.alterado_por ? 'Conekto: ' + corpo.alterado_por : 'Conekto' })

  try {
    try { corpo = await req.json() } catch { await registrar(400, { erro: 'JSON inválido' }, null); return json({ erro: 'JSON inválido.' }, 400) }
    if (corpo?.evento !== 'colaborador.alterado') { const r = { ok: true, ignorado: 'evento desconhecido' }; await registrar(200, r, null); return json(r) }

    // Acha pelo safi_id (= id do colaborador no SAFI); se não der, pelo CPF anterior ou atual.
    let f: any = null
    if (/^[0-9a-f-]{36}$/i.test(String(corpo.safi_id || ''))) {
      const { data } = await sb.from('funcionarios').select('id, updated_at').eq('id', corpo.safi_id).limit(1)
      f = data?.[0] || null
    }
    for (const c of [corpo.cpf_anterior, corpo.cpf]) {
      if (f || soDigitos(c).length !== 11) continue
      const { data } = await sb.from('funcionarios').select('id, updated_at, cpf')
      f = (data || []).find((x: any) => soDigitos(x.cpf) === soDigitos(c)) || null
    }
    if (!f) { const r = { erro: 'Colaborador não encontrado no SAFI.' }; await registrar(404, r, null); return json(r, 404) }

    const { campos, ignorados } = mapearAlteracoes(corpo.alteracoes || {})
    if (avisoAtrasado(corpo.alterado_em, f.updated_at)) {
      const r = { ok: true, aplicados: [], ignorados: Object.keys(corpo.alteracoes || {}), motivo: 'o SAFI tem uma alteração mais recente' }
      await registrar(200, r, f.id); return json(r)
    }
    if (Object.keys(campos).length) {
      const { error } = await sb.from('funcionarios').update({ ...campos, updated_at: corpo.alterado_em && !isNaN(Date.parse(corpo.alterado_em)) ? corpo.alterado_em : new Date().toISOString() }).eq('id', f.id)
      if (error) { const r = { erro: 'Não foi possível gravar: ' + error.message }; await registrar(500, r, f.id); return json(r, 500) }
    }
    const r = { ok: true, aplicados: Object.keys(campos), ignorados }
    await registrar(200, r, f.id)
    return json(r)
  } catch (e) {
    console.error('conekto-webhook error:', e)
    try { await registrar(500, { erro: String(e) }, null) } catch { /* registro é best-effort */ }
    return json({ erro: 'Erro interno.' }, 500)
  }
})
