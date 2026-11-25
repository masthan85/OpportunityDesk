import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import worker from '../dist/server/index.js';

const origin = 'https://opportunity.example';
const redirectUri = 'https://claude.ai/api/mcp/auth_callback';

function site(t) {
  const database = new DatabaseSync(':memory:');
  t.after(() => database.close());
  for (const { tag } of JSON.parse(readFileSync(new URL('../drizzle/meta/_journal.json', import.meta.url), 'utf8')).entries) {
    database.exec(readFileSync(new URL('../drizzle/' + tag + '.sql', import.meta.url), 'utf8'));
  }
  const DB = {
    prepare(sql) {
      const statement = database.prepare(sql);
      const bound = (...args) => ({
        first: () => statement.get(...args) ?? null,
        all: () => ({ results: statement.all(...args) }),
        run: () => ({ meta: statement.run(...args) }),
      });
      return { ...bound(), bind: bound };
    },
  };

  const realFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = realFetch; });
  globalThis.fetch = async url => {
    url = String(url);
    if (/\/jobs\/\d+$/.test(url)) return Response.json({ content: '&lt;p&gt;Own test automation &amp;amp; release quality.&lt;/p&gt;&lt;ul&gt;&lt;li&gt;Playwright&lt;/li&gt;&lt;/ul&gt;' });
    const board = url.split('/boards/')[1].split('/')[0];
    return Response.json({ jobs: [
      { id: 1, title: 'Senior Software Engineer in Test', absolute_url: `https://example.com/${board}/1`, location: { name: 'London, United Kingdom' } },
      { id: 2, title: 'Data Engineer', absolute_url: `https://example.com/${board}/2`, location: { name: 'Remote - US' } },
    ] });
  };
  return (path, options = {}) => worker.fetch(new Request(origin + path, { redirect: 'manual', ...options }), { DB });
}

const pkce = () => {
  const verifier = randomBytes(32).toString('base64url');
  return { verifier, challenge: createHash('sha256').update(verifier).digest('base64url') };
};
const form = values => ({ method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(values).toString() });

async function connect(request, visitor, clientName = 'Claude') {
  const registration = await (await request('/oauth/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_name: clientName, redirect_uris: [redirectUri] }),
  })).json();
  const { verifier, challenge } = pkce();
  const params = { response_type: 'code', client_id: registration.client_id, redirect_uri: redirectUri, state: 'xyz', code_challenge: challenge, code_challenge_method: 'S256' };
  const approval = await request('/oauth/authorize', {
    ...form({ ...params, decision: 'allow' }),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: origin, 'oai-authenticated-user-id': visitor },
  });
  assert.equal(approval.status, 302);
  const location = new URL(approval.headers.get('Location'));
  assert.equal(location.origin + location.pathname, redirectUri);
  assert.equal(location.searchParams.get('state'), 'xyz');
  const code = location.searchParams.get('code');
  const tokens = await (await request('/oauth/token', form({
    grant_type: 'authorization_code', code, redirect_uri: redirectUri, client_id: registration.client_id, code_verifier: verifier,
  }))).json();
  return { ...tokens, clientId: registration.client_id, code, verifier, params };
}

const rpc = (request, token, method, params, id = 1) => request('/mcp', {
  method: 'POST',
  headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
  body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
}).then(r => r.json());
const call = async (request, token, name, args = {}) => {
  const { result } = await rpc(request, token, 'tools/call', { name, arguments: args });
  return result;
};

test('publishes OAuth discovery metadata and challenges unauthenticated MCP requests', async t => {
  const request = site(t);
  const resource = await (await request('/.well-known/oauth-protected-resource/mcp')).json();
  assert.deepEqual(resource.authorization_servers, [origin]);
  const server = await (await request('/.well-known/oauth-authorization-server')).json();
  assert.equal(server.registration_endpoint, origin + '/oauth/register');
  assert.deepEqual(server.code_challenge_methods_supported, ['S256']);

  const challenge = await request('/mcp', { method: 'POST', body: '{}' });
  assert.equal(challenge.status, 401);
  assert.match(challenge.headers.get('WWW-Authenticate'), /resource_metadata="https:\/\/opportunity\.example\/\.well-known\/oauth-protected-resource"/);
});

