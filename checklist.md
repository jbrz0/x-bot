# X Bot Project Checklist

## Phase 1: MVP Setup & Core Functionality

### Project Setup & Configuration
- [x] Initialize Node.js project (`package.json`)
- [x] Install core dependencies (TypeScript, Node.js LTS, ts-node, nodemon, dotenv, pino)
- [x] Install API client dependencies (twitter-api-v2, openai)
- [x] Install scheduling dependencies (node-cron)
- [x] Install testing dependencies (Vitest)
- [x] Install ORM dependencies (Prisma, @prisma/client)
- [x] Set up TypeScript configuration (`tsconfig.json`)
- [x] Create project directory structure (`src`, `tests`, `src/services`, `src/strategies`, `api`)
- [x] Configure `.gitignore`
- [x] Define npm scripts (`dev`, `build`, `start`, `simulate`, `test`, `test:watch`) in `package.json`
- [x] Create `.env.example` file with necessary environment variables
- [x] Set up Prisma schema (`prisma/schema.prisma`) for SQLite (local)
- [x] Generate initial Prisma client
- [x] Set up basic logging with Pino (`src/utils/logger.ts`)
- [x] Create `src/config.ts` for easily tweakable settings (cadence, thresholds, topics)

### Core Service Wrappers
- [x] Create `src/services/xClient.ts` (stub)
    - [x] Initialize `twitter-api-v2` client
    - [x] Implement basic "hello world" post function (`postTweet` - returns ID)
    - [x] Implement function to get recent tweets (`searchRecentTweets`)
    - [x] Add basic rate limit handling (awareness, maybe simple delay) - Placeholder added
    - [x] Add exponential backoff/retry queue for API calls - Implemented with p-retry
    - [x] Implement `replyToTweet` function
    - [x] Implement `retweet` function
- [x] Create `src/services/openaiClient.ts` (stub)
    - [x] Initialize `openai` SDK client
    - [x] Create `modelRouter` class/function (simple env var based)
    - [x] Implement function to generate post/reply text using specified model (`generateContent`)
    - [x] Implement personality/tone prompt based on requirements (initial version)
    - [x] Implement content safeguard checks (sentiment, NSFW, politics) via prompt or post-processing

### Bot Logic & Strategy
- [x] Create `src/strategies/chooseAction.ts` (stub)
    - [x] Define topic weightings (moved to `config.ts`)
    - [x] Implement logic to scan recent tweets/trends (use actual `xClient` function)
    - [x] Implement engagement scoring heuristic function (`calculateEngagementScore`)
    - [x] Implement basic decision logic (repost, reply, original post, ignore) based on topics, engagement, and posting cadence rules - Refined
    - [x] Add rule: Don't reply to the same author within 48 hours (use Prisma check)
    - [x] Implement logic based on posting cadence (`config.ts`) - Basic check added
- [x] Create `src/bot.ts` (main entry point for logic) (stub)
    - [x] Load environment variables
    - [x] Integrate `xClient`, `openaiClient`, and `chooseAction` (stubs + real calls)
    - [x] Implement core bot execution flow (fetch data, decide action, generate content, post/reply) (stub structure + real calls)
    - [x] Add `--simulate` flag handling
    - [x] Integrate Prisma client for logging interactions
    - [x] Call interaction logging function
    - [x] Use actual `replyToTweet` and `retweet` functions

### Scheduling
- [x] Create `src/scheduler.ts` (for local development)
- [x] Create `api/run-bot.ts` (for Vercel Serverless Function)
- [x] Create `vercel.json`

### Testing
- [x] Set up basic Vitest structure (`tests/example.test.ts`)
- [x] Write unit tests for helper functions (e.g., `calculateEngagementScore`)
- [x] Implement mocks for X API calls, OpenAI & Prisma (`tests/mocks/setup.ts`)
- [ ] Implement mocks for OpenAI API calls
- [ ] Achieve >= 80% test coverage for helper functions

### Documentation
- [x] Create `README.md`
    - [x] Add project description
    - [x] Add setup instructions (dependencies, env vars)
    - [x] Add instructions for running locally (`npm run dev`, `npm run simulate`)
    - [x] Add instructions for deploying to Vercel
    - [x] Add table of environment variables

## Phase 2: Deployment & Refinements

### Deployment
- [ ] Configure Vercel project settings
- [ ] Set up environment variables on Vercel
- [ ] Deploy to Vercel
- [ ] Configure Supabase/Postgres database
- [ ] Update Prisma schema and configuration for Postgres
- [ ] Migrate database schema on Supabase
- [ ] Test Vercel deployment and cron job

### Advanced Features & Improvements (Optional/Future)
- [ ] Implement advanced rate limit handling/queueing
- [ ] Set up vector memory with LangChain and Supabase embeddings
- [ ] Add Dockerfile + docker-compose.yml for alternative deployments (e.g., DigitalOcean)
- [ ] Integrate logging with Logtail or Vercel Logs
- [ ] Request "automated" account label from X
- [ ] Refine content safeguards (more robust filters)
- [ ] Refine engagement heuristics and action strategy
- [ ] Add web dashboard (Next.js)
- [ ] Experiment with RAG using Weaviate/RSS
- [ ] Build optional plugin system (DM summaries, email digests)

---

*This checklist will be updated as tasks are completed.* 