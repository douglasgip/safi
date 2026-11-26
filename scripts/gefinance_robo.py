"""Robô do GeFinance (e-commerce / GIP) -> BI das Lojas do SAFI.

Abre o GeFinance num Edge escondido (perfil próprio em %USERPROFILE%\\SAFI-robo\\gefinance-perfil), entra com o
e-mail/senha da parte [gefinance] do config.ini quando o site pedir login, filtra do início do mês até ontem no painel
de Margem e lê a resposta que o próprio site recebe: dia a dia o faturamento total, a margem de lucro bruto e a
quantidade de vendas (os mesmos números dos cartões). Manda ao SAFI (bi-importar) como operação GIP.
Atualiza o mês inteiro todo dia: o GeFinance vai baixando a margem dos dias passados (comissão, frete, taxas).
Não usa mouse nem tela, então roda mesmo com o PC bloqueado.

Uso:
  python gefinance_robo.py            -> busca e envia
  python gefinance_robo.py ensaio     -> busca e mostra o que mandaria (o SAFI só calcula, não grava)
  python gefinance_robo.py ver        -> igual ao primeiro, mas com o Edge à vista (para acompanhar)
"""
import json
import os
import sys
import time
from datetime import date, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import seta_robo as base  # noqa: E402  (log, config, envio ao SAFI e a pasta do robô são os mesmos)

PERFIL = os.path.join(base.PASTA, 'gefinance-perfil')
URL_MARGEM = 'https://app.ge.finance/minha-conta/dashboard/margem'
ULTIMO = os.path.join(base.PASTA, 'ultimo_gefinance.json')


def linhas_do_gefinance(resposta, hoje):
    """Resposta do painel de Margem (kpis.revenueVersusMargin) -> linhas do BI, um dia por linha.
    Só dias já fechados (antes de hoje): o dia de hoje ainda está acontecendo."""
    kpi = ((resposta or {}).get('kpis') or {}).get('revenueVersusMargin') or {}
    if kpi.get('status') not in (None, 'ok'):
        raise RuntimeError('o GeFinance respondeu "%s" para o dia a dia' % kpi.get('status'))
    dias = {}
    for d in kpi.get('base') or []:
        dia = str(d.get('date') or '')[:10]
        if len(dia) != 10 or dia >= hoje.isoformat():
            continue
        fat = round(float(d.get('revenue') or 0), 2)
        vendas = int(d.get('salesQuantity') or 0)
        dias[dia] = {'operacao': 'GIP', 'data': dia, 'faturamento': fat,
                     'margem': round(float(d.get('contributionMargin') or 0), 2), 'qtd_vendas': vendas,
                     'ticket_medio': round(fat / vendas, 2) if vendas else None}
    return [dias[k] for k in sorted(dias)]


def entrar_se_preciso(page, cfg):
    """Se o GeFinance mostrar a tela de login, entra com o e-mail/senha que o Douglas pôs no config.ini."""
    email_campo = page.get_by_placeholder('Digite o seu e-mail')
    painel = page.get_by_text('Filtros', exact=True)
    painel.or_(email_campo).first.wait_for(timeout=90000)
    if not email_campo.is_visible():
        return
    email = cfg.get('gefinance', 'email', fallback='').strip()
    senha = cfg.get('gefinance', 'senha', fallback='')
    if not email or not senha:
        raise RuntimeError('o GeFinance pediu login: preencha email e senha em [gefinance] no ' + base.CONFIG)
    base.log('GeFinance: entrando (o login tinha expirado)')
    email_campo.fill(email)
    page.get_by_placeholder('Digite sua senha').fill(senha)
    page.get_by_role('button', name='Entrar').click()
    try:
        page.wait_for_url('**/minha-conta/**', timeout=60000)
    except Exception:
        raise RuntimeError('o GeFinance não aceitou o login (confira [gefinance] no config.ini)')
    if '/dashboard/margem' not in page.url:
        page.goto(URL_MARGEM, wait_until='domcontentloaded', timeout=60000)
    painel.first.wait_for(timeout=90000)


def periodo_de_busca(hoje):
    """O mês inteiro até ontem: o GeFinance vai baixando a margem dos dias passados (comissão, frete e taxas
    lançados depois), então todo dia o mês todo é atualizado. Nos 5 primeiros dias do mês pega também o mês
    anterior, para fechar os números dele."""
    fim = hoje - timedelta(days=1)
    inicio = hoje.replace(day=1)
    if hoje.day <= 5:
        inicio = (inicio - timedelta(days=1)).replace(day=1)
    return inicio, fim


MESES = ('janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro',
         'novembro', 'dezembro')


