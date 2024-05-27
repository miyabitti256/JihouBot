import dotenv from "dotenv";
import { Client, GatewayIntentBits, ActivityType, Collection, type TextChannel } from "discord.js";
import { schedule, type ScheduledTask } from "node-cron";
import { readdirSync, existsSync, readFileSync, appendFileSync } from "fs";
import type { Reminder } from "./types";

dotenv.config({ path: '.env.local' });

interface Command {
    data: {
        name: string;
    };
    execute: (interaction: any) => Promise<void>;
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates
    ]
});
const collection = new Collection();

const BotStartTime: Date = new Date(); //Bot startup time
const jobs: ScheduledTask[] = []; //Retention of time signal

//コマンドファイルを読み込む
const commandFiles = readdirSync("./commands").filter(file => file.endsWith("ts"));
for (const file of commandFiles){
    const command: Command = require(`./commands/${file}`);
    collection.set(command.data.name, command);
}

//login log
client.once("ready", c => {
    console.log(`${c.user.tag} has logged in.`);
    updateStatus();
    getReminder();
    schedule(`${BotStartTime.getSeconds()} ${BotStartTime.getMinutes()} * * * *`, () => updateStatus());    
});

client.on("messageCreate", message => {
    if(message.author.bot) return;

    const currentTime = getCurrentTime();
    const now = new Date();
    const nowH = now.getHours();
    const nowM = now.getMinutes();
    const nowS = now.getSeconds();
    const nowMS = now.getMilliseconds();

    if(message.content === "今何時？") {
        message.channel.send(`現在の時刻は${nowH}時${nowM}分${nowS}秒${nowMS}です。`);
        logToConsoleAndFile(`${currentTime} The current time has been given.`)
    }
    if(message.content === "!ちんぽ"){
        message.channel.send("黙れ小僧");
        logToConsoleAndFile(`${currentTime} !ちんぽ is detected.`);
    }
    if(message.content === "!お尻叩いて"){
        message.channel.send(`${nowH}:${nowM}お知らせします。 お尻を叩いて欲しいとはとんだ変態だな。いいだろう、ほら、ケツを出せよ。ふむ、全然叩き甲斐がなさそうなケツをしてるな。もっと大臀筋を鍛えてから出直してこい。`)
        logToConsoleAndFile(`${currentTime} HENTAI is detected.`);
    }
});

//Execute slash command
client.on("interactionCreate", async interaction => {
    if(!interaction.isCommand()) return;

    const command: any = collection.get(interaction.commandName);
    if(!command) return;

    try{
        logToConsoleAndFile(`${interaction.commandName} was excuted`);
        await command.execute(interaction);
        if(interaction.commandName === 'setschedule'||interaction.commandName === 'edit'||interaction.commandName === 'delete'){
            await getReminder();
          }
    } catch(e){
        console.error(e);
        await interaction.reply({ content: "このコマンドの実行中にエラーが発生しました。", ephemeral: true });
    }
})

client.on("voiceStateUpdate", (oldState, newState) => {

    const guildId = process.env.DISCORD_GUILD_ID as string;  // Server ID
    const voiceChannelId = process.env.DISCORD_VOICE_CHANNEL_ID as string;  // ID of the channel to monitor
    const textChannelId = process.env.DISCORD_TEXT_CHANNEL_ID as string;  // ID of the channel to send
    const currentTime = getCurrentTime();
    let timeout:any = null;

    if(newState.guild.id !== guildId || newState.member?.user.bot) return;

    if(newState.channelId === voiceChannelId && newState.channelId !== oldState.channelId) {
        const membersInChannel = newState.channel?.members.size;
        const user = newState.member?.user.tag;

        logToConsoleAndFile(`${currentTime} ${user} participated. ${membersInChannel} person`);
        clearTimeout(timeout);

        //Chat when only one person is on the voice channel
        if(membersInChannel === 1) {
            timeout = setTimeout(async () => {
                const textChannel = client.channels.cache.get(textChannelId);
                (textChannel as TextChannel).send("なんかいる")
                .catch(e => console.error("error sending message:", e));
            }, 600000);
        }
    } else if (oldState.channelId === voiceChannelId && oldState.channelId !== newState.channelId) {
        //When you leave the voice channel
        const membersInChannel = oldState.channel?.members.size;
        const user = oldState.member?.user.tag;

        logToConsoleAndFile(`${currentTime} ${user} has disconnected. ${membersInChannel} person`);
        clearTimeout(timeout);

        setTimeout(() => {
            const textChannel = oldState.guild.channels.cache.get(textChannelId);
            (textChannel as TextChannel)?.send("おい")
            .catch(e => console.error("error sending message:", e));
        }, 1000);

        if(membersInChannel === 0) {
            setTimeout(() => {
                const textChannel = oldState.guild.channels.cache.get(textChannelId);
                (textChannel as TextChannel)?.send("寝るな！").
                catch(e => console.error("error sending message:", e));
            }, 2000);
        }
    }
});

//Loading and rescheduling of time signal time
async function getReminder() {
    jobs.forEach(job => job.stop());
    jobs.length = 0;

    console.log(jobs);

    let reminders: Reminder[] = [];
    try {
        if(existsSync("./json/reminders.json")) {
            reminders = JSON.parse(readFileSync("json/reminders.json", "utf-8"));
        }
    } catch (e) {
        console.error(e);
    }
    reminders.forEach(reminder => {
        const { time, content } = reminder;
        const [hour, minute] = time.split(":");
        const sendChannel = client.channels.cache.get(process.env.DISCORD_TEXT_CHANNEL_ID as string/* ID of the channel to send */);

        const job = schedule(`${minute} ${hour} * * *`, () => {
            const currentTime = getCurrentTime();
            logToConsoleAndFile(`${currentTime} Message sent to the channel concerned.`);
            (sendChannel as TextChannel).send(content);
        });
        jobs.push(job);

        console.log(jobs);
    });
}

//Function to get the current time
function getCurrentTime(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
}

//Function to update status messages every hour
function updateStatus(): void{
    const now = new Date();
    const h = Math.floor((now.getTime() - BotStartTime.getTime()) / (1000 * 60 * 60))
    let statusMessage = `${h}時間連続稼働中`;
    //Added message requesting restart if uptime exceeds 5 days
    if(h >= 5 * 24) {
        statusMessage += " 再起動を要求します。";
    }
    client.user?.setActivity(statusMessage, { type: ActivityType.Custom });
}

//Function to output logs to console and log file
function logToConsoleAndFile(message: string) {
    const logMessage = `${message}`;
    console.log(logMessage);
    appendFileSync("log.log", logMessage + '\n');
}

client.login(process.env.DISCORD_TOKEN);
