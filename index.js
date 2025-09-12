require('dotenv').config();
const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, InteractionResponseType } = require('discord.js');
const fs = require('fs');
const path = require('path');

const userMoney = new Map();
const lastDailyReward = new Map();
const jackpotPool = { amount: 1000 };
const activeGames = new Map();

// Data persistence
const dataFile = path.join(__dirname, 'gamedata.json');

function saveData() {
    const data = {
        userMoney: Object.fromEntries(userMoney),
        lastDailyReward: Object.fromEntries(lastDailyReward),
        jackpotPool: jackpotPool,
        lastSave: new Date().toISOString()
    };
    
    try {
        fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
        console.log('✅ Spieldaten gespeichert');
    } catch (error) {
        console.error('❌ Fehler beim Speichern der Daten:', error);
    }
}

function loadData() {
    try {
        if (fs.existsSync(dataFile)) {
            const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
            
            // Load user money
            if (data.userMoney) {
                for (const [userId, money] of Object.entries(data.userMoney)) {
                    userMoney.set(userId, money);
                }
            }
            
            // Load daily rewards
            if (data.lastDailyReward) {
                for (const [userId, lastReward] of Object.entries(data.lastDailyReward)) {
                    lastDailyReward.set(userId, lastReward);
                }
            }
            
            // Load jackpot pool
            if (data.jackpotPool) {
                jackpotPool.amount = data.jackpotPool.amount || 1000;
            }
            
            console.log(`✅ Spieldaten geladen (${Object.keys(data.userMoney || {}).length} Spieler)`);
        } else {
            console.log('📁 Keine gespeicherten Daten gefunden - starte mit leeren Daten');
        }
    } catch (error) {
        console.error('❌ Fehler beim Laden der Daten:', error);
    }
}

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
    saveData(); // Auto-save when money changes
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
    saveData(); // Save after daily reward
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

async function playSlotAnimation(message, playerName, betAmount, finalResult) {
    const symbols = ['🍒', '🍋', '🍇', '🍊', '🍉', '⭐', '💎'];
    
    // Initial spinning message
    let content = `${playerName} setzt $${betAmount}!\n🎰 | 🎲 | 🎲 | 🎲 | 🎰\nDie Slots drehen sich...`;
    const sentMessage = await message.channel.send(content);
    
    // Wait a bit for dramatic effect
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // First slot stops
    content = `${playerName} setzt $${betAmount}!\n🎰 | ${finalResult.symbols[0]} | 🎲 | 🎲 | 🎰\nErster Slot gestoppt...`;
    await sentMessage.edit(content);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Second slot stops
    content = `${playerName} setzt $${betAmount}!\n🎰 | ${finalResult.symbols[0]} | ${finalResult.symbols[1]} | 🎲 | 🎰\nZweiter Slot gestoppt...`;
    await sentMessage.edit(content);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Final result
    const newBalance = getUserMoney(message.author.id);
    content = `${playerName} setzt $${betAmount}!\n🎰 | ${finalResult.symbols.join(' | ')} | 🎰\n${finalResult.message}\n💰 Neuer Kontostand: $${newBalance}`;
    await sentMessage.edit(content);
}

// Coinflip Game
function playCoinflip(betAmount) {
    const isHeads = Math.random() < 0.5;
    return {
        result: isHeads ? 'heads' : 'tails',
        emoji: isHeads ? '🪙' : '🪙',
        win: isHeads,
        winnings: isHeads ? betAmount * 2 : 0,
        message: isHeads ? 'KOPF! Du gewinnst!' : 'ZAHL! Du verlierst!'
    };
}

// Dice Game
function playDice(betAmount) {
    const roll = Math.floor(Math.random() * 6) + 1;
    let multiplier = 0;
    let message = '';
    
    if (roll === 6) {
        multiplier = 6;
        message = '⚅ SECHS! Großer Gewinn!';
    } else if (roll === 5) {
        multiplier = 3;
        message = '⚄ FÜNF! Guter Gewinn!';
    } else if (roll >= 3) {
        multiplier = 1.5;
        message = `⚂ ${roll}! Kleiner Gewinn!`;
    } else {
        multiplier = 0;
        message = `⚀ ${roll}! Leider kein Gewinn.`;
    }
    
    return {
        roll: roll,
        multiplier: multiplier,
        winnings: betAmount * multiplier,
        message: message
    };
}

