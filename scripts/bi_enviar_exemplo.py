"""
Modelo do envio do REALIZADO para o BI das Lojas do SAFI (função bi-importar).

A parte que LÊ os números (Seta, e-commerce) ainda vai ser escrita: aqui fica só o "envio",
que é igual para qualquer fonte. Troque a função `ler_numeros()` pela leitura de verdade.

Como usar no PC do Douglas:
  1. Instale o Python (python.org) e, no terminal:  pip install requests
  2. Defina a senha da importação numa variável de ambiente (NUNCA dentro deste arquivo):
       setx SAFI_BI_TOKEN "a-senha-gerada"      (feche e abra o terminal depois)
  3. Rode:  python bi_enviar_exemplo.py

Regras do que é enviado (o SAFI recusa linha fora delas e diz o motivo):
  - operacao: "Exposicao", "ViaCloset" ou "GIP" (também aceita "Exposição Paulista", "Via Closet", "E-commerce")
  - data: "aaaa-mm-dd", não pode ser no futuro
  - faturamento: obrigatório; margem, ticket_medio, pecas_atendimento, qtd_vendas: opcionais
  - números com PONTO decimal (24330.78), não vírgula
  - reenviar o mesmo dia da mesma operação substitui o que estava (pode rodar quantas vezes quiser)
"""
import os
import sys
import requests

URL = "https://ujsoqyhkebasszwtexmp.supabase.co/functions/v1/bi-importar"


def ler_numeros():
    """Troque por leitura de verdade (relatório do Seta, e-commerce...). Devolve uma lista de dias."""
    return [
        {"operacao": "Exposicao", "data": "2026-11-16", "faturamento": 24330.78, "margem": 11213.70,
         "ticket_medio": 190.08, "pecas_atendimento": 4.04, "qtd_vendas": 128},
    ]


def enviar(linhas):
    token = os.environ.get("SAFI_BI_TOKEN")
    if not token:
        sys.exit("Falta a variável SAFI_BI_TOKEN (veja o passo 2 no topo do arquivo).")
    resp = requests.post(URL, json={"linhas": linhas}, headers={"Authorization": "Bearer " + token}, timeout=60)
    dados = resp.json()
    if resp.status_code != 200 or not dados.get("ok"):
        sys.exit("Falhou (%s): %s" % (resp.status_code, dados.get("erro") or dados))
    print("Recebidas: %s · gravadas: %s" % (dados["recebidas"], dados["gravadas"]))
    for e in dados.get("erros", []):
        print("  linha %s recusada: %s" % (e["linha"], e["motivo"]))


if __name__ == "__main__":
    enviar(ler_numeros())
