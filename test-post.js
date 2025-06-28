// Simple test to post a basic tweet
require('dotenv').config();
const { TwitterApi } = require('twitter-api-v2');

const client = new TwitterApi({
  appKey: process.env.X_APP_KEY,
  appSecret: process.env.X_APP_SECRET,
  accessToken: process.env.X_ACCESS_TOKEN,
  accessSecret: process.env.X_ACCESS_SECRET,
});

async function testPost() {
  try {
    const timestamp = Date.now();
    const testTweet = `Test post ${timestamp}`;
    
    console.log('Attempting to post:', testTweet);
    const result = await client.v2.tweet(testTweet);
    console.log('SUCCESS! Posted tweet:', result.data);
  } catch (error) {
    console.error('ERROR:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
  }
}

testPost();
