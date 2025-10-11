# Analytics Agent ChatKit Starter

This project extends the OpenAI ChatKit starter with a minimal analytics workflow. Upload `.zip` archives of Excel workbooks, ingest them into DuckDB, and chat with an agent that can generate read-only SQL or Vega-Lite charts. Everything runs inside Next.js (App Router) and is deployable to Vercel.

## Features

- `/api/ingest` ingests `.xlsx` sheets from a zip archive into DuckDB and maintains a `_catalog` table with column metadata and row counts.
- `/api/sql` executes validated read-only SQL with a 50k row cap and 10s timeout.
- `/data` dashboard to upload archives, inspect the catalog, and run manual SQL checks.
- `/` chat interface powered by `<openai-chatkit>` that auto-runs ```sql``` blocks and renders ```vega-lite``` specs below assistant messages.
- System prompt hint so the assistant knows how to produce SQL and Vega-Lite responses.

## Prerequisites

- Node.js 18+
- An OpenAI API key with ChatKit access
- A ChatKit Workflow ID created in Agent Builder

## Environment Variables

Create `.env.local` and provide:

- `OPENAI_API_KEY` – **required**. ChatKit session creation uses this key.
- `NEXT_PUBLIC_CHATKIT_WORKFLOW_ID` – **required**. Workflow to load in the chat UI.
- `CHATKIT_API_BASE` – optional override for the ChatKit API base URL.

## Install & Run Locally

```bash
npm install
npm run dev
```

Visit:

- `http://localhost:3000/data` to upload Excel zips, refresh the catalog, or run ad-hoc queries.
- `http://localhost:3000/` to chat with the analytics agent.

## Usage Notes

1. Zip ingestion is capped at ~2,000,000 total rows per upload. All columns are stored as `VARCHAR` to keep type coercion simple.
2. DuckDB is stored at `/tmp/analytics.duckdb`. This works on Vercel but resets between deployments. **TODO:** switch to a persistent backend (e.g., Vercel Blob or external storage) for production reliability.
3. `/api/sql` rejects DDL/DML statements and trims results at 50,000 rows. Encourage the agent (or manual users) to add `LIMIT` clauses.
4. The chat bridge watches for ```sql``` and ```vega-lite``` fences. SQL blocks are executed against DuckDB and the results render inline; Vega-Lite specs render via `vega-embed`.

## Deploying to Vercel

1. Push this repository to GitHub and import it in the Vercel dashboard.
2. Set the environment variables above in the project settings.
3. Deploy – the provided `vercel.json` limits function runtime to 10 seconds, matching the SQL timeout.

## Manual QA Checklist

1. `npm install` and `npm run dev`.
2. Visit `/data`, upload a `.zip` of Excel files, and confirm tables appear in the catalog.
3. Run a manual `SELECT * FROM "_catalog"` query and confirm results display.
4. Visit `/`, ask the agent for a table summary (e.g., "Show the first 5 rows of orders"), observe the SQL result under the assistant message.
5. Request a chart ("Plot sales by month") and verify the Vega-Lite visualization renders.

## Additional Notes

- Update the ChatKit workflow's system prompt to include the guidance from [`app/lib/agent-system-prompt.ts`](app/lib/agent-system-prompt.ts).
- To persist data across deployments, replace the local `/tmp` DuckDB file with a remote DuckDB or object storage solution.
