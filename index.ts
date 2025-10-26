import {
  Client,
  Events,
  GatewayIntentBits,
  EmbedBuilder,
  PermissionFlagsBits,
  TextChannel,
  Message,
  ColorResolvable,
} from "discord.js";
import { config } from "dotenv";

config();

console.log("🔍 Checking environment variables...");
console.log("Token exists:", !!process.env.DISCORD_TOKEN);
console.log("Token length:", process.env.DISCORD_TOKEN?.length);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Store sticky messages data
interface StickyData {
  messageId: string;
  embedData: {
    title: string;
    description: string;
    color: number;
    footer?: string;
    timestamp?: boolean;
  };
  type: "text" | "status";
  isUpdating: boolean;
}

const stickyMessages = new Map<string, StickyData>();

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

// Helper function to parse hex color
function parseHexColor(hex: string): number {
  const cleaned = hex.replace("#", "");
  const parsed = parseInt(cleaned, 16);
  return isNaN(parsed) ? 0x5865f2 : parsed; // Default to Discord blurple if invalid
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

// Helper function to create embed from sticky data
function createEmbedFromData(data: StickyData["embedData"]): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(data.title)
    .setDescription(data.description)
    .setColor(data.color);

  if (data.footer) {
    embed.setFooter({ text: data.footer });
  }

  if (data.timestamp) {
    embed.setTimestamp();
  }

  return embed;
}

