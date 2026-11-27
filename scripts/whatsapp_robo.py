"""Robô do WhatsApp -> mensagem diária da meta de peças no grupo "Informativo Colaboradores".

Todo dia às 17:30 (Agendador do Windows) abre o WhatsApp Web num Edge escondido (perfil próprio em
%USERPROFILE%\\SAFI-robo\\whatsapp-perfil, conectado uma vez pelo QR), entra no grupo e manda a mesma mensagem do
botão "Compartilhar no WhatsApp" da página https://topfinds.com.br/meta (o texto é lido do próprio botão, então
a regra da mensagem fica só na página, que tem teste).

Combinado com o Douglas (26/11/2026): custo zero; se o PC estiver desligado às 17:30, pula o dia (não manda
atrasado). Manda do 1º dia da meta até o dia seguinte ao fim (o resultado final) e no máximo uma vez por dia.

Uso:
  python whatsapp_robo.py           -> manda (se for a hora e ainda não mandou hoje)
  python whatsapp_robo.py entrar    -> abre o WhatsApp Web à vista para escanear o QR (uma vez só)
  python whatsapp_robo.py ensaio    -> escondido, digita a mensagem no grupo mas NÃO envia (apaga em seguida)
  python whatsapp_robo.py agora     -> manda já, fora do horário (ex.: lembrou depois). Ainda só uma vez por dia.
  python whatsapp_robo.py teste     -> manda de verdade, mas só na conversa "Meu numero (você)" (não conta como o dia)
  python whatsapp_robo.py alerta-bi -> (10h) se o BI tiver operação atrasada, avisa no "Meu numero" do Douglas
"""
import base64
import json
import os
import sys
import time
import urllib.parse
from datetime import date, datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import seta_robo as base  # noqa: E402  (log e a pasta do robô são os mesmos)

GRUPO = 'Informativo Colaboradores'
GRUPO_TESTE = 'Meu numero'  # conversa do Douglas com ele mesmo, para testar envios de verdade
URL_META = 'https://topfinds.com.br/meta'
URL_WHATSAPP = 'https://web.whatsapp.com/'
PERFIL = os.path.join(base.PASTA, 'whatsapp-perfil')
ULTIMO = os.path.join(base.PASTA, 'whatsapp.json')
# Sem janela, o Edge se apresenta como "HeadlessChrome" e o WhatsApp Web recusa; usa a identificação normal do Edge.
AGENTE = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) '
          'Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0')


def deve_enviar(hoje, inicio, fim, ultimo, hora, forcar=False):
    """(enviar?, motivo). Datas em date; hora 'HH:MM'; ultimo = date do último envio ou None."""
    if ultimo == hoje:
        return False, 'já mandei hoje'
    if hoje < inicio:
        return False, 'a meta ainda não começou (começa em %s)' % inicio.strftime('%d/%m')
    if hoje > fim + timedelta(days=1):
        return False, 'a meta já acabou (%s)' % fim.strftime('%d/%m')
    if not forcar and not ('17:30' <= hora <= '19:00'):
        return False, 'fora do horário (%s): o PC estava desligado às 17:30, pulo o dia' % hora
    return True, ''


def ler_ultimo():
    try:
        with open(ULTIMO, encoding='utf-8') as f:
            return date.fromisoformat(json.load(f)['quando'])
    except Exception:
        return None


def mensagem_da_pagina(ctx):
    """Abre a página pública da meta (tamanho de celular) e devolve (dados da meta, mensagem do botão do WhatsApp,
    imagem da meta ou None). A imagem é a mesma do botão de compartilhar (imagemDaMeta, na própria página)."""
    page = ctx.new_page()
    try:
        page.set_viewport_size({'width': 420, 'height': 900})
        page.goto(URL_META, wait_until='domcontentloaded', timeout=60000)
        page.wait_for_selector('#zap:not([hidden])', state='attached', timeout=60000)
        href = page.get_attribute('#zap', 'href') or ''
        texto = urllib.parse.parse_qs(urllib.parse.urlparse(href).query).get('text', [''])[0]
        dados = page.evaluate("async () => (await sb.rpc('meta_pecas_publica')).data")
        if not texto or not dados:
            raise RuntimeError('a página da meta não montou a mensagem')
        imagem = None
        try:
            page.wait_for_timeout(4500)  # espera as barras, a motinha e os patinetes chegarem no lugar
            b64 = page.evaluate("""async () => { const b = await imagemDaMeta(); const u = new Uint8Array(await b.arrayBuffer());
              let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
              return btoa(s); }""")
            imagem = os.path.join(base.PASTA, 'whatsapp_meta.png')
            with open(imagem, 'wb') as f:
                f.write(base64.b64decode(b64))
        except Exception as e:
            base.log('WhatsApp: não consegui a imagem da meta (%s); mando só o texto' % e)
            imagem = None
        return dados, texto, imagem
    finally:
        page.close()


