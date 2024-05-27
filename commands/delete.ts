import { SlashCommandBuilder } from '@discordjs/builders';
import type { CommandInteraction } from 'discord.js';
import { writeFileSync } from 'fs';
import { tz } from 'moment-timezone';

export const data = new SlashCommandBuilder()
  .setName('delete')
  .setDescription('指定したIDの時報を削除します。')
  .addStringOption(option => option.setName('id')
    .setDescription('削除する時報のID')
    .setRequired(true));
export async function execute(interaction: CommandInteraction) {
  const id = interaction.options.data.find(opt => opt.name === "id")?.value;

  const reminders = require('../json/reminders.json');
  const reminderIndex = reminders.findIndex((reminder: { id: string }) => reminder.id === id);

  if (reminderIndex === -1) {
    return await interaction.reply(`ID:${id} の時報は見つかりませんでした。`);
  }

  reminders.splice(reminderIndex, 1);

  reminders.sort((a: { time: string; }, b: { time: string; }) => {
    const timeA = tz(a.time, 'HH:mm', 'Asia/Tokyo');
    const timeB = tz(b.time, 'HH:mm', 'Asia/Tokyo');
    return timeA.diff(timeB);
  }); // 日本時間でソートする
  reminders.forEach((reminder: { id: string; }, index: number) => {
    reminder.id = (index + 1).toString();
  }); //idの振り直し 

  writeFileSync('json/reminders.json', JSON.stringify(reminders, null, 2));

  await interaction.reply(`ID: ${id} の時報を削除しました。`);
}