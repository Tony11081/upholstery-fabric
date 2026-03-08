import OpenAI from "openai";
import * as dotenv from "dotenv";
import * as path from "path";

// Load .env file
dotenv.config({ path: path.join(__dirname, "../.env") });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || process.env.ANTHROPIC_BASE_URL,
});

async function testAPI() {
  console.log("Testing OpenRouter API...\n");
  console.log("API Key:", process.env.ANTHROPIC_API_KEY?.substring(0, 20) + "...");
  console.log("Base URL:", process.env.ANTHROPIC_BASE_URL);
  console.log("");

  try {
    const response = await openai.chat.completions.create({
      model: "openai/gpt-4o-mini",
      max_tokens: 50,
      messages: [
        {
          role: "user",
          content: "Say 'Hello, API is working!'",
        },
      ],
    });

    console.log("✅ API Response:");
    console.log(JSON.stringify(response, null, 2));
  } catch (error) {
    console.error("❌ API Error:", error);
  }
}

testAPI();