def abrir_whatsapp(ctx, espera_login=0):
    """Abre o WhatsApp Web e espera a lista de conversas. Se pedir QR: espera `espera_login` s (modo entrar) ou falha."""
    page = ctx.pages[0] if ctx.pages else ctx.new_page()
    page.goto(URL_WHATSAPP, wait_until='domcontentloaded', timeout=60000)
    fim = time.time() + 90 + espera_login
    while time.time() < fim:
        if page.locator('#pane-side').count():
            return page
        if not espera_login and page.locator('canvas[aria-label], [data-ref]').count():
            raise RuntimeError('o WhatsApp Web está desconectado: rode "python whatsapp_robo.py entrar" e escaneie o QR')
        page.wait_for_timeout(1000)
    raise RuntimeError('o WhatsApp Web não abriu a lista de conversas')


def abrir_grupo(page, nome=GRUPO):
    busca = page.locator('#side [contenteditable="true"], #side input[type="text"], #side [role="textbox"]').first
    busca.click(timeout=20000)
    page.keyboard.press('Control+A')
    page.keyboard.insert_text(nome)
    # o resultado da busca vem com o nome "picado" em pedaços (destaque do termo): procura pelo texto inteiro.
    # O grupo de verdade tem que bater o nome exato; a conversa de teste aparece como "Meu numero: (você)".
    exato = nome == GRUPO
    page.locator('#pane-side').get_by_text(nome, exact=exato).first.click(timeout=20000)
    page.locator('#main header').get_by_text(nome, exact=exato).first.wait_for(timeout=20000)


def limpar_rascunho(page):
    """Apaga o que estiver escrito na caixa e confere que ficou vazia (26/11: o 1º ensaio deixou rascunho no grupo,
    porque o Edge fechou antes do WhatsApp salvar a caixa vazia)."""
    caixa = page.locator('#main footer [contenteditable="true"]').first
    for _ in range(6):
        if not caixa.inner_text().strip():
            break
        caixa.click()
        page.keyboard.press('Control+A')
        page.keyboard.press('Backspace')
        page.wait_for_timeout(800)
    if caixa.inner_text().strip():
        raise RuntimeError('não consegui apagar o rascunho no WhatsApp')
    page.wait_for_timeout(3000)  # dá tempo do WhatsApp gravar o rascunho vazio antes de fechar


def mensagens_com(page, trecho):
    """Quantas mensagens da conversa (fora a caixa de escrever) têm esse trecho."""
    return page.evaluate("""t => [...document.querySelectorAll('#main .copyable-text')]
        .filter(e => !e.closest('footer') && (e.textContent || '').includes(t)).length""", trecho)


def situacao_da_ultima(page, trecho):
    """Marcas da última mensagem da conversa que tem esse trecho (o WhatsApp põe 'Enviada', 'Entregue', 'Lida' ou
    'Ocorreu um erro...'). Procura pelo texto porque às vezes a última linha da conversa é uma linha vazia."""
    return page.evaluate("""t => { const r = [...document.querySelectorAll('#main [role="row"]')].filter(x => (x.innerText || '').includes(t)).pop();
        return r ? [...r.querySelectorAll('[aria-label]')].map(e => (e.getAttribute('aria-label') || '').trim()) : []; }""", trecho)


def colar_imagem(page, imagem):
    """Cola a imagem na conversa (como Ctrl+V): o WhatsApp abre a tela da imagem com a legenda já em foco."""
    with open(imagem, 'rb') as f:
        b64 = base64.b64encode(f.read()).decode()
    page.locator('#main footer [contenteditable="true"]').first.click(timeout=20000)
    page.evaluate("""b64 => { const bin = atob(b64); const u = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
        const dt = new DataTransfer(); dt.items.add(new File([u], 'meta-de-pecas.png', { type: 'image/png' }));
        document.activeElement.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); }""", b64)
    legenda = page.locator('[contenteditable="true"][aria-placeholder="Adicione uma legenda"], [contenteditable="true"][aria-label*="legenda"]').first
    legenda.wait_for(timeout=20000)
    legenda.click()


