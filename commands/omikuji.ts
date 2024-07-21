import { SlashCommandBuilder } from '@discordjs/builders';
import { CommandInteraction, Guild, GuildMember, Role } from 'discord.js';
import { readFileSync, existsSync, writeFileSync, appendFileSync } from 'fs';
import { promisify } from 'util';

const wait = promisify(setTimeout);

// 定数
const USER_DATA_FILE = 'json/userData.json';
const RESULT_STATS_FILE = 'json/resultStats.json';
const LOG_FILE = 'log.log';
const TOKYO_TIMEZONE = 'Asia/Tokyo';
const RESET_HOUR = 5;

// おみくじの結果と確率
const OMIKUJI_RESULTS = [
  { result: 'ぬべ吉', weight: 1 },
  { result: 'ヌベキチ└(՞ةڼ◔)」', weight: 2 },
  { result: '大凶', weight: 5 },
  { result: '大吉', weight: 8 },
  { result: '吉', weight: 12 },
  { result: '凶', weight: 12 },
  { result: '中吉', weight: 16 },
  { result: '小吉', weight: 22 },
  { result: '末吉', weight: 22 }
];

// 型定義
interface UserData {
  [userId: string]: {
    lastDrawDate: string;
  };
}

interface ResultStats {
  [result: string]: number;
}

export const data = new SlashCommandBuilder()
  .setName('omikuji')
  .setDescription('一日に一度おみくじを引くことができます。毎朝5時に更新されます。');

export async function execute(interaction: CommandInteraction) {
  const userId = interaction.user.id;
  const currentDate = getCurrentTokyoDate();
  const userData = loadUserData();
  const resultStats = loadResultStats();

  if (canDrawOmikuji(userData, userId, currentDate)) {
    const selectedResult = drawOmikuji();
    await handleOmikujiResult(interaction, userId, selectedResult);
    updateUserData(userData, userId, currentDate);
    updateResultStats(resultStats, selectedResult);
    await sendOmikujiResult(interaction, selectedResult);
    logOmikujiDraw(interaction, userId, selectedResult);
  } else {
    await sendErrorMessage(interaction);
    logErrorAttempt(interaction, userId);
  }

  saveUserData(userData);
  saveResultStats(resultStats);
}

function getCurrentTokyoDate(): Date {
  const date = new Date(new Date().toLocaleString('ja-JP', { timeZone: TOKYO_TIMEZONE }));
  date.setHours(date.getHours() - RESET_HOUR);
  return date;
}

function canDrawOmikuji(userData: UserData, userId: string, currentDate: Date): boolean {
  const lastDrawDate = userData[userId] ? new Date(userData[userId].lastDrawDate) : null;
  return !lastDrawDate || !isSameDay(currentDate, lastDrawDate);
}

function drawOmikuji(): string {
  const totalWeight = OMIKUJI_RESULTS.reduce((sum, result) => sum + result.weight, 0);
  let randomNum = Math.floor(Math.random() * totalWeight);

  for (const result of OMIKUJI_RESULTS) {
    randomNum -= result.weight;
    if (randomNum <= 0) {
      return result.result;
    }
  }

  throw new Error('おみくじの結果が選択できませんでした。');
}

async function handleOmikujiResult(interaction: CommandInteraction, userId: string, result: string) {
  if (result === 'ぬべ吉' || result === 'ヌベキチ└(՞ةڼ◔)」') {
    await assignRole(interaction.guild, userId, result);
  }
}

async function assignRole(guild: Guild | null, userId: string, roleName: string) {
  if (!guild) return;

  const role = guild.roles.cache.find((r) => r.name === roleName);
  if (!role) return;

  const member = guild.members.cache.get(userId);
  if (!member) return;

  if (member.roles.cache.some((r) => r.name === roleName)) {
    logToConsoleAndFile(`${member.user.username} は既に${roleName}ロールを持っています。`);
  } else {
    try {
      await member.roles.add(role);
      logToConsoleAndFile(`${member.user.username} に${roleName}ロールを付与しました。`);
    } catch (error) {
      console.error('ロールの付与に失敗しました。', error);
    }
  }
}

function updateUserData(userData: UserData, userId: string, currentDate: Date) {
  userData[userId] = {
    lastDrawDate: currentDate.toISOString(),
  };
}

function updateResultStats(resultStats: ResultStats, result: string) {
  resultStats[result] = (resultStats[result] || 0) + 1;
}

async function sendOmikujiResult(interaction: CommandInteraction, result: string) {
  await interaction.deferReply();
  await wait(3000);
  await interaction.editReply(`おみくじの結果は「${result}」です！`);
}

async function sendErrorMessage(interaction: CommandInteraction) {
  await interaction.reply('おみくじは一日に一度しか引くことはできません。');
}

function logOmikujiDraw(interaction: CommandInteraction, userId: string, result: string) {
  const username = interaction.guild?.members.cache.get(userId)?.user.username;
  logToConsoleAndFile(`${getCurrentTime()} ${username}によっておみくじが引かれました。結果は${result}でした。`);
}

function logErrorAttempt(interaction: CommandInteraction, userId: string) {
  const username = interaction.guild?.members.cache.get(userId)?.user.username;
  logToConsoleAndFile(`${getCurrentTime()} ${username}が同日にもう一度おみくじを引こうとしました。`);
}

function loadUserData(): UserData {
  return loadJsonFile(USER_DATA_FILE);
}

function loadResultStats(): ResultStats {
  return loadJsonFile(RESULT_STATS_FILE);
}

function loadJsonFile(filePath: string): any {
  try {
    if (existsSync(filePath)) {
      const data = readFileSync(filePath, 'utf-8');
      return JSON.parse(data);
    }
    return {};
  } catch (err) {
    console.error(`ファイルの読み込みエラー (${filePath}):`, err);
    return {};
  }
}

function saveUserData(data: UserData) {
  saveJsonFile(USER_DATA_FILE, data);
}

function saveResultStats(data: ResultStats) {
  saveJsonFile(RESULT_STATS_FILE, data);
}

function saveJsonFile(filePath: string, data: any) {
  try {
    writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(`ファイルの保存エラー (${filePath}):`, err);
  }
}

function logToConsoleAndFile(message: string) {
  console.log(message);
  appendFileSync(LOG_FILE, message + '\n');
}

function getCurrentTime(): string {
  const now = new Date();
  return now.toLocaleString('ja-JP', {
    timeZone: TOKYO_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getDate() === date2.getDate() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getFullYear() === date2.getFullYear()
  );
}