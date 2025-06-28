// Test posting a completely manual, non-AI message
require('dotenv').config();
const { TwitterApi } = require('twitter-api-v2');

const client = new TwitterApi({
  appKey: process.env.X_APP_KEY,
  appSecret: process.env.X_APP_SECRET,
  accessToken: process.env.X_ACCESS_TOKEN,
  accessSecret: process.env.X_ACCESS_SECRET,
});

async function testManualPost() {
  try {
    // Very simple, human-like message
    const testTweet = `just testing my bot setup - ${Date.now()}`;
    
    console.log('Attempting to post:', testTweet);
    const result = await client.v2.tweet(testTweet);
    console.log('SUCCESS! Posted tweet:', result.data);
  } catch (error) {
    console.error('ERROR:', error);
    console.error('Status:', error.status);
    console.error('Code:', error.code);
    console.error('Data:', error.data);
  }
}

testManualPost();