// Sticky message handler - repositions message to bottom
client.on(Events.MessageCreate, async (message) => {
  // Ignore bot messages
  if (message.author.bot) return;

  const channelId = message.channel.id;
  const stickyData = stickyMessages.get(channelId);

  if (!stickyData) return;

  // Prevent duplicate updates with lock
  if (stickyData.isUpdating) {
    console.log("⏳ Sticky update already in progress, skipping...");
    return;
  }

  try {
    const channel = message.channel as TextChannel;

    // Set lock to prevent concurrent updates
    stickyData.isUpdating = true;
    stickyMessages.set(channelId, stickyData);

    // Delete the old sticky message
    try {
      const oldMessage = await channel.messages.fetch(stickyData.messageId);
      await oldMessage.delete();
    } catch (error) {
      console.log("Old sticky message not found");
    }

    // Create embed from stored data
    const embed = createEmbedFromData(stickyData.embedData);

    // Send new sticky message at the bottom
    const newMessage = await channel.send({ embeds: [embed] });

    // Update stored data with new message ID and unlock
    stickyMessages.set(channelId, {
      ...stickyData,
      messageId: newMessage.id,
      isUpdating: false,
    });

    console.log("📌 Sticky message repositioned to bottom");
  } catch (error) {
    console.error("Error handling sticky message:", error);
    // Unlock on error
    if (stickyData) {
      stickyData.isUpdating = false;
      stickyMessages.set(channelId, stickyData);
    }
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  console.log("🎯 Command received:", interaction.commandName);

  // ==================== ROBUX COMMANDS ====================

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

  // ==================== MODERATION COMMANDS ====================

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

  // ==================== STICKY COMMANDS ====================

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

      // Check if there's an existing sticky in this channel
      const existingData = stickyMessages.get(channel.id);

      if (existingData) {
        try {
          const existingMessage = await channel.messages.fetch(
            existingData.messageId
          );
          await existingMessage.delete();
          console.log("🗑️ Deleted old sticky message");
        } catch (error) {
          console.log("Old message not found or already deleted");
        }
      }

      // Create embed data
      const embedData = {
        title: `${statusDetails.emoji} Order Status`,
        description: `**Current Status:** ${statusDetails.title}\n\n**Details:** ${statusDetails.description}`,
        color: statusDetails.color,
        footer: `Last updated by ${interaction.user.tag}`,
        timestamp: true,
      };

      // Create and send embed
      const embed = createEmbedFromData(embedData);
      const newMessage = await channel.send({ embeds: [embed] });

      // Store the sticky data
      stickyMessages.set(channel.id, {
        messageId: newMessage.id,
        embedData: embedData,
        type: "status",
        isUpdating: false,
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

  if (interaction.commandName === "stick-message") {
    try {
      const title = interaction.options.getString("title", true);
      const description = interaction.options.getString("description", true);
      const colorHex = interaction.options.getString("color") || "#5865F2"; // Discord blurple default
      const channel = interaction.channel as TextChannel;

      if (!channel) {
        return await interaction.reply({
          content: "❌ Could not access this channel.",
          ephemeral: true,
        });
      }

      // Check if there's already a sticky in this channel
      const existingData = stickyMessages.get(channel.id);

      if (existingData) {
        return await interaction.reply({
          content:
            "❌ This channel already has a sticky message. Use `/remove-sticky` first.",
          ephemeral: true,
        });
      }

      // Parse color
      const color = parseHexColor(colorHex);

      // Create embed data (Discord will automatically render markdown formatters)
      const embedData = {
        title: title,
        description: description,
        color: color,
      };

      // Create and send embed
      const embed = createEmbedFromData(embedData);
      const newMessage = await channel.send({ embeds: [embed] });

      // Store the sticky data
      stickyMessages.set(channel.id, {
        messageId: newMessage.id,
        embedData: embedData,
        type: "text",
        isUpdating: false,
      });

      await interaction.reply({
        content:
          "✅ Message stickied! It will stay at the bottom. Use Discord markdown: **bold** *italic* __underline__ ~~strikethrough~~",
        ephemeral: true,
      });
      console.log("📌 Sticky text message created");
    } catch (error) {
      console.error("Error:", error);
      await interaction.reply({
        content: "❌ Failed to stick message.",
        ephemeral: true,
      });
    }
  }

  if (interaction.commandName === "remove-sticky") {
    try {
      const channel = interaction.channel as TextChannel;

      if (!channel) {
        return await interaction.reply({
          content: "❌ Could not access this channel.",
          ephemeral: true,
        });
      }

      const stickyData = stickyMessages.get(channel.id);

      if (!stickyData) {
        return await interaction.reply({
          content: "❌ No sticky message found in this channel.",
          ephemeral: true,
        });
      }

      try {
        const message = await channel.messages.fetch(stickyData.messageId);
        await message.delete();
        stickyMessages.delete(channel.id);

        await interaction.reply({
          content: "✅ Sticky message removed!",
          ephemeral: true,
        });
        console.log("✅ Sticky message removed");
      } catch (error) {
        stickyMessages.delete(channel.id);
        await interaction.reply({
          content: "✅ Sticky cleared (message was already deleted).",
          ephemeral: true,
        });
      }
    } catch (error) {
      console.error("Error:", error);
      await interaction.reply({
        content: "❌ Failed to remove sticky message.",
        ephemeral: true,
      });
    }
  }

  if (interaction.commandName === "remove-status") {
    try {
      const channel = interaction.channel as TextChannel;

      if (!channel) {
        return await interaction.reply({
          content: "❌ Could not access this channel.",
          ephemeral: true,
        });
      }

      const stickyData = stickyMessages.get(channel.id);

      if (!stickyData) {
        return await interaction.reply({
          content: "❌ No order status found in this channel.",
          ephemeral: true,
        });
      }

      if (stickyData.type !== "status") {
        return await interaction.reply({
          content:
            "❌ This channel has a text sticky, not an order status. Use `/remove-sticky` instead.",
          ephemeral: true,
        });
      }

      try {
        const message = await channel.messages.fetch(stickyData.messageId);
        await message.delete();
        stickyMessages.delete(channel.id);

        await interaction.reply({
          content: "✅ Order status removed!",
          ephemeral: true,
        });
        console.log("✅ Order status removed");
      } catch (error) {
        stickyMessages.delete(channel.id);
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
