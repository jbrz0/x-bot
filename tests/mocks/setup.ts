import { vi } from 'vitest';

// Mock Prisma client
vi.mock('../src/lib/prisma', () => ({
  default: {
    interactionLog: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    $disconnect: vi.fn(),
  },
}));

// Mock OpenAI client
vi.mock('../src/services/openaiClient', () => ({
  generateContent: vi.fn(),
}));

// Mock X client
vi.mock('../src/services/xClient', () => ({
  postTweet: vi.fn(),
  replyToTweet: vi.fn(),
  retweet: vi.fn(),
  searchRecentTweets: vi.fn(),
}));

// Mock logger to suppress output during tests
vi.mock('../src/utils/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
  },
})); 