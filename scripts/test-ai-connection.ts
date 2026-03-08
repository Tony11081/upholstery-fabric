import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();
dotenv.config({ path: ".env.local" });

const openRouterApiKey = process.env.OPENROUTER_API_KEY ?? "";
if (!openRouterApiKey) {
  console.error("❌ OPENROUTER_API_KEY is not set");
  console.log("\n💡 Please set it in .env.local:");
  console.log("   OPENROUTER_API_KEY=your_key_here\n");
  process.exit(1);
}

const openai = new OpenAI({
  apiKey: openRouterApiKey,
  baseURL: process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
});
const model = process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini";

async function testAIConnection() {
  console.log("🧪 Testing AI Connection...\n");
  console.log(`API Key: ${openRouterApiKey.substring(0, 10)}...`);
  console.log(`Model: ${model}\n`);

  try {
    console.log("📡 Sending test request...");

    const response = await openai.chat.completions.create({
      model,
      max_tokens: 100,
      messages: [
        {
          role: "user",
          content: "Reply with exactly: 'AI connection successful!'",
        },
      ],
    });

    const reply = response.choices[0]?.message?.content?.trim();

    console.log("\n✅ Connection successful!");
    console.log(`Response: ${reply}\n`);

    console.log("📊 API Info:");
    console.log(`   Model: ${response.model}`);
    console.log(`   Tokens used: ${response.usage?.total_tokens || "N/A"}`);

    console.log("\n✅ Your AI setup is ready!");
    console.log("\n🚀 Next steps:");
    console.log("   1. Run: npx tsx scripts/ai-optimize-batch.ts");
    console.log("   2. Or: ./scripts/deploy-ai-optimization.sh\n");

    return true;
  } catch (error: any) {
    console.error("\n❌ Connection failed!");

    if (error.status === 401) {
      console.error("\n🔑 Authentication Error:");
      console.error("   Your API key is invalid or expired");
      console.error("   Please check OPENROUTER_API_KEY in .env.local\n");
    } else if (error.status === 429) {
      console.error("\n⏱️  Rate Limit Error:");
      console.error("   Too many requests. Please wait and try again.\n");
    } else if (error.code === "ENOTFOUND" || error.code === "ECONNREFUSED") {
      console.error("\n🌐 Network Error:");
      console.error("   Cannot connect to OpenRouter API");
      console.error("   Please check your internet connection\n");
    } else {
      console.error("\n❓ Unknown Error:");
      console.error(`   ${error.message}\n`);
    }

    console.log("💡 Troubleshooting:");
    console.log("   1. Verify your API key at https://openrouter.ai/keys");
    console.log("   2. Check your internet connection");
    console.log("   3. Ensure .env.local is in the project root");
    console.log("   4. Try a different model in OPENROUTER_MODEL\n");

    return false;
  }
}

testAIConnection()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
