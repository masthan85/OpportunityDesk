// Technical and persona-aligned roles: QA/test, software engineering, business analysis, graduate/entry, and data/AI.
const technicalRole = /data|architect|machine learning|artificial intelligence|\bAI\b|\bML\b|analytics|MLOps|platform|engineer|developer|scientist|\bQA\b|quality|\btest|SDET|automation|devops|\bSRE\b|reliability|security|cloud|business analyst|systems analyst|product analyst|graduate|new grad|junior|entry[- ]?level|associate|intern/i;

const VALID_PERSONAS = new Set([
  'qa_engineer',
  'software_engineer',
  'business_analyst',
  'college_grad',
  'data_ai'
]);

function inferPersonas(roleTitle = '', department = '') {
  const text = `${roleTitle} ${department}`.toLowerCase();
  const personas = new Set();

  if (/\b(qa|quality assurance|test engineer|sdet|automation engineer|software in test)\b/.test(text)) {
    personas.add('qa_engineer');
  }

  if (/\b(software engineer|full[- ]?stack|backend|frontend|platform engineer|devops|sre|developer)\b/.test(text)) {
    personas.add('software_engineer');
  }

  if (/\b(business analyst|systems analyst|product analyst|requirements)\b/.test(text)) {
    personas.add('business_analyst');
  }

  if (/\b(graduate|new grad|junior|entry[- ]?level|associate|intern|internship)\b/.test(text)) {
    personas.add('college_grad');
  }

  if (/\b(data engineer|machine learning|ml engineer|artificial intelligence|\bai\b|\bml\b|analytics|mlops|data scientist)\b/.test(text)) {
    personas.add('data_ai');
  }

  if (personas.size === 0) {
    personas.add('software_engineer');
  }

  return Array.from(personas);
}

async function employerJobs(req) {
  const boards = [['databricks', 'Databricks'], ['gitlab', 'GitLab'], ['canonical', 'Canonical']];
  const failed = [];
  let requestedPersona = '';

  try {
    if (req?.url) {
      const url = new URL(req.url);
      const p = (url.searchParams.get('persona') || '').trim();
      if (VALID_PERSONAS.has(p)) requestedPersona = p;
    }
  } catch {
    requestedPersona = '';
  }

  const lists = await Promise.all(boards.map(async ([board, employer]) => {
    try {
      const res = await fetch('https://boards-api.greenhouse.io/v1/boards/' + board + '/jobs', {
        signal: AbortSignal.timeout(9000),
        cf: { cacheTtl: 300, cacheEverything: true }
      });
      if (!res.ok) throw Error();
      const { jobs } = await res.json();
      return jobs
        .filter(j => technicalRole.test(j.title) && /^https:\/\//.test(j.absolute_url))
        .map(j => {
          const department = (j.departments || []).map(d => d.name).join(', ');
          return {
            id: 'job-' + board + '-' + j.id,
            title: j.title,
            employer,
            location: j.location?.name || 'See listing',
            department,
            personas: inferPersonas(j.title, department),
            url: j.absolute_url
          };
        })
        .filter(job => !requestedPersona || job.personas.includes(requestedPersona));
    } catch {
      failed.push(employer);
      return [];
    }
  }));

  return json({ jobs: lists.flat(), failed, persona: requestedPersona || 'all' });
}

async function employerJobDescription(path) {
  const match = /^\/api\/jobs\/job-(databricks|gitlab|canonical)-(\d{1,18})$/.exec(path);
  if (!match) return json({ error: 'Unknown job' }, 404);
  const [, board, id] = match;
  try {
    const response = await fetch('https://boards-api.greenhouse.io/v1/boards/' + board + '/jobs/' + id, {
      signal: AbortSignal.timeout(9000),
      cf: { cacheTtl: 300, cacheEverything: true },
    });
    if (response.status === 404) return json({ error: 'The employer listing is no longer available' }, 404);
    if (!response.ok) throw Error('Employer feed unavailable');
    const { content } = await response.json();
    return json({ description: typeof content === 'string' ? content.slice(0, 42000) : '' });
  } catch {
    return json({ error: 'The employer description is temporarily unavailable' }, 502);
  }
}