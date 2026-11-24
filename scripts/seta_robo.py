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
  python seta_robo.py agendado               -> o que o Agendador chama: só age se faltar dia; avisa antes (com "Adiar")
  python seta_robo.py buscar ViaCloset 2026-11-14 -> dia(s) avulso(s) de uma loja (não mexe no estado.json)
  Agendamento: scripts/instalar-agendamento.ps1 (como administrador) instala a tarefa "SAFI - Robo do Seta".
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


LOG = os.path.join(PASTA, 'robo.log')


def log(*a):
    linha = time.strftime('%d/%m %H:%M:%S') + ' ' + ' '.join(str(x) for x in a)
    print(linha, flush=True)
    try:
        os.makedirs(PASTA, exist_ok=True)
        with open(LOG, 'a', encoding='utf-8') as f:
            f.write(linha + '\n')
    except OSError:
        pass


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


def focar(w, tentativas=4):
    """Traz a janela para a frente. Rodando pelo Agendador, o Windows às vezes recusa ("SetForegroundWindow");
    um Alt solto destrava essa trava. Se mesmo assim não der, desiste com uma mensagem clara."""
    import win32con
    import win32gui
    u = ctypes.windll.user32
    for _ in range(tentativas):
        try:
            w.set_focus()
            return
        except Exception:
            u.keybd_event(0x12, 0, 0, 0)  # Alt pressionado...
            u.keybd_event(0x12, 0, 2, 0)  # ...e solto
            try:
                win32gui.ShowWindow(w.handle, win32con.SW_RESTORE)
                win32gui.SetForegroundWindow(w.handle)
                return
            except Exception:
                time.sleep(1.5)
    raise RuntimeError('o Windows não deixou trazer o Seta para a frente (tela bloqueada ou desligada?)')


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


class SemRegistros(Exception):
    """O Seta avisou que não há vendas no dia (feriado, loja fechada): no lugar do "Salvar como" vem um aviso."""


# Texto de aviso do Seta que quer dizer "não teve venda nesse dia".
SEM_REGISTRO = r'nenhum|n[ãa]o (h[áa]|existe|foram|foi|encontr|possui)|sem (registro|dado|movimento|venda)|vazi'


def eh_sem_registro(texto):
    import re
    return bool(re.search(SEM_REGISTRO, texto or '', re.I))


def mensagem_do_seta():
    """Janela de aviso aberta pelo Seta (fora a janela principal e o "Salvar como"): devolve (janela, texto) ou None."""
    from pywinauto import Desktop
    janelas = Desktop(backend='win32').windows()
    pids = {w.process_id() for w in janelas if w.class_name().startswith('seta') and 'Empresa:' in w.window_text()}
    for w in janelas:
        if w.process_id() not in pids or not w.is_visible() or 'Empresa:' in w.window_text():
            continue
        if w.window_text() in ('Save As', 'Salvar como'):
            continue
        r = w.rectangle()
        if r.width() < 120 or r.height() < 60:
            continue
        textos = [w.window_text()] + [d.window_text() for d in w.descendants()]
        return w, ' | '.join(t.strip() for t in textos if t and t.strip())
    return None


def fechar_mensagem(w):
    try:
        focar(w)
        time.sleep(0.3)
        teclas('{ENTER}', pausa=1)
        if w.exists() and w.is_visible():
            w.close()
            time.sleep(1)
    except Exception:
        pass


