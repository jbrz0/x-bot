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

## Deployment (DigitalOcean Droplet with Docker)

This setup uses Docker and Docker Compose to run the bot application containerized on a DigitalOcean droplet (or any server with Docker).

**Prerequisites:**

*   A DigitalOcean account and a Droplet created (Ubuntu recommended, with Docker pre-installed or installed manually).
*   Docker and Docker Compose installed on your local machine (for building/testing) and on the Droplet.
*   Git installed on the Droplet.
*   Your Supabase database ready (or alternative Postgres database).

**Steps:**

1.  **SSH into your Droplet:**
    ```bash
    ssh root@your_droplet_ip
    ```
2.  **Clone the repository:**
    ```bash
    git clone <your-repository-url> # Replace with your repo URL
    cd x-bot
    ```
3.  **Create the environment file:**
    *   Copy the example:
        ```bash
        cp .env.example .env
        ```
    *   **Edit `.env` using a terminal editor** (like `nano` or `vim`) and fill in **all** your production credentials:
        ```bash
        nano .env
        ```
        *   Make sure `DATABASE_URL` points to your production Supabase Postgres string.
        *   Set `NODE_ENV=production`.
        *   Set `SIMULATE_MODE=false`.
        *   Leave `SIMULATE_DATABASE_URL` as is or remove it; it won't be used in production.
        *   Fill in `X_...` and `OPENAI_API_KEY`.
    *   Save the file (e.g., `Ctrl+X`, then `Y`, then `Enter` in `nano`).
4.  **Apply Database Migrations (Important!):**
    *   Before starting the bot for the first time, apply the Prisma schema to your production database:
        ```bash
        # Ensure node/npm are installed on the droplet if not using Docker for this step
        # npm install -g prisma # Install prisma globally if needed
        npx prisma migrate deploy
        ```
    *   *(Alternative for first time)*: If you haven't created migrations yet, you might need to run `npx prisma db push --accept-data-loss` *once* to initialize the schema. Use `migrate deploy` for subsequent updates.
5.  **Build and Run with Docker Compose:**
    ```bash
    docker-compose up --build -d

    # or if v2 like digital ocean (no hyphens)
    docker compose up --build -d
    ```
    *   `--build`: Forces Docker to rebuild the image using the `Dockerfile`.
    *   `-d`: Runs the container in detached mode (in the background).
6.  **Check Logs:**
    *   View the bot's logs:
        ```bash
        docker-compose logs -f x-bot-app
        
        # or if v2 like digital ocean (no hyphens)
        docker logs x-bot-app -f
        ```
    *   Press `Ctrl+C` to stop following the logs.
7.  **Stopping the Bot:**
    ```bash
    docker-compose down
    ```

**Updating:**

1.  SSH into the droplet.
2.  Navigate to the `x-bot` directory.
3.  Pull the latest code: `git pull origin main` (or your branch).
4.  Apply any new database migrations: `npx prisma migrate deploy`.
5.  Rebuild and restart the container: `docker-compose up --build -d`.

## Environment Variables

| Variable               | Description                                                                 | Example                         |
| ---------------------- | --------------------------------------------------------------------------- | ------------------------------- |
| `NODE_ENV`             | Set to `production` for deployments                                         | `production`                    |
| `X_APP_KEY`            | X API Key (Consumer Key)                                                    | `your_app_key`                  |
| `X_APP_SECRET`         | X API Key Secret (Consumer Secret)                                          | `your_app_secret`               |
| `X_ACCESS_TOKEN`       | X Access Token (for the bot user @jbrz0_bot)                                | `your_access_token`             |
| `X_ACCESS_SECRET`      | X Access Token Secret (for the bot user @jbrz0_bot)                         | `your_access_secret`            |
| `OPENAI_API_KEY`       | Your OpenAI API key                                                         | `sk-xxxxxxxxxxxxxxxxxxxxxxxxx`    |
| `OPENAI_MODEL`         | OpenAI model to use (optional, defaults to `gpt-4o-mini`)                   | `gpt-4o`                        |
| `DATABASE_URL`         | Connection string for the database (Supabase/Postgres for prod)             | `postgresql://user:pw...`       |
| `SIMULATE_DATABASE_URL`| Database URL for local simulate mode (SQLite)                             | `file:./dev.db`                 |
| `LOG_LEVEL`            | Logging level for Pino (optional, defaults to `info`)                       | `info`                          |
| `SIMULATE_MODE`        | Set to `false` for production                                               | `false`                         |

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
.dockerignore       # Docker ignore rules
Dockerfile          # Docker build definition
docker-compose.yml  # Docker compose configuration
ecosystem.config.js # PM2 configuration
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