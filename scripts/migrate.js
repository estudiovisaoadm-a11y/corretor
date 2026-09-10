#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const databaseUrl = String(process.env.DATABASE_URL || '').trim();
if (!databaseUrl) {
  if (process.env.NODE_ENV === 'production') {
    console.error('DATABASE_URL é obrigatório em produção.');
    process.exit(1);
  }
  console.log('DATABASE_URL não configurada; migração ignorada em desenvolvimento.');
  process.exit(0);
}

async function main() {
  const client = new Client({ connectionString: databaseUrl, connectionTimeoutMillis: 10000 });
  await client.connect();
  try {
    await client.query('BEGIN');
    const sql = fs.readFileSync(path.join(__dirname, '..', 'migrate.sql'), 'utf8');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('Migrações aplicadas com sucesso.');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(`Falha na migração: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main().catch((error) => { console.error(`Falha na conexão com o banco: ${error.message}`); process.exitCode = 1; });
