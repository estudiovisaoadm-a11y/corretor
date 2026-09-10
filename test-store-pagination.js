const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

test('listAnalises pagina resultados e mantém o contrato legado', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'imoveis-store-'));
  const db = path.join(dir, 'db.json');
  const previous = process.env.DB_PATH;
  process.env.DB_PATH = db;
  try {
    delete require.cache[require.resolve('./src/store')];
    const store = require('./src/store');
    for (let i = 0; i < 7; i++) store.addAnalise({ id: `a-${i}`, bairro: 'Asa Norte', score: i });

    const legacy = store.listAnalises({});
    assert.ok(Array.isArray(legacy));
    assert.equal(legacy.length, 7);

    const page = store.listAnalises({ page: 2, perPage: 3 });
    assert.deepEqual(Object.keys(page).sort(), ['items', 'page', 'perPage', 'total', 'totalPages'].sort());
    assert.equal(page.total, 7);
    assert.equal(page.totalPages, 3);
    assert.equal(page.items.length, 3);
    assert.deepEqual(page.items.map((x) => x.id), ['a-3', 'a-2', 'a-1']);

    const bounded = store.listAnalises({ page: 1, perPage: 1000 });
    assert.equal(bounded.perPage, 100);
  } finally {
    if (previous == null) delete process.env.DB_PATH;
    else process.env.DB_PATH = previous;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
