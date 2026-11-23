"""
Robô do Seta -> BI das Lojas do SAFI (roda no PC do Douglas).

O que ele faz, por loja e por dia:
  1. Na tela "Relatórios das vendas" do Seta, põe a data nos dois campos de Data da Venda;
  2. exporta em Excel o "01 - Resumo das Vendas" e a "02 - Listagem das Vendas";
  3. lê as duas planilhas e manda as linhas cruas para o SAFI (função bi-importar).
As contas (faturamento, lucro sem frete, vendas, ticket, P.A) e a conferência ficam no SAFI
(_ds/bi-importar_index.ts, testadas em tests/bi-seta.test.js). O robô só clica e lê.

Por que clica por posição: o Seta não mostra o nome dos botões para o Windows (só o das janelas).
Então o robô acha a JANELA pelo nome e clica medindo a partir do canto dela. Se um clique sair
errado, a conferência pega (data diferente, relatório errado, totais que não batem) e nada é gravado.

O Seta roda como ADMINISTRADOR, então este robô também precisa rodar como administrador
(no agendamento do Windows: "Executar com privilégios mais altos").

Configuração e segredos: SÓ no arquivo %USERPROFILE%\\SAFI-robo\\config.ini (nunca neste código).

Uso (num PowerShell de administrador):
  python seta_robo.py rodar                  -> rotina diária: abre cada Seta, busca os dias que faltam, sai e envia
  python seta_robo.py rodar ensaio           -> igual, mas o SAFI só calcula e mostra (não grava)
  python seta_robo.py exportar 2026-11-17     -> com "Relatórios das vendas" aberta: exporta e confere (não envia)
  python seta_robo.py token                  -> gera a senha da importação (grava no config.ini e copia; não mostra)
  python seta_robo.py ler 2026-11-17          -> só lê as planilhas já salvas e confere (não mexe no Seta)
"""
import configparser
import ctypes
import os
import sys
import time
from datetime import date

PASTA = os.path.join(os.path.expanduser('~'), 'SAFI-robo')
CONFIG = os.path.join(PASTA, 'config.ini')
PLANILHAS = os.path.join(PASTA, 'planilhas')
URL_SAFI = 'https://ujsoqyhkebasszwtexmp.supabase.co/functions/v1/bi-importar'

# Posições dentro da janela "Relatórios das vendas" (medidas a partir do canto de cima à esquerda dela).
REL = {
    'lista_relatorios': (200, 50),   # primeira linha visível da lista "Selecione o Modelo de Relatório"
    'data_inicial': (370, 267),
    'data_final': (490, 267),
    'excel': (47, 155),              # "6 - Excel"
    'fechar': (40, 287),             # "0 - Fechar"
}
# Tela de login (conteúdo centralizado): posições medidas a partir do MEIO da janela "SetaERP - Menu Inicial".
LOGIN = {
    'campo': (0, -26),        # campo "Informe o seu nome ou o seu código"
    'retaguarda': (205, 135), # "5 : Retaguarda"
    'sair': (343, 135),       # "6 : Sair"
}
# Menu de cima do Seta logado (medido a partir do canto da janela principal) e a opção Vendas > Relatórios.
MENU = {
    'vendas': (154, 34),
    'vendas_relatorios': (179, 291),
    'sair': (805, 34),
}
# Relatório -> quantas setas para baixo a partir do topo da lista, e as colunas que a planilha TEM que ter.
RELATORIOS = {
    'resumo': (0, ['quantidade', 'total', 'lucro', 'frete']),
    'listagem': (1, ['codigo', 'data', 'total']),
}
TENTATIVAS_RELATORIO = 3  # se exportar o relatório trocado, tenta de novo antes de desistir


def log(*a):
    print(time.strftime('%H:%M:%S'), *a, flush=True)


