import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import worker from '../dist/server/index.js';

const origin = 'https://opportunity.example';

function workspace(t) {
  const database = new DatabaseSync(':memory:');
  t.after(() => database.close());
  for (const migration of ['0000_workspace.sql', '0001_users.sql']) {
    database.exec(readFileSync(new URL('../drizzle/' + migration, import.meta.url), 'utf8'));
  }

  const DB = {
    prepare(sql) {
      const statement = database.prepare(sql);
      const bound = (...args) => ({
        first: () => statement.get(...args),
        all: () => ({ results: statement.all(...args) }),
        run: () => ({ meta: statement.run(...args) }),
      });
      return { ...bound(), bind: bound };
    },
  };
  return (path, options) => worker.fetch(new Request(origin + path, options), { DB });
}

function entryRequest(visitor, revision, title, requestOrigin = origin) {
  return {
    method: 'PUT',
    headers: {
      'oai-authenticated-user-id': visitor,
      'Content-Type': 'application/json',
      Origin: requestOrigin,
    },
    body: JSON.stringify({ id: 'conference', kind: 'opportunity', revision, data: { title } }),
  };
}

test('serves the sign-in page and rejects anonymous API requests', async t => {
  const request = workspace(t);
  assert.match(await (await request('/')).text(), /Open workspace/);
  assert.equal((await request('/api/entries')).status, 401);
  assert.equal((await request('/api/jobs')).status, 401);
  const script = await request('/workspace.js');
  assert.match(script.headers.get('Content-Type'), /javascript/);
  assert.match(await script.text(), /function renderCareer/);
});

test('isolates visitors, rejects cross-origin writes, and detects stale edits', async t => {
  const request = workspace(t);
  const save = (user, revision, title, source) =>
    request('/api/entries', entryRequest(user, revision, title, source));
  const read = async user => (await (await request('/api/entries', {
    headers: { 'oai-authenticated-user-id': user },
  })).json()).saved;

  assert.equal((await save('alice', 0, 'Conference', 'https://other.example')).status, 403);
  assert.deepEqual(await read('alice'), []);
  assert.equal((await save('alice', 0, 'Alice’s conference')).status, 200);
  assert.deepEqual(await read('bob'), []);
  assert.equal((await save('bob', 1, 'Overwrite')).status, 409);
  assert.equal((await save('bob', 0, 'Bob’s conference')).status, 200);
  assert.equal((await save('alice', 1, 'Updated conference')).status, 200);
  assert.equal((await save('alice', 1, 'Stale update')).status, 409);
  assert.equal((await read('alice'))[0].data.title, 'Updated conference');
  assert.equal((await read('bob'))[0].data.title, 'Bob’s conference');
});