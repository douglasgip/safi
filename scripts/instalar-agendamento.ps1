# Instala (ou atualiza) a tarefa "SAFI - Robo do Seta" no Agendador do Windows. Rodar como ADMINISTRADOR.
$ErrorActionPreference = 'Stop'
$pasta = Split-Path -Parent $MyInvocation.MyCommand.Path
$script = Join-Path $pasta 'seta_robo.py'
$pythonw = Join-Path $env:LOCALAPPDATA 'Programs\Python\Python313\pythonw.exe'
if (-not (Test-Path $pythonw)) { throw "Não achei o pythonw em $pythonw" }
$usuario = "$env:USERDOMAIN\$env:USERNAME"
$xml = Get-Content (Join-Path $pasta 'seta_agendamento.xml') -Raw -Encoding UTF8
$xml = $xml.Replace('__USUARIO__', $usuario).Replace('__PYTHONW__', $pythonw).Replace('__SCRIPT__', $script).Replace('__PASTA__', $pasta)
Register-ScheduledTask -TaskName 'SAFI - Robo do Seta' -Xml $xml -Force | Out-Null
Get-ScheduledTask -TaskName 'SAFI - Robo do Seta' | Select-Object TaskName, State
