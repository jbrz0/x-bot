# X Bot (@jbrz0_bot)

A TypeScript-based bot for X (Twitter) designed to:
*   Re-post interesting content based on configured topics.
*   Reply with smart, value-adding comments.
*   Occasionally craft original posts.

Built with Node.js, TypeScript, `twitter-api-v2`, OpenAI, Prisma, and Vitest.
Designed for local execution and Vercel Serverless Function deployment.

## Features (MVP)

*   **Content Curation:** Scans recent tweets based on weighted topics (`productivity`, `design`, `webdev`, `apple`, `crypto`, `scifi`, `minimalism`, `life-improvement`).
*   **Engagement Scoring:** Evaluates potential tweets using a heuristic based on author followers, likes, retweets, and age.
*   **Action Strategy:** Decides whether to reply, repost, post original content, or ignore based on engagement, relevance, and basic cadence rules.
*   **AI-Powered Content:** Uses OpenAI (`gpt-4o-mini` by default) to generate replies and original posts matching a defined persona (designer-founder, casual-smart, tech-optimistic).
*   **Rate Limit Handling:** Implements basic retries with exponential backoff for common API errors.
*   **State Management:** Uses Prisma with SQLite locally to track interactions (e.g., avoid replying to the same author too frequently).
*   **Scheduling:** 
    *   Local: Uses `node-cron` for scheduled execution via `npm run dev` or `npm run start`.
    *   Vercel: Configured for deployment as a Serverless Function triggered by Vercel Cron.
*   **Simulate Mode:** Allows running the bot logic without actually posting to X (logs intended actions instead).
*   **Testing:** Includes basic unit tests (Vitest) for helper functions.

## Setup

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd x-bot
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Set up environment variables:**
    *   Copy the example environment file:
        ```bash
        cp .env.example .env
        ```
    *   Edit the `.env` file and fill in your credentials and settings (see **Environment Variables** section below).
4.  **Set up the database:**
    *   Generate the Prisma client (needed after `npm install`):
        ```bash
        npx prisma generate
        ```
    *   Apply the database schema (creates the `dev.db` SQLite file):
        ```bash
        npx prisma db push
        ```

## Running the Bot

*   **Development Mode (with auto-reload):**
    *   Runs the local scheduler (`src/scheduler.ts`), which triggers the bot logic (`src/bot.ts`) based on the `CRON_SCHEDULE` (defaults to every hour).
    *   Uses `nodemon` to watch for file changes.
    ```bash
    npm run dev 
    ```
*   **Production Mode (local):**
    *   Builds the TypeScript code to JavaScript in the `dist/` directory.
    *   Runs the compiled scheduler (`dist/scheduler.js`).
    ```bash
    npm run build
    npm run start
    ```
*   **Simulate Mode:**
    *   Runs the bot logic once directly, logging intended actions instead of calling the X API.
    *   Useful for testing the decision logic without posting.
    ```bash
    npm run simulate
    # OR set SIMULATE_MODE=true in .env and run dev/start
    ```
*   **Running Tests:**
    ```bash
    npm test # Run all tests once
    npm run test:watch # Run tests in watch mode
    npm run test:coverage # Run tests and generate coverage report
    ```

## Deployment (Vercel)

1.  **Create a Vercel project:** Link your Git repository (GitHub, GitLab, Bitbucket).
2.  **Configure Build Command:** Set the build command to `npm run build` or `npx prisma generate && npm run build` if generation is needed during build.
3.  **Configure Output Directory:** Vercel usually detects Next.js/Nuxt, ensure it knows this is a Node.js backend if needed. The `dist` directory isn't directly served, but the `api` directory is key.
4.  **Set Environment Variables:** In the Vercel project settings (Settings > Environment Variables), add all the variables defined in `.env.example` (e.g., `X_APP_KEY`, `OPENAI_API_KEY`, `DATABASE_URL`, `VERCEL_CRON_SECRET`).
    *   **`DATABASE_URL`:** Change this to your production database connection string (e.g., Supabase/Postgres).
    *   **`VERCEL_CRON_SECRET` (Optional but Recommended):** Generate a strong secret string. Add it here and also in `vercel.json` under the cron job definition (`"path": "/api/run-bot?_cron_secret=YOUR_SECRET"`) for protection. *Note: The current `api/run-bot.ts` checks the `Authorization: Bearer <secret>` header, which is Vercel's default protection method when using the dashboard UI to add protection. If adding manually to `vercel.json`, the query param method might be needed instead, requiring an update to `api/run-bot.ts`.* Refer to Vercel Cron Job security documentation.
