# Operação em produção

## Arquitetura de execução

O serviço roda como uma imagem Docker Node.js 20 Alpine. O processo inicia com `scripts/start-production.js`, aplica `migrate.sql` no PostgreSQL e só então inicia o servidor HTTP. Se o banco não estiver acessível ou uma migração falhar, o processo termina para que a plataforma faça o restart e o erro fique visível nos logs.

O container executa como usuário sem privilégios, usa `dumb-init` para encaminhar sinais corretamente e expõe uma verificação de vida em `/healthz`. O banco é persistente; arquivos locais como `db.json` não são usados em produção.

## Deploy no Render

O `render.yaml` cria o web service Docker e um PostgreSQL gerenciado. Após conectar o repositório ao Render, revise o plano do banco e preencha `CORS_ORIGINS` com a URL HTTPS final do painel.

Variáveis sensíveis geradas pelo blueprint:

- `DATABASE_URL`: fornecida pelo PostgreSQL do Render.
- `AUTH_TOKEN_SECRET`: segredo usado para tokens de login.
- `ADMIN_API_KEY`: chave administrativa legada e de bootstrap.

Configure também, quando aplicável, `WEBHOOK_SECRET`, `EVOLUTION_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE`, `OPENROUTER_API_KEY`, `OPENCODE_API_KEY` e as credenciais dos portais. Nunca grave esses valores no repositório.

## Operação local com PostgreSQL

```powershell
$env:NODE_ENV = 'production'
$env:DATABASE_URL = 'postgresql://usuario:senha@localhost:5432/imoveis'
$env:AUTH_TOKEN_SECRET = 'gere-um-segredo-com-32-caracteres-ou-mais'
$env:ADMIN_API_KEY = 'gere-outra-chave-com-32-caracteres-ou-mais'
npm run ops:preflight
npm run db:migrate
npm start
```

Para executar a mesma sequência usada no container:

```powershell
npm run start:production
```

## Backup e recuperação

Antes de uma migração relevante, exporte o banco:

```powershell
pg_dump "$env:DATABASE_URL" --format=custom --file=backup-$(Get-Date -Format yyyyMMdd-HHmm).dump
```

Para restaurar em um banco de recuperação, use `pg_restore` com uma URL separada. Valide `/healthz`, faça login e consulte o dashboard antes de direcionar tráfego para o banco restaurado.

## Checklist de release

1. Confirmar que `npm test`, `npm run ops:preflight` e `docker build -t corretor-ia-imoveis .` passam.
2. Conferir logs do boot e a mensagem `Migrações aplicadas com sucesso.`.
3. Confirmar que `/healthz` retorna HTTP 200.
4. Fazer uma análise de anúncio e validar o login no ambiente publicado.
5. Confirmar backup recente e os segredos no gerenciador da plataforma.
