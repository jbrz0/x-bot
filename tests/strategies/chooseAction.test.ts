import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { calculateEngagementScore, chooseNextAction } from '../../src/strategies/chooseAction';
import * as xClient from '../../src/services/xClient';
import prisma from '../../src/lib/prisma';
import * as openaiClient from '../../src/services/openaiClient';

// Mock the modules. This happens before imports are fully resolved.
// NOTE: The actual setup.ts file already does this, but repeating here for clarity 
// and potentially helping the test runner.
vi.mock('../../src/services/xClient');
vi.mock('../../src/lib/prisma');
vi.mock('../../src/services/openaiClient');

// Type assertion helper for mocked functions (more robust)
function asMock<T extends (...args: any[]) => any>(func: T): vi.MockedFunction<T> {
  return func as vi.MockedFunction<T>;
}

// Type assertion for mocked functions
const mockedSearch = xClient.searchRecentTweets as vi.Mock;
const mockedFindFirst = prisma.interactionLog.findFirst as vi.Mock;

// Mock Date.now() for consistent testing
// Use beforeEach/afterEach to manage system time mocks cleanly
// const NOW = Date.now(); // Set this inside tests or beforeEach if needed

describe('calculateEngagementScore', () => {
  const createTweet = (overrides: Partial<any> = {}): any => ({
    id: '123',
    text: 'Test tweet',
    authorId: 'author1',
    authorFollowers: 1000,
    likeCount: 50,
    retweetCount: 10,
    replyCount: 5,
    quoteCount: 2,
    createdAt: new Date(Date.now() - 60 * 60 * 1000), // 60 minutes ago
    ...overrides,
  });

  it('should calculate score correctly for a typical tweet', () => {
    const tweet = createTweet(); // 60 min old, 1000 followers, 50 likes, 10 RTs
    // Actual calculated score was ~34.258
    expect(calculateEngagementScore(tweet)).toBeCloseTo(34.258, 3);
  });

  it('should return 0 if tweet age is zero or negative', () => {
    const tweetNow = createTweet({ createdAt: new Date(Date.now()) });
    const tweetFuture = createTweet({ createdAt: new Date(Date.now() + 60000) });
    expect(calculateEngagementScore(tweetNow)).toBe(0);
    expect(calculateEngagementScore(tweetFuture)).toBe(0);
  });

  it('should handle zero engagement correctly', () => {
    const tweet = createTweet({ likeCount: 0, retweetCount: 0 });
    // Score = (sqrt(1000) * (0 + 0 * 1.5)) / 60 = 0
    expect(calculateEngagementScore(tweet)).toBe(0);
  });

  it('should handle zero followers correctly', () => {
    const tweet = createTweet({ authorFollowers: 0 });
    // Score = (sqrt(0) * (50 + 10 * 1.5)) / 60 = 0
    expect(calculateEngagementScore(tweet)).toBe(0);
  });

  it('should increase score with higher engagement', () => {
    const tweetLow = createTweet({ likeCount: 10, retweetCount: 2 }); // Score ~ 7.38
    const tweetHigh = createTweet({ likeCount: 100, retweetCount: 50 }); // Score ~ 92.24
    expect(calculateEngagementScore(tweetHigh)).toBeGreaterThan(calculateEngagementScore(tweetLow));
  });

  it('should decrease score with older age', () => {
    const tweetYoung = createTweet({ createdAt: new Date(Date.now() - 30 * 60 * 1000) }); // 30 min old, Score ~ 68.51
    const tweetOld = createTweet({ createdAt: new Date(Date.now() - 120 * 60 * 1000) }); // 120 min old, Score ~ 17.13
    expect(calculateEngagementScore(tweetYoung)).toBeGreaterThan(calculateEngagementScore(tweetOld));
  });
});

