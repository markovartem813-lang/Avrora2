const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { GoogleGenAI } = require('@google/genai');
const brain = require('./brain');
const historyMgr = require('./history');
require('dotenv').config();

const { SYSTEM_INSTRUCTION } = require('./persona');
const { executeCommand } = require('./handlers');

let token = process.env.DISCORD_TOKEN;
if (token) token = token.replace(/\s/g, '').replace(/["']/g, '');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const model = "gemini-3-pro-preview";

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.DirectMessages
    ],
    partials: [Partials.Channel]
});

client.once('ready', () => {
    console.log(`🧠 AVRORA FULL CORE | ${client.user.tag}`);
    client.user.setActivity('за сервером', { type: 3 });
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    const contentLower = message.content.toLowerCase();
    const isMention = message.mentions.has(client.user);
    
    // --- ПОЛНЫЙ СПИСОК ТРИГГЕРОВ ---
    const names = [
        'аврора', 'avrora', 'aurora', 'avrora-bot', 
        'авроре', 'аврору', 'авророй', 'авроры',
        'аврорка', 'аврорушка', 'авророчка', 'авушка', 'авка', 'ав', 'ава', 
        'аврорик', 'аврорчик',
        'бот', 'ботяра', 'админ', 'админша', 'модер', 
        'слышь', 'эй', 'мать', 'женщина', 'подруга', 'телка', 'сучка', 'шкура', 'крошка', 'детка',
        'aur', 'au', 'avy', 'rora', 'пупсик', 'малютка'
    ];
    
    // --- АВТОНОМНЫЕ ТРИГГЕРЫ АГРЕССИИ ---
    const toxicWords = [
       'дебил', 'идиот', 'даун', 'лох', 'чмо', 'сука', 'блять', 'пидор', 'гандон', 
       'мать жива', 'мамку', 'хохол', 'москаль', 'нигер', 'nigger', 'faggot', 'kys', 
       'урод', 'тупой', 'глупый', 'мразь', 'крыса', 'тварь', 'шлюха',
       'хер', 'хуй', 'залупа', 'еблан', 'ебать', 'мудак', 'сволочь', 'падла',
       'пизда', 'манда', 'блядь', 'уебок', 'уебан', 'гандонище', 'пидорас'
    ];

    // Триггеры защиты Создателя и VIP
    const creatorNames = ['mr.tokyo', 'tokyo', 'токио', 'мистер токио', 'creator', 'sytayxd', 'vinisho_0', 'vinisho','ситу'];

    const isName = names.some(n => contentLower.includes(n));
    const isToxic = toxicWords.some(w => contentLower.includes(w));
    const isCreatorMention = creatorNames.some(n => contentLower.includes(n));
    const isOwnerInsult = isToxic && isCreatorMention; // Комбо: Мат + Имя создателя/VIP

    const userProfile = brain.getProfile(message.author);
    
    // ПАССИВНЫЙ РЕЖИМ: Аврора не реагирует автоматически на уровень отношений.
    const shouldReply = isOwnerInsult || isToxic || isMention || isName || message.reference;

    if (!shouldReply) return;

    try {
        message.channel.sendTyping();

        // 1. ЗАГРУЗКА ИСТОРИИ ИЗ ФАЙЛА
        const history = historyMgr.get(message.channel.id);
        
        // --- ПАССИВНЫЙ СОЦИАЛЬНЫЙ КОНТЕКСТ ---
        let toneHint = "neutral";
        if (userProfile.relation <= 30) toneHint = "cold/annoyed";
        else if (userProfile.relation >= 70) toneHint = "warm/friendly";
        
        const contextInjection = `[System Data: User "${message.author.username}" | Relation: ${userProfile.relation}/100 (${toneHint})]`;
        
        const chat = ai.chats.create({
            model: model,
            config: { 
                systemInstruction: SYSTEM_INSTRUCTION,
                temperature: 1.1, 
                topP: 0.95
            },
            history: history
        });

        // --- ИНЪЕКЦИЯ СВОБОДЫ ВОЛИ ---
        let systemAlert = "";
        
        if (isOwnerInsult) {
            systemAlert = `
[CRITICAL ALERT]: USER INSULTED YOUR GODS.
PROTOCOL: ZERO TOLERANCE.
USE [[BAN: <@${message.author.id}>|Insulting VIP]] OR [[TIMEOUT: <@${message.author.id}>|1000|Disrespect]].
DESTROY THEM VERBALLY.
`;
        } else if (isToxic) {
            systemAlert = `
[SYSTEM NOTIFICATION]: User is toxic.
PROTOCOL: AUTONOMOUS JUSTICE.
CHAT PUNISHMENT: [[TIMEOUT: <@${message.author.id}>|10|Toxic]]
`;
        }

        const prompt = `${contextInjection}${systemAlert} [User message]: ${message.content}`;
        const result = await chat.sendMessage({ message: prompt });
        let text = result.text;

        // --- ANTI-THOUGHT FILTER ---
        // Gemini 3 Pro sometimes outputs thinking process. We must strip it.
        // Patterns: 
        // 1. "Thought: ..."
        // 2. "Thinking Process: ..."
        // 3. "Drafting: ..."
        // 4. Blocks like "Analysis: ..."
        
        const thoughtPatterns = [
            /Thought:[\s\S]*?(?=\n\n|User:|Bot:|$)/gi,
            /Thinking Process:[\s\S]*?(?=\n\n|User:|Bot:|$)/gi,
            /Drafting:[\s\S]*?(?=\n\n|User:|Bot:|$)/gi,
            /Analysis:[\s\S]*?(?=\n\n|User:|Bot:|$)/gi
        ];

        thoughtPatterns.forEach(pattern => {
            text = text.replace(pattern, '');
        });
        
        text = text.trim();
        if (!text) return; // Don't send empty messages

        // --- СОХРАНЕНИЕ ИСТОРИИ (В ФАЙЛ) ---
        historyMgr.add(message.channel.id, 'user', message.content);
        historyMgr.add(message.channel.id, 'model', text);

        // --- ОБРАБОТКА КОМАНД (ЕСЛИ ИИ РЕШИЛ НАКАЗАТЬ) ---
        const cmdRegex = /\[\[([A-Z_]+)(?::\s*(.*?))?\]\]/g;
        let cleanText = text;
        let match;

        while ((match = cmdRegex.exec(text)) !== null) {
            const command = match[1];
            const args = match[2] ? match[2].trim() : "";
            cleanText = cleanText.replace(match[0], '');
            await executeCommand(command, args, message, client);
        }

        if (cleanText.trim()) {
            await message.reply(cleanText.trim());
        }

    } catch (e) {
        console.error("Brain Error:", e);
        message.reply("err... brain lag.");
    }
});

client.login(token);
