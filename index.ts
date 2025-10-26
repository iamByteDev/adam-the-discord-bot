import {
  Client,
  Events,
  GatewayIntentBits,
  EmbedBuilder,
  PermissionFlagsBits,
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
  ],
});

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
});

console.log("🚀 Attempting to login...");
client
  .login(process.env.DISCORD_TOKEN)
  .then(() => console.log("✅ Login successful"))
  .catch((error) => {
    console.error("❌ Login failed:", error);
    process.exit(1);
  });
