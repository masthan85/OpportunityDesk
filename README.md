# Open Opportunity Desk

Discover data and AI jobs and events, and track applications, submissions, deadlines, and follow-ups in a private workspace. [Open the live site](https://data-and-ai-opportunities.optimisticrosemary.chatgpt.site)

## Build and test

Use Node.js 22.13 or later. The project has no npm dependencies.

```sh
npm run build
npm test
```

The build emits a self-contained Sites Worker at `dist/server/index.js`, plus its hosting metadata and database migrations. The tests run the built Worker with an in-memory SQLite adapter.

## Repository layout

| Path | Responsibility |
| --- | --- |
| `src/client/` | Browser UI, opportunity catalogue, career profile, and jobs views |
| `src/server/worker.js` | HTTP routing, authentication boundary, and asset delivery |
| `src/server/entries/` | Per-user records, optimistic concurrency, and legacy owner seed |
| `src/server/jobs/` | Employer feed integration |
| `drizzle/` | D1 schema migrations in deployment order |
| `test/` | Built Worker integration tests |
| `.openai/hosting.json` | Existing ChatGPT Sites project and binding metadata |

## Hosting and data

Production runs on ChatGPT Sites with a D1 database bound as `DB`. Sites supplies verified user identity headers. A standalone deployment needs its own authentication boundary that strips incoming identity headers and injects verified identity before the Worker receives a request.

The discovery catalogue is maintained in `src/client/discovery.js`. Job discovery uses selected Greenhouse employer boards. A GitHub push does not deploy to Sites. Keep the repository private because it includes the legacy owner-specific starter record. User database contents are managed separately by Sites.

The initial GitHub import is based on Sites version 7, source commit `e0fe978f4a5e5bd821fd0c2a6e9978060950c486`.
