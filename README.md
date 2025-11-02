# Analytics Agent ChatKit Starter

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
![NextJS](https://img.shields.io/badge/Built_with-NextJS-blue)
![OpenAI API](https://img.shields.io/badge/Powered_by-OpenAI_API-orange)

This repository is the simplest way to bootstrap a [ChatKit](http://openai.github.io/chatkit-js/) application. It ships with a minimal Next.js UI, the ChatKit web component, and a ready-to-use session endpoint so you can experiment with OpenAI-hosted workflows built using [Agent Builder](https://platform.openai.com/agent-builder).

## Features

- Next.js app with `<openai-chatkit>` web component and theming controls
- API endpoint for creating a session at [`app/api/create-session/route.ts`](app/api/create-session/route.ts)
- Config file for starter prompts, theme, placeholder text, and greeting message

## Prerequisites

### 1. Install dependencies

Create `.env.local` and provide:

- `OPENAI_API_KEY` – **required**. ChatKit session creation uses this key.
- `NEXT_PUBLIC_CHATKIT_WORKFLOW_ID` – **required**. Workflow to load in the chat UI.
- `CHATKIT_API_BASE` – optional override for the ChatKit API base URL.

## Install & Run Locally

```bash
npm install
npm run dev
```

You can get your workflow id from the [Agent Builder](https://platform.openai.com/agent-builder) interface, after clicking "Publish":

<img src="./public/docs/workflow.jpg" width=500 />

You can get your OpenAI API key from the [OpenAI API Keys](https://platform.openai.com/api-keys) page.

### 3. Configure ChatKit credentials

Update `.env.local` with the variables that match your setup.

- `OPENAI_API_KEY` — This must be an API key created **within the same org & project as your Agent Builder**. If you already have a different `OPENAI_API_KEY` env variable set in your terminal session, that one will take precedence over the key in `.env.local` one (this is how a Next.js app works). So, **please run `unset OPENAI_API_KEY` (`set OPENAI_API_KEY=` for Windows OS) beforehand**.
- `NEXT_PUBLIC_CHATKIT_WORKFLOW_ID` — This is the ID of the workflow you created in [Agent Builder](https://platform.openai.com/agent-builder), which starts with `wf_...`
- (optional) `CHATKIT_API_BASE` - This is a customizable base URL for the ChatKit API endpoint

> Note: if your workflow is using a model requiring organization verification, such as GPT-5, make sure you verify your organization first. Visit your [organization settings](https://platform.openai.com/settings/organization/general) and click on "Verify Organization".

## Usage Notes

1. Zip ingestion is capped at ~2,000,000 total rows per upload. All columns are stored as `VARCHAR` to keep type coercion simple.
2. DuckDB is stored at `/tmp/analytics.duckdb`. This works on Vercel but resets between deployments. **TODO:** switch to a persistent backend (e.g., Vercel Blob or external storage) for production reliability.
3. `/api/sql` rejects DDL/DML statements and trims results at 50,000 rows. Encourage the agent (or manual users) to add `LIMIT` clauses.
4. The chat bridge watches for ```sql``` and ```vega-lite``` fences. SQL blocks are executed against DuckDB and the results render inline; Vega-Lite specs render via `vega-embed`.

## Deploying to Vercel

### 5. Deploy your app

```bash
npm run build
```

Before deploying your app, you need to verify the domain by adding it to the [Domain allowlist](https://platform.openai.com/settings/organization/security/domain-allowlist) on your dashboard.

## Customization Tips

- Adjust starter prompts, greeting text, [chatkit theme](https://chatkit.studio/playground), and placeholder copy in [`lib/config.ts`](lib/config.ts).
- Update the event handlers inside [`components/.tsx`](components/ChatKitPanel.tsx) to integrate with your product analytics or storage.

## Additional Notes

- Update the ChatKit workflow's system prompt to include the guidance from [`app/lib/agent-system-prompt.ts`](app/lib/agent-system-prompt.ts).
- To persist data across deployments, replace the local `/tmp` DuckDB file with a remote DuckDB or object storage solution.