5.  **Deploy:** Trigger a deployment.
6.  **Set up Production Database:** 
    *   If using a relational database like Postgres on Supabase, update your `prisma/schema.prisma` file:
        ```prisma
        datasource db {
          provider = "postgresql"
          url      = env("DATABASE_URL")
        }
        ```
    *   Run `npx prisma db push` (or preferably `npx prisma migrate deploy` after creating migrations locally) against your production database *before* or during the first deployment.
7.  **Monitor:** Check Vercel Functions logs and Cron Job status in the dashboard.

## Environment Variables

| Variable               | Description                                                                 | Example                         |
| ---------------------- | --------------------------------------------------------------------------- | ------------------------------- |
| `X_APP_KEY`            | X API Key (Consumer Key)                                                    | `your_app_key`                  |
| `X_APP_SECRET`         | X API Key Secret (Consumer Secret)                                          | `your_app_secret`               |
| `X_ACCESS_TOKEN`       | X Access Token (for the bot user @jbrz0_bot)                                | `your_access_token`             |
| `X_ACCESS_SECRET`      | X Access Token Secret (for the bot user @jbrz0_bot)                         | `your_access_secret`            |
| `OPENAI_API_KEY`       | Your OpenAI API key                                                         | `sk-xxxxxxxxxxxxxxxxxxxxxxxxx`    |
| `OPENAI_MODEL`         | OpenAI model to use (optional, defaults to `gpt-4o-mini`)                   | `gpt-4o`                        |
| `DATABASE_URL`         | Connection string for the database (SQLite for local, Postgres for prod)    | `file:./dev.db`                 |
| `LOG_LEVEL`            | Logging level for Pino (optional, defaults to `info`)                       | `debug`                         |
| `SIMULATE_MODE`        | Set to `true` to prevent actual X API posts (optional, defaults to `false`) | `true`                          |
| `VERCEL_CRON_SECRET`   | Secret for securing Vercel cron job endpoint (optional, for Vercel deploy)  | `a_very_strong_random_secret` |

## Project Structure

```
.env.example        # Environment variable template
.gitignore          # Git ignore rules
checklist.md        # Project tasks
package.json        # Project dependencies and scripts
pnpm-lock.yaml      # Lockfile
prisma/
  schema.prisma     # Database schema
  dev.db            # SQLite database (local, generated)
src/
  api/
    run-bot.ts      # Vercel Serverless Function handler
  lib/
    prisma.ts       # Prisma client singleton
  services/
    openaiClient.ts # OpenAI API wrapper
    xClient.ts      # X API wrapper
  strategies/
    chooseAction.ts # Core decision logic
  utils/
    logger.ts       # Pino logger setup
  bot.ts            # Main bot execution logic
  config.ts         # Bot configuration
  scheduler.ts      # Local cron scheduler
tests/
  mocks/
    setup.ts        # Vitest mock setup
  strategies/
    chooseAction.test.ts # Tests for strategy logic
  example.test.ts   # Placeholder test file
tsconfig.json       # TypeScript configuration
vercel.json         # Vercel deployment configuration (cron)
vitest.config.ts    # Vitest configuration
README.md           # This file
```

## TODO / Future Ideas

*   Implement robust cadence checking against database logs.
*   Refine `isTweetRelevant` check (e.g., use OpenAI for better understanding).
*   Add check to avoid reposting the same tweet.
*   Implement more sophisticated error handling and reporting.
*   Explore `twitter-api-v2` Rate Limit plugin.
*   Add more comprehensive tests (covering `bot.ts`, mocks for specific API scenarios).
*   Achieve higher test coverage.
*   (See full list in `checklist.md` Phase 2 & Advanced Features) 