def carregar_config():
    os.makedirs(PLANILHAS, exist_ok=True)
    cfg = configparser.ConfigParser()
    if not os.path.exists(CONFIG):
        cfg['seta exposicao'] = {'usuario': '', 'senha': ''}
        cfg['seta viacloset'] = {'usuario': '', 'senha': ''}
        cfg['safi'] = {'token': ''}
        cfg['lojas'] = {'Exposicao': r'C:\Exposicao\seta.exe', 'ViaCloset': r'C:\Via\seta.exe'}
        with open(CONFIG, 'w', encoding='utf-8') as f:
            cfg.write(f)
        log('Criei o arquivo de configuração (preencha usuário, senha e token):', CONFIG)
    cfg.read(CONFIG, encoding='utf-8')
    return cfg


def sou_administrador():
    try:
        return bool(ctypes.windll.shell32.IsUserAnAdmin())
    except Exception:
        return False


def arquivo(loja, dia, rel):
    return os.path.join(PLANILHAS, '%s_%s_%s.xls' % (loja, dia, rel))


# ---------- leitura das planilhas ----------

def ler_planilha(caminho, colunas):
    import xlrd
    s = xlrd.open_workbook(caminho).sheet_by_index(0)
    cab = [str(c).strip().lower() for c in s.row_values(0)] if s.nrows else []
    faltam = [c for c in colunas if c not in cab]
    if faltam:
        raise RuntimeError('a planilha %s não tem as colunas %s (relatório errado?)' % (os.path.basename(caminho), faltam))
    linhas = []
    for i in range(1, s.nrows):
        v = s.row_values(i)
        l = {c: v[cab.index(c)] for c in colunas}
        if 'codigo' in l:
            l['codigo'] = str(l['codigo']).strip()
        if 'data' in l:
            l['data'] = str(l['data']).strip()
        linhas.append(l)
    return linhas


def conferencia_local(resumo, listagem):
    """Só para mostrar na tela; a conta que vale é a do SAFI."""
    fat = round(sum(l['total'] for l in resumo), 2)
    vendas = len({l['codigo'] for l in listagem if l['total'] > 0})
    return {
        'faturamento': fat,
        'margem': round(sum(l['lucro'] for l in resumo) - sum(l['frete'] for l in resumo), 2),
        'pecas': int(round(sum(l['quantidade'] for l in resumo))),
        'vendas': vendas,
        'total_listagem': round(sum(l['total'] for l in listagem), 2),
        'datas_listagem': sorted({l['data'] for l in listagem}),
    }


# ---------- tela do Seta ----------

def janela_principal():
    from pywinauto import Desktop
    for t in Desktop(backend='win32').windows():
        if t.class_name().startswith('seta') and t.is_visible() and 'Empresa:' in t.window_text():
            return t
    return None


def loja_da_janela(top):
    t = top.window_text().lower()
    if 'exposi' in t:
        return 'Exposicao'
    if 'via' in t:
        return 'ViaCloset'
    raise RuntimeError('não reconheci a loja no título: ' + top.window_text())


def achar_form(top, nome, espera=15, so_visivel=True):
    fim = time.time() + espera
    while time.time() < fim:
        for d in top.descendants():
            if d.window_text() == nome and (d.is_visible() or not so_visivel):
                return d
        time.sleep(0.3)
    raise RuntimeError('a janela "%s" não apareceu' % nome)


def clicar(form, ponto, pausa=0.5):
    from pywinauto import mouse
    r = form.rectangle()
    mouse.click(coords=(r.left + ponto[0], r.top + ponto[1]))
    time.sleep(pausa)


def teclas(t, pausa=0.3):
    from pywinauto.keyboard import send_keys
    send_keys(t, pause=0.05)
    time.sleep(pausa)


def digitar_data(form, campo, dia):
    clicar(form, REL[campo])
    teclas('{HOME}')
    teclas(dia.strftime('%d%m%Y'), pausa=0.4)


