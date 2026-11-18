import { readFile, writeFile, mkdir, cp } from 'node:fs/promises';

const fromRoot = path => new URL(path, import.meta.url);
const read = path => readFile(fromRoot(path), 'utf8');
const bundle = async paths => (await Promise.all(paths.map(read))).join('\n');

const assets = {
  '/': await read('src/client/index.html'),
  '/sign-in.html': await read('src/client/sign-in.html'),
  '/style.css': await read('src/client/style.css'),
  '/workspace.js': await bundle([
    'src/client/app.js',
    'src/client/discovery.js',
    'src/client/jobs.js',
  ]),
};

const worker = await bundle([
  'src/server/entries/owner-seed.js',
  'src/server/entries/handler.js',
  'src/server/jobs/greenhouse.js',
  'src/server/worker.js',
]);

await Promise.all([
  mkdir(fromRoot('dist/server'), { recursive: true }),
  mkdir(fromRoot('dist/.openai'), { recursive: true }),
]);

await Promise.all([
  cp(fromRoot('.openai/hosting.json'), fromRoot('dist/.openai/hosting.json')),
  cp(fromRoot('drizzle'), fromRoot('dist/drizzle'), { recursive: true }),
  writeFile(fromRoot('dist/server/index.js'), `const assets = ${JSON.stringify(assets)};\n${worker}`),
]);
