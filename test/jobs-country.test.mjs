import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const source = ['discovery.js', 'jobs.js'].map(file =>
  readFileSync(new URL('../src/client/' + file, import.meta.url), 'utf8')
).join('\n');

const jobs = runInNewContext(source + `
  ({
    countries: location => [...jobCountries(location)],
    matches: (term, title) => roleMatches(term, title),
    personaMatches: (persona, itemPersonas) => matchesPersona(persona, itemPersonas),
    selected: (records, hint) => {
      initialiseJobCountry(records, hint);
      return jobCountry;
    }
  })
`, { document: { addEventListener() {} }, window: { addEventListener() {} } });

test('recognises specific and multi-country employer locations', () => {
  for (const [location, expected] of [
    ['Office Based - London, UK', ['GB']],
    ['Boston, Massachusetts; Remote - California', ['US']],
    ['Bangalore, India; Remote, Poland', ['IN', 'PL']],
    ['Remote, United Kingdom; Remote, United States', ['GB', 'US']],
    ['Home Based - EMEA; Home Based - Worldwide', []],
  ]) {
    assert.deepEqual(Array.from(jobs.countries(location)), expected);
  }
});

test('defaults to the visitor country and honours saved overrides', () => {
  for (const country of ['GB', 'US', 'IN']) assert.equal(jobs.selected([], country), country);
  const saved = [{kind: 'preference', id: 'jobs-country', data: {title: 'IN'}}];
  assert.equal(jobs.selected(saved, 'GB'), 'IN');
  saved[0].data.title = 'All';
  assert.equal(jobs.selected(saved, 'GB'), 'All');
});

test('matches profile roles regardless of word order or inflection', () => {
  for (const [term, title, expected] of [
    ['test engineer', 'Senior Software Engineer in Test', true],
    ['test engineer', 'Engineering Manager, Testing', true],
    ['qa engineer', 'Quality Assurance Engineer', true],
    ['qa engineer', 'SDET', true],
    ['data architect', 'Solutions Architect, Data Platform', true],
    ['test engineer', 'Data Engineer', false],
    ['ai', 'Account Executive', false],
  ]) assert.equal(jobs.matches(term, title), expected, term + ' / ' + title);
});

test('filters opportunities by persona while keeping universal events visible', () => {
  assert.equal(jobs.personaMatches('qa_engineer', ['qa_engineer']), true);
  assert.equal(jobs.personaMatches('qa_engineer', ['software_engineer']), false);
  assert.equal(jobs.personaMatches('qa_engineer', ['universal']), true);
  assert.equal(jobs.personaMatches('business_analyst', ['universal']), true);
  assert.equal(jobs.personaMatches('college_grad', ['college_grad']), true);
  assert.equal(jobs.personaMatches('all', ['software_engineer']), true);
});