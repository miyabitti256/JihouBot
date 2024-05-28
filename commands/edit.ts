import { SlashCommandBuilder } from '@discordjs/builders';
import type { CommandInteraction } from 'discord.js';
import { writeFileSync } from 'fs';
import { tz } from 'moment-timezone';

export const data = new SlashCommandBuilder()
  .setName('edit')
  .setDescription('指定したIDの時報時刻と内容を編集します。IDは/indexで確認できます。')
  .addStringOption(option => option.setName('id')
    .setDescription('編集する時報のID')
    .setRequired(true))
  .addStringOption(option => option.setName('time')
    .setDescription('新しく時報する時刻 22:22 のように入力してください。')
    .setRequired(true))
  .addStringOption(option => option.setName('content')
    .setDescription('新しい時報のメッセージの内容(空白の場合はデフォルトの時報となります。)')
    .setRequired(false));
export async function execute(interaction: CommandInteraction) {
  const id = interaction.options.data.find(opt => opt.name === "id")?.value;
  const time = interaction.options.data.find(opt => opt.name === "time")?.value as string;
  let content = interaction.options.data.find(opt => opt.name === "content")?.value || "";

  if (content === "") {
    content = `${time}をお知らせします。`;
  };

  const [hour, minute] = time.split(':');
  if(hour >= "24" || minute >= "60"){
    await interaction.reply({ content: '不正な時間入力です。00 ~ 23時 または 00 ~ 59分の値を入力してください。 ', ephemeral: true });
    return
  }

  const reminders = require('../json/reminders.json');
  const reminderIndex = reminders.findIndex((reminder: { id: any; }) => reminder.id === id);

  if (reminderIndex === -1) {
    return await interaction.reply(`ID: ${id} の時報は見つかりませんでした。`);
  }

  reminders[reminderIndex].time = time;
  if (content !== null) {
    reminders[reminderIndex].content = content;
  }

  reminders.sort((a: { time: string; }, b: { time: string; }) => {
    const timeA = tz(a.time, 'HH:mm', 'Asia/Tokyo');
    const timeB = tz(b.time, 'HH:mm', 'Asia/Tokyo');
    return timeA.diff(timeB);
  }); // 日本時間でソートする
  reminders.forEach((reminder: { id: string; }, index: number) => {
    reminder.id = (index + 1).toString();
  }); //idの振り直し    
  writeFileSync('json/reminders.json', JSON.stringify(reminders, null, 2));

  await interaction.reply(`ID:${id} の時報を編集しました。`);
}
