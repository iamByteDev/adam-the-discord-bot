import { REST, Routes } from "discord.js";
import { config } from "dotenv";

config();

const commands = [
  {
    name: "robux-before-tax",
    description:
      "Calculate how much to charge so the receiver gets X robux after tax.",
    options: [
      {
        name: "amount",
        type: 4, // INTEGER type
        description: "The amount of robux wanted after tax",
        required: true,
        min_value: 1,
      },
    ],
  },
];

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN!);

(async () => {
  try {
    console.log(
      `Started refreshing ${commands.length} application (/) commands.`
    );

    // Deploy to specific guild (instant, for testing)
    const data = (await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID!,
        process.env.GUILD_ID!
      ),
      { body: commands }
    )) as any;

    console.log(
      `Successfully reloaded ${data.length} application (/) commands.`
    );
  } catch (error) {
    console.error("Error deploying commands:", error);
  }
})();