def salvar_como(caminho, espera=20):
    """Espera o "Save As" do Windows, digita o caminho completo e clica em Salvar."""
    from pywinauto import Desktop
    if os.path.exists(caminho):
        os.remove(caminho)
    fim = time.time() + espera
    dlg = None
    while time.time() < fim and not dlg:
        for w in Desktop(backend='win32').windows():
            if w.class_name() == '#32770' and w.is_visible() and w.window_text() in ('Save As', 'Salvar como'):
                dlg = w
                break
        time.sleep(0.3)
    if not dlg:
        raise RuntimeError('a janela de salvar o Excel não abriu')
    edit = [c for c in dlg.descendants() if c.class_name() == 'Edit'][0]
    edit.set_edit_text(caminho)
    time.sleep(0.3)
    botao = [c for c in dlg.descendants() if c.class_name() == 'Button' and c.window_text().replace('&', '') == 'Salvar'][0]
    botao.click()
    fim = time.time() + espera
    while time.time() < fim:
        if os.path.exists(caminho) and os.path.getsize(caminho) > 0:
            t1 = os.path.getsize(caminho)
            time.sleep(0.8)
            if os.path.getsize(caminho) == t1:
                return
        time.sleep(0.3)
    raise RuntimeError('o Seta não gravou o arquivo ' + caminho)


