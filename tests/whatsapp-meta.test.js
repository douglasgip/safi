'use strict';
// Robô do WhatsApp (26/11/2026): todo dia às 17:30 o PC do Douglas manda a mensagem da meta de peças no grupo
// "Informativo Colaboradores" pelo WhatsApp Web. Custo zero; se o PC estiver desligado, pula o dia (combinado).
// A mensagem é a MESMA do botão "Compartilhar no WhatsApp" da página /meta (lida do próprio link, já testada).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const { ler, caminho } = require('./helpers/carregar');

const py = () => ler('scripts/whatsapp_robo.py');
const fn = (codigo, nome) => codigo.match(new RegExp('def ' + nome + '\\([\\s\\S]*?\\r?\\n\\r?\\n\\r?\\n'))[0];

test('whatsapp: robô existe e manda no grupo certo, com a mensagem do botão da página /meta', () => {
  assert.ok(fs.existsSync(caminho('scripts/whatsapp_robo.py')));
  const c = py();
  assert.match(c, /GRUPO = 'Informativo Colaboradores'/);
  assert.match(c, /URL_META = 'https:\/\/topfinds\.com\.br\/meta'/);
  assert.match(c, /#zap/, 'a mensagem vem do link do botão (mesmo texto, sem duplicar a regra)');
});

test('whatsapp: só envia uma vez por dia, das 17:30 às 19:00, do 1º dia da meta até o dia seguinte ao fim', () => {
  const d = fn(py(), 'deve_enviar');
  assert.match(d, /ultimo == hoje/);
  assert.match(d, /'17:30' <= hora <= '19:00'/);
  assert.match(d, /hoje < inicio/);
  assert.match(d, /hoje > fim \+ timedelta\(days=1\)/);
});

test('whatsapp: no ensaio digita a mensagem mas NÃO aperta enviar (e apaga o rascunho)', () => {
  const e = fn(py(), 'escrever_no_grupo');
  assert.match(e, /if ensaio:[\s\S]*?limpar_rascunho\(page\)[\s\S]*?return/);
  assert.ok(e.indexOf("if ensaio:") < e.lastIndexOf("press('Enter')"), 'o Enter de enviar vem depois da saída do ensaio');
});

test('whatsapp: o rascunho do ensaio é apagado de verdade (confere a caixa vazia e espera o WhatsApp salvar)', () => {
  // 26/11: o 1º ensaio deixou a mensagem como rascunho no grupo (o Edge fechou antes do WhatsApp salvar a caixa vazia)
  const l = fn(py(), 'limpar_rascunho');
  assert.match(l, /for _ in range\(\d+\):[\s\S]*?inner_text\(\)\.strip\(\)/);
  assert.match(l, /raise RuntimeError/);
  assert.match(l, /wait_for_timeout\(3000\)/);
});

test('whatsapp: o modo teste manda só na conversa "Meu numero" e não conta como o envio do dia', () => {
  const c = py();
  assert.match(c, /GRUPO_TESTE = 'Meu numero'/);
  assert.match(c, /abrir_grupo\(page, GRUPO_TESTE if modo == 'teste' else GRUPO\)/);
  const r = fn(c, 'rodar');
  assert.ok(r.indexOf("if modo == 'teste':") < r.indexOf('gravar_ultimo(texto)'), 'teste sai antes de gravar o dia');
});

test('whatsapp: confere que a mensagem saiu antes de marcar o dia como enviado', () => {
  const c = py();
  // 26/11: a imagem ainda subia quando o Edge fechou e a mensagem ficou com erro; agora espera "Enviada/Entregue/Lida"
  const e = fn(c, 'escrever_no_grupo');
  assert.match(e, /'Enviada', 'Entregue', 'Lida'/);
  assert.match(e, /startswith\('Ocorreu um erro'\)[\s\S]*?raise RuntimeError/);
  assert.ok(c.indexOf('confirmar_envio(') < c.indexOf('gravar_ultimo('));
});

test('whatsapp: manda a imagem da meta (a mesma do botão da página) com a mensagem na legenda; sem imagem, só texto', () => {
  const c = py();
  assert.match(fn(c, 'mensagem_da_pagina'), /imagemDaMeta\(\)/);
  assert.match(fn(c, 'mensagem_da_pagina'), /except Exception as e:[\s\S]*?mando só o texto[\s\S]*?imagem = None/);
  assert.match(fn(c, 'colar_imagem'), /ClipboardEvent\('paste'/);
  assert.match(fn(c, 'colar_imagem'), /Adicione uma legenda/);
  assert.match(fn(c, 'escrever_no_grupo'), /if imagem:\s*colar_imagem\(page, imagem\)/);
});
