require('dotenv').config();
const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, InteractionResponseType } = require('discord.js');

const userMoney = new Map();
const lastDailyReward = new Map();

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

function getUserMoney(userId) {
    if (!userMoney.has(userId)) {
        userMoney.set(userId, 500);
    }
    return userMoney.get(userId);
}

function setUserMoney(userId, amount) {
    userMoney.set(userId, Math.max(0, amount));
}

function canClaimDaily(userId) {
    const lastReward = lastDailyReward.get(userId);
    if (!lastReward) return true;
    
    const now = new Date();
    const lastRewardDate = new Date(lastReward);
    const timeDiff = now.getTime() - lastRewardDate.getTime();
    const hoursDiff = timeDiff / (1000 * 3600);
    
    return hoursDiff >= 24;
}

function claimDailyReward(userId) {
    const amount = Math.floor(Math.random() * 701) + 100;
    const currentMoney = getUserMoney(userId);
    setUserMoney(userId, currentMoney + amount);
    lastDailyReward.set(userId, new Date().toISOString());
    return amount;
}

function getTimeUntilNextDaily(userId) {
    const lastReward = lastDailyReward.get(userId);
    if (!lastReward) return 0;
    
    const lastRewardDate = new Date(lastReward);
    const nextRewardTime = new Date(lastRewardDate.getTime() + (24 * 60 * 60 * 1000));
    const now = new Date();
    const timeDiff = nextRewardTime.getTime() - now.getTime();
    
    if (timeDiff <= 0) return 0;
    
    const hours = Math.floor(timeDiff / (1000 * 60 * 60));
    const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
    
    return { hours, minutes };
}

function getSlotResult(betAmount) {
    const symbols = ['🍒', '🍋', '🍇', '🍊', '🍉', '⭐', '💎'];
    const slot1 = symbols[Math.floor(Math.random() * symbols.length)];
    const slot2 = symbols[Math.floor(Math.random() * symbols.length)];
    const slot3 = symbols[Math.floor(Math.random() * symbols.length)];
    
    let result = { symbols: [slot1, slot2, slot3], betAmount: betAmount };
    
    if (slot1 === slot2 && slot2 === slot3) {
        if (slot1 === '💎') {
            result.outcome = 'jackpot';
            result.multiplier = 50;
            result.winnings = betAmount * 50;
            result.message = `💎💎💎 MEGA JACKPOT! Du gewinnst $${result.winnings}! 💎💎💎`;
        } else if (slot1 === '⭐') {
            result.outcome = 'big_win';
            result.multiplier = 20;
            result.winnings = betAmount * 20;
            result.message = `⭐⭐⭐ GROSSER GEWINN! Du gewinnst $${result.winnings}! ⭐⭐⭐`;
        } else {
            result.outcome = 'win';
            result.multiplier = 10;
            result.winnings = betAmount * 10;
            result.message = `${slot1}${slot1}${slot1} Gewinn! Du gewinnst $${result.winnings}! 🎉`;
        }
    } else if (slot1 === slot2 || slot2 === slot3 || slot1 === slot3) {
        result.outcome = 'small_win';
        result.multiplier = 2;
        result.winnings = betAmount * 2;
        result.message = `Kleiner Gewinn! Du gewinnst $${result.winnings}! 😊`;
    } else {
        result.outcome = 'lose';
        result.multiplier = 0;
        result.winnings = 0;
        result.message = `Kein Gewinn diesmal. Du verlierst $${betAmount}! 🎰`;
    }
    
    return result;
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
    } else if (message.content === '?money') {
        const balance = getUserMoney(message.author.id);
        await message.channel.send(`💰 **${message.member.displayName}** hat $${balance} auf dem Konto!`);
    } else if (message.content === '?daily') {
        if (canClaimDaily(message.author.id)) {
            const amount = claimDailyReward(message.author.id);
            const newBalance = getUserMoney(message.author.id);
            await message.channel.send(`🎁 **${message.member.displayName}** hat die tägliche Belohnung von $${amount} erhalten!\n💰 Neuer Kontostand: $${newBalance}`);
        } else {
            const timeLeft = getTimeUntilNextDaily(message.author.id);
            if (timeLeft === 0) {
                const amount = claimDailyReward(message.author.id);
                const newBalance = getUserMoney(message.author.id);
                await message.channel.send(`🎁 **${message.member.displayName}** hat die tägliche Belohnung von $${amount} erhalten!\n💰 Neuer Kontostand: $${newBalance}`);
            } else {
                await message.channel.send(`⏰ Du hast bereits deine tägliche Belohnung erhalten! Nächste Belohnung in ${timeLeft.hours}h ${timeLeft.minutes}m.`);
            }
        }
    } else if (message.content.startsWith('?slot')) {
        const args = message.content.split(' ');
        let betAmount = 1;
        
        if (args.length > 1) {
            const parsedAmount = parseInt(args[1]);
            if (isNaN(parsedAmount) || parsedAmount <= 0) {
                await message.channel.send('❌ Bitte gib einen gültigen Betrag ein! (z.B. ?slot 5)');
                return;
            }
            betAmount = parsedAmount;
        }
        
        const userBalance = getUserMoney(message.author.id);
        if (userBalance < betAmount) {
            await message.channel.send(`❌ Du hast nicht genug Geld! Du hast nur $${userBalance}.`);
            return;
        }
        
        const result = getSlotResult(betAmount);
        const newBalance = userBalance - betAmount + result.winnings;
        setUserMoney(message.author.id, newBalance);
        
        const slotDisplay = `🎰 | ${result.symbols.join(' | ')} | 🎰`;
        const response = `${message.member.displayName} setzt $${betAmount}!\n${slotDisplay}\n${result.message}\n💰 Neuer Kontostand: $${newBalance}`;
        await message.channel.send(response);
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'risk') {
        await handleRiskCommand(interaction.member, interaction);
    }
});

client.login(process.env.DISCORD_TOKEN);