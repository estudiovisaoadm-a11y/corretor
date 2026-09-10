# Configuração do banco Supabase

Projeto configurado como referência:

```text
hunhabumyokpvuddwvuv
https://hunhabumyokpvuddwvuv.supabase.co
```

O sistema usa PostgreSQL pelo módulo `src/db/postgres.js`. Portanto, a conexão de produção deve ser fornecida por `DATABASE_URL`; não é necessário expor uma chave `service_role` no navegador.

## Configuração local

Copie `.env.example` para `.env` e defina `DATABASE_URL` com a senha URL-encoded:

```text
DATABASE_URL=postgresql://postgres:<URL_ENCODED_PASSWORD>@db.hunhabumyokpvuddwvuv.supabase.co:5432/postgres
```

Caracteres especiais da senha precisam ser codificados na URL. Por exemplo, `@` vira `%40`, `&` vira `%26` e `/` vira `%2F`.

Depois, aplique o esquema:

```powershell
npm run db:migrate
npm run ops:preflight
```

## Configuração no Render

No serviço de produção, configure `DATABASE_URL` com o connection string do Supabase. Configure também:

- `AUTH_TOKEN_SECRET`
- `ADMIN_API_KEY`
- `CORS_ORIGINS` ou `RENDER_EXTERNAL_URL`

Nunca coloque a senha, `service_role` ou `DATABASE_URL` em arquivos versionados. O arquivo `.env` já está ignorado pelo Git.

## Verificação

Após configurar a variável:

```powershell
npm run db:migrate
npm run start:production
```

Verifique `/healthz` e `/readyz`. O `/readyz` confirma uma consulta real ao PostgreSQL.