def escrever_no_grupo(page, texto, imagem=None, ensaio=False):
    """Manda a imagem da meta com a mensagem na legenda (ou só o texto, se não houver imagem).
    Escreve linha por linha (Shift+Enter entre elas). No ensaio, apaga tudo sem enviar.
    Devolve quantas mensagens com a 1a linha já existiam (para confirmar_envio achar a nova)."""
    antes = mensagens_com(page, texto.split('\n')[0])
    if imagem:
        colar_imagem(page, imagem)
    else:
        page.locator('#main footer [contenteditable="true"]').first.click(timeout=20000)
    linhas = texto.split('\n')
    for i, linha in enumerate(linhas):
        if linha:
            page.keyboard.insert_text(linha)
        if i < len(linhas) - 1:
            page.keyboard.press('Shift+Enter')
    page.wait_for_timeout(800)
    if ensaio:
        page.screenshot(path=os.path.join(base.PASTA, 'whatsapp_ensaio.png'))
        if imagem:
            page.keyboard.press('Escape')  # fecha a tela da imagem sem enviar
            page.wait_for_timeout(1500)
        limpar_rascunho(page)
        return antes
    page.keyboard.press('Enter')
    # Espera a mensagem nova ficar "Enviada"/"Entregue"/"Lida". A imagem demora a subir: fechar o Edge antes deixa a
    # mensagem com erro (26/11, no teste). Se o WhatsApp marcar "Ocorreu um erro", para e avisa.
    fim = time.time() + 180
    while time.time() < fim:
        page.wait_for_timeout(2000)
        if mensagens_com(page, linhas[0]) <= antes:
            continue
        marcas = situacao_da_ultima(page, linhas[0])
        if any(m.startswith('Ocorreu um erro') for m in marcas):
            raise RuntimeError('o WhatsApp deu erro ao enviar a mensagem')
        if any(m in ('Enviada', 'Entregue', 'Lida') for m in marcas):
            page.wait_for_timeout(3000)
            return antes
    raise RuntimeError('a mensagem não terminou de enviar (sem internet?)')


def confirmar_envio(page, texto, antes):
    if mensagens_com(page, texto.split('\n')[0]) <= antes:
        raise RuntimeError('não achei a mensagem enviada no grupo')


def gravar_ultimo(texto):
    with open(ULTIMO, 'w', encoding='utf-8') as f:
        json.dump({'quando': date.today().isoformat(), 'hora': time.strftime('%H:%M'), 'mensagem': texto}, f, ensure_ascii=False)


# ── Alerta das 10h: BI com dado atrasado (decidido com o Douglas em 27/11/2026) ──
NOMES_BI = {'Exposicao': 'Exposição', 'ViaCloset': 'Via Closet', 'GIP': 'E-commerce'}


def atraso_bi(conferido_ate, agora):
    """Mesma regra do BI (atrasoBI em bi.html): depois das 9h o esperado é ontem; antes, anteontem."""
    if not conferido_ate:
        return None
    hora = agora.hour
    esperado = agora.date() - timedelta(days=1 if hora >= 9 else 2)
    return max(0, (esperado - date.fromisoformat(conferido_ate)).days)


