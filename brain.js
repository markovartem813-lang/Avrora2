
const fs = require('fs');
const path = './brain.json';

// Структура мозга: { userId: { relation: 50, facts: [], username: "", warns: [], inventory: [] } }
let brainData = {};

if (fs.existsSync(path)) {
    try { brainData = JSON.parse(fs.readFileSync(path, 'utf8')); } 
    catch (e) { console.error("Ошибка чтения мозга:", e); brainData = {}; }
} else {
    fs.writeFileSync(path, '{}');
}

function saveBrain() {
    try { fs.writeFileSync(path, JSON.stringify(brainData, null, 2)); } 
    catch (e) { console.error("Ошибка записи мозга:", e); }
}

function getProfile(user) {
    if (!user || !user.id) return null;
    if (!brainData[user.id]) {
        brainData[user.id] = { 
            relation: 50, 
            facts: [], 
            username: user.username,
            warns: [],
            inventory: []
        };
    }
    return brainData[user.id];
}

function updateRelation(userId, delta) {
    if (!brainData[userId]) return 50;
    brainData[userId].relation = Math.max(0, Math.min(100, brainData[userId].relation + delta));
    saveBrain();
    return brainData[userId].relation;
}

function learnFact(userId, fact) {
    if (!brainData[userId]) return;
    if (brainData[userId].facts.includes(fact)) return;
    brainData[userId].facts.push(fact);
    if (brainData[userId].facts.length > 20) brainData[userId].facts.shift();
    saveBrain();
}

function addWarn(userId, reason, moderator) {
    if (!brainData[userId]) return;
    if (!brainData[userId].warns) brainData[userId].warns = [];
    brainData[userId].warns.push({ reason, moderator, date: Date.now() });
    saveBrain();
}

function clearWarns(userId) {
    if (!brainData[userId]) return;
    brainData[userId].warns = [];
    saveBrain();
}

module.exports = { 
    getProfile, updateRelation, learnFact, 
    addWarn, clearWarns, saveBrain 
};
