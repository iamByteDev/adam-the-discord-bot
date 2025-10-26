import {
  Client,
  Events,
  GatewayIntentBits,
  EmbedBuilder,
  PermissionFlagsBits,
  TextChannel,
  Message,
} from "discord.js";
import { config } from "dotenv";

config();

console.log("🔍 Checking environment variables...");
console.log("Token exists:", !!process.env.DISCORD_TOKEN);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildMessages, // Required for sticky messages
    GatewayIntentBits.MessageContent, // Required for sticky messages
  ],
});

// Store order status messages: { channelId: { messageId, embed, lastMessageCount } }
const orderStatusMessages = new Map<
  string,
  { messageId: string; embed: EmbedBuilder; lastMessageCount: number }
>();

client.once(Events.ClientReady, (c) => {
  console.log(`✅ Bot is ready! Logged in as ${c.user.tag}`);
});

client.on(Events.Error, (error) => {
  console.error("❌ Client error:", error);
});

process.on("unhandledRejection", (error) => {
  console.error("❌ Unhandled promise rejection:", error);
});

// Helper function to parse duration
function parseDuration(duration: string): number | null {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) return null;

  const value = parseInt(match[1]);
  const unit = match[2];

  switch (unit) {
    case "s":
      return value * 1000;
    case "m":
      return value * 60 * 1000;
    case "h":
      return value * 60 * 60 * 1000;
    case "d":
      return value * 24 * 60 * 60 * 1000;
    default:
      return null;
  }
}

// Helper function to get status details
function getStatusDetails(status: string): {
  color: number;
  emoji: string;
  title: string;
  description: string;
} {
  switch (status) {
    case "finding_product":
      return {
        color: 0x3498db,
        emoji: "🔍",
        title: "Finding Product",
        description: "We are trying to find the requested item",
      };
    case "on_hold":
      return {
        color: 0xf39c12,
        emoji: "⏸️",
        title: "On Hold",
        description: "Your order has been put on hold.",
      };
    case "pending_payment":
      return {
        color: 0xe67e22,
        emoji: "💳",
        title: "Pending Payment",
        description: "Waiting for client to pay.",
      };
    case "transaction_in_progress":
      return {
        color: 0x9b59b6,
        emoji: "⚙️",
        title: "Transaction in Progress",
        description:
          "We received your payment and is waiting for client to be online.",
      };
    case "success":
      return {
        color: 0x2ecc71,
        emoji: "✅",
        title: "Success",
        description: "Thanks for shopping at VaultX",
      };
    case "declined":
      return {
        color: 0xe74c3c,
        emoji: "❌",
        title: "Declined",
        description: "Sorry we can't grant the requested item",
      };
    default:
      return {
        color: 0x95a5a6,
        emoji: "📦",
        title: "Unknown Status",
        description: "Status information unavailable",
      };
  }
}