def salvar_como(caminho, espera=20):
    """Espera o "Save As" do Windows, digita o caminho completo e clica em Salvar.
    Se no lugar dele o Seta mostrar um aviso de "sem registros", fecha o aviso e avisa com SemRegistros."""
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
        if not dlg:
            msg = mensagem_do_seta()
            if msg:
                janela, texto = msg
                log('  mensagem do Seta:', texto or '(sem texto legível)')
                fechar_mensagem(janela)
                if eh_sem_registro(texto):
                    raise SemRegistros(texto)
                raise RuntimeError('o Seta mostrou uma mensagem em vez de salvar: ' + (texto or '(sem texto legível)'))
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
    focar(top)
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
    focar(top)
    time.sleep(0.5)
    acionar_menu(top, 'Vendas', VENDAS_RELATORIOS)
    try:
        return achar_form(top, 'Relatórios das vendas', espera=8)
    except RuntimeError:
        log('  pelo comando não abriu; tentando pelo teclado (Alt+V e setas)')
        focar(top)
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
    """Na tela "Relatórios das vendas" aberta: data nos dois campos e exporta os dois relatórios.
    Devolve False se o Seta avisar que não houve vendas no dia (nada exportado)."""
    digitar_data(form, 'data_inicial', dia)
    digitar_data(form, 'data_final', dia)
    for rel, (setas, colunas) in RELATORIOS.items():
        caminho = arquivo(loja, dia.isoformat(), rel)
        for tentativa in range(1, TENTATIVAS_RELATORIO + 1):
            focar(top)
            clicar(form, REL['lista_relatorios'])
            time.sleep(0.4 * tentativa)  # o Seta às vezes ignora as setas se vierem rápido demais
            teclas('{HOME}' + '{DOWN}' * setas)
            time.sleep(0.4 * tentativa)
            clicar(form, REL['excel'])
            try:
                salvar_como(caminho)
            except SemRegistros:
                log('  %s %s: sem vendas no dia' % (loja, dia.strftime('%d/%m')))
                return False
            try:
                ler_planilha(caminho, colunas)  # confere se saiu o relatório certo
                break
            except RuntimeError:
                if tentativa == TENTATIVAS_RELATORIO:
                    raise
                log('  saiu o relatório errado em', os.path.basename(caminho), '- tentando de novo')
        log('  salvei', os.path.basename(caminho))


def dia_sem_vendas(loja, dia):
    """Dia em que o Seta avisou "sem registros": vai ao SAFI com as duas planilhas vazias (o SAFI marca como sem vendas)."""
    return {'operacao': loja, 'data': dia, 'resumo': [], 'listagem': []}


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


SETAS_ABERTOS = []  # processos do Seta que o robô abriu nesta rodada


def fechar_setas_abertos():
    """Depois de um erro, fecha à força o Seta que o próprio robô abriu (se ainda estiver aberto),
    para a próxima loja/rodada não esbarrar em "Seta aberto"."""
    for proc in SETAS_ABERTOS:
        try:
            if proc.poll() is None:
                proc.kill()
                log('  fechei o Seta que ficou aberto depois do erro')
        except Exception:
            pass
    SETAS_ABERTOS.clear()
    time.sleep(2)


def abrir_seta(cfg, loja):
    import subprocess
    exe = cfg.get('lojas', loja, fallback='').strip()
    if not exe or not os.path.exists(exe):
        raise RuntimeError('não achei o Seta da loja %s (%s) — confira [lojas] no %s' % (loja, exe, CONFIG))
    log('Abrindo o Seta da loja', loja)
    SETAS_ABERTOS.append(subprocess.Popen([exe], cwd=os.path.dirname(exe)))
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
    focar(top)
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


