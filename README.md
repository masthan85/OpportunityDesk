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
| `src/server/connector/` | OAuth sign-in and MCP tools for AI assistants |
| `src/shared/` | Event catalogue, regions and job matching used by both browser and Worker |
| `drizzle/` | D1 schema migrations in deployment order |
| `test/` | Built Worker integration tests |
| `.openai/hosting.json` | Existing ChatGPT Sites project and binding metadata |

## Hosting and data

Production runs on ChatGPT Sites with a D1 database bound as `DB`. Sites supplies verified user identity headers. A standalone deployment needs its own authentication boundary that strips incoming identity headers and injects verified identity before the Worker receives a request.

The discovery catalogue is maintained in `src/client/discovery.js`. Job discovery uses selected Greenhouse employer boards. A GitHub push does not deploy to Sites. Keep the repository private because it includes the legacy owner-specific starter record. User database contents are managed separately by Sites.

The initial GitHub import is based on Sites version 7, source commit `e0fe978f4a5e5bd821fd0c2a6e9978060950c486`.

## AI connector

Visitors can use Opportunity Desk from their own Claude or ChatGPT. The site is an MCP server at `/mcp` and an OAuth 2.1 authorisation server: an AI app registers itself at `/oauth/register`, the visitor signs in with the site's existing ChatGPT sign-in and approves access at `/oauth/authorize`, and the app receives tokens bound to that visitor at `/oauth/token`. Tools read and update only that visitor's records, which the website shows as usual. The site never calls an AI model and holds no AI API key; the visitor's own assistant does the reasoning.

Tools: `get_profile`, `update_profile`, `search_jobs`, `get_job_description`, `search_events`, `list_my_records`, `track_event`, `mark_job_applied` and `update_record_status`. Visitors find the connector address and can disconnect apps on the Career profile page. Migration `0002_connector` adds the client, code and token tables; only SHA-256 hashes of codes and tokens are stored.
