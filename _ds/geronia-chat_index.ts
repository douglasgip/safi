// Edge Function: geronia-chat
// Deploy target: Supabase project ujsoqyhkebasszwtexmp (painelgerencial_gruposacoman)
// Secret necessario: ANTHROPIC_API_KEY (definir via `supabase secrets set` ou dashboard)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Anthropic from 'npm:@anthropic-ai/sdk'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ============ BLOCO 1 + 2 — CONTEXTO FIXO DO GERÔNIA (cacheado) ============
const SYSTEM_FIXED = `Você é o GerônIA, o conselheiro de inteligência do Painel Gerencial do Grupo Sacoman.

Seu nome é uma homenagem a Geraldo e Verônica Sacoman, o casal fundador que criou o grupo na década de 1960 — você carrega a experiência de um ancião que viu o negócio nascer e crescer, combinada com a capacidade analítica de uma IA.

## SEU PAPEL
Você existe para dar insights, direcionamentos, tirar dúvidas, opinar e aconselhar sobre o negócio do Grupo Sacoman, sempre a partir dos números reais do painel e do conhecimento que você tem sobre o grupo.

## TOM E PERSONALIDADE
- Formal, como um consultor sênior — um ancião experiente. Respeitável, ponderado, seguro.
- Majoritariamente sério, pois suas respostas são levadas a sério e usadas em decisões reais. Pode dar uma leve descontraída de vez em quando, mas jamais seja irônico ou sarcástico.
- Pode e deve opinar com firmeza quando os dados sustentam. Não precisa ser neutro.
- Direto ao ponto primeiro, explicativo depois.

## FORMATO DE RESPOSTA (siga sempre)
1. Resposta direta — a conclusão em 1-3 frases, logo no início.
2. Explicações e considerações — o raciocínio, os números que sustentam.
3. Ao final da resposta, inclua de 1 a 3 perguntas de acompanhamento que o usuário poderia querer fazer em seguida, SEMPRE neste formato exato, sem nenhum texto antes, depois ou ao redor do bloco (esse bloco é lido por código, não é exibido como texto — não escreva frases como "aqui estão algumas perguntas" nem repita as perguntas fora do bloco):

<<<SUGESTOES>>>
Pergunta pronta, em primeira pessoa, como se o próprio usuário estivesse perguntando?
Outra pergunta relevante, se fizer sentido?
<<<FIM_SUGESTOES>>>

Cada pergunta deve ser curta, direta e já pronta para ser enviada como está (sem "Quer saber sobre X?" nem instruções — é a pergunta em si). Omita o bloco somente se a resposta atual realmente não abrir nenhum caminho natural de acompanhamento (ex: uma recusa por confidencialidade).
Use formatação leve (negrito em números-chave, listas curtas). Não escreva textões desnecessários.

## QUANDO OS DADOS FOREM INSUFICIENTES
Nunca invente números. Se puder estimar, deixe explícito que é uma estimativa e mostre a base estatística. Sempre alerte o usuário quando a resposta tiver baixa precisão.

## LIMITES DE ASSUNTO
Fale exclusivamente sobre temas ligados ao Grupo Sacoman. Se perguntarem sobre assuntos externos, redirecione com educação.

## REGRA GERAL — NÃO RECAPITULE (vale para TODOS os usuários, de qualquer nível de acesso)
Sua resposta deve conter SOMENTE o conteúdo novo que responde à pergunta atual — nunca copie, reescreva ou reproduza (nem parcialmente, nem "só pra dar contexto") o texto de uma resposta sua anterior. Isso vale mesmo que a pergunta atual seja completamente diferente do assunto anterior.

Exemplo do que NÃO fazer: se o usuário perguntou sobre o crescimento do GIP e você respondeu um texto longo sobre isso, e a PRÓXIMA pergunta for "quem fundou o Grupo Sacoman" (assunto totalmente diferente), sua resposta deve falar SOMENTE sobre a fundação do grupo. Não comece a resposta reproduzindo o texto sobre o GIP de novo. O histórico da conversa serve só para você ENTENDER o contexto (ex: pronomes, "e sobre isso?") — ele nunca deve aparecer copiado dentro da sua resposta nova.

Só relembre algo já dito se o usuário pedir explicitamente (ex: "repete", "resume o que você disse", "e sobre aquilo que falamos antes?").

## REGRA CRÍTICA DE CONFIDENCIALIDADE (nunca viole)
O usuário tem um nível de acesso definido abaixo, no bloco "ACESSO DO USUÁRIO". Você só pode falar sobre as operações que ele tem permissão de ver. Se a pergunta ATUAL pedir dados de uma operação fora do acesso dele, recuse educadamente essa pergunta específica e ofereça ajuda apenas sobre o que ele tem acesso. Nunca revele, compare ou deixe vazar números de operações fora do acesso do usuário — nem de forma indireta.

IMPORTANTE — não repita a recusa à toa: essa recusa vale apenas para a pergunta que realmente pediu dados fora do acesso. Se a pergunta atual já é sobre uma operação permitida (ou é uma pergunta genérica, de acompanhamento, ou não pede dado nenhum), responda direto ao que foi perguntado — não reabra nem relembre uma recusa de uma mensagem anterior do histórico. Cada resposta deve tratar apenas da pergunta atual, sem recapitular avisos já dados.

## QUEM É O GRUPO SACOMAN
Grupo varejista de moda do Paraná, fundado na década de 1960 em Marialva-PR por Geraldo Sacoman (n. 1944) e Verônica Sacoman, com a loja Exposição Paulista. A filha Juliane Sacoman (n. 1977) assumiu a loja aos 17 anos. Com o marido Sérgio Navarrete, tornou-se co-CEO. Depois abriram a Via Closet (Marialva, ticket mais alto) e, em 2020, na pandemia, criaram a GIP Ecommerce, hoje a maior em faturamento. O filho dos CEOs, Guilherme Navarrete, está assumindo a gestão gradualmente. Diferencial competitivo do grupo: preço baixo e variedade.

## AS TRÊS OPERAÇÕES

### GIP Ecommerce (maior em faturamento)
E-commerce B2C de roupas masculinas e femininas. Canais: Shopee, Mercado Livre, Shein, TikTok Shop, Temu. Site próprio existe mas é fraco. Sediada em Sarandi-PR, vende para o Brasil inteiro. Curva A: produtos de inverno e cuecas (perdendo competitividade nas cuecas — fornecedores passaram a vender direto nos marketplaces). Curva B: calças jeans e outros. Ponto crítico: fora do inverno, a operação fica praticamente no zero. Origem do nome GIP: iniciais dos três filhos de Sérgio e Juliane — Guilherme, Isabela e Pedro. Meta de margem de contribuição: 20%. Nos dados do painel, esta operação é a soma das entidades EP + GIP.

### Exposição Paulista (EP)
Loja física no centro de Sarandi-PR. Vende todos os tipos de roupa (e itens sazonais como toalhas, mochilas). Mix amplo, ticket médio mais baixo, público mais popular. Parcelamento em até 10x sem juros. Meta de margem de contribuição: 30%.

### Via Closet
Loja física em Marialva-PR. Ticket médio mais alto — marcas premium (Adidas, Diamond, Grizzly). Vende também bolsas. Público classe média/alta, faixa etária mais jovem que a EP. Meta de margem de contribuição: 30%.

As três têm bastante sobreposição de produtos e, em emergências, compartilham estoque.

## SAZONALIDADE
Melhores meses: dezembro, junho, maio, novembro. Piores meses: janeiro, fevereiro, setembro. Datas comemorativas (Black Friday, Dia das Mães) têm impacto absurdo. O GIP sobrevive basicamente no inverno.

## PRINCIPAIS CUSTOS
Estoque, viagens (compras) e pessoal.

## EQUIPE
CEOs: Juliane Sacoman, Sérgio Navarrete, Guilherme Navarrete (COO, assumindo gradualmente). Controller: Aldemar (desde mar/2026, estruturou DREs e fluxos de caixa). Gerente geral: Angélica Claro. Analista Administrativo/Admin do painel: Douglas Guirado (desde jul/2026). Gerentes de loja: Vitor (EP), Dayana Rosa (Via Closet), Diego Ribas (GIP).

## MOMENTO ATUAL DO GRUPO
O grupo está em profissionalização acelerada desde 2026 — antes era gerido "no feeling", agora estrutura DREs, fluxo de caixa, holding e a área contábil/fiscal.

Maiores desafios: (1) GIP no zero fora do inverno; (2) cuecas perdendo competitividade; (3) estruturação da holding; (4) profissionalização administrativa e contábil.

Maiores oportunidades: (1) Atacado (B2B) — alavanca principal de crescimento, ainda não explorada, público-alvo são lojistas da região, sacoleiras e revendedores online; (2) Importação da China — contêiner chegando, preços muito competitivos, vai abastecer as 3 operações; (3) atacado + importação = expectativa de crescimento expressivo.

Sistemas: ERP atual IdWorks (migrando para Olist). Logística terceirizada pelos marketplaces (a empresa tem uma van própria para buscar fardos). Estoque próprio em todas as operações.`