def rodar(cfg, ensaio=False, pedidos=None):
    """Rotina diária: para cada loja, os dias que faltam -> exporta, confere e manda ao SAFI.
    Com pedidos={loja: [dias]} busca só esses dias e NÃO mexe no estado.json (dia avulso no passado)."""
    if seta_aberto():
        raise RuntimeError('o Seta já está aberto: feche antes (o robô abre e fecha sozinho)')
    est = ler_estado()
    hoje = date.today()
    planilhas = []
    falha = None  # se um dia der erro, manda ao SAFI o que já deu certo e só depois acusa o erro
    for loja in ('Exposicao', 'ViaCloset'):
        dias = pedidos.get(loja, []) if pedidos is not None else dias_faltando(est.get(loja), hoje)
        if not dias:
            log(loja, ': nada a buscar')
            continue
        log(loja, ': dias', ', '.join(d.strftime('%d/%m') for d in dias))
        try:
            top = abrir_seta(cfg, loja)
            try:
                top = entrar(cfg)
                form = abrir_relatorios(top)
                for d in dias:
                    if exportar_dia(top, form, loja, d) is False:
                        planilhas.append(dia_sem_vendas(loja, d.isoformat()))
                        continue
                    p = ler_dia(loja, d.isoformat())
                    mostrar(p)
                    planilhas.append(p)
            finally:
                sair(top)
        except Exception as e:
            log('ERRO na loja', loja, '->', e, '(os dias que já deram certo seguem para o SAFI)')
            falha = falha or e
            fechar_setas_abertos()
    if not planilhas:
        if falha:
            raise falha
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
    if not ensaio and r.get('ok') and pedidos is None:
        # Avança só até o último dia bom EM SEQUÊNCIA: um dia recusado é tentado de novo na próxima vez.
        recusados = {(e.get('motivo') or '').split(':')[0] for e in r.get('erros') or []}
        for loja in ('Exposicao', 'ViaCloset'):
            for p in sorted((p for p in planilhas if p['operacao'] == loja), key=lambda p: p['data']):
                if loja + ' ' + p['data'] in recusados:
                    break
                est[loja] = p['data']
        gravar_estado(est)
    if falha:
        raise falha
    return 0


AVISO_SEGUNDOS = 60   # tempo do aviso antes de pegar o mouse (sem resposta = começa)
ADIAR_MINUTOS = 60    # "Adiar" espera isto e pergunta de novo
TENTATIVAS_NO_DIA = 8  # no máximo 8 adiamentos/esperas numa mesma chamada


def tela_bloqueada():
    """Com o Windows bloqueado o robô não consegue clicar: fica para o gatilho de desbloqueio."""
    import subprocess
    try:
        r = subprocess.run(['tasklist', '/FI', 'IMAGENAME eq LogonUI.exe', '/NH'], capture_output=True, text=True,
                           creationflags=0x08000000, timeout=15)
        if 'logonui' in (r.stdout or '').lower():
            return True  # a tela de login/bloqueio do Windows está aberta
    except Exception:
        pass
    u = ctypes.windll.user32
    h = u.OpenInputDesktop(0, False, 0x0100)
    if not h:
        return True
    ok = u.SwitchDesktop(h)
    u.CloseDesktop(h)
    return not ok


def faltam_dias(est, hoje):
    return any(dias_faltando(est.get(l), hoje) for l in ('Exposicao', 'ViaCloset'))


