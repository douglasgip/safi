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
  python seta_robo.py exportar 2026-11-17     -> com "Relatórios das vendas" aberta: exporta e confere (não envia)
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
# Relatório -> quantas setas para baixo a partir do topo da lista, e as colunas que a planilha TEM que ter.
RELATORIOS = {
    'resumo': (0, ['quantidade', 'total', 'lucro', 'frete']),
    'listagem': (1, ['codigo', 'data', 'total']),
}


def log(*a):
    print(time.strftime('%H:%M:%S'), *a, flush=True)


def carregar_config():
    os.makedirs(PLANILHAS, exist_ok=True)
    cfg = configparser.ConfigParser()
    if not os.path.exists(CONFIG):
        cfg['seta'] = {'usuario': '', 'senha': ''}
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


def achar_form(top, nome, espera=15):
    fim = time.time() + espera
    while time.time() < fim:
        for d in top.descendants():
            if d.window_text() == nome and d.is_visible():
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


def exportar_dia(top, form, loja, dia):
    """Na tela "Relatórios das vendas" aberta: data nos dois campos e exporta os dois relatórios."""
    digitar_data(form, 'data_inicial', dia)
    digitar_data(form, 'data_final', dia)
    for rel, (setas, _) in RELATORIOS.items():
        top.set_focus()
        clicar(form, REL['lista_relatorios'])
        teclas('{HOME}' + '{DOWN}' * setas)
        clicar(form, REL['excel'])
        caminho = arquivo(loja, dia.isoformat(), rel)
        salvar_como(caminho)
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
    carregar_config()
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
