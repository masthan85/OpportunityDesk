import assert from 'node:assert/strict';
import { test } from 'node:test';
import worker from '../dist/server/index.js';

test('job feed keeps test, QA and engineering roles and drops non-technical ones', async t => {
  const realFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = realFetch; });
  globalThis.fetch = async () => Response.json({ jobs: [
    'Senior Software Engineer in Test', 'QA Analyst', 'Data Engineer', 'Account Executive', 'Recruiter',
  ].map((title, id) => ({ id, title, absolute_url: 'https://example.com/' + id, location: { name: 'London, UK' } })) });

  const response = await worker.fetch(new Request('https://opportunity.example/api/jobs', {
    headers: { 'oai-authenticated-user-id': 'alice' },
  }), {});
  const { jobs, failed } = await response.json();
  assert.deepEqual(failed, []);
  assert.deepEqual([...new Set(jobs.map(job => job.title))],
    ['Senior Software Engineer in Test', 'QA Analyst', 'Data Engineer']);
});