def rotulo_do_dia(d):
    """Como o calendário do GeFinance chama cada dia (aria-label): "1 de novembro de 2026"."""
    return '%d de %s de %d' % (d.day, MESES[d.month - 1], d.year)


def clicar_dia(page, d):
    """Clica no dia `d` do calendário do filtro, voltando ou avançando o mês até ele aparecer."""
    for _ in range(14):
        cel = page.locator('.mat-calendar-body-cell[aria-label="%s"]' % rotulo_do_dia(d))
        if cel.count():
            cel.first.click()
            page.wait_for_timeout(300)
            return
        visto = (page.locator('.mat-calendar-body-cell').first.get_attribute('aria-label') or '').split(' de ')
        mes_visto = (int(visto[2]), MESES.index(visto[1]) + 1) if len(visto) == 3 and visto[1] in MESES else None
        anterior = mes_visto is not None and (d.year, d.month) < mes_visto
        page.get_by_label('Previous month' if anterior else 'Next month').click()
        page.wait_for_timeout(300)
    raise RuntimeError('não achei o dia %s no calendário do GeFinance' % d.isoformat())


def buscar(cfg, visivel=False, hoje=None):
    """Abre o painel de Margem, filtra do início do mês (ver periodo_de_busca) até ontem e devolve o JSON que o
    site recebeu. Confere que o GeFinance filtrou exatamente esse período antes de usar."""
    from playwright.sync_api import sync_playwright
    inicio, fim = periodo_de_busca(hoje or date.today())
    os.makedirs(PERFIL, exist_ok=True)
    with sync_playwright() as p:
        ctx = p.chromium.launch_persistent_context(
            PERFIL, channel='msedge', headless=not visivel, viewport={'width': 1440, 'height': 900},
            locale='pt-BR', timezone_id='America/Sao_Paulo')
        try:
            page = ctx.pages[0] if ctx.pages else ctx.new_page()
            page.goto(URL_MARGEM, wait_until='domcontentloaded', timeout=60000)
            entrar_se_preciso(page, cfg)
            page.get_by_text('Filtros', exact=True).first.click(timeout=30000)
            page.get_by_text('Dia', exact=True).first.click(timeout=15000)
            # Os campos de data são só de leitura: escolhe no calendário (1º clique = início, 2º = fim).
            clicar_dia(page, inicio)
            clicar_dia(page, fim)
            with page.expect_response(lambda r: 'dashboard-kpis/margin' in r.url and r.request.method == 'POST',
                                      timeout=90000) as info:
                page.get_by_role('button', name='Aplicar').click()
            resp = info.value
            if resp.status != 200:
                raise RuntimeError('o GeFinance respondeu %s ao pedir os números' % resp.status)
            pedido = resp.request.post_data or ''
            esperado = 'firstDate=%s&endDate=%s' % (inicio.isoformat(), fim.isoformat())
            if esperado not in pedido:
                raise RuntimeError('o filtro do GeFinance não ficou no período certo (queria %s)' % esperado)
            return resp.json()
        finally:
            ctx.close()


def rodar_gefinance(cfg, ensaio=False, visivel=False):
    """Busca o mês no GeFinance (ver periodo_de_busca) e manda ao SAFI. Devolve as linhas enviadas."""
    base.log('GeFinance: buscando o mês')
    linhas = linhas_do_gefinance(buscar(cfg, visivel=visivel), date.today())
    if not linhas:
        raise RuntimeError('o GeFinance não trouxe nenhum dia fechado')
    for l in linhas:
        base.log('  GIP %s: fat %.2f · margem %.2f · %d vendas · ticket %.2f' % (
            l['data'], l['faturamento'], l['margem'], l['qtd_vendas'], l['ticket_medio'] or 0))
    r = base.enviar(cfg, linhas=linhas, ensaio=ensaio)
    base.log('SAFI (GeFinance):', 'ENSAIO (nada gravado)' if ensaio else '', 'gravadas', r.get('gravadas'),
             '· recusadas', len(r.get('erros') or []))
    for e in r.get('erros') or []:
        base.log('  RECUSADO:', e.get('motivo'))
    if r.get('erro'):
        raise RuntimeError('SAFI: ' + str(r['erro']))
    if not ensaio:
        with open(ULTIMO, 'w', encoding='utf-8') as f:
            json.dump({'quando': date.today().isoformat(), 'hora': time.strftime('%H:%M'), 'linhas': linhas}, f, ensure_ascii=False)
    return linhas


if __name__ == '__main__':
    args = sys.argv[1:]
    try:
        rodar_gefinance(base.carregar_config(), ensaio='ensaio' in args, visivel='ver' in args)
        sys.exit(0)
    except Exception as e:
        import traceback
        base.log('GeFinance: ERRO:', e)
        base.log(traceback.format_exc())
        sys.exit(1)
