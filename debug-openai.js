// Debug script to see exactly what OpenAI returns
require('dotenv').config();
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function debugOpenAI() {
  try {
    console.log('Testing OpenAI response...');
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "Write a simple tweet about morning thoughts." },
      ],
      temperature: 0.7,
      max_tokens: 280,
    });

    const content = completion.choices[0]?.message?.content;
    
    console.log('Raw OpenAI response:');
    console.log('Content:', JSON.stringify(content));
    console.log('Content length:', content?.length);
    console.log('Content as string:', content);
    
    // Check for problematic characters
    if (content) {
      const hasProblematicChars = /[\u0000-\u001F\u007F-\u009F\uFFFD\uFEFF]/.test(content);
      console.log('Has problematic characters:', hasProblematicChars);
      
      // Show character codes
      console.log('Character codes:');
      for (let i = 0; i < Math.min(content.length, 50); i++) {
        const char = content[i];
        const code = content.charCodeAt(i);
        console.log(`${i}: "${char}" (${code})`);
      }
    }
    
  } catch (error) {
    console.error('OpenAI Error:', error);
  }
}

debugOpenAI();