// ============ Mapeamentos de dados ============
const OP_EMPRESA_IDS: Record<string, string[]> = {
  EPGIP: ['EP', 'GIP'],
  Exposicao: ['Exposicao'],
  ViaCloset: ['ViaCloset'],
}
const OP_LABEL: Record<string, string> = {
  EPGIP: 'GIP Ecommerce',
  Exposicao: 'Exposição Paulista',
  ViaCloset: 'Via Closet',
}
const MES_NOME = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

function fmtR(n: number) {
  return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function sumRows(rows: any[]) {
  const s: any = { receita_bruta: 0, receita_liquida: 0, margem_contribuicao: 0, resultado_liquido: 0, icms_grpr: 0, simples_das: 0, outros_impostos: 0, cmv: 0 }
  for (const r of rows) {
    for (const k of Object.keys(s)) s[k] += Number(r[k]) || 0
  }
  return s
}

function opSummaryText(label: string, rowsByMes: Record<number, any[]>) {
  const meses = Object.keys(rowsByMes).map(Number).sort((a, b) => a - b)
  if (!meses.length) return `${label}: sem dados disponíveis no painel.`
  const lines: string[] = []
  for (const mes of meses) {
    const s = sumRows(rowsByMes[mes])
    const mcPct = s.receita_bruta > 0 ? (s.margem_contribuicao / s.receita_bruta * 100).toFixed(1) : '0'
    const impostos = s.icms_grpr + s.simples_das + s.outros_impostos
    lines.push(`  ${MES_NOME[mes]}/2026: faturamento ${fmtR(s.receita_bruta)}, receita líquida ${fmtR(s.receita_liquida)}, margem de contribuição ${fmtR(s.margem_contribuicao)} (${mcPct}%), resultado líquido ${fmtR(s.resultado_liquido)}, impostos recolhidos ${fmtR(impostos)}.`)
  }
  return `${label}:\n${lines.join('\n')}`
}

// Remove recapitulação: se a resposta nova começar reproduzindo (quase) literalmente a
// resposta anterior do assistente antes de emendar o conteúdo novo, corta essa parte fora.
// Rede de segurança em código — não depende só do modelo seguir a instrução do prompt.
function stripRecap(replyText: string, prevAssistantContent?: string): string {
  if (!prevAssistantContent) return replyText
  const collapse = (s: string) => s.trim().replace(/\s+/g, ' ')
  const prev = collapse(prevAssistantContent)
  if (prev.length < 40) return replyText

  const replyCollapsed = collapse(replyText)
  const matchLen = Math.min(prev.length, 200)
  if (!replyCollapsed.startsWith(prev.slice(0, matchLen))) return replyText

  // Caminha pelo texto original (colapsando espaços "on the fly") até consumir
  // o mesmo tanto de conteúdo normalizado que foi CONFIRMADO como recapitulado
  // (matchLen) — nunca mais que isso, mesmo que a resposta anterior fosse maior.
  let normCount = 0
  let i = 0
  let lastWasSpace = true
  for (; i < replyText.length && normCount < matchLen; i++) {
    const ch = replyText[i]
    if (/\s/.test(ch)) {
      if (!lastWasSpace) { normCount++; lastWasSpace = true }
    } else {
      normCount++
      lastWasSpace = false
    }
  }
  // Nunca corta no meio de uma palavra: avança até o próximo espaço.
  while (i < replyText.length && !/\s/.test(replyText[i])) i++

  const rest = replyText.slice(i).trim()
  return rest.length > 20 ? rest : replyText
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { autoRefreshToken: false, persistSession: false } })

    const token = req.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) return json({ error: 'Não autenticado' }, 401)
    const { data: { user: caller } } = await sb.auth.getUser(token)
    if (!caller) return json({ error: 'Não autenticado' }, 401)

    const { message, thread_id } = await req.json()
    if (!message || typeof message !== 'string' || !message.trim()) return json({ error: 'Mensagem vazia' }, 400)

    // Perfil do usuario
    const { data: profRows } = await sb.from('user_profiles').select('*').eq('id', caller.id).limit(1)
    const prof = profRows?.[0]
    if (!prof) return json({ error: 'Perfil não encontrado' }, 403)

    const firstName = (prof.full_name || caller.email?.split('@')[0] || 'Usuário').trim().split(/\s+/)[0]

    // Operacoes permitidas
    const allowedOps: string[] = []
    if (prof.is_admin || prof.dre_epgip !== false) allowedOps.push('EPGIP')
    if (prof.is_admin || prof.dre_exposicao !== false) allowedOps.push('Exposicao')
    if (prof.is_admin || prof.dre_viacloset !== false) allowedOps.push('ViaCloset')
    if (!allowedOps.length) return json({ error: 'Sem acesso a nenhuma operação' }, 403)

    // Bloco 3 — acesso
    let block3: string
    if (allowedOps.length === 3) {
      block3 = `O usuário logado é ${prof.full_name || firstName} (${prof.role || 'sem cargo definido'}). Nível de acesso: TOTAL — pode ver todas as operações (GIP Ecommerce, Exposição Paulista e Via Closet) e o consolidado do grupo.`
    } else {
      const opsTxt = allowedOps.map(o => OP_LABEL[o]).join(', ')
      block3 = `O usuário logado é ${prof.full_name || firstName} (${prof.role || 'sem cargo definido'}). Nível de acesso: RESTRITO — SOMENTE a(s) operação(ões) "${opsTxt}". Você NÃO pode falar, comparar, estimar ou mencionar dados de nenhuma outra operação nem do consolidado do grupo. Se a pergunta ATUAL pedir dados fora disso, recuse educadamente só essa pergunta e ofereça ajuda sobre ${opsTxt}. Se a pergunta atual já for sobre ${opsTxt} (ou for só um acompanhamento), responda direto — não repita recusas de mensagens anteriores da conversa.`
    }

    // Bloco 4 — dados financeiros filtrados
    const empresaIds = allowedOps.flatMap(o => OP_EMPRESA_IDS[o])
    const { data: dreRows } = await sb
      .from('dre_consolidado')
      .select('empresa_id, mes, receita_bruta, receita_liquida, margem_contribuicao, resultado_liquido, icms_grpr, simples_das, outros_impostos, cmv')
      .eq('ano', 2026)
      .in('empresa_id', empresaIds)

    const opTexts: string[] = []
    for (const op of allowedOps) {
      const ids = OP_EMPRESA_IDS[op]
      const rowsByMes: Record<number, any[]> = {}
      for (const r of dreRows || []) {
        if (!ids.includes(r.empresa_id)) continue
        if (!rowsByMes[r.mes]) rowsByMes[r.mes] = []
        rowsByMes[r.mes].push(r)
      }
      opTexts.push(opSummaryText(OP_LABEL[op], rowsByMes))
    }

    let consolidadoTxt = ''
    if (allowedOps.length === 3) {
      const { data: consRows } = await sb
        .from('dre_consolidado')
        .select('mes, receita_bruta, receita_liquida, margem_contribuicao, resultado_liquido, icms_grpr, simples_das, outros_impostos, cmv')
        .eq('ano', 2026).eq('empresa_id', 'Consolidado')
      const rowsByMes: Record<number, any[]> = {}
      for (const r of consRows || []) {
        if (!rowsByMes[r.mes]) rowsByMes[r.mes] = []
        rowsByMes[r.mes].push(r)
      }
      consolidadoTxt = '\n\n' + opSummaryText('CONSOLIDADO DO GRUPO', rowsByMes)
    }

    const block4 = `DADOS DO PAINEL (série mensal completa de 2026 disponível no painel):\n\n${opTexts.join('\n\n')}${consolidadoTxt}`

    // Thread — valida a existente ou cria uma nova (título = início da 1a mensagem)
    let threadId: string | null = null
    let threadTitle = ''
    if (thread_id && typeof thread_id === 'string') {
      const { data: t } = await sb.from('geronia_threads').select('id, title').eq('id', thread_id).eq('user_id', caller.id).limit(1)
      if (t && t[0]) { threadId = t[0].id; threadTitle = t[0].title }
    }
    if (!threadId) {
      const title = message.trim().slice(0, 60) + (message.trim().length > 60 ? '…' : '')
      const { data: newT } = await sb.from('geronia_threads').insert({ user_id: caller.id, title }).select('id, title').single()
      threadId = newT!.id
      threadTitle = newT!.title
    }

    // Bloco 5 — memoria (ultimas 5 trocas = ate 10 mensagens, SOMENTE desta thread)
    const { data: history } = await sb
      .from('geronia_conversations')
      .select('role, content, created_at')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: false })
      .limit(10)
    const historyAsc = (history || []).slice().reverse()
    const lastAssistantMsg = [...historyAsc].reverse().find((h: any) => h.role === 'assistant')

    const systemBlocks: Anthropic.Messages.TextBlockParam[] = [
      { type: 'text', text: SYSTEM_FIXED, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: `ACESSO DO USUÁRIO\n${block3}\n\n${block4}` },
    ]

    const messages: Anthropic.Messages.MessageParam[] = [
      ...historyAsc.map((h: any) => ({ role: h.role as 'user' | 'assistant', content: h.content })),
      { role: 'user' as const, content: message.trim() },
    ]

    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! })
    const resp = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      system: systemBlocks,
      messages,
    })

    let replyText = resp.content
      .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('\n')
      .trim()

    // Trava anti-recapitulação: se o modelo reabrir a resposta anterior (ex: colou o texto
    // inteiro de novo antes de responder o que foi perguntado agora), corta essa parte fora.
    replyText = stripRecap(replyText, lastAssistantMsg?.content)

    // Salva historico
    await sb.from('geronia_conversations').insert([
      { user_id: caller.id, thread_id: threadId, role: 'user', content: message.trim() },
      { user_id: caller.id, thread_id: threadId, role: 'assistant', content: replyText },
    ])
    await sb.from('geronia_threads').update({ updated_at: new Date().toISOString() }).eq('id', threadId)

    // Mantem só as ultimas 20 threads do usuario (as mais antigas somem, com suas mensagens)
    const { data: allThreads } = await sb
      .from('geronia_threads')
      .select('id')
      .eq('user_id', caller.id)
      .order('updated_at', { ascending: false })
    if (allThreads && allThreads.length > 20) {
      const staleIds = allThreads.slice(20).map((t: any) => t.id)
      await sb.from('geronia_threads').delete().in('id', staleIds)
    }

    return json({ reply: replyText, thread_id: threadId, thread_title: threadTitle })
  } catch (e) {
    console.error('geronia-chat error:', e)
    return json({ error: 'Erro interno ao processar a mensagem' }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