test('connects an AI app to the signed-in visitor and serves their workspace through MCP tools', async t => {
  const request = site(t);
  const alice = await connect(request, 'alice');
  assert.equal(alice.token_type, 'Bearer');

  const init = await rpc(request, alice.access_token, 'initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } });
  assert.equal(init.result.protocolVersion, '2025-06-18');
  const notification = await request('/mcp', { method: 'POST', headers: { Authorization: 'Bearer ' + alice.access_token }, body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) });
  assert.equal(notification.status, 202);
  const { result: { tools } } = await rpc(request, alice.access_token, 'tools/list');
  assert.ok(tools.some(tool => tool.name === 'search_jobs'));

  const profile = await call(request, alice.access_token, 'update_profile', { target_roles: 'Test Engineer', job_country: 'United Kingdom' });
  assert.equal(profile.structuredContent.targetRoles, 'Test Engineer');
  assert.equal(profile.structuredContent.jobCountry.code, 'GB');

  const jobs = (await call(request, alice.access_token, 'search_jobs')).structuredContent;
  assert.deepEqual(jobs.jobs.map(job => job.title), Array(3).fill('Senior Software Engineer in Test'));
  const description = (await call(request, alice.access_token, 'get_job_description', { job_id: jobs.jobs[0].id })).structuredContent;
  assert.equal(description.description, 'Own test automation & release quality.\n\n• Playwright');

  const applied = await call(request, alice.access_token, 'mark_job_applied', { job_id: jobs.jobs[0].id });
  assert.equal(applied.structuredContent.status, 'Applied');
  const status = await call(request, alice.access_token, 'update_record_status', { record_id: jobs.jobs[0].id, status: 'Interviewing' });
  assert.equal(status.structuredContent.status, 'Interviewing');

  const events = (await call(request, alice.access_token, 'search_events', { type: 'Hackathons', region: 'GB' })).structuredContent;
  assert.ok(events.events.length > 0);
  await call(request, alice.access_token, 'track_event', { event_id: events.events[0].id, status: 'Submitted' });
  const records = (await call(request, alice.access_token, 'list_my_records')).structuredContent;
  assert.equal(records.opportunities[0].status, 'Submitted');
  assert.equal(records.jobApplications[0].status, 'Interviewing');

  // The website reads the same records the connector wrote.
  const web = await (await request('/api/entries', { headers: { 'oai-authenticated-user-id': 'alice' } })).json();
  assert.equal(web.saved.find(r => r.id === 'career-profile').data.keywords, 'Test Engineer');

  // Another visitor's connection sees none of it.
  const bob = await connect(request, 'bob', 'ChatGPT');
  assert.deepEqual((await call(request, bob.access_token, 'list_my_records')).structuredContent, { opportunities: [], jobApplications: [] });

  const invalid = await call(request, alice.access_token, 'update_record_status', { record_id: 'nope', status: 'Applied' });
  assert.equal(invalid.isError, true);
});

test('rejects reused codes, bad PKCE verifiers and unregistered redirect URIs, and rotates refresh tokens', async t => {
  const request = site(t);
  const alice = await connect(request, 'alice');
  const reuse = await request('/oauth/token', form({ grant_type: 'authorization_code', code: alice.code, redirect_uri: redirectUri, client_id: alice.clientId, code_verifier: alice.verifier }));
  assert.equal(reuse.status, 400);

  const approval = await request('/oauth/authorize', {
    ...form({ ...alice.params, decision: 'allow' }),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: origin, 'oai-authenticated-user-id': 'alice' },
  });
  const code = new URL(approval.headers.get('Location')).searchParams.get('code');
  const badVerifier = await request('/oauth/token', form({ grant_type: 'authorization_code', code, redirect_uri: redirectUri, client_id: alice.clientId, code_verifier: pkce().verifier }));
  assert.equal(badVerifier.status, 400);

  const foreign = await request('/oauth/authorize?' + new URLSearchParams({ ...alice.params, redirect_uri: 'https://attacker.example/cb' }), { headers: { 'oai-authenticated-user-id': 'alice' } });
  assert.equal(foreign.status, 400);
  assert.equal(foreign.headers.get('Location'), null);

  const crossSite = await request('/oauth/authorize', {
    ...form({ ...alice.params, decision: 'allow' }),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: 'https://attacker.example', 'oai-authenticated-user-id': 'alice' },
  });
  assert.equal(crossSite.status, 403);

  const signedOut = await request('/oauth/authorize?' + new URLSearchParams(alice.params));
  assert.equal(signedOut.status, 302);
  assert.match(signedOut.headers.get('Location'), /^\/signin-with-chatgpt\?return_to=%2Foauth%2Fauthorize%3F/);
  const consent = await request('/oauth/authorize?' + new URLSearchParams(alice.params), { headers: { 'oai-authenticated-user-id': 'alice' } });
  assert.match(await consent.text(), /Connect Claude/);

  const refreshed = await (await request('/oauth/token', form({ grant_type: 'refresh_token', refresh_token: alice.refresh_token, client_id: alice.clientId }))).json();
  assert.ok(refreshed.access_token);
  const replay = await request('/oauth/token', form({ grant_type: 'refresh_token', refresh_token: alice.refresh_token, client_id: alice.clientId }));
  assert.equal(replay.status, 400);
});

test('lists connected apps on the website and disconnects them', async t => {
  const request = site(t);
  const alice = await connect(request, 'alice');
  const headers = { 'oai-authenticated-user-id': 'alice', 'Content-Type': 'application/json', Origin: origin };
  assert.deepEqual(await (await request('/api/connections', { headers })).json(), { apps: ['Claude'] });
  assert.equal((await request('/api/connections', { method: 'DELETE', headers: { ...headers, Origin: 'https://attacker.example' } })).status, 403);
  assert.equal((await request('/api/connections', { method: 'DELETE', headers })).status, 200);
  assert.equal((await request('/mcp', { method: 'POST', headers: { Authorization: 'Bearer ' + alice.access_token }, body: '{}' })).status, 401);
});