def situacao_bi(cfg):
    """Até que dia cada operação está conferida, lido do SAFI (o mesmo que o BI mostra)."""
    import urllib.request
    token = cfg.get('safi', 'token', fallback='').strip()
    req = urllib.request.Request(base.URL_SAFI, data=json.dumps({'consulta': True}).encode('utf-8'), method='POST',
                                 headers={'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode('utf-8')).get('situacao') or []


def texto_alerta_bi(regs, agora):
    """Mensagem do alerta, ou '' se tudo estiver em dia."""
    linhas, atrasou = [], False
    for op in ('Exposicao', 'ViaCloset', 'GIP'):
        r = next((x for x in regs if x.get('operacao') == op), {})
        a = atraso_bi(r.get('conferido_ate'), agora)
        nome = NOMES_BI[op]
        if a is None:
            linhas.append('%s: sem registro.' % nome)
        elif a == 0:
            linhas.append('%s: em dia (até %s).' % (nome, r['conferido_ate'][8:10] + '/' + r['conferido_ate'][5:7]))
        else:
            atrasou = True
            t = '%s: até %s, %d dia%s de atraso.' % (nome, r['conferido_ate'][8:10] + '/' + r['conferido_ate'][5:7], a, '' if a == 1 else 's')
            if r.get('ultimo_erro'):
                t += ' Motivo: %s.' % r['ultimo_erro']
            else:
                t += ' O robô não rodou (PC desligado?).'
            linhas.append(t)
    if not atrasou:
        return ''
    return 'SAFI · BI com dado atrasado\n\n' + '\n'.join(linhas) + '\n\nVer no BI: https://topfinds.com.br/bi'


def alerta_bi(ctx, texto):
    """Manda o alerta só para a conversa do Douglas com ele mesmo (GRUPO_TESTE), nunca para o grupo."""
    page = abrir_whatsapp(ctx)
    abrir_grupo(page, GRUPO_TESTE)
    antes = escrever_no_grupo(page, texto)
    confirmar_envio(page, texto, antes)
    base.log('WhatsApp: alerta de BI atrasado enviado no', GRUPO_TESTE)


def rodar(modo=''):
    from playwright.sync_api import sync_playwright
    texto_alerta = ''
    if modo == 'alerta-bi':
        texto_alerta = texto_alerta_bi(situacao_bi(base.carregar_config()), datetime.now())
        if not texto_alerta:
            base.log('WhatsApp: BI em dia, sem alerta')
            return
    visivel = modo == 'entrar'  # o ensaio roda escondido, igual ao envio de todo dia
    os.makedirs(PERFIL, exist_ok=True)
    with sync_playwright() as p:
        ctx = p.chromium.launch_persistent_context(
            PERFIL, channel='msedge', headless=not visivel, viewport={'width': 1280, 'height': 860},
            locale='pt-BR', timezone_id='America/Sao_Paulo', user_agent=None if visivel else AGENTE)
        try:
            if modo == 'alerta-bi':
                return alerta_bi(ctx, texto_alerta)
            if modo == 'entrar':
                base.log('WhatsApp: escaneie o QR no Edge que abriu (tenho 5 minutos)')
                abrir_whatsapp(ctx, espera_login=300)
                page = ctx.pages[0]
                page.wait_for_timeout(8000)  # deixa terminar de sincronizar
                base.log('WhatsApp: conectado')
                return
            dados, texto, imagem = mensagem_da_pagina(ctx)
            hoje = date.fromisoformat(dados['hoje'])
            ok, motivo = deve_enviar(hoje, date.fromisoformat(dados['inicio']), date.fromisoformat(dados['fim']),
                                     ler_ultimo(), time.strftime('%H:%M'), forcar=modo in ('agora', 'ensaio', 'teste'))
            if not ok and modo not in ('ensaio', 'teste'):
                base.log('WhatsApp: não mando hoje -', motivo)
                return
            page = abrir_whatsapp(ctx)
            abrir_grupo(page, GRUPO_TESTE if modo == 'teste' else GRUPO)
            antes = escrever_no_grupo(page, texto, imagem=imagem, ensaio=modo == 'ensaio')
            if modo == 'ensaio':
                base.log('WhatsApp: ENSAIO ok (montei imagem e legenda no grupo e apaguei, nada enviado). Foto em whatsapp_ensaio.png')
                return
            confirmar_envio(page, texto, antes)
            if modo == 'teste':
                base.log('WhatsApp: TESTE enviado na conversa', GRUPO_TESTE, '(o grupo não recebeu nada)')
                return
            gravar_ultimo(texto)
            base.log('WhatsApp: mensagem da meta enviada no grupo', GRUPO, '-', texto.split('\n')[1])
        finally:
            ctx.close()


if __name__ == '__main__':
    args = sys.argv[1:]
    try:
        rodar(args[0] if args else '')
        sys.exit(0)
    except Exception as e:
        import traceback
        base.log('WhatsApp: ERRO:', e)
        base.log(traceback.format_exc())
        sys.exit(1)
