import { SlashCommandBuilder } from '@discordjs/builders';
import { schedule } from 'node-cron';
import { writeFileSync } from 'fs';
import { tz } from 'moment-timezone';
import type { CommandInteraction, TextChannel } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('setschedule')
  .setDescription('時報する時刻とメッセージを設定できます。')
  .addStringOption(option => option.setName('time')
    .setDescription('時報する時刻 22:22 のように入力してください。')
    .setRequired(true))
  .addStringOption(option => option.setName('content')
    .setDescription('時報のメッセージの内容(空白の場合はデフォルトの時報となります。)')
    .setRequired(false));
export async function execute(interaction: CommandInteraction) {
  const time = interaction.options.data.find(opt => opt.name ==='time')?.value as string;
  let content = interaction.options.data.find(opt => opt.name === 'content')?.value as string;
  if (content === null) {
    content = `${time}をお知らせします。`;
  };
  const [hour, minute] = time.split(':');

  const channel = interaction.client.channels.cache.get("") as TextChannel; // ここに時報メッセージを送信するチャンネルのIDを入力
  schedule(`${minute} ${hour} * * *`, function () {
    channel.send(content);
  });

  // リマインダーの保存
  const reminders = require('json/reminders.json');
  reminders.push({ time, content });
  reminders.sort((a: { time: string; }, b: { time: string; }) => {
    const timeA = tz(a.time, 'HH:mm', 'Asia/Tokyo');
    const timeB = tz(b.time, 'HH:mm', 'Asia/Tokyo');
    return timeA.diff(timeB);
  }); // 日本時間でソートする
  reminders.forEach((reminder: { id: string; }, index: number) => {
    reminder.id = (index + 1).toString();
  }); //idの振り直し
  writeFileSync('json/reminders.json', JSON.stringify(reminders, null, 2));

  await interaction.reply(`${time}に時報を設定しました。`);
}