def perguntar_antes(segundos=AVISO_SEGUNDOS):
    """Aviso por cima de tudo com a cara do GerônIA (mesmas cores e foto da tela dele no SAFI):
    "vou usar o mouse", contagem regressiva em anel âmbar, [Começar agora] (Enter) e [Adiar] (Esc).
    Sem resposta, começa sozinho. Toca o som de atenção do Windows; nos últimos 10 s o anel fica vermelho."""
    import tkinter as tk
    try:
        import winsound
        winsound.MessageBeep(0x30)
    except Exception:
        pass
    FUNDO, ROXO, AZUL, CARTAO, BORDA, LINHA = '#080b14', '#7c3aed', '#1d4ed8', '#0f1322', '#232a40', '#0c1020'
    BRANCO, TEXTO, CINZA, APAGADO = '#f1f5f9', '#e2e8f0', '#94a3b8', '#64748b'
    AMBAR, AMBAR2, ESCURO_AMBAR, INDIGO, LILAS, VERDE, VERMELHO = (
        '#f59e0b', '#fbbf24', '#1a0a00', '#6366f1', '#a5b4fc', '#4ade80', '#f87171')
    LETRA = 'Segoe UI'
    W, H = 640, 580
    res = {'v': 'agora'}

    def mistura(c1, c2, t):
        a = [int(c1[i:i + 2], 16) for i in (1, 3, 5)]
        b = [int(c2[i:i + 2], 16) for i in (1, 3, 5)]
        return '#%02x%02x%02x' % tuple(round(x + (y - x) * t) for x, y in zip(a, b))

    root = tk.Tk()
    root.title('GerônIA · Robô do Seta')
    root.overrideredirect(True)
    root.attributes('-topmost', True)
    cv = tk.Canvas(root, width=W, height=H, highlightthickness=0, bg=FUNDO)
    cv.pack()

    def arredondado(x1, y1, x2, y2, r, **kw):
        p = (x1 + r, y1, x2 - r, y1, x2, y1, x2, y1 + r, x2, y2 - r, x2, y2,
             x2 - r, y2, x1 + r, y2, x1, y2, x1, y2 - r, x1, y1 + r, x1, y1)
        return cv.create_polygon(p, smooth=True, **kw)

    # Fundo do GerônIA: brilhos borrados roxo (em cima, à esquerda) e azul (embaixo, à direita) + grade sutil.
    for (ox, oy, raio, cor, forca) in ((40, 30, 330, ROXO, 0.38), (W - 30, H - 20, 300, AZUL, 0.34)):
        for k in range(40, 0, -1):
            t = k / 40
            r = raio * t
            cv.create_oval(ox - r, oy - r, ox + r, oy + r, outline='', fill=mistura(FUNDO, cor, forca * (1 - t) ** 1.6))
    for x in range(0, W, 28):
        cv.create_line(x, 0, x, H, fill=LINHA)
    for y in range(0, H, 28):
        cv.create_line(0, y, W, y, fill=LINHA)

    # Cartão de vidro.
    M = 26
    arredondado(M, M, W - M, H - M, 26, fill=CARTAO, outline=BORDA, width=1)

    # Cabeçalho: foto do GerônIA (redonda, com brilho índigo), nome e "online".
    ax, ay, lado = M + 62, M + 62, 64
    foto = None
    try:
        caminho = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'GerônIA.png')
        img = tk.PhotoImage(file=caminho)
        fator = max(1, round(img.width() / lado))
        foto = img.subsample(fator, fator)
        cv.create_image(ax, ay, image=foto)
    except Exception:
        cv.create_oval(ax - lado / 2, ay - lado / 2, ax + lado / 2, ay + lado / 2, fill=INDIGO, outline='')
        cv.create_text(ax, ay, text='G', font=(LETRA, 24, 'bold'), fill=BRANCO)
    r = lado / 2
    cv.create_oval(ax - r - 8, ay - r - 8, ax + r + 8, ay + r + 8, outline=CARTAO, width=17)  # recorta a foto em círculo
    brilhos = [cv.create_oval(ax - r - d, ay - r - d, ax + r + d, ay + r + d, outline=mistura(CARTAO, INDIGO, a), width=2)
               for d, a in ((2, 0.85), (5, 0.45), (8, 0.2))]
    cv.create_text(ax + 50, ay - 12, anchor='w', text='GerônIA', font=(LETRA, 17, 'bold'), fill=BRANCO)
    ponto = cv.create_oval(ax + 51, ay + 9, ax + 59, ay + 17, fill=VERDE, outline='')
    cv.create_text(ax + 66, ay + 13, anchor='w', text='Robô do Seta · pronto para buscar as vendas', font=(LETRA, 10), fill=CINZA)
    cv.create_line(M + 24, ay + 50, W - M - 24, ay + 50, fill=BORDA)

    # Mensagem.
    cx = W // 2
    cv.create_text(cx, 196, text='Vou usar o mouse e o teclado', font=(LETRA, 25, 'bold'), fill=BRANCO)
    cv.create_text(cx, 240, text='Vou abrir o Seta e buscar as vendas das lojas para o SAFI.\n'
                                 'Leva uns 3 a 5 minutos: não mexa no mouse até o Seta fechar.',
                   font=(LETRA, 10), fill=CINZA, justify='center')

    # Contagem regressiva em anel âmbar.
    cy, ra = 338, 54
    cv.create_oval(cx - ra, cy - ra, cx + ra, cy + ra, outline=BORDA, width=7)
    anel = cv.create_arc(cx - ra, cy - ra, cx + ra, cy + ra, start=90, extent=-359.9, style='arc', outline=AMBAR, width=7)
    numero = cv.create_text(cx, cy - 4, text=str(segundos), font=(LETRA, 34, 'bold'), fill=AMBAR2)
    cv.create_text(cx, cy + 26, text='segundos', font=(LETRA, 9), fill=APAGADO)

    # Etiquetas (como as sugestões do GerônIA).
    etiquetas = ('Seta ERP', 'Exposição · Via Closet', 'BI das Lojas', '3 a 5 min')
    larguras = [len(t) * 7 + 26 for t in etiquetas]
    x = cx - (sum(larguras) + 8 * (len(etiquetas) - 1)) / 2
    for t, lg in zip(etiquetas, larguras):
        arredondado(x, 418, x + lg, 444, 13, fill=mistura(CARTAO, INDIGO, 0.12), outline=mistura(CARTAO, INDIGO, 0.45))
        cv.create_text(x + lg / 2, 431, text=t, font=(LETRA, 9, 'bold'), fill=LILAS)
        x += lg + 8

    def adiar(_=None):
        res['v'] = 'adiar'
        root.destroy()

    def comecar(_=None):
        res['v'] = 'agora'
        root.destroy()

    def botao(x, texto, principal, acao):
        tag = 'b%d' % x
        if principal:
            arredondado(x - 120, 470, x + 120, 516, 18, fill=mistura(AMBAR, ESCURO_AMBAR, 0.55), outline='', tags=tag)
            arredondado(x - 120, 466, x + 120, 512, 18, fill=AMBAR, outline=AMBAR2, width=1, tags=tag)
        else:
            arredondado(x - 120, 466, x + 120, 512, 18, fill=mistura(CARTAO, '#ffffff', 0.05), outline=BORDA, width=1, tags=tag)
        cv.create_text(x, 489, text=texto, font=(LETRA, 12, 'bold'), fill=ESCURO_AMBAR if principal else TEXTO, tags=tag)
        cv.tag_bind(tag, '<Button-1>', acao)
        cv.tag_bind(tag, '<Enter>', lambda e: cv.config(cursor='hand2'))
        cv.tag_bind(tag, '<Leave>', lambda e: cv.config(cursor=''))

    botao(cx - 130, '▶  Começar agora', True, comecar)
    botao(cx + 130, '❚❚  Adiar %d min' % ADIAR_MINUTOS, False, adiar)
    cv.create_text(cx, H - M - 16, text='Enter = começar   ·   Esc = adiar', font=(LETRA, 8), fill=APAGADO)
    root.bind('<Return>', comecar)
    root.bind('<Escape>', adiar)

    n = {'s': segundos, 'pisca': False}

    def tick():
        if n['s'] <= 0:
            root.destroy()
            return
        fim = n['s'] <= 10
        cv.itemconfig(numero, text=str(n['s']), fill=VERMELHO if fim else AMBAR2)
        cv.itemconfig(anel, extent=-359.9 * n['s'] / segundos, outline=VERMELHO if fim else AMBAR)
        n['pisca'] = not n['pisca']
        cv.itemconfig(ponto, fill=VERDE if n['pisca'] else mistura(CARTAO, VERDE, 0.35))
        for b, a in zip(brilhos, ((0.85, 0.45, 0.2) if n['pisca'] else (0.6, 0.25, 0.08))):
            cv.itemconfig(b, outline=mistura(CARTAO, INDIGO, a))
        n['s'] -= 1
        root.after(1000, tick)

    root.update_idletasks()
    root.geometry('%dx%d+%d+%d' % (W, H, (root.winfo_screenwidth() - W) // 2, (root.winfo_screenheight() - H) // 3))
    root.lift()
    root.focus_force()
    root._foto = foto  # segura a imagem viva enquanto a janela estiver aberta
    tick()
    root.mainloop()
    return res['v']


def perguntar_antes_seguro(segundos=AVISO_SEGUNDOS):
    """Mostra o aviso num processo separado (o desenho do aviso já travou o Python algumas vezes).
    Código 10 = adiar; qualquer outro resultado (inclusive travar) = segue a rotina, para não perder o dia."""
    import subprocess
    try:
        r = subprocess.run([sys.executable, '-P', os.path.abspath(__file__), 'aviso', str(segundos)], timeout=segundos + 60)
        if r.returncode == 10:
            return 'adiar'
        if r.returncode != 0:
            log('agendado: o aviso fechou com erro (%s); sigo a rotina sem ele' % r.returncode)
    except Exception as e:
        log('agendado: o aviso não abriu (%s); sigo a rotina sem ele' % e)
    return 'agora'


def agendado(cfg):
    """Chamado pelo Agendador do Windows (08:32, ao entrar e ao desbloquear). Só age se faltar dia:
    tela bloqueada -> deixa para o desbloqueio; Seta aberto -> espera; senão avisa (com "Adiar") e roda."""
    if not sou_administrador():
        log('agendado: precisa rodar como administrador (marque "privilégios mais altos" na tarefa)')
        return 1
    for _ in range(TENTATIVAS_NO_DIA):
        if not faltam_dias(ler_estado(), date.today()):
            return 0
        if tela_bloqueada():
            log('agendado: tela bloqueada, fica para quando desbloquear')
            return 0
        if seta_aberto():
            log('agendado: o Seta está aberto (alguém usando); tento de novo em %d min' % ADIAR_MINUTOS)
            time.sleep(ADIAR_MINUTOS * 60)
            continue
        if perguntar_antes_seguro() == 'adiar':
            log('agendado: adiado %d min' % ADIAR_MINUTOS)
            time.sleep(ADIAR_MINUTOS * 60)
            continue
        log('agendado: começando')
        return rodar(cfg)
    log('agendado: desisti por hoje (adiado/ocupado demais); tento no próximo gatilho')
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
    if args and args[0] == 'buscar':
        # Dia(s) avulso(s) de uma loja, fora da rotina (ex.: buraco no BI). Não mexe no estado.json.
        if not sou_administrador():
            print('Rode como administrador.')
            return 1
        loja = args[1] if len(args) > 1 else ''
        if loja not in ('Exposicao', 'ViaCloset') or len(args) < 3:
            print('Uso: buscar Exposicao|ViaCloset aaaa-mm-dd [aaaa-mm-dd ...]')
            return 1
        return rodar(cfg, pedidos={loja: [date.fromisoformat(d) for d in args[2:]]})
    if args and args[0] == 'agendado':
        return agendado(cfg)
    if args and args[0] == 'aviso':
        # Só mostra o aviso para ver como fica (não abre o Seta).
        return 10 if perguntar_antes(int(args[1]) if len(args) > 1 else AVISO_SEGUNDOS) == 'adiar' else 0
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
    focar(top)
    time.sleep(0.5)
    form = achar_form(top, 'Relatórios das vendas', espera=3)
    log('Loja:', loja, '· dia:', dia.isoformat())
    exportar_dia(top, form, loja, dia)
    mostrar(ler_dia(loja, dia.isoformat()))
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main(sys.argv[1:]))
    except Exception as e:
        import traceback
        log('ERRO:', e)
        log(traceback.format_exc())
        sys.exit(1)
