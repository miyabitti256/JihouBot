import { SlashCommandBuilder } from '@discordjs/builders';
import type { CommandInteraction } from 'discord.js';
import { readFileSync, existsSync, writeFileSync, appendFileSync } from 'fs';

export const data = new SlashCommandBuilder()
  .setName('omikuji')
  .setDescription('一日に一度おみくじを引くことができます。毎朝5時に更新されます。');
export async function execute(interaction: CommandInteraction) {
  const userData = loadUserData();
  const userId = interaction.user.id;
  const currentDate = new Date(new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }));
  currentDate.setHours(currentDate.getHours() - 5);
  const lastCommandTime = userData[userId] ? new Date(userData[userId].lastDrawDate) : null;
  const resultStats = loadResultStats();
  const wait = require('util').promisify(setTimeout);
  if (!lastCommandTime || !isSameDay(currentDate, lastCommandTime)) {
    // ユーザーデータを更新
    userData[userId] = {
      lastDrawDate: currentDate.toISOString(),
    };
    // ユーザーデータを保存
    saveUserData(userData);

    // おみくじの結果とそれぞれの確率を設定
    // おみくじは良い結果順にぬべ吉→大吉→吉→中吉→小吉→末吉→凶→大凶→ヌベキチ└(՞ةڼ◔)」
    const results = [
      { result: 'ぬべ吉', weight: 1 }, // 1%  
      { result: 'ヌベキチ└(՞ةڼ◔)」', weight: 2 }, //2%
      { result: '大凶', weight: 5 }, // 5%
      { result: '大吉', weight: 8 }, // 8%
      { result: '吉', weight: 12 }, // 12%
      { result: '凶', weight: 12 }, // 12%
      { result: '中吉', weight: 16 }, // 16%
      { result: '小吉', weight: 22 }, // 22%
      { result: '末吉', weight: 22 } // 22%
    ];

    // 確率に基づいて結果をランダムに選択
    const totalWeight = results.reduce((sum, result) => sum + result.weight, 0);
    let randomNum = Math.floor(Math.random() * totalWeight);

    let selectedResult = "";
    for (const result of results) {
      randomNum -= result.weight;
      if (randomNum <= 0) {
        selectedResult = result.result;
        break;
      }
    }

    // ぬべ吉かヌベキチ└(՞ةڼ◔)」の場合、ユーザーにロールを付与
    if (selectedResult === 'ぬべ吉' || selectedResult === 'ヌベキチ└(՞ةڼ◔)」') {
      const guild = interaction.guild;
      const roleName = selectedResult === 'ぬべ吉' ? 'ぬべ吉' : 'ヌベキチ└(՞ةڼ◔)」';
      const role = guild?.roles.cache.find((r) => r.name === roleName);
      if (role) {
        const member = guild?.members.cache.get(userId);
        if (member) {
          // 既にロールを持っていた場合何もしない
          if (member.roles.cache.some((r) => r.name === roleName)) {
            logToConsoleAndText(`${member.user.username} は既に${roleName}ロールを持っています。`);
          } else {
            try {
              await member.roles.add(role);
              logToConsoleAndText(`${member.user.username} に${roleName}ロールを付与しました。`);
            } catch (error) {
              console.error('ロールの付与に失敗しました。', error);
            }
          }
        }
      }
    }
    // おみくじの結果を集計
    resultStats[selectedResult] = (resultStats[selectedResult] || 0) + 1;
    // 結果をメッセージで返信
    await interaction.deferReply();
    await wait(3000);
    await interaction.editReply(`おみくじの結果は「${selectedResult}」です！`);
    const currentTime = getCurrentTime();
    logToConsoleAndText(`${currentTime} ${interaction.guild?.members.cache.get(userId)?.user.username}によっておみくじが引かれました。結果は${selectedResult}でした。`);
  } else {
    //同じ日だった場合エラーメッセージを送信
    interaction.reply('おみくじは一日に一度しか引くことはできません。');
    const currentTime = getCurrentTime();
    logToConsoleAndText(`${currentTime} ${interaction.guild?.members.cache.get(userId)?.user.username}が同日にもう一度おみくじを引こうとしました。`);
  }
  // ユーザーデータを読み込む関数
  function loadUserData() {
    try {
      const data = readFileSync('json/userData.json', 'utf-8');
      return JSON.parse(data);
    } catch (err) {
      // ファイルが存在しないか読み込みエラーが発生した場合、空のオブジェクトを返す
      return {};
    }
  }
  // おみくじの結果を集計するファイルを読み込む関数
  function loadResultStats(): Record<string, number> {
    try {
      if (existsSync('json/resultStats.json')) {
        const data = readFileSync('json/resultStats.json', 'utf-8');
        return JSON.parse(data);
      }
      return {};
    } catch (err) {
      console.error('結果の読み込みエラー:', err);
      return {};
    }
  }
  // ユーザーデータを保存する関数
  function saveUserData(data: any) {
    writeFileSync('json/userData.json', JSON.stringify(data, null, 2));
  }
  // 結果を保存する関数
  function saveResultStats() {
    try {
      writeFileSync('json/resultStats.json', JSON.stringify(resultStats, null, 2));
    } catch (err) {
      console.error('結果の保存エラー:', err);
    }
  }
  //ログをコンソールとテキストファイルに出力する関数
  function logToConsoleAndText(message: string) {
    const logMessage = `${message}`;
    console.log(logMessage);
    appendFileSync('log.log', logMessage + '\n');
  }
  // 現在時刻を取得する関数
  function getCurrentTime() {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
  }
  // 2つの日付が同じ日かどうかをチェックする関数
  function isSameDay(date1: Date, date2: Date) {
    return (
      date1.getDate() === date2.getDate() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getFullYear() === date2.getFullYear()
    );
  }
  saveResultStats();
}