// Roulette Game
function playRoulette(betAmount, bet) {
    const number = Math.floor(Math.random() * 37); // 0-36
    const isRed = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36].includes(number);
    const isBlack = number > 0 && !isRed;
    
    let winnings = 0;
    let message = '';
    
    if (bet === 'red' && isRed) {
        winnings = betAmount * 2;
        message = `🔴 ${number} ROT! Du gewinnst!`;
    } else if (bet === 'black' && isBlack) {
        winnings = betAmount * 2;
        message = `⚫ ${number} SCHWARZ! Du gewinnst!`;
    } else if (bet === number.toString()) {
        winnings = betAmount * 36;
        message = `🎯 ${number}! VOLLTREFFER! Riesiger Gewinn!`;
    } else {
        winnings = 0;
        const color = number === 0 ? '🟢' : (isRed ? '🔴' : '⚫');
        message = `${color} ${number}! Leider kein Gewinn.`;
    }
    
    return {
        number: number,
        winnings: winnings,
        message: message
    };
}

// Card Game Helper Functions
function createDeck() {
    const suits = ['♠️', '♥️', '♦️', '♣️'];
    const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const deck = [];
    
    for (const suit of suits) {
        for (const rank of ranks) {
            deck.push({ rank, suit, value: getCardValue(rank) });
        }
    }
    
    return shuffleDeck(deck);
}

