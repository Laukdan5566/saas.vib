# Agente local de impressao

O agente local deve rodar no Windows do cliente que possui a impressora.

Para cliente final, o formato recomendado e o pacote `.exe` configurado pelo SaaS:

1. Acessar a empresa no SaaS.
2. Abrir `Impressoras`.
3. Clicar em **Baixar agente configurado**.
4. Extrair o ZIP no Windows da loja.
5. Executar `install-service.bat` como Administrador.

O pacote gerado pelo SaaS ja inclui `config.json` com empresa, token e URL da API. O computador do cliente nao precisa ter Python instalado nem editar JSON para o fluxo comum.

Se `windows_printer_name` vier vazio, o agente tenta imprimir na impressora padrao do Windows. Para trocar a impressora sem editar JSON, execute `select-printer.bat` e escolha pela lista exibida. Tambem e possivel alterar a impressora padrao do Windows.

O agente envia periodicamente um status para o SaaS. A tela `Impressoras` mostra online/offline, ultimo contato, computador e impressora detectada.

Fluxo legado/generico:

1. Baixar `https://saas.correacloud.com.br/print-agent.zip`.
2. Extrair o ZIP.
3. Executar `install-service.bat` como Administrador.
4. Preencher/conferir `C:\ProgramData\VibPrintAgent\config.json`.
5. O servico `VibPrintAgent` passa a iniciar junto com o Windows.

Arquivos no Windows:

- Executavel/servico: `C:\ProgramData\VibPrintAgent\VibPrintAgent.exe`
- Configuracao: `C:\ProgramData\VibPrintAgent\config.json`
- Log: `C:\ProgramData\VibPrintAgent\print-agent.log`

Fluxo:

1. `GET /api/print-jobs/pending`
2. `POST /api/print-jobs/heartbeat`
3. `POST /api/print-jobs/:id/claim`
4. Impressao local.
5. `POST /api/print-jobs/:id/success` ou `POST /api/print-jobs/:id/fail`

Use `PRINT_AGENT_TOKEN` no header:

```http
Authorization: Bearer token
X-Company-Id: company-id
```

## Configuracao local

O agente separa dois nomes:

- `queue_printer_name`: impressora/fila cadastrada no SaaS.
- `windows_printer_name`: nome exato da impressora no Windows do cliente.
- `encoding`: codificacao ESC/POS. Para impressoras POS no Brasil, usar `cp860`.

O envio para impressoras Windows e feito em RAW/ESC-POS direto no spooler. O metodo anterior via `print /D:` pode marcar o job como impresso no Windows sem a impressora fisica soltar papel.

O agente ainda aceita o campo legado `printer_name` como fallback, mas a configuracao correta para novas instalacoes e separar `queue_printer_name` e `windows_printer_name`.

Exemplo:

```json
{
  "api_base_url": "https://saas.correacloud.com.br/api",
  "company_id": "id-da-empresa",
  "token": "PRINT_AGENT_TOKEN",
  "queue_printer_name": "Cozinha Big Burguer",
  "windows_printer_name": "POSPrinter POS80",
  "encoding": "cp860",
  "poll_interval_seconds": 5,
  "heartbeat_interval_seconds": 30
}
```

No Windows, o nome pode ser conferido com:

```powershell
Get-Printer
```

## Comandos do executavel

```powershell
VibPrintAgent.exe console
VibPrintAgent.exe install --startup auto
VibPrintAgent.exe start
VibPrintAgent.exe stop
VibPrintAgent.exe remove
VibPrintAgent.exe select-printer
```

## Build do executavel

O fonte continua em `print-agent/agent.py`.

Para gerar o pacote em uma maquina Windows com Python:

```powershell
cd print-agent
.\build-exe.ps1
```

O build usa PyInstaller e gera `dist\VibPrintAgent.exe`.
