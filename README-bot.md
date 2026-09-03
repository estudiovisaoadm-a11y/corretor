# Bot WhatsApp — setup Evolution API

## Fluxo
Corretor manda link/texto no WhatsApp → Evolution recebe → `POST /webhook/evolution` → MVP analisa (m², localização, financiamento, permuta, documentação) → responde ficha em 1-2 mensagens.

## 1. Subir a Evolution API
```powershell
Copy-Item .env.example .env
# edite .env e defina EVOLUTION_API_KEY com uma chave longa
docker compose -f docker-compose.evolution.yml up -d
```

## 2. Criar instância e conectar o número
```powershell
$KEY = "sua-chave-do-.env"
Invoke-RestMethod -Uri "http://localhost:8080/instance/create" -Method Post -Headers @{ apikey=$KEY; "Content-Type"="application/json" } -Body '{"instanceName":"corretor-bot","integration":"WHATSAPP-BAILEYS","qrcode":true}'
```
A resposta traz o QR code (base64). Escaneie em WhatsApp → Aparelhos conectados → Conectar aparelho.

Checar status:
```powershell
Invoke-RestMethod -Uri "http://localhost:8080/instance/connectionState/corretor-bot" -Headers @{ apikey=$KEY }
```

## 3. Apontar o webhook para este MVP
O MVP precisa estar acessível (em prod use URL pública; em dev use ngrok):
```powershell
ngrok http 3000
```
Configure na instância (ou via `WEBHOOK_GLOBAL_URL` no compose):
- URL: `https://SEU-DOMINIO/webhook/evolution`
- Evento: `MESSAGES_UPSERT`

## 4. Testar sem WhatsApp real
```powershell
node test-webhook.js   # simula ajuda, link e texto puro
node demo.js           # fichas de exemplo dos 3 portais
```

## 5. Testar de ponta a ponta
1. `node server.js` (sem `EVOLUTION_API_KEY` = dry-run, só loga; com a chave = envia de verdade)
2. Mande "ajuda" para o número conectado → deve responder o menu
3. Encaminhe um link do DFImóveis/WImóveis/NetImóveis → recebe ficha + score

## Comandos do bot
- Qualquer link ou texto de anúncio → ficha analisada
- `ajuda` → menu

## Notas
- Número no formato internacional sem `+` (ex: `5561999999999`).
- Baileys (QR) é não-oficial: use um número dedicado ao bot; para alto volume considere migrar a instância para `WHATSAPP-BUSINESS` (Cloud API oficial).
- Respeite os Termos dos portais: o bot analisa links encaminhados; varredura automática deve obedecer robots.txt + intervalo entre requisições.