function shuffleDeck(deck) {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

function getCardValue(rank) {
    if (rank === 'A') return 11;
    if (['J', 'Q', 'K'].includes(rank)) return 10;
    return parseInt(rank);
}

function calculateHandValue(hand) {
    let value = 0;
    let aces = 0;
    
    for (const card of hand) {
        if (card.rank === 'A') {
            aces++;
            value += 11;
        } else {
            value += card.value;
        }
    }
    
    while (value > 21 && aces > 0) {
        value -= 10;
        aces--;
    }
    
    return value;
}

function cardToString(card) {
    return `${card.rank}${card.suit}`;
}

// Scratch Card Game
function playScratchCard(betAmount) {
    const symbols = ['🍒', '⭐', '💎', '🍋', '💰', '🎁'];
    const card = [];
    for (let i = 0; i < 9; i++) {
        card.push(symbols[Math.floor(Math.random() * symbols.length)]);
    }
    
    // Count symbol occurrences
    const counts = {};
    card.forEach(symbol => {
        counts[symbol] = (counts[symbol] || 0) + 1;
    });
    
    let winnings = 0;
    let message = '';
    
    // Check for wins (3 or more of same symbol)
    for (const [symbol, count] of Object.entries(counts)) {
        if (count >= 3) {
            let multiplier = 0;
            if (symbol === '💎') multiplier = count * 10;
            else if (symbol === '⭐') multiplier = count * 5;
            else if (symbol === '💰') multiplier = count * 3;
            else multiplier = count;
            
            winnings = Math.max(winnings, betAmount * multiplier);
            message = `${symbol} ${count}x! Du gewinnst!`;
            break;
        }
    }
    
    if (winnings === 0) {
        message = 'Kein Gewinn diesmal!';
    }
    
    return {
        card: card,
        winnings: winnings,
        message: message
    };
}

// Blackjack Game
function startBlackjack(betAmount) {
    const deck = createDeck();
    const playerHand = [deck.pop(), deck.pop()];
    const dealerHand = [deck.pop(), deck.pop()];
    
    return {
        deck: deck,
        playerHand: playerHand,
        dealerHand: dealerHand,
        betAmount: betAmount,
        gameState: 'playing'
    };
}

// War Card Game
function playWar(betAmount) {
    const deck = createDeck();
    const playerCard = deck.pop();
    const dealerCard = deck.pop();
    
    let winnings = 0;
    let message = '';
    
    if (playerCard.value > dealerCard.value) {
        winnings = betAmount * 2;
        message = `Du gewinnst! ${cardToString(playerCard)} schlägt ${cardToString(dealerCard)}`;
    } else if (playerCard.value < dealerCard.value) {
        winnings = 0;
        message = `Du verlierst! ${cardToString(dealerCard)} schlägt ${cardToString(playerCard)}`;
    } else {
        winnings = betAmount;
        message = `Unentschieden! ${cardToString(playerCard)} = ${cardToString(dealerCard)} - Einsatz zurück`;
    }
    
    return {
        playerCard: playerCard,
        dealerCard: dealerCard,
        winnings: winnings,
        message: message
    };
}

// Crash Game
function startCrash() {
    const crashPoint = Math.random() < 0.05 ? 1 + Math.random() * 2 : 1 + Math.random() * 10;
    return {
        crashPoint: crashPoint,
        currentMultiplier: 1.0,
        crashed: false
    };
}

// Mines Game
function createMinesField(mines = 5) {
    const field = Array(25).fill(false);
    
    // Place mines randomly
    for (let i = 0; i < mines; i++) {
        let pos;
        do {
            pos = Math.floor(Math.random() * 25);
        } while (field[pos]);
        field[pos] = true;
    }
    
    return field;
}

// Wheel Game
function spinWheel(betAmount) {
    const segments = [
        { name: '💎', multiplier: 50, chance: 1 },
        { name: '⭐', multiplier: 10, chance: 3 },
        { name: '🍒', multiplier: 5, chance: 8 },
        { name: '🍋', multiplier: 3, chance: 15 },
        { name: '🍇', multiplier: 2, chance: 25 },
        { name: '❌', multiplier: 0, chance: 48 }
    ];
    
    const random = Math.random() * 100;
    let cumulative = 0;
    
    for (const segment of segments) {
        cumulative += segment.chance;
        if (random <= cumulative) {
            return {
                segment: segment.name,
                multiplier: segment.multiplier,
                winnings: betAmount * segment.multiplier,
                message: segment.multiplier > 0 ? 
                    `${segment.name} ${segment.multiplier}x! Du gewinnst!` : 
                    `${segment.name} Kein Gewinn diesmal!`
            };
        }
    }
}

client.on('ready', () => {
    console.log(`Bot ist bereit! Eingeloggt als ${client.user.tag}`);
    loadData(); // Load saved data on startup
    deployCommands();
    
    // Auto-save every 5 minutes
    setInterval(() => {
        saveData();
    }, 5 * 60 * 1000);
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
        
        await playSlotAnimation(message, message.member.displayName, betAmount, result);
    } else if (message.content.startsWith('?coinflip')) {
        const args = message.content.split(' ');
        const betAmount = parseInt(args[1]) || 1;
        
        if (isNaN(betAmount) || betAmount <= 0) {
            await message.channel.send('❌ Bitte gib einen gültigen Betrag ein! (z.B. ?coinflip 10)');
            return;
        }
        
        const userBalance = getUserMoney(message.author.id);
        if (userBalance < betAmount) {
            await message.channel.send(`❌ Du hast nicht genug Geld! Du hast nur $${userBalance}.`);
            return;
        }
        
        const result = playCoinflip(betAmount);
        const newBalance = userBalance - betAmount + result.winnings;
        setUserMoney(message.author.id, newBalance);
        
        await message.channel.send(`🪙 **${message.member.displayName}** wirft eine Münze für $${betAmount}!\n${result.emoji} ${result.result.toUpperCase()}!\n${result.message}\n💰 Neuer Kontostand: $${newBalance}`);
    
    } else if (message.content.startsWith('?dice')) {
        const args = message.content.split(' ');
        const betAmount = parseInt(args[1]) || 1;
        
        if (isNaN(betAmount) || betAmount <= 0) {
            await message.channel.send('❌ Bitte gib einen gültigen Betrag ein! (z.B. ?dice 10)');
            return;
        }
        
        const userBalance = getUserMoney(message.author.id);
        if (userBalance < betAmount) {
            await message.channel.send(`❌ Du hast nicht genug Geld! Du hast nur $${userBalance}.`);
            return;
        }
        
        const result = playDice(betAmount);
        const newBalance = userBalance - betAmount + result.winnings;
        setUserMoney(message.author.id, newBalance);
        
        await message.channel.send(`🎲 **${message.member.displayName}** würfelt für $${betAmount}!\n${result.message}\nGewinn: $${result.winnings}\n💰 Neuer Kontostand: $${newBalance}`);
    
    } else if (message.content.startsWith('?roulette')) {
        const args = message.content.split(' ');
        if (args.length < 3) {
            await message.channel.send('❌ Verwendung: ?roulette <betrag> <red/black/0-36>\nBeispiele: ?roulette 10 red, ?roulette 5 black, ?roulette 20 7');
            return;
        }
        
        const betAmount = parseInt(args[1]);
        const bet = args[2].toLowerCase();
        
        if (isNaN(betAmount) || betAmount <= 0) {
            await message.channel.send('❌ Bitte gib einen gültigen Betrag ein!');
            return;
        }
        
        if (!['red', 'black'].includes(bet) && (isNaN(parseInt(bet)) || parseInt(bet) < 0 || parseInt(bet) > 36)) {
            await message.channel.send('❌ Ungültiger Einsatz! Verwende "red", "black" oder eine Zahl 0-36.');
            return;
        }
        
        const userBalance = getUserMoney(message.author.id);
        if (userBalance < betAmount) {
            await message.channel.send(`❌ Du hast nicht genug Geld! Du hast nur $${userBalance}.`);
            return;
        }
        
        const result = playRoulette(betAmount, bet);
        const newBalance = userBalance - betAmount + result.winnings;
        setUserMoney(message.author.id, newBalance);
        
        await message.channel.send(`🎰 **${message.member.displayName}** spielt Roulette für $${betAmount} auf "${bet}"!\n${result.message}\nGewinn: $${result.winnings}\n💰 Neuer Kontostand: $${newBalance}`);
    
    } else if (message.content.startsWith('?scratch')) {
        const args = message.content.split(' ');
        const betAmount = parseInt(args[1]) || 1;
        
        if (isNaN(betAmount) || betAmount <= 0) {
            await message.channel.send('❌ Bitte gib einen gültigen Betrag ein! (z.B. ?scratch 10)');
            return;
        }
        
        const userBalance = getUserMoney(message.author.id);
        if (userBalance < betAmount) {
            await message.channel.send(`❌ Du hast nicht genug Geld! Du hast nur $${userBalance}.`);
            return;
        }
        
        const result = playScratchCard(betAmount);
        const newBalance = userBalance - betAmount + result.winnings;
        setUserMoney(message.author.id, newBalance);
        
        const cardDisplay = result.card.slice(0, 3).join(' ') + '\n' + 
                           result.card.slice(3, 6).join(' ') + '\n' + 
                           result.card.slice(6, 9).join(' ');
        
        await message.channel.send(`🎫 **${message.member.displayName}** kauft ein Rubbellos für $${betAmount}!\n\`\`\`\n${cardDisplay}\n\`\`\`\n${result.message}\nGewinn: $${result.winnings}\n💰 Neuer Kontostand: $${newBalance}`);
    
    } else if (message.content.startsWith('?war')) {
        const args = message.content.split(' ');
        const betAmount = parseInt(args[1]) || 1;
        
        if (isNaN(betAmount) || betAmount <= 0) {
            await message.channel.send('❌ Bitte gib einen gültigen Betrag ein! (z.B. ?war 10)');
            return;
        }
        
        const userBalance = getUserMoney(message.author.id);
        if (userBalance < betAmount) {
            await message.channel.send(`❌ Du hast nicht genug Geld! Du hast nur $${userBalance}.`);
            return;
        }
        
        const result = playWar(betAmount);
        const newBalance = userBalance - betAmount + result.winnings;
        setUserMoney(message.author.id, newBalance);
        
        await message.channel.send(`⚔️ **${message.member.displayName}** spielt Kartenkrieg für $${betAmount}!\nDeine Karte: ${cardToString(result.playerCard)}\nDealer Karte: ${cardToString(result.dealerCard)}\n${result.message}\nGewinn: $${result.winnings}\n💰 Neuer Kontostand: $${newBalance}`);
    
    } else if (message.content.startsWith('?wheel')) {
        const args = message.content.split(' ');
        const betAmount = parseInt(args[1]) || 1;
        
        if (isNaN(betAmount) || betAmount <= 0) {
            await message.channel.send('❌ Bitte gib einen gültigen Betrag ein! (z.B. ?wheel 10)');
            return;
        }
        
        const userBalance = getUserMoney(message.author.id);
        if (userBalance < betAmount) {
            await message.channel.send(`❌ Du hast nicht genug Geld! Du hast nur $${userBalance}.`);
            return;
        }
        
        const result = spinWheel(betAmount);
        const newBalance = userBalance - betAmount + result.winnings;
        setUserMoney(message.author.id, newBalance);
        
        await message.channel.send(`🎡 **${message.member.displayName}** dreht das Glücksrad für $${betAmount}!\n🎯 Das Rad landet auf: ${result.segment}\n${result.message}\nGewinn: $${result.winnings}\n💰 Neuer Kontostand: $${newBalance}`);
    
    } else if (message.content.startsWith('?blackjack')) {
        const args = message.content.split(' ');
        const betAmount = parseInt(args[1]) || 1;
        
        if (isNaN(betAmount) || betAmount <= 0) {
            await message.channel.send('❌ Bitte gib einen gültigen Betrag ein! (z.B. ?blackjack 10)');
            return;
        }
        
        const userBalance = getUserMoney(message.author.id);
        if (userBalance < betAmount) {
            await message.channel.send(`❌ Du hast nicht genug Geld! Du hast nur $${userBalance}.`);
            return;
        }
        
        if (activeGames.has(message.author.id)) {
            await message.channel.send('❌ Du spielst bereits ein Spiel! Beende es zuerst.');
            return;
        }
        
        const game = startBlackjack(betAmount);
        activeGames.set(message.author.id, game);
        
        const playerValue = calculateHandValue(game.playerHand);
        const dealerValue = calculateHandValue([game.dealerHand[0]]);
        
        let content = `🃏 **${message.member.displayName}** spielt Blackjack für $${betAmount}!\n\n`;
        content += `**Deine Karten:** ${game.playerHand.map(cardToString).join(', ')} (${playerValue})\n`;
        content += `**Dealer:** ${cardToString(game.dealerHand[0])}, ? (${dealerValue}+)\n\n`;
        
        if (playerValue === 21) {
            // Natural blackjack
            const winnings = betAmount * 2.5;
            const newBalance = userBalance - betAmount + winnings;
            setUserMoney(message.author.id, newBalance);
            activeGames.delete(message.author.id);
            content += `🎉 BLACKJACK! Du gewinnst $${winnings}!\n💰 Neuer Kontostand: $${newBalance}`;
        } else {
            content += `Verwende ?hit zum Ziehen oder ?stand zum Bleiben`;
        }
        
        await message.channel.send(content);
    
    } else if (message.content === '?hit') {
        const game = activeGames.get(message.author.id);
        if (!game || game.gameState !== 'playing') {
            await message.channel.send('❌ Du spielst gerade kein Blackjack!');
            return;
        }
        
        game.playerHand.push(game.deck.pop());
        const playerValue = calculateHandValue(game.playerHand);
        
        let content = `🃏 **${message.member.displayName}** zieht eine Karte!\n\n`;
        content += `**Deine Karten:** ${game.playerHand.map(cardToString).join(', ')} (${playerValue})\n`;
        content += `**Dealer:** ${cardToString(game.dealerHand[0])}, ?\n\n`;
        
        if (playerValue > 21) {
            // Player busts
            const newBalance = getUserMoney(message.author.id) - game.betAmount;
            setUserMoney(message.author.id, newBalance);
            activeGames.delete(message.author.id);
            content += `💥 BUST! Du verlierst $${game.betAmount}!\n💰 Neuer Kontostand: $${newBalance}`;
        } else if (playerValue === 21) {
            content += `🎯 21! Verwende ?stand um zu bleiben`;
        } else {
            content += `Verwende ?hit zum Ziehen oder ?stand zum Bleiben`;
        }
        
        await message.channel.send(content);
    
    } else if (message.content === '?stand') {
        const game = activeGames.get(message.author.id);
        if (!game || game.gameState !== 'playing') {
            await message.channel.send('❌ Du spielst gerade kein Blackjack!');
            return;
        }
        
        // Dealer plays
        while (calculateHandValue(game.dealerHand) < 17) {
            game.dealerHand.push(game.deck.pop());
        }
        
        const playerValue = calculateHandValue(game.playerHand);
        const dealerValue = calculateHandValue(game.dealerHand);
        
        let content = `🃏 **${message.member.displayName}** bleibt bei ${playerValue}!\n\n`;
        content += `**Deine Karten:** ${game.playerHand.map(cardToString).join(', ')} (${playerValue})\n`;
        content += `**Dealer:** ${game.dealerHand.map(cardToString).join(', ')} (${dealerValue})\n\n`;
        
        let winnings = 0;
        if (dealerValue > 21) {
            winnings = game.betAmount * 2;
            content += `🎉 Dealer BUST! Du gewinnst $${winnings}!`;
        } else if (playerValue > dealerValue) {
            winnings = game.betAmount * 2;
            content += `🎉 Du gewinnst! $${winnings}!`;
        } else if (playerValue === dealerValue) {
            winnings = game.betAmount;
            content += `🤝 Unentschieden! Einsatz zurück: $${winnings}`;
        } else {
            content += `😞 Du verlierst $${game.betAmount}!`;
        }
        
        const newBalance = getUserMoney(message.author.id) - game.betAmount + winnings;
        setUserMoney(message.author.id, newBalance);
        activeGames.delete(message.author.id);
        
        content += `\n💰 Neuer Kontostand: $${newBalance}`;
        await message.channel.send(content);
    
    } else if (message.content.startsWith('?jackpot')) {
        const balance = getUserMoney(message.author.id);
        await message.channel.send(`🎰 **JACKPOT POOL** 🎰\n💰 Aktueller Jackpot: $${jackpotPool.amount}\n💳 Dein Guthaben: $${balance}\n\n🎫 Kaufe ein Jackpot-Ticket für $100 mit ?jackpot buy\n🏆 Jeden Tag um 20:00 wird ein Gewinner gezogen!`);
    
    } else if (message.content === '?games' || message.content === '?help') {
        const helpText = `🎮 **GAMELING CASINO** 🎮\n\n` +
        `💰 **Guthaben & Belohnungen:**\n` +
        `?money - Kontostand anzeigen\n` +
        `?daily - Tägliche Belohnung ($100-800)\n\n` +
        
        `🎰 **Glücksspiele:**\n` +
        `?slot <betrag> - Spielautomaten (Multiplikatoren: 2x-50x)\n` +
        `?coinflip <betrag> - Münzwurf (2x bei Gewinn)\n` +
        `?dice <betrag> - Würfel (6=6x, 5=3x, 3-4=1.5x)\n` +
        `?roulette <betrag> <red/black/0-36> - Roulette (Farbe=2x, Zahl=36x)\n` +
        `?wheel <betrag> - Glücksrad (2x-50x Multiplikatoren)\n` +
        `?scratch <betrag> - Rubbellos (3+ gleiche Symbole gewinnen)\n\n` +
        
        `🃏 **Kartenspiele:**\n` +
        `?blackjack <betrag> - Blackjack (dann ?hit oder ?stand)\n` +
        `?war <betrag> - Kartenkrieg (höhere Karte gewinnt)\n\n` +
        
        `🏆 **Spezial:**\n` +
        `?jackpot - Jackpot Pool anzeigen\n` +
        `?risk - Original Risk Command\n\n` +
        
        `**Startguthaben:** $500 für neue Spieler\n` +
        `**Tipp:** Beginne mit kleinen Einsätzen!`;
        
        await message.channel.send(helpText);
    
    } else if (message.content === '?backup' && message.member.permissions.has('ADMINISTRATOR')) {
        try {
            saveData();
            const stats = {
                players: userMoney.size,
                totalMoney: Array.from(userMoney.values()).reduce((a, b) => a + b, 0),
                jackpot: jackpotPool.amount,
                activeGames: activeGames.size
            };
            
            await message.channel.send(`💾 **Backup erstellt!**\n👥 Spieler: ${stats.players}\n💰 Gesamtgeld: $${stats.totalMoney}\n🎰 Jackpot: $${stats.jackpot}\n🎮 Aktive Spiele: ${stats.activeGames}`);
        } catch (error) {
            await message.channel.send('❌ Fehler beim Erstellen des Backups!');
        }
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'risk') {
        await handleRiskCommand(interaction.member, interaction);
    }
});

// Graceful shutdown - save data before exit
process.on('SIGINT', () => {
    console.log('🛑 Bot wird beendet - speichere Daten...');
    saveData();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('🛑 Bot wird beendet - speichere Daten...');
    saveData();
    process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);