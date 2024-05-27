import { SlashCommandBuilder } from '@discordjs/builders';
import { TextChannel, type CommandInteraction } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('deletemsg')
  .setDescription('ぬべ')
  .addStringOption(option => option.setName('id')
    .setDescription('ぬべ')
    .setRequired(true));
export async function execute(interaction: CommandInteraction) {
  const messageId = interaction.options.data.find(opt => opt.name === "id")?.value as string;
  const channel = interaction.channel as TextChannel;

  if(!channel || !(channel instanceof TextChannel)) {
    await interaction.reply({ content: "このチャンネルのメッセージを削除することはできません。", ephemeral: true });
  }

  try {
    await channel.messages.fetch(messageId).then(message => message.delete());
    await interaction.reply({ content: '削除に成功しました。', ephemeral: true });
  } catch (error) {
    console.error(error);
  }
}