// Sticky message handler
client.on(Events.MessageCreate, async (message) => {
  // Ignore bot messages
  if (message.author.bot) return;

  const channelId = message.channel.id;
  const stickyData = orderStatusMessages.get(channelId);

  if (!stickyData) return;

  try {
    const channel = message.channel as TextChannel;

    // Count messages since last sticky (to avoid re-posting too frequently)
    stickyData.lastMessageCount++;

    // Only re-post after 3 messages to reduce spam
    if (stickyData.lastMessageCount < 1) return;

    // Delete the old sticky message
    try {
      const oldMessage = await channel.messages.fetch(stickyData.messageId);
      await oldMessage.delete();
    } catch (error) {
      console.log("Old sticky message not found");
    }

    // Send new sticky message at the bottom
    const newMessage = await channel.send({ embeds: [stickyData.embed] });

    // Update stored data
    orderStatusMessages.set(channelId, {
      messageId: newMessage.id,
      embed: stickyData.embed,
      lastMessageCount: 0,
    });

    console.log("📌 Sticky message repositioned to bottom");
  } catch (error) {
    console.error("Error handling sticky message:", error);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  console.log("🎯 Command received:", interaction.commandName);

  // Robux commands
  if (interaction.commandName === "robux-before-tax") {
    try {
      const robuxAfterTax = interaction.options.getInteger("amount", true);
      const robuxBeforeTax = Math.round(robuxAfterTax / 0.7);

      await interaction.reply({
        content: `💰 To receive **${robuxAfterTax.toLocaleString()}** Robux after tax, you need to charge **${robuxBeforeTax.toLocaleString()}** Robux.`,
      });
    } catch (error) {
      console.error("Error:", error);
      await interaction.reply({
        content: "❌ An error occurred.",
        ephemeral: true,
      });
    }
  }

  if (interaction.commandName === "robux-after-tax") {
    try {
      const robuxBeforeTax = interaction.options.getInteger("amount", true);
      const robuxAfterTax = Math.round(robuxBeforeTax * 0.7);

      await interaction.reply({
        content: `💵 If you charge **${robuxBeforeTax.toLocaleString()}** Robux, you will receive **${robuxAfterTax.toLocaleString()}** Robux after tax.`,
      });
    } catch (error) {
      console.error("Error:", error);
      await interaction.reply({
        content: "❌ An error occurred.",
        ephemeral: true,
      });
    }
  }

  // Ban command
  if (interaction.commandName === "ban") {
    try {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.BanMembers)) {
        return await interaction.reply({
          content: "❌ You do not have permission to ban members.",
          ephemeral: true,
        });
      }

      const target = interaction.options.getUser("target", true);
      const member = interaction.guild?.members.cache.get(target.id);
      const duration = interaction.options.getString("duration", true);
      const reason =
        interaction.options.getString("reason") || "No reason provided";

      if (!member) {
        return await interaction.reply({
          content: "❌ Member not found.",
          ephemeral: true,
        });
      }

      if (!member.bannable) {
        return await interaction.reply({
          content:
            "❌ I cannot ban this member. They may have a higher role than me.",
          ephemeral: true,
        });
      }

      await member.ban({
        reason: `${reason} | Banned by ${interaction.user.tag}`,
      });

      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle("🔨 Member Banned")
        .setThumbnail(target.displayAvatarURL())
        .addFields(
          {
            name: "👤 Target",
            value: `${target.tag} (${target.id})`,
            inline: true,
          },
          { name: "⏰ Duration", value: duration, inline: true },
          { name: "👮 Moderator", value: `${interaction.user}`, inline: true },
          { name: "📝 Reason", value: reason, inline: false }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
      console.log("✅ Ban executed successfully");
    } catch (error) {
      console.error("Error:", error);
      await interaction.reply({
        content: "❌ Failed to ban member.",
        ephemeral: true,
      });
    }
  }

  // Kick command
  if (interaction.commandName === "kick") {
    try {
      if (
        !interaction.memberPermissions?.has(PermissionFlagsBits.KickMembers)
      ) {
        return await interaction.reply({
          content: "❌ You do not have permission to kick members.",
          ephemeral: true,
        });
      }

      const target = interaction.options.getUser("target", true);
      const member = interaction.guild?.members.cache.get(target.id);
      const reason =
        interaction.options.getString("reason") || "No reason provided";

      if (!member) {
        return await interaction.reply({
          content: "❌ Member not found.",
          ephemeral: true,
        });
      }

      if (!member.kickable) {
        return await interaction.reply({
          content:
            "❌ I cannot kick this member. They may have a higher role than me.",
          ephemeral: true,
        });
      }

      await member.kick(`${reason} | Kicked by ${interaction.user.tag}`);

      const embed = new EmbedBuilder()
        .setColor(0xffa500)
        .setTitle("👢 Member Kicked")
        .setThumbnail(target.displayAvatarURL())
        .addFields(
          {
            name: "👤 Target",
            value: `${target.tag} (${target.id})`,
            inline: true,
          },
          { name: "👮 Moderator", value: `${interaction.user}`, inline: true },
          { name: "📝 Reason", value: reason, inline: false }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
      console.log("✅ Kick executed successfully");
    } catch (error) {
      console.error("Error:", error);
      await interaction.reply({
        content: "❌ Failed to kick member.",
        ephemeral: true,
      });
    }
  }

  // Mute command
  if (interaction.commandName === "mute") {
    try {
      if (
        !interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)
      ) {
        return await interaction.reply({
          content: "❌ You do not have permission to timeout members.",
          ephemeral: true,
        });
      }

      const target = interaction.options.getUser("target", true);
      const member = interaction.guild?.members.cache.get(target.id);
      const durationStr = interaction.options.getString("duration", true);
      const reason =
        interaction.options.getString("reason") || "No reason provided";

      if (!member) {
        return await interaction.reply({
          content: "❌ Member not found.",
          ephemeral: true,
        });
      }

      const durationMs = parseDuration(durationStr);
      if (!durationMs) {
        return await interaction.reply({
          content: "❌ Invalid duration format. Use: 5m, 1h, 1d, etc.",
          ephemeral: true,
        });
      }

      if (durationMs > 28 * 24 * 60 * 60 * 1000) {
        return await interaction.reply({
          content: "❌ Duration cannot exceed 28 days.",
          ephemeral: true,
        });
      }

      if (!member.moderatable) {
        return await interaction.reply({
          content:
            "❌ I cannot timeout this member. They may have a higher role than me.",
          ephemeral: true,
        });
      }

      await member.timeout(
        durationMs,
        `${reason} | Muted by ${interaction.user.tag}`
      );

      const embed = new EmbedBuilder()
        .setColor(0xffff00)
        .setTitle("🔇 Member Muted")
        .setThumbnail(target.displayAvatarURL())
        .addFields(
          {
            name: "👤 Target",
            value: `${target.tag} (${target.id})`,
            inline: true,
          },
          { name: "⏰ Duration", value: durationStr, inline: true },
          { name: "👮 Moderator", value: `${interaction.user}`, inline: true },
          { name: "📝 Reason", value: reason, inline: false }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
      console.log("✅ Mute executed successfully");
    } catch (error) {
      console.error("Error:", error);
      await interaction.reply({
        content: "❌ Failed to mute member.",
        ephemeral: true,
      });
    }
  }

  // Set Order Status command
  if (interaction.commandName === "set-order-status") {
    try {
      const status = interaction.options.getString("status", true);
      const statusDetails = getStatusDetails(status);
      const channel = interaction.channel as TextChannel;

      if (!channel) {
        return await interaction.reply({
          content: "❌ Could not access this channel.",
          ephemeral: true,
        });
      }

      const embed = new EmbedBuilder()
        .setColor(statusDetails.color)
        .setTitle(`${statusDetails.emoji} Order Status`)
        .addFields(
          { name: "Current Status", value: statusDetails.title, inline: false },
          { name: "Details", value: statusDetails.description, inline: false }
        )
        .setFooter({ text: `Last updated by ${interaction.user.tag}` })
        .setTimestamp();

      // Check if there's an existing status message in this channel
      const existingData = orderStatusMessages.get(channel.id);

      if (existingData) {
        try {
          // Delete the old message
          const existingMessage = await channel.messages.fetch(
            existingData.messageId
          );
          await existingMessage.delete();
          console.log("🗑️ Deleted old status message");
        } catch (error) {
          console.log("Old message not found or already deleted");
        }
      }

      // Create new sticky message
      const newMessage = await channel.send({ embeds: [embed] });

      // Store the sticky data
      orderStatusMessages.set(channel.id, {
        messageId: newMessage.id,
        embed: embed,
        lastMessageCount: 0,
      });

      await interaction.reply({
        content: "✅ Order status set! This message will stay at the bottom.",
        ephemeral: true,
      });
      console.log("📌 Sticky order status created");
    } catch (error) {
      console.error("Error:", error);
      await interaction.reply({
        content: "❌ Failed to set order status.",
        ephemeral: true,
      });
    }
  }

  // Remove Status command
  if (interaction.commandName === "remove-status") {
    try {
      const channel = interaction.channel as TextChannel;

      if (!channel) {
        return await interaction.reply({
          content: "❌ Could not access this channel.",
          ephemeral: true,
        });
      }

      const stickyData = orderStatusMessages.get(channel.id);

      if (!stickyData) {
        return await interaction.reply({
          content: "❌ No order status message found in this channel.",
          ephemeral: true,
        });
      }

      try {
        const message = await channel.messages.fetch(stickyData.messageId);
        await message.delete();
        orderStatusMessages.delete(channel.id);

        await interaction.reply({
          content: "✅ Order status removed!",
          ephemeral: true,
        });
        console.log("✅ Sticky order status removed");
      } catch (error) {
        orderStatusMessages.delete(channel.id);
        await interaction.reply({
          content: "✅ Order status cleared (message was already deleted).",
          ephemeral: true,
        });
      }
    } catch (error) {
      console.error("Error:", error);
      await interaction.reply({
        content: "❌ Failed to remove order status.",
        ephemeral: true,
      });
    }
  }
});

console.log("🚀 Attempting to login...");
client
  .login(process.env.DISCORD_TOKEN)
  .then(() => console.log("✅ Login successful"))
  .catch((error) => {
    console.error("❌ Login failed:", error);
    process.exit(1);
  });