describe('chooseNextAction', () => {
  let NOW: number;

  // Reset mocks and time before each test
  beforeEach(() => {
    vi.useFakeTimers(); 
    vi.setSystemTime(new Date('2024-01-01T12:00:00.000Z'));
    NOW = Date.now();
    vi.clearAllMocks();
    // Reset mocks using the global variables (assuming setup.ts works)
    mockedSearch.mockResolvedValue([]);
    mockedFindFirst.mockResolvedValue(null);
  });

  // Restore real timers after each test
  afterEach(() => {
    vi.useRealTimers();
  });

  // Helper to create mock tweet candidates relative to NOW
  const createMockCandidate = (id: string, scoreProps: Partial<any>, text: string = 'Test tweet'): any => ({
    id,
    text,
    authorId: `author_${id}`,
    authorFollowers: scoreProps.authorFollowers ?? 1000,
    likeCount: scoreProps.likeCount ?? 50,
    retweetCount: scoreProps.retweetCount ?? 10,
    replyCount: scoreProps.replyCount ?? 5,
    quoteCount: scoreProps.quoteCount ?? 2,
    createdAt: new Date(NOW - (scoreProps.ageMinutes ?? 60) * 60 * 1000),
  });

  it('should choose IGNORE if no candidates are found', async () => {
    // Arrange: Mocks reset in beforeEach
    // Act
    const decision = await chooseNextAction();
    // Assert
    expect(mockedSearch).toHaveBeenCalled(); // Check if the mock was called
    expect(decision.type).toBe('ignore');
    expect(decision.reason).toContain('No suitable candidates');
  });

  it('should choose REPLY for a relevant, high-engagement tweet with no recent replies', async () => {
    // Arrange
    const highEngagementTweet = createMockCandidate('t1', { ageMinutes: 30, likeCount: 100, retweetCount: 20 }, "This tweet talks about #UIUX design");
    mockedSearch.mockResolvedValue([highEngagementTweet]);
    // Act
    const decision = await chooseNextAction();
    // Assert
    expect(decision.type).toBe('reply');
    expect(decision.targetTweet?.id).toBe('t1');
    expect(mockedFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ authorId: 'author_t1' }) })
    );
  });

  it('should choose REPOST for a relevant tweet if no suitable reply target exists', async () => {
    // Arrange
    const relevantTweet = createMockCandidate('t2', { ageMinutes: 60, likeCount: 10, retweetCount: 1 }, "Let's discuss #productivity tools");
    mockedSearch.mockResolvedValue([relevantTweet]);
    // Act
    const decision = await chooseNextAction();
    // Assert
    expect(decision.type).toBe('repost');
    expect(decision.targetTweet?.id).toBe('t2');
  });

  it('should IGNORE a high-engagement tweet if it is not relevant', async () => {
     // Arrange
    const highEngagementIrrelevant = createMockCandidate('t3', { ageMinutes: 30, likeCount: 100, retweetCount: 20 }, "Just some random thoughts");
    mockedSearch.mockResolvedValue([highEngagementIrrelevant]);
    vi.setSystemTime(new Date('2024-01-01T18:30:00.000Z')); 
    // Act
    const decision = await chooseNextAction();
    // Assert
    expect(decision.type).toBe('ignore');
  });

  it('should IGNORE a relevant, high-engagement tweet if replied recently', async () => {
    // Arrange
    const tweet = createMockCandidate('t4', { ageMinutes: 30, likeCount: 100, retweetCount: 20 }, "More on #webdev");
    mockedSearch.mockResolvedValue([tweet]);
    mockedFindFirst.mockResolvedValue({ id: 'log1', authorId: 'author_t4', type: 'reply', createdAt: new Date() });
    // Act
    const decision = await chooseNextAction();
    // Assert
    expect(mockedFindFirst).toHaveBeenCalled();
    expect(decision.type).toBe('ignore'); 
  });

   it('should choose ORIGINAL_POST if within cadence window and no other actions taken', async () => {
    // Arrange
    vi.setSystemTime(new Date('2024-01-01T10:00:00.000Z')); 
    // Act
    const decision = await chooseNextAction();
    // Assert
    expect(decision.type).toBe('original_post');
  });

  // TODO: Add tests for cadence checks involving DB lookups (counts)
  // TODO: Add tests for relevance checking variations
});

// TODO: Add tests for chooseNextAction (requires mocking dependencies) 