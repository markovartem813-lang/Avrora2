
const fs = require('fs');
const path = './history.json';

// Структура истории: { channelId: [ { role: 'user', parts: [{text: '...'}] } ] }
let historyData = {};

// Загрузка при старте
if (fs.existsSync(path)) {
    try {
        historyData = JSON.parse(fs.readFileSync(path, 'utf8'));
    } catch (e) {
        console.error("Ошибка чтения файла истории:", e);
        historyData = {};
    }
} else {
    fs.writeFileSync(path, '{}');
}

function save() {
    try {
        fs.writeFileSync(path, JSON.stringify(historyData, null, 2));
    } catch (e) {
        console.error("Ошибка записи истории:", e);
    }
}

function get(channelId) {
    return historyData[channelId] || [];
}

function add(channelId, role, text) {
    if (!historyData[channelId]) historyData[channelId] = [];
    
    // Формат Gemini API
    historyData[channelId].push({ role: role, parts: [{ text: text }] });
    
    // ЛИМИТ: 10000 сообщений
    if (historyData[channelId].length > 10000) {
        historyData[channelId] = historyData[channelId].slice(-10000);
    }
    
    save();
}

module.exports = { get, add };
