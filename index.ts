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
import * as fs from "fs";
import * as path from "path";

config();

console.log("🔍 Checking environment variables...");
console.log("Token exists:", !!process.env.DISCORD_TOKEN);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// ==================== INTERFACES ====================

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

interface TempBan {
  userId: string;
  guildId: string;
  unbanTime: number;
  reason: string;
}

interface Vouch {
  voucherId: string;
  voucherTag: string;
  targetId: string;
  rating: number;
  comment: string;
  timestamp: number;
}

// ==================== DATA STORAGE ====================

const stickyMessages = new Map<string, StickyData>();
const tempBans: TempBan[] = [];
const vouches = new Map<string, Vouch[]>();

// File paths
const DATA_DIR = path.join(__dirname, "..", "data");
const VOUCHES_FILE = path.join(DATA_DIR, "vouches.json");

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  console.log("📁 Created data directory");
}

// ==================== VOUCHES FILE OPERATIONS ====================

function loadVouches() {
  try {
    if (fs.existsSync(VOUCHES_FILE)) {
      const data = fs.readFileSync(VOUCHES_FILE, "utf-8");
      const parsed = JSON.parse(data);

      Object.entries(parsed).forEach(([userId, userVouches]) => {
        vouches.set(userId, userVouches as Vouch[]);
      });

      console.log(`✅ Loaded ${vouches.size} users with vouches`);
    } else {
      console.log("📝 No existing vouches file found, starting fresh");
    }
  } catch (error) {
    console.error("❌ Failed to load vouches:", error);
  }
}

function saveVouches() {
  try {
    const obj: any = {};
    vouches.forEach((value, key) => {
      obj[key] = value;
    });

    fs.writeFileSync(VOUCHES_FILE, JSON.stringify(obj, null, 2));
    console.log("💾 Vouches saved to file");
  } catch (error) {
    console.error("❌ Failed to save vouches:", error);
  }
}

// ==================== CLIENT EVENTS ====================

client.once(Events.ClientReady, (c) => {
  console.log(`✅ Bot is ready! Logged in as ${c.user.tag}`);
  loadVouches();
  setInterval(checkExpiredBans, 60000);
});

client.on(Events.Error, (error) => {
  console.error("❌ Client error:", error);
});

process.on("unhandledRejection", (error) => {
  console.error("❌ Unhandled promise rejection:", error);
});

// ==================== HELPER FUNCTIONS ====================

async function checkExpiredBans() {
  const now = Date.now();
  const expiredBans = tempBans.filter((ban) => ban.unbanTime <= now);

  for (const ban of expiredBans) {
    try {
      const guild = client.guilds.cache.get(ban.guildId);
      if (guild) {
        await guild.members.unban(ban.userId, "Temporary ban expired");
        console.log(`⏰ Auto-unbanned user ${ban.userId}`);
      }
      const index = tempBans.indexOf(ban);
      if (index > -1) tempBans.splice(index, 1);
    } catch (error) {
      console.error(`Failed to auto-unban ${ban.userId}:`, error);
    }
  }
}

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

function parseHexColor(hex: string): number {
  const cleaned = hex.replace("#", "");
  const parsed = parseInt(cleaned, 16);
  return isNaN(parsed) ? 0x5865f2 : parsed;
}

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

function createEmbedFromData(data: StickyData["embedData"]): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(data.title)
    .setDescription(data.description)
    .setColor(data.color);

  if (data.footer) embed.setFooter({ text: data.footer });
  if (data.timestamp) embed.setTimestamp();

  return embed;
}

function getAverageRating(userVouches: Vouch[]): number {
  if (userVouches.length === 0) return 0;
  const sum = userVouches.reduce((acc, v) => acc + v.rating, 0);
  return sum / userVouches.length;
}

function formatStars(rating: number): string {
  const fullStars = Math.floor(rating);
  const halfStar = rating % 1 >= 0.5 ? 1 : 0;
  const emptyStars = 5 - fullStars - halfStar;

  return (
    "⭐".repeat(fullStars) +
    (halfStar ? "✨" : "") +
    "☆".repeat(emptyStars) +
    ` (${rating.toFixed(1)}/5.0)`
  );
}

