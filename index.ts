import { Client, Events, GatewayIntentBits } from "discord.js";
import { config } from "dotenv";

config();

console.log("🔍 Checking environment variables...");
console.log("Token exists:", !!process.env.DISCORD_TOKEN);
console.log("Token length:", process.env.DISCORD_TOKEN?.length);

// Create a new Client instance
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// When the client is ready
client.once(Events.ClientReady, (c) => {
  console.log(`✅ Bot is ready! Logged in as ${c.user.tag}`);
});

// Error handling
client.on(Events.Error, (error) => {
  console.error("❌ Client error:", error);
});

process.on("unhandledRejection", (error) => {
  console.error("❌ Unhandled promise rejection:", error);
});

// Handle slash command interactions
client.on(Events.InteractionCreate, async (interaction) => {
  console.log("📩 Interaction received:", interaction.type);

  if (!interaction.isChatInputCommand()) return;

  console.log("🎯 Command received:", interaction.commandName);

  if (interaction.commandName === "robux-before-tax") {
    try {
      const robuxAfterTax = interaction.options.getInteger("amount", true);
      const robuxBeforeTax = Math.round(robuxAfterTax / 0.7);

      await interaction.reply({
        content: `💰 To receive **${robuxAfterTax.toLocaleString()}** Robux after tax, you need to charge **${robuxBeforeTax.toLocaleString()}** Robux.`,
        ephemeral: false,
      });

      console.log("✅ Reply sent successfully");
    } catch (error) {
      console.error("❌ Error handling command:", error);

      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "❌ An error occurred while processing your command.",
          ephemeral: true,
        });
      }
    }
  }
});

// Login to Discord
console.log("🚀 Attempting to login...");
client
  .login(process.env.DISCORD_TOKEN)
  .then(() => console.log("✅ Login successful"))
  .catch((error) => {
    console.error("❌ Login failed:", error);
    process.exit(1);
  });
