# X Bot

A TypeScript-based bot for X (Twitter) designed to:
*   Re-post interesting content based on configured topics.
*   Reply with smart, value-adding comments.
*   Occasionally craft original posts.

Built with Node.js, TypeScript, `twitter-api-v2`, OpenAI, and Vitest.
Designed for local execution and deployment on any server with Node.js.

## Features (MVP)

*   **Content Curation:** Scans recent tweets based on weighted topics 
    *   **Note:** The combined length of all keywords in `src/config.ts` (joined by ` OR ` and including necessary filters like `-is:retweet`) must not exceed the X API v2 search query limit of 512 characters. If you add too many keywords, the tweet search functionality will fail.
*   **Engagement Scoring:** Evaluates potential tweets using a heuristic based on author followers, likes, retweets, and age.
*   **Action Strategy:** Decides whether to reply, repost, post original content, or ignore based on engagement, relevance, and basic cadence rules.
*   **AI-Powered Content:** Uses OpenAI (`gpt-4o-mini` by default) to generate replies and original posts matching a defined persona (designer-founder, casual-smart, tech-optimistic).
*   **Rate Limit Handling:** Implements basic retries with exponential backoff for common API errors.

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


## Configuration

Before running the bot, you may want to customize its behavior. Here are the key files for configuration:

*   **`src/config.ts`**: This is the main configuration file where you can define the bot's personality and content strategy.
    *   `BOT_PERSONA`: A detailed description of the bot's personality, writing style, and tone. This heavily influences the AI-generated content.
    *   `TOPICS`: An array of topics the bot will search for on X. Each topic has a weight to control its priority.
    *   `KEYWORDS`: A list of keywords related to your topics. The bot uses these to find relevant tweets.

*   **`src/bot.ts`**: This file contains the core logic for the bot, including the prompt templates sent to the AI.
    *   Look for the `openai.chat.completions.create` calls to see the exact prompts used for generating replies and original posts. You can modify these prompts to change how the bot crafts its content.

*   **`src/scheduler.ts`**: This file controls how often the bot runs.
    *   `CRON_SCHEDULE`: A cron expression that determines the posting frequency. The default is set to run once every hour.
    *   **Note on Rate Limits**: The default schedule is designed to stay within the free tier of the X API. If you make the schedule more frequent, you may exceed the rate limits and need to upgrade to a paid X API plan.

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

| `LOG_LEVEL`            | Logging level for Pino (optional, defaults to `info`)                       | `info`                          |
| `SIMULATE_MODE`        | Set to `false` for production                                               | `false`                         |

## Project Structure

```
.env.example        # Environment variable template
.gitignore          # Git ignore rules
checklist.md        # Project tasks
package.json        # Project dependencies and scripts
src/
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


*   Refine `isTweetRelevant` check (e.g., use OpenAI for better understanding).
*   Add check to avoid reposting the same tweet.
*   Implement more sophisticated error handling and reporting.
*   Explore `twitter-api-v2` Rate Limit plugin.
*   Add more comprehensive tests (covering `bot.ts`, mocks for specific API scenarios).
*   Achieve higher test coverage.
*   (See full list in `checklist.md` Phase 2 & Advanced Features) 


# PM2 Deployment
Use pm2 (Recommended for production)

### Install dependencies:

```bash 
npm install -g pm2 ts-node typescript
npm install  # Install project dependencies
```

### Stop any existing PM2 processes:

```bash
pm2 stop all
pm2 delete all
```

### Start using ecosystem config:

```bash
pm2 start ecosystem.config.js
```

### Save and enable auto-start:

```bash
pm2 save
pm2 startup
# Follow the instructions from the startup command
```

### Useful PM2 commands:

**Direct PM2 Commands:**

```bash
pm2 status          # Check status
pm2 logs x-bot       # View logs
pm2 restart x-bot    # Restart bot
pm2 stop x-bot       # Stop bot
pm2 delete x-bot     # Delete bot
```

**NPM Script Wrappers:**

The following scripts are available in `package.json` for convenience:
```bash
npm run pm2          # Start the bot using PM2
npm run pm2:stop     # Stop the bot
npm run pm2:restart  # Restart the bot
npm run pm2:logs     # View logs
```