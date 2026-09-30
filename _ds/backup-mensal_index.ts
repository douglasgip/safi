// Edge Function: backup-mensal
// Deploy target: Supabase project ujsoqyhkebasszwtexmp (painelgerencial_gruposacoman)
// Secrets necessários: RESEND_API_KEY (conta Resend), CRON_SECRET (valor combinado com o
// job do pg_cron que chama esta function todo dia 1º — ver migração backup_mensal_cron_job).
//
// Backup fora do Supabase (plano Free não tem backup automático nem PITR): lê TODAS as
// tabelas do schema public com o service role (bypassa RLS de propósito, é o dono dos
// dados falando consigo mesmo) e manda por e-mail uma planilha .xlsx com uma aba por
// tabela. Chamado automaticamente pelo pg_cron; também pode ser chamado manualmente
// (mesmo header x-cron-secret) se o Douglas quiser gerar um backup avulso.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.4'
import * as XLSX from 'npm:xlsx@0.18.5'

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const MES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const EMPRESA_NOME: Record<string, string> = { EP: 'EP', GIP: 'GIP Ecommerce', Exposicao: 'Exposição Paulista', ViaCloset: 'Via Closet', RP: 'RP' }
const arred2 = (v: unknown) => Math.round((Number(v) || 0) * 100) / 100

// Nome de aba do Excel tem limite de 31 caracteres e não aceita alguns símbolos — corta e
// desempata com sufixo numérico se duas tabelas colidirem depois de cortadas.
function nomeAba(tabela: string, usados: Set<string>): string {
  let base = tabela.replace(/[\\/?*[\]:]/g, '_').slice(0, 31)
  let nome = base, i = 2
  while (usados.has(nome)) { const suf = '_' + i; nome = base.slice(0, 31 - suf.length) + suf; i++ }
  usados.add(nome)
  return nome
}

// jsonb (objeto/array) não cabe direto numa célula — vira texto JSON. null/undefined viram célula vazia.
function achatarLinha(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const k of Object.keys(row)) {
    const v = row[k]
    out[k] = v == null ? '' : (typeof v === 'object' ? JSON.stringify(v) : v)
  }
  return out
}

