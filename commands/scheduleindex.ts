import { SlashCommandBuilder } from '@discordjs/builders';
import { CommandInteraction, EmbedBuilder } from 'discord.js';
import { readFileSync } from 'fs';

export const data = new SlashCommandBuilder()
  .setName('index')
  .setDescription('現在設定されている時報時刻を表示します。');
export async function execute(interaction: CommandInteraction) {
  let reminders = [];
  try {
    const data = readFileSync("json/reminders.json", "utf-8");
    reminders = JSON.parse(data);
  } catch (error) {
    console.error(error);
  }

  let reminderList = '';

  const embed = new EmbedBuilder()
    .setTitle('現在の時報設定');

  for (const reminder of reminders) {
    const { id, time, content } = reminder;
    reminderList += `${id} ${time} ${content}\n`;
    embed.addFields({ name: `${time} ID:${id}`, value: content });
  }

  await interaction.reply({ embeds: [embed] });
}