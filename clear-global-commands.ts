import { REST, Routes } from "discord.js";
import { config } from "dotenv";

config();

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN!);

(async () => {
  try {
    console.log("Started clearing global application (/) commands.");

    // Clear all global commands
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID!),
      { body: [] } // Empty array removes all commands
    );

    console.log("✅ Successfully cleared all global commands.");
    console.log(
      "⚠️ Note: It may take up to 1 hour for them to disappear from Discord."
    );
  } catch (error) {
    console.error("Error clearing commands:", error);
  }
})();
