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
        type: 4,
        description: "The amount of robux wanted after tax",
        required: true,
        min_value: 1,
      },
    ],
  },
  {
    name: "robux-after-tax",
    description: "Calculate how much robux you will receive after tax.",
    options: [
      {
        name: "amount",
        type: 4,
        description: "The amount of robux before tax",
        required: true,
        min_value: 1,
      },
    ],
  },
  {
    name: "ban",
    description: "Ban a member from the server.",
    options: [
      {
        name: "target",
        type: 6,
        description: "The member to ban",
        required: true,
      },
      {
        name: "duration",
        type: 3,
        description: "Ban duration (e.g., 1d, 7d, 30d, permanent)",
        required: true,
      },
      {
        name: "reason",
        type: 3,
        description: "Reason for the ban",
        required: false,
      },
    ],
  },
  {
    name: "kick",
    description: "Kick a member from the server.",
    options: [
      {
        name: "target",
        type: 6,
        description: "The member to kick",
        required: true,
      },
      {
        name: "reason",
        type: 3,
        description: "Reason for the kick",
        required: false,
      },
    ],
  },
  {
    name: "mute",
    description: "Timeout a member (mute them).",
    options: [
      {
        name: "target",
        type: 6,
        description: "The member to mute",
        required: true,
      },
      {
        name: "duration",
        type: 3,
        description: "Mute duration (e.g., 5m, 1h, 1d)",
        required: true,
      },
      {
        name: "reason",
        type: 3,
        description: "Reason for the mute",
        required: false,
      },
    ],
  },
  {
    name: "set-order-status",
    description: "Create or update an order status message.",
    options: [
      {
        name: "status",
        type: 3,
        description: "Order status",
        required: true,
        choices: [
          { name: "Finding Product", value: "finding_product" },
          { name: "On Hold", value: "on_hold" },
          { name: "Pending Payment", value: "pending_payment" },
          { name: "Transaction in Progress", value: "transaction_in_progress" },
          { name: "Success", value: "success" },
          { name: "Declined", value: "declined" },
        ],
      },
    ],
  },
  {
    name: "remove-status",
    description: "Remove the order status message from this channel.",
  },
];

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN!);

(async () => {
  try {
    console.log(
      `Started refreshing ${commands.length} application (/) commands.`
    );

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
