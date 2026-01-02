
const { EmbedBuilder, PermissionsBitField, ChannelType, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const { joinVoiceChannel, getVoiceConnection, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const play = require('play-dl');
const brain = require('./brain');

// Глобальная очередь музыки: guildId -> { player, resource, queue: [], loop: false, volume: 100 }
const musicQueues = new Map();

async function executeCommand(cmd, args, message, client) {
    const { guild, channel, member, author } = message;
    const parts = args.split('|').map(s => s.trim());
    
    // --- ПОИСК ЦЕЛИ (TARGET) ---
    // 1. По упоминанию
    let target = message.mentions.members.first();
    
    // 2. По ID или Имени (если не упомянули)
    if (!target && parts[0]) {
         const clean = parts[0].replace(/[<@!>]/g, '');
         if (clean.match(/^\d+$/)) {
             try { target = await guild.members.fetch(clean).catch(()=>{}); } catch {}
         } else if (parts[0].length > 1) {
             // Поиск по нику
             target = guild.members.cache.find(m => m.user.username.toLowerCase().includes(parts[0].toLowerCase()) || m.displayName.toLowerCase().includes(parts[0].toLowerCase()));
         }
    }
    const selfTarget = target || member;
    
    // Вспомогательная функция для ролей
    const findRole = (query) => {
        if (!query) return null;
        const clean = query.replace(/[<@&>]/g, '');
        return guild.roles.cache.get(clean) || guild.roles.cache.find(r => r.name.toLowerCase() === query.toLowerCase());
    };

    try {
        switch (cmd) {
            // ==========================================
            // НЕЙРОПЛАСТИЧНОСТЬ
            // ==========================================
            case 'LEARN':
                if (target && parts[1]) {
                    brain.learnFact(target.id, parts[1]);
                    console.log(`[LEARNED] ${target.user.tag}: ${parts[1]}`);
                }
                break;
            case 'RELATION':
                if (target) {
                    const delta = parseInt(parts[1]);
                    if (!isNaN(delta)) brain.updateRelation(target.id, delta);
                }
                break;

            // ==========================================
            // МОДЕРАЦИЯ (ПОЛНАЯ)
            // ==========================================
            case 'BAN': 
                if(target?.bannable) {
                    await target.ban({ reason: parts[1] || 'Avrora Justice' });
                    message.react('☠️').catch(()=>{});
                } else message.reply('Не могу забанить (нет прав или роль выше).');
                break;
            case 'UNBAN':
                // parts[0] должен быть ID
                const banId = parts[0].replace(/[<@!>]/g, '');
                if (banId) {
                    await guild.members.unban(banId).then(() => message.react('🔓')).catch(() => message.reply('Пользователь не найден в бане.'));
                }
                break;
            case 'KICK': 
                if(target?.kickable) {
                    await target.kick(parts[1]);
                    message.react('🦶').catch(()=>{});
                }
                break;
            case 'TIMEOUT': 
            case 'MUTE':
                if(target?.moderatable) {
                    const mins = parseInt(parts[1]) || 10;
                    await target.timeout(Math.min(mins, 40320) * 60 * 1000, parts[2] || "Muted");
                    message.react('🤐').catch(()=>{});
                }
                break;
            case 'UNTIMEOUT':
            case 'UNMUTE':
                if(target?.moderatable) {
                    await target.timeout(null);
                    message.react('🗣️').catch(()=>{});
                }
                break;
            case 'PURGE':
                const amount = parseInt(parts[0]) || 5;
                if (amount <= 100) await channel.bulkDelete(amount, true).catch(()=>{});
                break;
            case 'NUKE':
                const pos = channel.position;
                const cloned = await channel.clone();
                await channel.delete();
                await cloned.setPosition(pos);
                cloned.send('https://media.giphy.com/media/HhTXt43pk1I1W/giphy.gif');
                cloned.send('☢️ **КАНАЛ БЫЛ УНИЧТОЖЕН И ПЕРЕСОЗДАН**');
                break;
            case 'LOCK':
                await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false });
                message.react('🔒').catch(()=>{});
                break;
            case 'UNLOCK':
                await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: true });
                message.react('🔓').catch(()=>{});
                break;
            case 'SLOWMODE':
                const secs = parseInt(parts[0]) || 0;
                await channel.setRateLimitPerUser(secs);
                message.react('qc').catch(()=>{});
                break;

            // ==========================================
            // УПРАВЛЕНИЕ РОЛЯМИ (FIXED)
            // ==========================================
            case 'ADDROLE':
                if (target && parts[1]) {
                    const role = findRole(parts[1]);
                    if (role && target.manageable) {
                        await target.roles.add(role);
                        message.react('✅').catch(()=>{});
                    } else message.reply('Роль не найдена или нет прав.');
                }
                break;
            case 'REMOVEROLE':
                if (target && parts[1]) {
                    const role = findRole(parts[1]);
                    if (role && target.manageable) {
                        await target.roles.remove(role);
                        message.react('✅').catch(()=>{});
                    }
                }
                break;
            case 'CREATEROLE':
                // args: Name | ColorHex
                await guild.roles.create({
                    name: parts[0] || 'New Role',
                    color: parts[1] || 'DEFAULT',
                    reason: 'Avrora Command'
                });
                message.react('✨').catch(()=>{});
                break;
            case 'DELETEROLE':
                const dRole = findRole(parts[0]);
                if (dRole) {
                    await dRole.delete();
                    message.react('🗑️').catch(()=>{});
                }
                break;
            case 'ROLEALL':
                const raRole = findRole(parts[0]);
                if (raRole) {
                    message.reply(`Выдаю роль ${raRole.name} всем... (это займет время)`);
                    const members = await guild.members.fetch();
                    members.forEach(m => { if(!m.user.bot) m.roles.add(raRole).catch(()=>{}); });
                }
                break;
            case 'UNROLEALL':
                const urRole = findRole(parts[0]);
                if (urRole) {
                    message.reply(`Снимаю роль ${urRole.name} у всех...`);
                    const members = await guild.members.fetch();
                    members.forEach(m => { if(!m.user.bot) m.roles.remove(urRole).catch(()=>{}); });
                }
                break;

            // ==========================================
            // УПРАВЛЕНИЕ КАНАЛАМИ
            // ==========================================
            case 'CREATECHANNEL':
                await guild.channels.create({ name: parts[0] || 'new-channel', type: ChannelType.GuildText });
                message.react('🔨').catch(()=>{});
                break;
            case 'DELETECHANNEL':
                await channel.delete();
                break;
            case 'RENAME':
                if(parts[0]) await channel.setName(parts[0]);
                break;
            case 'TOPIC':
                if(parts[0]) await channel.setTopic(parts[0]);
                break;

            // ==========================================
            // ТИКЕТЫ
            // ==========================================
            case 'TICKETOPEN':
                const tName = `ticket-${author.username}`;
                const tChan = await guild.channels.create({
                    name: tName,
                    type: ChannelType.GuildText,
                    permissionOverwrites: [
                        { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                        { id: author.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                        { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
                    ]
                });
                message.reply(`Тикет создан: ${tChan}`);
                tChan.send(`Привет, ${author}! Опиши проблему. Админы скоро придут.`);
                break;
            case 'TICKETCLOSE':
                if (channel.name.startsWith('ticket-')) {
                    channel.send('Тикет будет удален через 5 секунд...');
                    setTimeout(() => channel.delete(), 5000);
                } else message.reply('Это не тикет.');
                break;

            // ==========================================
            // МУЗЫКА (EXTENDED)
            // ==========================================
            case 'PLAY':
                if (member.voice.channel && parts[0]) {
                    const query = parts.join(' ');
                    const voiceChannel = member.voice.channel;
                    
                    let connection = getVoiceConnection(guild.id);
                    if (!connection) connection = joinVoiceChannel({ channelId: voiceChannel.id, guildId: guild.id, adapterCreator: guild.voiceAdapterCreator });
                    
                    try {
                        const yt_info = await play.search(query, { limit: 1 });
                        if(yt_info && yt_info.length > 0) {
                            const url = yt_info[0].url;
                            let queueData = musicQueues.get(guild.id);
                            if (!queueData) {
                                queueData = { player: createAudioPlayer(), queue: [], loop: false, connection };
                                musicQueues.set(guild.id, queueData);
                                connection.subscribe(queueData.player);
                                
                                queueData.player.on(AudioPlayerStatus.Idle, () => {
                                    if (queueData.loop && queueData.currentUrl) {
                                         // Loop logic: replay current
                                         playStream(queueData, queueData.currentUrl);
                                    } else if (queueData.queue.length > 0) {
                                        const next = queueData.queue.shift();
                                        playStream(queueData, next.url);
                                    }
                                });
                            }
                            
                            // Если ничего не играет, играем сразу
                            if (queueData.player.state.status !== AudioPlayerStatus.Playing) {
                                await playStream(queueData, url);
                                message.channel.send({ embeds: [new EmbedBuilder().setColor('Purple').setDescription(`🎶 Играет: **${yt_info[0].title}**`)] });
                            } else {
                                queueData.queue.push({ url, title: yt_info[0].title });
                                message.channel.send({ embeds: [new EmbedBuilder().setColor('Purple').setDescription(`📝 Добавлено в очередь: **${yt_info[0].title}**`)] });
                            }
                            queueData.currentUrl = url; // Save for loop
                        } else {
                            message.reply("Ничего не найдено.");
                        }
                    } catch(err) {
                        console.log(err);
                        message.reply("Ошибка.");
                    }
                } else message.reply("Зайди в войс!");
                break;
            case 'SKIP':
                const qSkip = musicQueues.get(guild.id);
                if (qSkip && qSkip.player) qSkip.player.stop();
                message.react('⏭️').catch(()=>{});
                break;
            case 'STOP':
                const qStop = musicQueues.get(guild.id);
                if (qStop) {
                    qStop.queue = [];
                    qStop.player.stop();
                    qStop.connection.destroy();
                    musicQueues.delete(guild.id);
                }
                message.react('🛑').catch(()=>{});
                break;
            case 'PAUSE':
                const qPause = musicQueues.get(guild.id);
                if(qPause) qPause.player.pause();
                break;
            case 'RESUME':
                const qResume = musicQueues.get(guild.id);
                if(qResume) qResume.player.unpause();
                break;
            case 'LOOP':
                const qLoop = musicQueues.get(guild.id);
                if(qLoop) {
                    qLoop.loop = !qLoop.loop;
                    message.reply(`Loop: ${qLoop.loop ? 'ON' : 'OFF'}`);
                }
                break;
            case 'QUEUE':
                const qList = musicQueues.get(guild.id);
                if(qList && qList.queue.length > 0) {
                    const list = qList.queue.map((t, i) => `${i+1}. ${t.title}`).join('\n');
                    message.channel.send({ embeds: [new EmbedBuilder().setTitle("Очередь").setDescription(list.substring(0, 2048))] });
                } else message.reply("Очередь пуста.");
                break;

            // ==========================================
            // ИНФО И УТИЛИТЫ
            // ==========================================
            case 'USERINFO':
                const u = selfTarget.user;
                const emb = new EmbedBuilder()
                    .setColor('Blue')
                    .setTitle(u.tag)
                    .setThumbnail(u.displayAvatarURL())
                    .addFields(
                        { name: 'ID', value: u.id, inline: true },
                        { name: 'Created', value: u.createdAt.toLocaleDateString(), inline: true },
                        { name: 'Joined', value: selfTarget.joinedAt?.toLocaleDateString() || '?', inline: true }
                    );
                message.channel.send({ embeds: [emb] });
                break;
            case 'SERVERINFO':
                const sEmb = new EmbedBuilder()
                    .setColor('Gold')
                    .setTitle(guild.name)
                    .setThumbnail(guild.iconURL())
                    .addFields(
                        { name: 'Owner', value: `<@${guild.ownerId}>`, inline: true },
                        { name: 'Members', value: `${guild.memberCount}`, inline: true },
                        { name: 'Created', value: guild.createdAt.toLocaleDateString(), inline: true }
                    );
                message.channel.send({ embeds: [sEmb] });
                break;
            case 'AVATAR':
                message.channel.send({ embeds: [new EmbedBuilder().setColor('Random').setImage(selfTarget.user.displayAvatarURL({size: 512, dynamic: true}))] });
                break;
            case 'SAY':
                message.delete().catch(()=>{});
                message.channel.send(parts.join(' '));
                break;
            case 'EMBED':
                message.channel.send({ embeds: [new EmbedBuilder().setColor('Random').setTitle(parts[0]||'Title').setDescription(parts[1]||'Text')] });
                break;

            // ==========================================
            // РОЗЫГРЫШИ (SIMPLE)
            // ==========================================
            case 'GSTART':
                // GSTART: PRIZE
                message.channel.send({ 
                    content: '🎉 **GIVEAWAY** 🎉',
                    embeds: [new EmbedBuilder().setColor('Gold').setTitle(parts[0] || 'Prize').setDescription('Нажми на реакцию 🎉 чтобы участвовать!')] 
                }).then(msg => msg.react('🎉'));
                break;

            // ==========================================
            // FUN / MINI-GAMES
            // ==========================================
            case '8BALL':
                const answers = ['Да', 'Нет', 'Возможно', 'Точно нет', 'Бесспорно'];
                message.reply(`🎱 ${answers[Math.floor(Math.random()*answers.length)]}`);
                break;
            case 'COIN':
                message.reply(Math.random() > 0.5 ? '🪙 Орел' : '🪙 Решка');
                break;
            case 'DICE':
                message.reply(`🎲 Выпало: ${Math.floor(Math.random() * 6) + 1}`);
                break;
            case 'SLOTS':
                const slots = ['🍒', '🍋', '🍇', '🍉', '7️⃣'];
                const r1 = slots[Math.floor(Math.random()*slots.length)];
                const r2 = slots[Math.floor(Math.random()*slots.length)];
                const r3 = slots[Math.floor(Math.random()*slots.length)];
                message.reply(`🎰 | ${r1} ${r2} ${r3} | ${(r1===r2 && r2===r3) ? 'WIN!' : 'LOSE'}`);
                break;
            case 'MATH':
                try {
                    // Safety check needed in real prod, but ok for lite demo
                    const res = eval(parts[0].replace(/[^0-9+\-*/().]/g, ''));
                    message.reply(`🔢 Результат: ${res}`);
                } catch { message.reply('Ошибка выражения.'); }
                break;
        }
    } catch (e) {
        console.error("Handler Error:", e.message);
        message.reply(`❌ Ошибка команды: ${e.message}`);
    }
}

// Helper for music
async function playStream(queue, url) {
    const stream = await play.stream(url);
    const resource = createAudioResource(stream.stream, { inputType: stream.type });
    queue.player.play(resource);
}

module.exports = { executeCommand };