function bufferParaBase64(buf: Uint8Array): string {
  let bin = ''
  const CHUNK = 8192
  for (let i = 0; i < buf.length; i += CHUNK) bin += String.fromCharCode(...buf.subarray(i, i + CHUNK))
  return btoa(bin)
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok')

  try {
    const segredo = req.headers.get('x-cron-secret')
    if (!segredo || segredo !== Deno.env.get('CRON_SECRET'))
      return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401, headers: { 'Content-Type': 'application/json' } })

    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { autoRefreshToken: false, persistSession: false } })

    const { data: tabelas, error: errTabelas } = await sb.rpc('backup_listar_tabelas')
    if (errTabelas) throw errTabelas

    const wb = XLSX.utils.book_new()
    const abasUsadas = new Set<string>()
    let totalLinhas = 0

    // Aba legível: o DRE (Faturamento → Resultado Líquido) em português, uma linha por
    // empresa/mês — mesma conta usada no Painel do Conselho, mas sem juntar EP com GIP.
    const { data: dre, error: errDre } = await sb.rpc('backup_dre_legivel')
    if (errDre) throw errDre
    const linhasDre = (dre as Record<string, unknown>[]).map(r => ({
      'Empresa': EMPRESA_NOME[r.empresa_id as string] || r.empresa_id,
      'Competência': MES_ABREV[(r.mes as number) - 1] + '/' + r.ano,
      'Faturamento': arred2(r.faturamento),
      'Deduções': arred2(r.deducoes),
      'Receita Líquida': arred2(r.receita_liquida),
      'Custos Variáveis': arred2(r.custos_variaveis),
      'Margem de Contribuição': arred2(r.margem_contribuicao),
      'Gastos Operacionais': arred2(r.gastos_operacionais),
      'Despesas Financeiras': arred2(r.despesas_financeiras),
      'IR e CSLL': arred2(r.ir_csll),
      'EBITDA': arred2(r.ebitda),
      'Resultado Líquido': arred2(r.resultado_liquido),
    }))
    const wsDre = linhasDre.length ? XLSX.utils.json_to_sheet(linhasDre) : XLSX.utils.aoa_to_sheet([['Sem lançamentos ainda']])
    XLSX.utils.book_append_sheet(wb, wsDre, nomeAba('DRE (legível)', abasUsadas))

    for (const tabela of (tabelas as string[])) {
      const linhas: Record<string, unknown>[] = []
      const PAGINA = 1000
      for (let offset = 0; ; offset += PAGINA) {
        const { data, error } = await sb.from(tabela).select('*').range(offset, offset + PAGINA - 1)
        if (error) { linhas.push({ erro: 'Não foi possível ler esta tabela: ' + error.message }); break }
        if (!data || !data.length) break
        linhas.push(...data.map(achatarLinha))
        if (data.length < PAGINA) break
      }
      totalLinhas += linhas.length
      const ws = linhas.length ? XLSX.utils.json_to_sheet(linhas) : XLSX.utils.aoa_to_sheet([['Tabela vazia']])
      XLSX.utils.book_append_sheet(wb, ws, nomeAba(tabela, abasUsadas))
    }

    const bufferXlsx = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
    const base64 = bufferParaBase64(new Uint8Array(bufferXlsx))

    // Destinatário padrão é a lista de admins; um teste avulso pode mandar pra outro
    // e-mail passando {"para": ["fulano@..."]} no corpo (o agendamento mensal chama sem corpo).
    let destinatarios: string[] = []
    try { const body = await req.json(); if (Array.isArray(body?.para) && body.para.length) destinatarios = body.para.filter((e: unknown) => typeof e === 'string' && e) } catch (_e) { /* sem corpo = usa os admins */ }
    if (!destinatarios.length) {
      const { data: admins } = await sb.from('user_profiles').select('email').eq('is_admin', true).not('email', 'is', null)
      destinatarios = (admins || []).map((a: { email: string }) => a.email).filter(Boolean)
    }
    if (!destinatarios.length) throw new Error('Nenhum destinatário — nenhum admin com e-mail cadastrado.')

    const hoje = new Date()
    const competencia = MESES[hoje.getUTCMonth()] + ' de ' + hoje.getUTCFullYear()
    const arquivo = 'SAFI-backup-' + hoje.getUTCFullYear() + '-' + String(hoje.getUTCMonth() + 1).padStart(2, '0') + '.xlsx'

    const resendResp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + Deno.env.get('RESEND_API_KEY'), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'SAFI <safi@mail.topfinds.com.br>',
        to: destinatarios,
        subject: 'Backup mensal do SAFI — ' + competencia,
        html: '<p>Segue em anexo o backup mensal do SAFI: a aba <b>DRE (legível)</b> traz o resultado por empresa e mês em português (Faturamento, EBITDA, Resultado Líquido...); as demais são as ' + (tabelas as string[]).length + ' tabelas do banco como estão gravadas, uma aba cada (' + totalLinhas.toLocaleString('pt-BR') + ' linhas ao todo).</p><p>Gerado automaticamente todo dia 1º — este e-mail não precisa de resposta.</p>',
        attachments: [{ filename: arquivo, content: base64 }],
      }),
    })
    if (!resendResp.ok) {
      const txt = await resendResp.text()
      throw new Error('Falha ao enviar e-mail (Resend): ' + txt)
    }

    return new Response(JSON.stringify({ ok: true, tabelas: (tabelas as string[]).length, linhas: totalLinhas, enviadoPara: destinatarios }), { headers: { 'Content-Type': 'application/json' } })
  } catch (e) {
    console.error('backup-mensal error:', e)
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Erro interno' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
})
