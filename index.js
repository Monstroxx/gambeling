require('dotenv').config();
const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, InteractionResponseType } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent
    ]
});

const riskCommand = new SlashCommandBuilder()
    .setName('risk')
    .setDescription('Wage es... aber sei vorsichtig!');

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

async function deployCommands() {
    try {
        console.log('Registriere Slash Commands...');
        await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: [riskCommand.toJSON()] }
        );
        console.log('Slash Commands erfolgreich registriert!');
    } catch (error) {
        console.error('Fehler beim Registrieren der Commands:', error);
    }
}

function getRandomOutcome() {
    const random = Math.random() * 100;
    
    if (random < 0.1) {
        return { type: 'jackpot', duration: null };
    } else if (random < 2) {
        return { type: 'timeout', duration: 24 * 60 };
    } else if (random < 5) {
        return { type: 'timeout', duration: 12 * 60 };
    } else if (random < 10) {
        return { type: 'timeout', duration: 6 * 60 };
    } else if (random < 18) {
        return { type: 'timeout', duration: 3 * 60 };
    } else if (random < 30) {
        return { type: 'timeout', duration: 60 };
    } else if (random < 45) {
        return { type: 'timeout', duration: 20 };
    } else if (random < 75) {
        const shortTimeouts = [1, 2, 3, 4, 5];
        return { type: 'timeout', duration: shortTimeouts[Math.floor(Math.random() * shortTimeouts.length)] };
    } else {
        return { type: 'safe', duration: null };
    }
}

function formatDuration(minutes) {
    if (minutes < 60) {
        return `${minutes} Minute${minutes !== 1 ? 'n' : ''}`;
    } else {
        const hours = Math.floor(minutes / 60);
        return `${hours} Stunde${hours !== 1 ? 'n' : ''}`;
    }
}

client.on('ready', () => {
    console.log(`Bot ist bereit! Eingeloggt als ${client.user.tag}`);
    deployCommands();
});

async function handleRiskCommand(member, channelOrInteraction) {
    const outcome = getRandomOutcome();
    
    try {
        if (outcome.type === 'safe') {
            const message = `🍀 **${member.displayName} hatte Glück!** Du bist diesmal davongekommen.`;
            if (channelOrInteraction.reply) {
                await channelOrInteraction.reply({ content: message });
            } else {
                await channelOrInteraction.send(message);
            }
        } else if (outcome.type === 'timeout') {
            await member.timeout(outcome.duration * 60 * 1000, 'Risk Command - Pech gehabt!');
            const message = `⏰ **${member.displayName} hatte Pech!** Du wurdest für ${formatDuration(outcome.duration)} stumm geschaltet.`;
            if (channelOrInteraction.reply) {
                await channelOrInteraction.reply({ content: message });
            } else {
                await channelOrInteraction.send(message);
            }
        } else if (outcome.type === 'jackpot') {
            const jackpotRole = member.guild.roles.cache.get(process.env.JACKPOT_ROLE_ID);
            if (jackpotRole) {
                await member.roles.add(jackpotRole);
                const message = `🎉 **JACKPOT! ${member.displayName}** hat die ${jackpotRole.name} Rolle gewonnen! 🎊`;
                if (channelOrInteraction.reply) {
                    await channelOrInteraction.reply({ content: message });
                } else {
                    await channelOrInteraction.send(message);
                }
            } else {
                const message = `🎉 **JACKPOT ${member.displayName}!** Aber die Rolle konnte nicht gefunden werden.`;
                if (channelOrInteraction.reply) {
                    await channelOrInteraction.reply({ content: message });
                } else {
                    await channelOrInteraction.send(message);
                }
            }
        }
    } catch (error) {
        console.error('Fehler beim Ausführen des Risk Commands:', error);
        const errorMessage = '❌ Ein Fehler ist aufgetreten. Möglicherweise habe ich nicht die nötigen Berechtigungen.';
        if (channelOrInteraction.reply) {
            await channelOrInteraction.reply({ content: errorMessage, flags: 64 });
        } else {
            await channelOrInteraction.send(errorMessage);
        }
    }
}

client.on('messageCreate', async message => {
    if (message.author.bot) return;
    
    if (message.content === '?risk') {
        await handleRiskCommand(message.member, message.channel);
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'risk') {
        await handleRiskCommand(interaction.member, interaction);
    }
});

client.login(process.env.DISCORD_TOKEN);