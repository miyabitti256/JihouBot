import dotenv from "dotenv";
import { REST, Routes, type APIApplicationCommand } from 'discord.js';
import { readdirSync } from 'fs';

dotenv.config({ path: '.env.local' });

const clientId = ""; //クライアントID
const guildId = ""; //登録するサーバーID
const commands = [];
const commandFiles = readdirSync('./commands').filter(file => file.endsWith('.ts'));

for (const file of commandFiles) {
	const command = require(`./commands/${file}`);
	commands.push(command.data.toJSON());
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN as string);

(async () => {
	try {
		console.log(`${commands.length} 個のアプリケーションコマンドを登録します。`);

		const data = await rest.put(
			Routes.applicationGuildCommands(clientId, guildId),
			{ body: commands },
		) as APIApplicationCommand[];

		console.log(`${data.length} 個のアプリケーションコマンドを登録しました。`);
	} catch (error) {
		console.error(error);
	}
})();