def clicar_centro(form, ponto, pausa=0.6):
    from pywinauto import mouse
    r = form.rectangle()
    mouse.click(coords=((r.left + r.right) // 2 + ponto[0], (r.top + r.bottom) // 2 + ponto[1]))
    time.sleep(pausa)


def clicar_janela(top, ponto, pausa=0.6):
    from pywinauto import mouse
    r = top.rectangle()
    mouse.click(coords=(r.left + ponto[0], r.top + ponto[1]))
    time.sleep(pausa)


def texto_literal(s):
    """Escapa os caracteres que o send_keys trata como comando (+ ^ % ~ ( ) { } [ ])."""
    return ''.join('{%s}' % c if c in '+^%~(){}[]' else c for c in s)


def esperar(cond, espera, passo=0.3):
    fim = time.time() + espera
    while time.time() < fim:
        v = cond()
        if v:
            return v
        time.sleep(passo)
    return None


def aviso_na_tela(top):
    """O aviso "Importante" (notas pendentes etc.) é uma janelinha SEM título dentro do Seta, menor que a tela."""
    rt = top.rectangle()
    for d in top.descendants():
        if d.is_visible() and d.window_text() == '' and d.class_name().startswith('seta'):
            r = d.rectangle()
            if 200 < r.width() < rt.width() - 100 and 150 < r.height() < rt.height() - 100:
                return d
    return None


# Botão "Fechar" do aviso, medido a partir do canto do aviso.
AVISO_FECHAR = (386, 296)


def logado_na_retaguarda(top):
    """Na Retaguarda existe a barra de menu do Windows (Cadastros, Compras, Vendas...); na tela de login, não.
    (A tela "SetaERP - Menu Inicial" às vezes vem marcada como escondida, então não dá para confiar nela.)"""
    import win32gui
    return bool(win32gui.GetMenu(top.handle))


def janela_login():
    from pywinauto import Desktop
    for t in Desktop(backend='win32').windows():
        if t.class_name().startswith('seta') and t.is_visible() and 'Menu Inicial' in t.window_text():
            return t
    return None


def entrar(cfg):
    """Da tela de login até o Seta logado na Retaguarda (título com "Funcionário:").
    Usuário e senha de cada loja ficam em [seta exposicao] / [seta viacloset] no config.ini."""
    top = esperar(janela_login, 60)
    if not top:
        raise RuntimeError('a tela do Seta não abriu')
    loja = loja_da_janela(top)
    secao = 'seta ' + loja.lower()
    usuario = cfg.get(secao, 'usuario', fallback='').strip()
    senha = cfg.get(secao, 'senha', fallback='')
    if not usuario or not senha:
        raise RuntimeError('preencha usuario e senha em [%s] no %s' % (secao, CONFIG))
    log('Entrando no Seta da loja', loja)
    top.set_focus()
    time.sleep(1)
    if logado_na_retaguarda(top):
        return top
    if 'Funcionário:' not in top.window_text():
        form = achar_form(top, 'SetaERP - Menu Inicial', so_visivel=False)
        clicar_centro(form, LOGIN['campo'])
        teclas(texto_literal(usuario) + '{ENTER}', pausa=1.5)
        teclas(texto_literal(senha) + '{ENTER}', pausa=1)
        if not esperar(lambda: 'Funcionário:' in top.window_text(), 15):
            raise RuntimeError('o Seta não aceitou o usuário/senha')
    # Aviso "Importante" (nem sempre aparece): espera um pouco e, se vier, clica em Fechar.
    for _ in range(3):
        aviso = esperar(lambda: aviso_na_tela(top), 6)
        if not aviso:
            break
        log('  aviso na tela -> Fechar')
        clicar(aviso, AVISO_FECHAR, pausa=1.5)
    if aviso_na_tela(top):
        raise RuntimeError('o aviso na tela não fechou')
    form = achar_form(top, 'SetaERP - Menu Inicial', so_visivel=False)
    clicar_centro(form, LOGIN['retaguarda'], pausa=2)
    if not esperar(lambda: logado_na_retaguarda(top), 30):
        raise RuntimeError('não consegui entrar na Retaguarda')
    log('  na Retaguarda:', top.window_text())
    return top


def abrir_relatorios(top):
    """Menu Vendas > Relatórios -> janela "Relatórios das vendas".
    O menu de cima do Seta é um menu padrão do Windows: escolhe pelo NOME (posição só se o nome falhar)."""
    top.set_focus()
    time.sleep(0.5)
    acionar_menu(top, 'Vendas', VENDAS_RELATORIOS)
    try:
        return achar_form(top, 'Relatórios das vendas', espera=8)
    except RuntimeError:
        log('  pelo comando não abriu; tentando pelo teclado (Alt+V e setas)')
        top.set_focus()
        teclas('%v', pausa=0.8)
        teclas('{DOWN}' * VENDAS_RELATORIOS['setas'] + '{ENTER}', pausa=1)
        return achar_form(top, 'Relatórios das vendas', espera=15)


# Menu "Vendas" do Seta: os itens não têm nome para o Windows (o Seta desenha o texto), então o robô
# confere o "desenho" do menu (19 itens, separadores nestas posições) e usa a posição do item.
# Itens (print do Douglas): 0 Consulta · 2-4 Pendentes/Baixadas/Condicionais · 6-8 Cancel./Devol./Estorno ·
# 10 Central de Liberação · 12 E-commerce · 14 Curva ABC · 15 Relatórios · 17 Motor · 18 Central de Mensagens.
VENDAS_RELATORIOS = {'itens': 19, 'separadores': {1, 5, 9, 11, 13, 16}, 'indice': 15, 'setas': 10}


def acionar_menu(top, nome_menu, item):
    """Confere o desenho do submenu e manda ao Seta o comando do item (o mesmo que o clique manda)."""
    import ctypes
    import win32con
    import win32gui
    u = ctypes.windll.user32
    barra = win32gui.GetMenu(top.handle)
    if not barra:
        raise RuntimeError('o Seta está sem a barra de menu')
    idx = None
    for i in range(u.GetMenuItemCount(barra)):
        buf = ctypes.create_unicode_buffer(100)
        u.GetMenuStringW(barra, i, buf, 100, 0x400)
        if buf.value.replace('&', '') == nome_menu:
            idx = i
    if idx is None:
        raise RuntimeError('não achei o menu "%s"' % nome_menu)
    sub = win32gui.GetSubMenu(barra, idx)
    n = u.GetMenuItemCount(sub)
    seps = {i for i in range(n) if u.GetMenuState(sub, i, 0x400) & 0x800}
    if n != item['itens'] or seps != item['separadores']:
        raise RuntimeError('o menu "%s" mudou (itens %s, separadores %s): confira antes de continuar' % (nome_menu, n, sorted(seps)))
    win32gui.PostMessage(top.handle, win32con.WM_COMMAND, u.GetMenuItemID(sub, item['indice']), 0)
    time.sleep(1.5)


def exportar_dia(top, form, loja, dia):
    """Na tela "Relatórios das vendas" aberta: data nos dois campos e exporta os dois relatórios."""
    digitar_data(form, 'data_inicial', dia)
    digitar_data(form, 'data_final', dia)
    for rel, (setas, colunas) in RELATORIOS.items():
        caminho = arquivo(loja, dia.isoformat(), rel)
        for tentativa in range(1, TENTATIVAS_RELATORIO + 1):
            top.set_focus()
            clicar(form, REL['lista_relatorios'])
            time.sleep(0.4 * tentativa)  # o Seta às vezes ignora as setas se vierem rápido demais
            teclas('{HOME}' + '{DOWN}' * setas)
            time.sleep(0.4 * tentativa)
            clicar(form, REL['excel'])
            salvar_como(caminho)
            try:
                ler_planilha(caminho, colunas)  # confere se saiu o relatório certo
                break
            except RuntimeError:
                if tentativa == TENTATIVAS_RELATORIO:
                    raise
                log('  saiu o relatório errado em', os.path.basename(caminho), '- tentando de novo')
        log('  salvei', os.path.basename(caminho))


def ler_dia(loja, dia):
    resumo = ler_planilha(arquivo(loja, dia, 'resumo'), RELATORIOS['resumo'][1])
    listagem = ler_planilha(arquivo(loja, dia, 'listagem'), RELATORIOS['listagem'][1])
    return {'operacao': loja, 'data': dia, 'resumo': resumo, 'listagem': listagem}


def mostrar(p):
    c = conferencia_local(p['resumo'], p['listagem'])
    log('%s %s: faturamento R$ %.2f · lucro (sem frete) R$ %.2f · %s peças · %s vendas' % (p['operacao'], p['data'], c['faturamento'], c['margem'], c['pecas'], c['vendas']))
    log('  conferência: total da listagem R$ %.2f (%s) · datas na listagem: %s' % (
        c['total_listagem'], 'bate' if abs(c['total_listagem'] - c['faturamento']) <= 0.05 else 'NÃO BATE', c['datas_listagem']))


ESTADO = os.path.join(PASTA, 'estado.json')
MAX_DIAS = 31  # se o robô ficar muito tempo sem rodar, busca no máximo os últimos 31 dias
ULTIMO_DA_PLANILHA = "2026-11-15"  # a carga inicial do BI (planilha KPI's Lojas) vai até 15/11


def ler_estado():
    import json
    try:
        with open(ESTADO, encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return {}


def gravar_estado(est):
    import json
    with open(ESTADO, 'w', encoding='utf-8') as f:
        json.dump(est, f, indent=1)


def dias_faltando(ultimo, hoje):
    """Do dia seguinte ao último enviado até ONTEM. Primeira vez: a partir do fim da carga da planilha."""
    from datetime import timedelta
    ontem = hoje - timedelta(days=1)
    ini = date.fromisoformat(ultimo or ULTIMO_DA_PLANILHA) + timedelta(days=1)
    ini = max(ini, ontem - timedelta(days=MAX_DIAS - 1))
    out = []
    while ini <= ontem:
        out.append(ini)
        ini += timedelta(days=1)
    return out


def seta_aberto():
    from pywinauto import Desktop
    return [t for t in Desktop(backend='win32').windows() if t.class_name().startswith('seta') and t.is_visible() and 'Menu Inicial' in t.window_text()]


def abrir_seta(cfg, loja):
    import subprocess
    exe = cfg.get('lojas', loja, fallback='').strip()
    if not exe or not os.path.exists(exe):
        raise RuntimeError('não achei o Seta da loja %s (%s) — confira [lojas] no %s' % (loja, exe, CONFIG))
    log('Abrindo o Seta da loja', loja)
    subprocess.Popen([exe], cwd=os.path.dirname(exe))
    # O Seta demora para abrir e o título vai se completando: espera aparecer "Empresa:" e a tela de login.
    def pronto():
        for t in seta_aberto():
            if 'Empresa:' in t.window_text() and any(d.window_text() == 'SetaERP - Menu Inicial' for d in t.descendants()):
                return t
        return None
    top = esperar(pronto, 120, passo=1)
    if not top:
        raise RuntimeError('o Seta da loja %s não abriu' % loja)
    time.sleep(3)
    if loja_da_janela(top) != loja:
        raise RuntimeError('abriu o Seta de outra loja: ' + top.window_text())
    return top


def sair(top):
    """Fecha "Relatórios das vendas", menu Sair (volta ao login) e "6 : Sair" (fecha o Seta)."""
    import ctypes
    import win32con
    import win32gui
    u = ctypes.windll.user32
    top.set_focus()
    time.sleep(0.5)
    rel = [d for d in top.descendants() if d.window_text() == 'Relatórios das vendas' and d.is_visible()]
    if rel:
        clicar(rel[0], REL['fechar'], pausa=1.5)
    barra = win32gui.GetMenu(top.handle)
    if barra:
        for i in range(u.GetMenuItemCount(barra)):
            buf = ctypes.create_unicode_buffer(100)
            u.GetMenuStringW(barra, i, buf, 100, 0x400)
            if buf.value.replace('&', '') == 'Sair':
                win32gui.PostMessage(top.handle, win32con.WM_COMMAND, u.GetMenuItemID(barra, i), 0)
        if not esperar(lambda: not win32gui.GetMenu(top.handle), 20):
            raise RuntimeError('o Seta não saiu da Retaguarda')
        time.sleep(1.5)
    form = achar_form(top, 'SetaERP - Menu Inicial', so_visivel=False)
    clicar_centro(form, LOGIN['sair'], pausa=2)
    if not esperar(lambda: not win32gui.IsWindow(top.handle), 30):
        raise RuntimeError('o Seta não fechou')
    log('  Seta fechado')


def rodar(cfg, ensaio=False):
    """Rotina diária: para cada loja, os dias que faltam -> exporta, confere e manda ao SAFI."""
    if seta_aberto():
        raise RuntimeError('o Seta já está aberto: feche antes (o robô abre e fecha sozinho)')
    est = ler_estado()
    hoje = date.today()
    planilhas = []
    for loja in ('Exposicao', 'ViaCloset'):
        dias = dias_faltando(est.get(loja), hoje)
        if not dias:
            log(loja, ': nada a buscar')
            continue
        log(loja, ': dias', ', '.join(d.strftime('%d/%m') for d in dias))
        top = abrir_seta(cfg, loja)
        try:
            top = entrar(cfg)
            form = abrir_relatorios(top)
            for d in dias:
                exportar_dia(top, form, loja, d)
                p = ler_dia(loja, d.isoformat())
                mostrar(p)
                planilhas.append(p)
        finally:
            sair(top)
    if not planilhas:
        return 0
    if not cfg.get('safi', 'token', fallback='').strip():
        log('Sem o token do SAFI no config.ini: exportei e conferi, mas NÃO enviei.')
        return 0
    r = enviar(cfg, planilhas, ensaio=ensaio)
    log('SAFI:', 'ENSAIO (nada gravado)' if ensaio else '', 'gravadas', r.get('gravadas'), '· recusadas', len(r.get('erros') or []))
    for l in r.get('linhas') or []:
        log('  %s %s: fat %.2f · margem %.2f · %s vendas · ticket %.2f · P.A %.2f' % (
            l['operacao'], l['data'], l['faturamento'], l['margem'], l['qtd_vendas'], l['ticket_medio'] or 0, l['pecas_atendimento'] or 0))
    for e in r.get('erros') or []:
        log('  RECUSADO:', e.get('motivo'))
    for s in r.get('semVendas') or []:
        log('  sem vendas:', s)
    if r.get('erro'):
        raise RuntimeError('SAFI: ' + str(r['erro']))
    if not ensaio and r.get('ok'):
        # Avança só até o último dia bom EM SEQUÊNCIA: um dia recusado é tentado de novo na próxima vez.
        recusados = {(e.get('motivo') or '').split(':')[0] for e in r.get('erros') or []}
        for loja in ('Exposicao', 'ViaCloset'):
            for p in sorted((p for p in planilhas if p['operacao'] == loja), key=lambda p: p['data']):
                if loja + ' ' + p['data'] in recusados:
                    break
                est[loja] = p['data']
        gravar_estado(est)
    return 0


def criar_token():
    """Gera a senha da importação, grava no config.ini e copia para a área de transferência
    (para colar no Supabase como BI_IMPORT_TOKEN). Não mostra o valor na tela."""
    import re
    import secrets
    import subprocess
    with open(CONFIG, encoding='utf-8') as f:
        txt = f.read()
    m = re.search(r'(?ms)^\[safi\]\s*$.*?^token[ \t]*=[ \t]*(.*?)[ \t]*$', txt)
    if not m:
        print('Não achei a linha "token =" na parte [safi] do', CONFIG)
        return 1
    if m.group(1):
        print('Já existe um token no config.ini; não troquei. Para gerar outro, apague o valor da linha "token =" e rode de novo.')
        return 1
    tok = secrets.token_urlsafe(32)
    txt = txt[:m.start(1)] + tok + txt[m.end(1):]
    with open(CONFIG, 'w', encoding='utf-8') as f:
        f.write(txt)
    subprocess.run('clip', input=tok.encode('utf-16-le'), check=True)
    print('Token gerado, gravado no config.ini e COPIADO (Ctrl+V). Agora cole no Supabase como BI_IMPORT_TOKEN.')
    return 0


def enviar(cfg, planilhas, ensaio=False):
    """Manda as planilhas cruas ao SAFI; com ensaio=True o SAFI só calcula e devolve (não grava)."""
    import json
    import urllib.request
    token = cfg.get('safi', 'token', fallback='').strip()
    if not token:
        raise RuntimeError('falta o token do SAFI no ' + CONFIG)
    corpo = json.dumps({"planilhas": planilhas, "ensaio": ensaio}).encode('utf-8')
    req = urllib.request.Request(URL_SAFI, data=corpo, method='POST', headers={
        'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        return json.loads(e.read().decode('utf-8') or '{}') | {'ok': False, 'status': e.code}


def main(args):
    cfg = carregar_config()
    if args and args[0] == 'entrar':
        # Teste: com o Seta na tela de login, entra, vai para a Retaguarda e abre Vendas > Relatórios.
        if not sou_administrador():
            print('Rode como administrador.')
            return 1
        top = entrar(cfg)
        import win32gui
        log('  menu de verdade do Windows?', bool(win32gui.GetMenu(top.handle)))
        abrir_relatorios(top)
        log('Cheguei em "Relatórios das vendas".')
        return 0
    if args and args[0] == 'token':
        return criar_token()
    if args and args[0] == 'rodar':
        if not sou_administrador():
            print('Rode como administrador.')
            return 1
        return rodar(cfg, ensaio='ensaio' in args[1:])
    if not args or args[0] not in ('exportar', 'ler'):
        print(__doc__)
        return 1
    dia = date.fromisoformat(args[1]) if len(args) > 1 else None
    if not dia:
        print('Informe o dia: aaaa-mm-dd')
        return 1
    if args[0] == 'ler':
        for loja in ('Exposicao', 'ViaCloset'):
            if os.path.exists(arquivo(loja, dia.isoformat(), 'resumo')):
                mostrar(ler_dia(loja, dia.isoformat()))
        return 0
    if not sou_administrador():
        print('Rode como administrador (o Seta roda como administrador e o Windows bloqueia o clique).')
        return 1
    top = janela_principal()
    if not top:
        print('Não achei o Seta aberto.')
        return 1
    loja = loja_da_janela(top)
    top.set_focus()
    time.sleep(0.5)
    form = achar_form(top, 'Relatórios das vendas', espera=3)
    log('Loja:', loja, '· dia:', dia.isoformat())
    exportar_dia(top, form, loja, dia)
    mostrar(ler_dia(loja, dia.isoformat()))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
