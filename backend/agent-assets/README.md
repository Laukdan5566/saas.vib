# Agente local de impressao

## Uso recomendado para cliente

1. Baixar o agente pelo botao **Baixar agente configurado** dentro da empresa no SaaS.
2. Extrair o ZIP.
3. Executar `install-service.bat` como Administrador.
4. O servico `VibPrintAgent` fica iniciado automaticamente com o Windows.

O pacote com `.exe` nao exige Python instalado no computador do cliente.
Quando baixado pelo SaaS, o pacote ja vem com `config.json` preenchido com empresa, token e URL da API.
Se `windows_printer_name` estiver vazio, o agente usa a impressora padrao do Windows.
Para escolher outra impressora sem editar arquivo, execute `select-printer.bat` e selecione pela lista.
O SaaS mostra o agente como online quando ele envia o status para a empresa.

Versao atual: `0.2.1`.

Arquivos locais:

- Configuracao: `C:\ProgramData\VibPrintAgent\config.json`
- Log: `C:\ProgramData\VibPrintAgent\print-agent.log`

## Comandos manuais

```powershell
VibPrintAgent.exe console
VibPrintAgent.exe install --startup auto
VibPrintAgent.exe start
VibPrintAgent.exe stop
VibPrintAgent.exe remove
VibPrintAgent.exe select-printer
```

## Uso tecnico/dev com Python

```powershell
pip install -r requirements.txt
copy config.example.json config.json
python agent.py
```

O agente roda no Windows, consulta a API por jobs pendentes, faz `claim`, imprime na impressora local e retorna `success` ou `fail`.

A impressao no Windows e enviada em RAW/ESC-POS direto para o spooler. Isso evita o problema do comando `print /D:` aceitar o job mas nao soltar papel em impressoras POS USB.

## Campos importantes

- `queue_printer_name`: nome da impressora cadastrada no SaaS. Exemplo: `Cozinha Big Burguer`.
- `windows_printer_name`: nome da impressora instalada no Windows. Exemplo: `POSPrinter POS80`.
- `encoding`: codificacao usada para textos na impressora. Para PT-BR, usar `cp860`.
- `heartbeat_interval_seconds`: intervalo para avisar o SaaS que o agente esta online.

Se `queue_printer_name` ficar vazio, o agente busca qualquer job pendente da empresa.
Se `windows_printer_name` ficar vazio, o agente usa a impressora padrao do Windows.

O campo antigo `printer_name` ainda e aceito como fallback para testes antigos, mas novas instalacoes devem usar `queue_printer_name` e `windows_printer_name`.

## Gerar o executavel

Em uma maquina Windows com Python:

```powershell
.\build-exe.ps1
```

O executavel sera gerado em `dist\VibPrintAgent.exe`.
