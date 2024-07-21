import dotenv from "dotenv";
import { Client, GatewayIntentBits, ActivityType, Collection, TextChannel, VoiceState, Message, type Interaction } from "discord.js";
import { schedule, type ScheduledTask } from "node-cron";
import { readdirSync, existsSync, readFileSync, appendFileSync } from "fs";
import type { Reminder, Command } from "./types";

dotenv.config({ path: '.env.local' });

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates
    ]
});

const collection = new Collection<string, Command>();
const BOT_START_TIME: Date = new Date();
const jobs: ScheduledTask[] = [];

// 定数
const LOG_FILE = "log.log";
const REMINDERS_FILE = "./json/reminders.json";
const COMMANDS_DIR = "./commands";
const RESTART_REQUEST_HOURS = 5 * 24;

// 環境変数
const {
    DISCORD_TOKEN,
    DISCORD_GUILD_ID,
    DISCORD_VOICE_CHANNEL_ID,
    DISCORD_TEXT_CHANNEL_ID
} = process.env;

// 初期化
async function initialize() {
    await loadCommands();
    client.once("ready", onClientReady);
    client.on("messageCreate", onMessageCreate);
    client.on("interactionCreate", onInteractionCreate);
    client.on("voiceStateUpdate", onVoiceStateUpdate);
    await client.login(DISCORD_TOKEN);
}

async function loadCommands() {
    const commandFiles = readdirSync(COMMANDS_DIR).filter(file => file.endsWith(".ts"));
    for (const file of commandFiles) {
        const command: Command = require(`${COMMANDS_DIR}/${file}`);
        collection.set(command.data.name, command);
    }
}

function onClientReady(c: Client) {
    console.log(`${c.user?.tag} has logged in.`);
    updateStatus();
    getReminder();
    schedule(`${BOT_START_TIME.getSeconds()} ${BOT_START_TIME.getMinutes()} * * * *`, updateStatus);
}

async function onMessageCreate(message: Message) {
    if (message.author.bot) return;

    const currentTime = getCurrentTime();
    const now = new Date();

    if (message.content === "今何時？") {
        await message.channel.send(`現在の時刻は${now.getHours()}時${now.getMinutes()}分${now.getSeconds()}秒${now.getMilliseconds()}です。`);
        logToConsoleAndFile(`${currentTime} The current time has been given.`);
    } else if (message.content === "!ちんぽ") {
        await message.channel.send("黙れ小僧");
        logToConsoleAndFile(`${currentTime} !ちんぽ is detected.`);
    } else if (message.content === "!お尻叩いて") {
        await message.channel.send(`${now.getHours()}:${now.getMinutes()}お知らせします。 お尻を叩いて欲しいとはとんだ変態だな。いいだろう、ほら、ケツを出せよ。ふむ、全然叩き甲斐がなさそうなケツをしてるな。もっと大臀筋を鍛えてから出直してこい。`);
        logToConsoleAndFile(`${currentTime} HENTAI is detected.`);
    }
}

async function onInteractionCreate(interaction: Interaction) {
    if (!interaction.isCommand()) return;

    const command = collection.get(interaction.commandName);
    if (!command) return;

    try {
        logToConsoleAndFile(`${interaction.commandName} was executed`);
        await command.execute(interaction);
        if (['setschedule', 'edit', 'delete'].includes(interaction.commandName)) {
            await getReminder();
        }
    } catch (e) {
        console.error(e);
        await interaction.reply({ content: "このコマンドの実行中にエラーが発生しました。", ephemeral: true });
    }
}

async function onVoiceStateUpdate(oldState: VoiceState, newState: VoiceState) {
    if (newState.guild.id !== DISCORD_GUILD_ID || newState.member?.user.bot) return;

    const currentTime = getCurrentTime();
    let timeout: NodeJS.Timer | null = null;

    if (newState.channelId === DISCORD_VOICE_CHANNEL_ID && newState.channelId !== oldState.channelId) {
        await handleVoiceChannelJoin(newState, currentTime, timeout);
    } else if (oldState.channelId === DISCORD_VOICE_CHANNEL_ID && oldState.channelId !== newState.channelId) {
        await handleVoiceChannelLeave(oldState, currentTime);
    }
}

async function handleVoiceChannelJoin(newState: VoiceState, currentTime: string, timeout: Timer | null) {
    const membersInChannel = newState.channel?.members.size ?? 0;
    const user = newState.member?.user.tag;

    logToConsoleAndFile(`${currentTime} ${user} participated. ${membersInChannel} person`);
    if (timeout) clearTimeout(timeout);

    if (membersInChannel === 1) {
        timeout = setTimeout(async () => {
            const textChannel = client.channels.cache.get(DISCORD_TEXT_CHANNEL_ID as string) as TextChannel;
            await textChannel.send("なんかいる").catch(e => console.error("error sending message:", e));
        }, 600000);
    }
}

async function handleVoiceChannelLeave(oldState: VoiceState, currentTime: string) {
    const membersInChannel = oldState.channel?.members.size ?? 0;
    const user = oldState.member?.user.tag;

    logToConsoleAndFile(`${currentTime} ${user} has disconnected. ${membersInChannel} person`);

    const textChannel = oldState.guild.channels.cache.get(DISCORD_TEXT_CHANNEL_ID as string) as TextChannel;
    
    setTimeout(async () => {
        await textChannel.send("おい").catch(e => console.error("error sending message:", e));
    }, 1000);

    if (membersInChannel === 0) {
        setTimeout(async () => {
            await textChannel.send("寝るな！").catch(e => console.error("error sending message:", e));
        }, 2000);
    }
}

async function getReminder() {
    jobs.forEach(job => job.stop());
    jobs.length = 0;
    
    let reminders: Reminder[] = [];
    try {
        if (existsSync(REMINDERS_FILE)) {
            reminders = JSON.parse(readFileSync(REMINDERS_FILE, "utf-8"));
        }
    } catch (e) {
        console.error(e);
    }

    reminders.forEach(reminder => {
        const { time, content } = reminder;
        const [hour, minute] = time.split(":");
        const sendChannel = client.channels.cache.get(DISCORD_TEXT_CHANNEL_ID as string) as TextChannel;

        const job = schedule(`${minute} ${hour} * * *`, async () => {
            const currentTime = getCurrentTime();
            logToConsoleAndFile(`${currentTime} Message sent to the channel concerned.`);
            await sendChannel.send(content);
        });
        jobs.push(job);
    });
}

function getCurrentTime(): string {
    const now = new Date();
    return now.toLocaleString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

function updateStatus(): void {
    const now = new Date();
    const h = Math.floor((now.getTime() - BOT_START_TIME.getTime()) / (1000 * 60 * 60));
    let statusMessage = `${h}時間連続稼働中`;
    if (h >= RESTART_REQUEST_HOURS) {
        statusMessage += " 再起動を要求します。";
    }
    client.user?.setActivity(statusMessage, { type: ActivityType.Custom });
}

function logToConsoleAndFile(message: string) {
    console.log(message);
    appendFileSync(LOG_FILE, message + '\n');
}

initialize().catch(console.error);