// ==================== STICKY MESSAGE HANDLER ====================

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;

  const channelId = message.channel.id;
  const stickyData = stickyMessages.get(channelId);

  if (!stickyData || stickyData.isUpdating) return;

  try {
    const channel = message.channel as TextChannel;

    stickyData.isUpdating = true;
    stickyMessages.set(channelId, stickyData);

    try {
      const oldMessage = await channel.messages.fetch(stickyData.messageId);
      await oldMessage.delete();
    } catch (error) {
      console.log("Old sticky message not found");
    }

    const embed = createEmbedFromData(stickyData.embedData);
    const newMessage = await channel.send({ embeds: [embed] });

    stickyMessages.set(channelId, {
      ...stickyData,
      messageId: newMessage.id,
      isUpdating: false,
    });

    console.log("📌 Sticky message repositioned");
  } catch (error) {
    console.error("Error handling sticky:", error);
    if (stickyData) {
      stickyData.isUpdating = false;
      stickyMessages.set(channelId, stickyData);
    }
  }
});

// ==================== COMMAND HANDLERS ====================

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  console.log("🎯 Command received:", interaction.commandName);

  // ==================== ROBUX COMMANDS ====================

  if (interaction.commandName === "robux-before-tax") {
    const robuxAfterTax = interaction.options.getInteger("amount", true);
    const robuxBeforeTax = Math.round(robuxAfterTax / 0.7);
    await interaction.reply({
      content: `💰 To receive **${robuxAfterTax.toLocaleString()}** Robux after tax, you need to charge **${robuxBeforeTax.toLocaleString()}** Robux.`,
    });
  }

  if (interaction.commandName === "robux-after-tax") {
    const robuxBeforeTax = interaction.options.getInteger("amount", true);
    const robuxAfterTax = Math.round(robuxBeforeTax * 0.7);
    await interaction.reply({
      content: `💵 If you charge **${robuxBeforeTax.toLocaleString()}** Robux, you will receive **${robuxAfterTax.toLocaleString()}** Robux after tax.`,
    });
  }

  // ==================== MODERATION COMMANDS ====================

  if (interaction.commandName === "ban") {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.BanMembers)) {
      return await interaction.reply({
        content: "❌ No permission to ban.",
        ephemeral: true,
      });
    }

    const target = interaction.options.getUser("target", true);
    const member = interaction.guild?.members.cache.get(target.id);
    const durationStr = interaction.options.getString("duration", true);
    const reason =
      interaction.options.getString("reason") || "No reason provided";

    if (!member?.bannable) {
      return await interaction.reply({
        content: "❌ Cannot ban this member.",
        ephemeral: true,
      });
    }

    await member.ban({ reason: `${reason} | By ${interaction.user.tag}` });

    let banType = "Permanent";
    if (
      durationStr.toLowerCase() !== "permanent" &&
      durationStr.toLowerCase() !== "perm"
    ) {
      const durationMs = parseDuration(durationStr);
      if (durationMs) {
        tempBans.push({
          userId: target.id,
          guildId: interaction.guild!.id,
          unbanTime: Date.now() + durationMs,
          reason: reason,
        });
        banType = `Temporary (${durationStr})`;
      }
    }

    const embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle("🔨 Member Banned")
      .setThumbnail(target.displayAvatarURL())
      .addFields(
        { name: "👤 Target", value: `${target.tag}`, inline: true },
        { name: "⏰ Duration", value: banType, inline: true },
        { name: "👮 Moderator", value: `${interaction.user}`, inline: true },
        { name: "📝 Reason", value: reason }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  if (interaction.commandName === "unban") {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.BanMembers)) {
      return await interaction.reply({
        content: "❌ No permission to unban.",
        ephemeral: true,
      });
    }

    const userId = interaction.options.getString("user-id", true);
    const reason =
      interaction.options.getString("reason") || "No reason provided";

    if (!/^\d{17,19}$/.test(userId)) {
      return await interaction.reply({
        content: "❌ Invalid user ID.",
        ephemeral: true,
      });
    }

    try {
      await interaction.guild?.members.unban(
        userId,
        `${reason} | By ${interaction.user.tag}`
      );

      const tempBanIndex = tempBans.findIndex((b) => b.userId === userId);
      if (tempBanIndex > -1) tempBans.splice(tempBanIndex, 1);

      const embed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle("✅ User Unbanned")
        .addFields(
          { name: "👤 User ID", value: userId, inline: true },
          { name: "👮 Moderator", value: `${interaction.user}`, inline: true },
          { name: "📝 Reason", value: reason }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch {
      await interaction.reply({
        content: "❌ Failed to unban.",
        ephemeral: true,
      });
    }
  }

  if (interaction.commandName === "kick") {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.KickMembers)) {
      return await interaction.reply({
        content: "❌ No permission to kick.",
        ephemeral: true,
      });
    }

    const target = interaction.options.getUser("target", true);
    const member = interaction.guild?.members.cache.get(target.id);
    const reason =
      interaction.options.getString("reason") || "No reason provided";

    if (!member?.kickable) {
      return await interaction.reply({
        content: "❌ Cannot kick this member.",
        ephemeral: true,
      });
    }

    await member.kick(`${reason} | By ${interaction.user.tag}`);

    const embed = new EmbedBuilder()
      .setColor(0xffa500)
      .setTitle("👢 Member Kicked")
      .setThumbnail(target.displayAvatarURL())
      .addFields(
        { name: "👤 Target", value: `${target.tag}`, inline: true },
        { name: "👮 Moderator", value: `${interaction.user}`, inline: true },
        { name: "📝 Reason", value: reason }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  if (interaction.commandName === "mute") {
    if (
      !interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)
    ) {
      return await interaction.reply({
        content: "❌ No permission to mute.",
        ephemeral: true,
      });
    }

    const target = interaction.options.getUser("target", true);
    const member = interaction.guild?.members.cache.get(target.id);
    const durationStr = interaction.options.getString("duration", true);
    const reason =
      interaction.options.getString("reason") || "No reason provided";

    const durationMs = parseDuration(durationStr);
    if (!durationMs || durationMs > 28 * 24 * 60 * 60 * 1000) {
      return await interaction.reply({
        content: "❌ Invalid duration (max 28d).",
        ephemeral: true,
      });
    }

    if (!member?.moderatable) {
      return await interaction.reply({
        content: "❌ Cannot mute this member.",
        ephemeral: true,
      });
    }

    await member.timeout(durationMs, `${reason} | By ${interaction.user.tag}`);

    const embed = new EmbedBuilder()
      .setColor(0xffff00)
      .setTitle("🔇 Member Muted")
      .setThumbnail(target.displayAvatarURL())
      .addFields(
        { name: "👤 Target", value: `${target.tag}`, inline: true },
        { name: "⏰ Duration", value: durationStr, inline: true },
        { name: "👮 Moderator", value: `${interaction.user}`, inline: true },
        { name: "📝 Reason", value: reason }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  if (interaction.commandName === "unmute") {
    if (
      !interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)
    ) {
      return await interaction.reply({
        content: "❌ No permission to unmute.",
        ephemeral: true,
      });
    }

    const target = interaction.options.getUser("target", true);
    const member = interaction.guild?.members.cache.get(target.id);
    const reason =
      interaction.options.getString("reason") || "No reason provided";

    if (!member?.isCommunicationDisabled()) {
      return await interaction.reply({
        content: "❌ Member is not muted.",
        ephemeral: true,
      });
    }

    await member.timeout(null, `${reason} | By ${interaction.user.tag}`);

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle("🔊 Member Unmuted")
      .setThumbnail(target.displayAvatarURL())
      .addFields(
        { name: "👤 Target", value: `${target.tag}`, inline: true },
        { name: "👮 Moderator", value: `${interaction.user}`, inline: true },
        { name: "📝 Reason", value: reason }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  // ==================== STICKY COMMANDS ====================

  if (interaction.commandName === "set-order-status") {
    const status = interaction.options.getString("status", true);
    const statusDetails = getStatusDetails(status);
    const channel = interaction.channel as TextChannel;

    const existingData = stickyMessages.get(channel.id);
    if (existingData) {
      try {
        const existingMessage = await channel.messages.fetch(
          existingData.messageId
        );
        await existingMessage.delete();
      } catch {}
    }

    const embedData = {
      title: `${statusDetails.emoji} Order Status`,
      description: `**Current Status:** ${statusDetails.title}\n\n**Details:** ${statusDetails.description}`,
      color: statusDetails.color,
      footer: `Last updated by ${interaction.user.tag}`,
      timestamp: true,
    };

    const embed = createEmbedFromData(embedData);
    const newMessage = await channel.send({ embeds: [embed] });

    stickyMessages.set(channel.id, {
      messageId: newMessage.id,
      embedData: embedData,
      type: "status",
      isUpdating: false,
    });

    await interaction.reply({
      content: "✅ Order status set!",
      ephemeral: true,
    });
  }

  if (interaction.commandName === "stick-message") {
    const title = interaction.options.getString("title", true);
    const description = interaction.options.getString("description", true);
    const colorHex = interaction.options.getString("color") || "#5865F2";
    const channel = interaction.channel as TextChannel;

    if (stickyMessages.has(channel.id)) {
      return await interaction.reply({
        content: "❌ Channel already has a sticky. Use `/remove-sticky` first.",
        ephemeral: true,
      });
    }

    const embedData = {
      title: title,
      description: description,
      color: parseHexColor(colorHex),
    };

    const embed = createEmbedFromData(embedData);
    const newMessage = await channel.send({ embeds: [embed] });

    stickyMessages.set(channel.id, {
      messageId: newMessage.id,
      embedData: embedData,
      type: "text",
      isUpdating: false,
    });

    await interaction.reply({
      content: "✅ Message stickied!",
      ephemeral: true,
    });
  }

  if (interaction.commandName === "remove-sticky") {
    const channel = interaction.channel as TextChannel;
    const stickyData = stickyMessages.get(channel.id);

    if (!stickyData) {
      return await interaction.reply({
        content: "❌ No sticky message found.",
        ephemeral: true,
      });
    }

    try {
      const message = await channel.messages.fetch(stickyData.messageId);
      await message.delete();
    } catch {}

    stickyMessages.delete(channel.id);
    await interaction.reply({ content: "✅ Sticky removed!", ephemeral: true });
  }

  if (interaction.commandName === "remove-status") {
    const channel = interaction.channel as TextChannel;
    const stickyData = stickyMessages.get(channel.id);

    if (!stickyData || stickyData.type !== "status") {
      return await interaction.reply({
        content: "❌ No order status found.",
        ephemeral: true,
      });
    }

    try {
      const message = await channel.messages.fetch(stickyData.messageId);
      await message.delete();
    } catch {}

    stickyMessages.delete(channel.id);
    await interaction.reply({ content: "✅ Status removed!", ephemeral: true });
  }

  // ==================== VOUCH COMMANDS ====================

  if (interaction.commandName === "vouch") {
    try {
      const target = interaction.options.getUser("user", true);
      const rating = interaction.options.getInteger("rating", true);
      const comment = interaction.options.getString("comment", true);

      // Prevent self-vouching
      if (target.id === interaction.user.id) {
        return await interaction.reply({
          content: "❌ You cannot vouch for yourself!",
          ephemeral: true,
        });
      }

      // Prevent vouching for bots
      if (target.bot) {
        return await interaction.reply({
          content: "❌ You cannot vouch for bots!",
          ephemeral: true,
        });
      }

      // Get existing vouches for the target
      let userVouches = vouches.get(target.id) || [];

      // Check if voucher already vouched for this user
      const existingVouchIndex = userVouches.findIndex(
        (v) => v.voucherId === interaction.user.id
      );

      const isUpdate = existingVouchIndex !== -1;

      if (existingVouchIndex !== -1) {
        // Update existing vouch
        userVouches[existingVouchIndex] = {
          voucherId: interaction.user.id,
          voucherTag: interaction.user.tag,
          targetId: target.id,
          rating: rating,
          comment: comment,
          timestamp: Date.now(),
        };
      } else {
        // Add new vouch
        userVouches.push({
          voucherId: interaction.user.id,
          voucherTag: interaction.user.tag,
          targetId: target.id,
          rating: rating,
          comment: comment,
          timestamp: Date.now(),
        });
      }

      vouches.set(target.id, userVouches);
      saveVouches();

      const avgRating = getAverageRating(userVouches);

      const embed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle(isUpdate ? "✏️ Vouch Updated" : "✅ Vouch Added")
        .setDescription(`Successfully vouched for ${target}!`)
        .setThumbnail(target.displayAvatarURL())
        .addFields(
          { name: "Rating", value: "⭐".repeat(rating), inline: true },
          {
            name: "Total Vouches",
            value: `${userVouches.length}`,
            inline: true,
          },
          {
            name: "Average Rating",
            value: formatStars(avgRating),
            inline: false,
          },
          { name: "Comment", value: comment }
        )
        .setFooter({ text: `Vouched by ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
      console.log(
        `✅ Vouch ${isUpdate ? "updated" : "added"}: ${
          interaction.user.tag
        } → ${target.tag}`
      );
    } catch (error) {
      console.error("Error:", error);
      await interaction.reply({
        content: "❌ Failed to add vouch.",
        ephemeral: true,
      });
    }
  }

  if (interaction.commandName === "vouches") {
    try {
      const target = interaction.options.getUser("user") || interaction.user;
      const userVouches = vouches.get(target.id) || [];

      if (userVouches.length === 0) {
        const embed = new EmbedBuilder()
          .setColor(0x95a5a6)
          .setTitle("📋 No Vouches")
          .setDescription(`${target} has no vouches yet.`)
          .setThumbnail(target.displayAvatarURL());

        return await interaction.reply({ embeds: [embed] });
      }

      const avgRating = getAverageRating(userVouches);

      // Calculate rating distribution
      const ratingCounts = [0, 0, 0, 0, 0];
      userVouches.forEach((v) => ratingCounts[v.rating - 1]++);

      // Sort vouches by timestamp (newest first)
      const sortedVouches = [...userVouches].sort(
        (a, b) => b.timestamp - a.timestamp
      );

      // Create embed
      const embed = new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle(`📋 Vouches for ${target.tag}`)
        .setThumbnail(target.displayAvatarURL())
        .setDescription(
          `**Total Vouches:** ${userVouches.length}\n` +
            `**Average Rating:** ${formatStars(avgRating)}\n\n` +
            `**Rating Distribution:**\n` +
            `⭐⭐⭐⭐⭐ (${ratingCounts[4]})\n` +
            `⭐⭐⭐⭐ (${ratingCounts[3]})\n` +
            `⭐⭐⭐ (${ratingCounts[2]})\n` +
            `⭐⭐ (${ratingCounts[1]})\n` +
            `⭐ (${ratingCounts[0]})`
        )
        .setTimestamp();

      // Add up to 5 most recent vouches
      const displayVouches = sortedVouches.slice(0, 5);

      for (const vouch of displayVouches) {
        const timestamp = Math.floor(vouch.timestamp / 1000);
        const stars = "⭐".repeat(vouch.rating);

        embed.addFields({
          name: `${stars} - ${vouch.voucherTag}`,
          value: `${vouch.comment}\n*<t:${timestamp}:R>*`,
          inline: false,
        });
      }

      if (userVouches.length > 5) {
        embed.setFooter({ text: `Showing 5 of ${userVouches.length} vouches` });
      }

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error("Error:", error);
      await interaction.reply({
        content: "❌ Failed to fetch vouches.",
        ephemeral: true,
      });
    }
  }

  if (interaction.commandName === "remove-vouch") {
    try {
      const target = interaction.options.getUser("user", true);
      const userVouches = vouches.get(target.id) || [];

      const vouchIndex = userVouches.findIndex(
        (v) => v.voucherId === interaction.user.id
      );

      if (vouchIndex === -1) {
        return await interaction.reply({
          content: `❌ You haven't vouched for ${target.tag}.`,
          ephemeral: true,
        });
      }

      // Remove the vouch
      userVouches.splice(vouchIndex, 1);

      if (userVouches.length === 0) {
        vouches.delete(target.id);
      } else {
        vouches.set(target.id, userVouches);
      }

      saveVouches();

      const embed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle("🗑️ Vouch Removed")
        .setDescription(`Successfully removed your vouch for ${target}.`)
        .setThumbnail(target.displayAvatarURL())
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
      console.log(`✅ Vouch removed: ${interaction.user.tag} → ${target.tag}`);
    } catch (error) {
      console.error("Error:", error);
      await interaction.reply({
        content: "❌ Failed to remove vouch.",
        ephemeral: true,
      });
    }
  }
});

// ==================== LOGIN ====================

client
  .login(process.env.DISCORD_TOKEN)
  .then(() => console.log("✅ Login successful"))
  .catch((error) => {
    console.error("❌ Login failed:", error);
    process.exit(1);
  });
