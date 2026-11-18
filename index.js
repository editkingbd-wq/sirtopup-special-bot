const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');
const http = require('http');
const https = require('https');

// --- আল্ট্রা-সিকিউর গ্লোবাল এরর হ্যান্ডলার (বট ক্রাশ রোধ করতে) ---
process.on('uncaughtException', (err) => {
    console.error('CRITICAL UNCAUGHT EXCEPTION:', err);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('CRITICAL UNHANDLED REJECTION:', reason);
});

// কনফিগারেশন
const BOT_TOKEN = process.env.BOT_TOKEN || '8395471740:AAF-v0dAgc36nL7sb1G5Dy6IzHmsCUlwe80';
const ADMIN_ID = process.env.ADMIN_ID || '5932254012';

// Render URL নির্ধারণ
const RENDER_URL = process.env.RENDER_EXTERNAL_URL || 'https://sirtopup-special-bot-1.onrender.com';
const PORT = process.env.PORT || 3000;
const bot = new Telegraf(BOT_TOKEN);
const DB_FILE = 'database.json';

// --- ফায়ারবেস ডেটাবেস ইউআরএল কনফিগারেশন ---
const FIREBASE_DB_URL = process.env.FIREBASE_DB_URL || 'https://sirtopupspecialbot-default-rtdb.firebaseio.com/';

let cachedDb = { users: {}, prices: { 1: {}, 2: {}, 3: {} }, numbers: {}, orders: {}, allowedUsers: [] };

// এডমিন পেন্ডিং স্টেট ট্র্যাক করার জন্য (ইন্টারেক্টিভ ফুল লিস্ট আপডেটের জন্য)
let adminPriceUpdateSessions = {};

// --- শুধুমাত্র আপনার ওয়েবসাইটের এপিআই দিয়ে UID চেক ফাংশন ---
function checkFreeFireUID(uid) {
    return new Promise((resolve) => {
        const url = `https://akmtopup.com/api/checkuid?uid=${uid}`;
        const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept': 'application/json' }, timeout: 8000 }, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    let nickname = parsed.nickname || parsed.message || parsed.name || parsed.username || parsed.AccountName;
                    if (nickname && nickname.trim() !== '') {
                        resolve(nickname);
                    } else {
                        resolve(`Player (${uid})`);
                    }
                } catch (e) {
                    resolve(`Player (${uid})`);
                }
            });
        });
        req.on('error', () => {
            resolve(`Player (${uid})`);
        });
        req.on('timeout', () => {
            req.destroy();
            resolve(`Player (${uid})`);
        });
    });
}

// --- প্যাকেজ সিরিয়াল ও সঠিক ইমোজি লিস্ট ---
const BD_PACKAGE_ORDER = [
    { name: "Weekly Membership", display: "• Wᴇᴇᴋʟʏ Mᴇᴍʙᴇʀsʜɪ𝗽 💳" },
    { name: "Monthly Membership", display: "• Mᴏɴᴛʜʟʏ Mᴇᴍʙᴇʀsʜɪ𝗽 💳" },
    { name: "Weekly Lite", display: "• Wᴇᴇᴋʟʏ Lɪᴛᴇ 💳" },
    { name: "25 Diamond", display: "• 25 💎 Diamond" },
    { name: "50 Diamond", display: "• 50 💎 Diamond" },
    { name: "100 Diamond", display: "• 100 💎 Diamond" },
    { name: "115 Diamond", display: "• 115 💎 Diamond" },
    { name: "240 Diamond", display: "• 240 💎 Diamond" },
    { name: "355 Diamond", display: "• 355 💎 Diamond" },
    { name: "610 Diamond", display: "• 610 💎 Diamond" },
    { name: "1090 Diamond", display: "• 1090 💎 Diamond" },
    { name: "1240 Diamond", display: "• 1240 💎 Diamond" },
    { name: "2530 Diamond", display: "• 2530 💎 Diamond" },
    { name: "5060 Diamond", display: "• 5060 💎 Diamond" },
    { name: "1 SQUAD 4 BOT", display: "• 1 S𝗤𝗨𝗔𝗗 4 B𝗢𝗧 🤖" },
    { name: "Level Up Package - Level 6", display: "• Lᴇᴠᴇl Uᴘ - Lᴇᴠᴇl 𝟼 💳" },
    { name: "Level Up Package - Level 10", display: "• Lᴇᴠᴇl Uᴘ - Lᴇᴠᴇl 𝟷𝟶 💳" },
    { name: "Level Up Package - Level 15", display: "• Lᴇᴠᴇl Uᴘ - Lᴇᴠᴇl 𝟷𝟻 💳" },
    { name: "Level Up Package - Level 20", display: "• Lᴇᴠᴇl Uᴘ - Lᴇᴠᴇl 𝟸𝟶 💳" },
    { name: "Level Up Package - Level 25", display: "• Lᴇᴠᴇl Uᴘ - Lᴇᴠᴇl 𝟸𝟻 💳" },
    { name: "Level Up Package - Level 30", display: "• Lᴇᴠᴇl Uᴘ - Lᴇᴠᴇl 𝟹𝟶 💳" },
    { name: "100 LIKE", display: "• 100 Lɪᴋᴇ" },
    { name: "200 LIKE", display: "• 200 Lɪᴋᴇ" }
];

const INDO_PACKAGE_ORDER = [
    { name: "Monthly Membership Indo", display: "• Mᴏɴᴛʜʟʏ 💳 Indo" },
    { name: "Weekly Membership Indo", display: "• Wᴇᴇᴋʟʏ 💳 Indo" },
    { name: "5 Diamond Indo", display: "• 5 💎 Diamond Indo" },
    { name: "50 Diamond Indo", display: "• 50 💎 Diamond Indo" },
    { name: "70 Diamond Indo", display: "• 70 💎 Diamond Indo" },
    { name: "140 Diamond Indo", display: "• 140 💎 Diamond Indo" },
    { name: "355 Diamond Indo", display: "• 355 💎 Diamond Indo" },
    { name: "720 Diamond Indo", display: "• 720 💎 Diamond Indo" },
    { name: "7290 Diamond Indo", display: "• 7290 💎 Diamond Indo" },
    { name: "Booyah Pass Indo", display: "• Bᴏᴏʏᴀʜ Pᴀss 💳 Indo" },
    { name: "Level Up Pass [Lv.6] Indo", display: "• Lᴠʟ 𝟼 💳 Indo" },
    { name: "Level Up Pass [Lv.10] Indo", display: "• Lᴠʟ 𝟷𝟶 💳 Indo" },
    { name: "Level Up Pass [Lv.15] Indo", display: "• Lᴠʟ 𝟷𝟻 💳 Indo" },
    { name: "Level Up Pass [Lv.20] Indo", display: "• Lᴠʟ 𝟸𝟶 💳 Indo" },
    { name: "Level Up Pass [Lv.25] Indo", display: "• Lᴠʟ 𝟸𝟻 💳 Indo" },
    { name: "Level Up Pass [Lv.30] Indo", display: "• Lᴠʟ 𝟹𝟶 💳 Indo" }
];

// ডিফল্ট প্রাইস লিস্ট (তিনটি লিস্টের জন্য বেস ডিফল্ট)
const DEFAULT_PRICES = {
    "Weekly Membership": "150৳", "Monthly Membership": "740৳", "Weekly Lite": "39৳",
    "25 Diamond": "20৳", "50 Diamond": "36৳", "100 Diamond": "72৳", "115 Diamond": "79৳",
    "240 Diamond": "157৳", "355 Diamond": "236৳", "610 Diamond": "403৳", "1090 Diamond": "714৳",
    "1240 Diamond": "800৳", "2530 Diamond": "1604৳", "5060 Diamond": "3210৳", "1 SQUAD 4 BOT": "190৳",
    "Level Up Package - Level 6": "39৳", "Level Up Package - Level 10": "66৳", "Level Up Package - Level 15": "66৳",
    "Level Up Package - Level 20": "66৳", "Level Up Package - Level 25": "66৳", "Level Up Package - Level 30": "95৳",
    "100 LIKE": "10৳", "200 LIKE": "19৳", "Monthly Membership Indo": "740৳", "Weekly Membership Indo": "240৳",
    "5 Diamond Indo": "10৳", "50 Diamond Indo": "63৳", "70 Diamond Indo": "82৳", "140 Diamond Indo": "164৳",
    "355 Diamond Indo": "410৳", "720 Diamond Indo": "820৳", "7290 Diamond Indo": "8000৳", "Booyah Pass Indo": "364৳",
    "Level Up Pass [Lv.6] Indo": "88৳", "Level Up Pass [Lv.10] Indo": "77৳", "Level Up Pass [Lv.15] Indo": "77৳",
    "Level Up Pass [Lv.20] Indo": "77৳", "Level Up Pass [Lv.25] Indo": "77৳", "Level Up Pass [Lv.30] Indo": "120৳"
};

// ডাটাবেজে প্রাইস স্ট্রাকচার চেক বা মাইগ্রেট করার ফাংশন
function ensurePricesStructure(pricesObj) {
    if (!pricesObj || typeof pricesObj !== 'object') {
        return { 1: { ...DEFAULT_PRICES }, 2: { ...DEFAULT_PRICES }, 3: { ...DEFAULT_PRICES } };
    }
    if (!pricesObj['1'] && !pricesObj['2'] && !pricesObj['3']) {
        const migrated = { 1: { ...DEFAULT_PRICES }, 2: { ...DEFAULT_PRICES }, 3: { ...DEFAULT_PRICES } };
        for (let k in pricesObj) {
            migrated[1][k] = pricesObj[k];
            migrated[2][k] = pricesObj[k];
            migrated[3][k] = pricesObj[k];
        }
        return migrated;
    }
    
    let formatted = {
        1: pricesObj['1'] || { ...DEFAULT_PRICES },
        2: pricesObj['2'] || { ...DEFAULT_PRICES },
        3: pricesObj['3'] || { ...DEFAULT_PRICES }
    };

    for (let listNum of ['1', '2', '3']) {
        for (let key in DEFAULT_PRICES) {
            if (!formatted[listNum][key]) {
                formatted[listNum][key] = DEFAULT_PRICES[key];
            }
        }
    }
    return formatted;
}

// --- ফায়ারবেস সিঙ্ক ও ডাটাবেজ হ্যান্ডলার ফাংশন (সেফ ও নন-ব্লকিং) ---
function syncDataFromFirebase() {
    if (!FIREBASE_DB_URL) return;
    const cleanBase = FIREBASE_DB_URL.endsWith('/') ? FIREBASE_DB_URL.slice(0, -1) : FIREBASE_DB_URL;
    const url = `${cleanBase}/database.json`;
    
    const req = https.get(url, { timeout: 10000 }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
            try {
                if (data && data !== 'null') {
                    const parsed = JSON.parse(data);
                    if (parsed) {
                        cachedDb.users = parsed.users || {};
                        cachedDb.prices = ensurePricesStructure(parsed.prices);
                        cachedDb.numbers = parsed.numbers || {};
                        cachedDb.orders = parsed.orders || {};
                        cachedDb.allowedUsers = parsed.allowedUsers || [];
                        
                        fs.writeFileSync(DB_FILE, JSON.stringify(cachedDb, null, 2));
                        console.log('🔄 Data successfully synced from Firebase to Local!');
                    }
                }
            } catch (e) {
                console.error('Firebase Sync Parse Error:', e);
            }
        });
    });

    req.on('error', (err) => {
        console.error('Firebase Sync Network Error (Ignored):', err.message);
    });

    req.on('timeout', () => {
        req.destroy();
        console.error('Firebase Sync Timeout');
    });
}

function loadDatabase() {
    try {
        if (fs.existsSync(DB_FILE)) {
            const data = fs.readFileSync(DB_FILE, 'utf8');
            if (data.trim() !== '') {
                const parsed = JSON.parse(data);
                cachedDb.users = parsed.users || {};
                cachedDb.prices = ensurePricesStructure(parsed.prices);
                cachedDb.numbers = parsed.numbers || {};
                cachedDb.orders = parsed.orders || {};
                cachedDb.allowedUsers = parsed.allowedUsers || [];
            }
        }
    } catch (e) {}
    
    cachedDb.prices = ensurePricesStructure(cachedDb.prices);
    return cachedDb;
}

// ফায়ারবেসের নিষিদ্ধ ক্যারেক্টার ক্লিন করার ফাংশন
function sanitizeKeys(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeKeys(item));
    }
    const sanitized = {};
    for (let key of Object.keys(obj)) {
        let cleanKey = key.replace(/[.#$\[\]]/g, '_');
        sanitized[cleanKey] = sanitizeKeys(obj[key]);
    }
    return sanitized;
}

function saveDatabase(data) {
    cachedDb = data;
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('DB Local Save Error:', e);
    }

    if (!FIREBASE_DB_URL) return;
    
    setImmediate(() => {
        try {
            const sanitizedData = sanitizeKeys(data);
            const dataString = JSON.stringify(sanitizedData);
            
            const cleanBase = FIREBASE_DB_URL.endsWith('/') ? FIREBASE_DB_URL.slice(0, -1) : FIREBASE_DB_URL;
            const targetUrl = `${cleanBase}/database.json`;
            const dbUrl = new URL(targetUrl);

            const reqOptions = {
                hostname: dbUrl.hostname,
                path: dbUrl.pathname + dbUrl.search,
                method: 'PUT',
                timeout: 10000,
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(dataString)
                }
            };

            const req = https.request(reqOptions, (res) => {
                let responseBody = '';
                res.on('data', (chunk) => { responseBody += chunk; });
                res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        console.log('✅ Successfully saved to Firebase!');
                    } else {
                        console.error(`❌ Firebase Save Failed! Status: ${res.statusCode}`);
                    }
                });
            });

            req.on('error', (err) => {
                console.error('❌ Firebase Request Error (Ignored):', err.message);
            });

            req.on('timeout', () => {
                req.destroy();
                console.error('❌ Firebase Save Timeout');
            });

            req.write(dataString);
            req.end();
        } catch (err) {
            console.error('Firebase Background Save Error:', err);
        }
    });
}

syncDataFromFirebase();
setInterval(syncDataFromFirebase, 5 * 60 * 1000);

// রিয়েল-টাইম বাংলাদেশি ফরম্যাটেড ডেট ও টাইম জেনারেট করার হেল্পার ফাংশন
function getFormattedDateTime(timestamp = Date.now()) {
    const d = new Date(timestamp);
    return d.toLocaleString('en-GB', {
        timeZone: 'Asia/Dhaka',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
}

// ইউজারের জন্য নির্দিষ্ট প্রাইস লিস্ট নেওয়ার হেল্পার ফাংশন (ডিফল্ট List 3)
function getUserPriceList(userId) {
    const db = loadDatabase();
    if (db.users && db.users[userId] && db.users[userId].priceList) {
        const listNum = db.users[userId].priceList.toString();
        if (db.prices[listNum]) {
            return db.prices[listNum];
        }
    }
    return db.prices['3'] || DEFAULT_PRICES;
}

// --- 🎯 অত্যন্ত নিখুঁত ও ফুলপ্রুফ প্যাকেজ পার্সিং ও ম্যাচিং লজিক ---
function identifyPackageKey(rawName) {
    const lowerRaw = rawName.toLowerCase();
    const clean = lowerRaw
        .replace(/[𝕨𝘄𝗐𝗐]/g, 'w').replace(/[𝚎𝗲𝘦𝘦]/g, 'e')
        .replace(/[𝚔𝚔𝚔𝚔]/g, 'k').replace(/[𝚕𝚕𝚕𝚕]/g, 'l').replace(/[𝚢𝚢𝚢𝚢]/g, 'y')
        .replace(/[𝚖𝗺𝗺𝗺]/g, 'm').replace(/[𝗼𝗼𝗼𝗼]/g, 'o').replace(/[𝗻𝗻𝗻𝗻]/g, 'n')
        .replace(/[𝘁𝘁𝘁𝘁]/g, 't').replace(/[𝚑𝚑𝚑𝚑]/g, 'h').replace(/[𝗽𝗽𝗽𝗽]/g, 'p')
        .replace(/[^a-z0-9]/g, '');

    // প্রথমে কড়াভাবে চেক করবো লাইনে বা প্যাকেজ নামে 'indo' বা 'indonesia' শব্দ আছে কিনা
    const isIndo = lowerRaw.includes('indo') || clean.includes('indo');

    if (isIndo) {
        if (clean.includes('monthly')) return "Monthly Membership Indo";
        if (clean.includes('weekly')) return "Weekly Membership Indo";
        if (clean.includes('booyah')) return "Booyah Pass Indo";
        if (clean.includes('level') || clean.includes('lvl')) {
            if (clean.includes('30')) return "Level Up Pass [Lv.30] Indo";
            if (clean.includes('25')) return "Level Up Pass [Lv.25] Indo";
            if (clean.includes('20')) return "Level Up Pass [Lv.20] Indo";
            if (clean.includes('15')) return "Level Up Pass [Lv.15] Indo";
            if (clean.includes('10')) return "Level Up Pass [Lv.10] Indo";
            if (clean.includes('6')) return "Level Up Pass [Lv.6] Indo";
        }
        const nums = clean.match(/\d+/);
        if (nums) {
            const nStr = nums[0];
            for (const item of INDO_PACKAGE_ORDER) {
                if (item.name.toLowerCase().includes(nStr + ' diamond')) return item.name;
            }
            for (const item of INDO_PACKAGE_ORDER) {
                if (item.name.toLowerCase().includes(nStr)) return item.name;
            }
        }
        for (const item of INDO_PACKAGE_ORDER) {
            const targetClean = item.name.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (targetClean === clean || clean === targetClean) return item.name;
        }
    } else {
        // বাংলাদেশ বা জেনারেল প্যাকেজ ম্যাচিং (যেখানে 'indo' নেই)
        if (clean.includes('weeklylite') || clean.includes('lite')) return "Weekly Lite";
        if (clean.includes('monthly')) return "Monthly Membership";
        if (clean.includes('weekly')) return "Weekly Membership";
        if (clean.includes('squad') || clean.includes('bot')) return "1 SQUAD 4 BOT";
        if (clean.includes('like')) {
            if (clean.includes('200')) return "200 LIKE";
            return "100 LIKE";
        }
        if (clean.includes('level') || clean.includes('lvl') || clean.includes('levelup')) {
            if (clean.includes('30')) return "Level Up Package - Level 30";
            if (clean.includes('25')) return "Level Up Package - Level 25";
            if (clean.includes('20')) return "Level Up Package - Level 20";
            if (clean.includes('15')) return "Level Up Package - Level 15";
            if (clean.includes('10')) return "Level Up Package - Level 10";
            if (clean.includes('6')) return "Level Up Package - Level 6";
        }
        
        const nums = clean.match(/\d+/);
        if (nums) {
            const nStr = nums[0];
            const exactSearchStr = nStr + 'diamond';
            for (const item of BD_PACKAGE_ORDER) {
                const itemClean = item.name.toLowerCase().replace(/[^a-z0-9]/g, '');
                if (itemClean === exactSearchStr) return item.name;
            }
            for (const item of BD_PACKAGE_ORDER) {
                const itemClean = item.name.toLowerCase().replace(/[^a-z0-9]/g, '');
                if (itemClean.startsWith(nStr)) return item.name;
            }
        }

        for (const item of BD_PACKAGE_ORDER) {
            const targetClean = item.name.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (targetClean === clean) return item.name;
        }
    }
    return null;
}

// --- হোয়াইটলিস্ট ও সিকিউরিটি মিডলওয়্যার (ডিফল্ট List 3 অ্যাসাইনমেন্ট) ---
bot.use(async (ctx, next) => {
    try {
        if (ctx && ctx.from) {
            const db = loadDatabase();
            const userId = ctx.from.id.toString();
            const firstName = ctx.from.first_name || 'গ্রাহক';
            const username = ctx.from.username ? `@${ctx.from.username}` : 'N/A';
            if (!db.users) db.users = {};
            if (userId === ADMIN_ID || (db.allowedUsers && db.allowedUsers.includes(userId))) {
                if (!db.users[userId]) {
                    db.users[userId] = { 
                        balance: 0, 
                        name: firstName, 
                        username: username, 
                        priceList: '3', // ডিফল্টভাবে লিস্ট ৩ অ্যাসাইন হবে
                        joinedAt: Date.now(),
                        purchases: {},
                        totalSpent: 0
                    };
                } else {
                    db.users[userId].name = firstName;
                    db.users[userId].username = username;
                    if (!db.users[userId].priceList) db.users[userId].priceList = '3';
                    if (!db.users[userId].joinedAt) db.users[userId].joinedAt = Date.now();
                    if (!db.users[userId].purchases) db.users[userId].purchases = {};
                    if (db.users[userId].totalSpent === undefined) db.users[userId].totalSpent = 0;
                }
                saveDatabase(db);
            }

            if (userId === ADMIN_ID && ctx.message && ctx.message.text && !ctx.message.text.startsWith('/')) {
                if (adminPriceUpdateSessions[ADMIN_ID]) {
                    const targetListNum = adminPriceUpdateSessions[ADMIN_ID];
                    delete adminPriceUpdateSessions[ADMIN_ID];

                    const fullText = ctx.message.text;
                    const lines = fullText.split('\n');
                    let updatedCount = 0;

                    db.prices = ensurePricesStructure(db.prices);
                    
                    // সম্পূর্ণ নতুন ফ্রেশ লিস্ট ইনিশিয়ালাইজ করে পুরোনো ডেটা পুরোপুরি ওভাররাইট করার জন্য
                    db.prices[targetListNum] = { ...DEFAULT_PRICES };

                    for (const line of lines) {
                        const trimmedLine = line.trim();
                        if (!trimmedLine) continue;
                        if (trimmedLine.includes('TOPUP LIST') || trimmedLine.includes('অর্ডার করার নিয়ম') || trimmedLine.startsWith('🛒') || trimmedLine.startsWith('🔹') || trimmedLine.startsWith('✨') || trimmedLine.startsWith('🇮🇩') || trimmedLine.startsWith('🇧🇩') || trimmedLine.startsWith('➡️')) {
                            continue;
                        }

                        const parts = trimmedLine.split(/(?:[—–-]{1,2}|\u27a2|->|=>|\u2794|\s{2,})/);
                        if (parts.length >= 2) {
                            let rawPkg = parts[0].replace(/^[•\-\*🔹💎💳\s]+/, '').trim();
                            let rawPrice = parts[parts.length - 1].trim();

                            const matchedKey = identifyPackageKey(rawPkg);
                            if (matchedKey) {
                                db.prices[targetListNum][matchedKey] = rawPrice;
                                updatedCount++;
                            }
                        } else {
                            const allValidKeys = [...BD_PACKAGE_ORDER.map(p => p.name), ...INDO_PACKAGE_ORDER.map(p => p.name)];
                            for (const kName of allValidKeys) {
                                if (trimmedLine.toLowerCase().includes(kName.toLowerCase())) {
                                    const priceMatch = trimmedLine.match(/(\d+\s*(?:৳|tk|BDT)?)/gi);
                                    if (priceMatch && priceMatch.length > 0) {
                                        const extractedPrice = priceMatch[priceMatch.length - 1].trim();
                                        db.prices[targetListNum][kName] = extractedPrice;
                                        updatedCount++;
                                    }
                                }
                            }
                        }
                    }

                    saveDatabase(db);
                    return ctx.reply(
                        `✅ **List ${targetListNum} সফলভাবে আপডেট করা হয়েছে!**\n\n` +
                        `📊 মোট \`${updatedCount}\` টি আইটেমের প্রাইস অটো-পার্স ও আপডেট করা হয়েছে।`,
                        { parse_mode: 'Markdown' }
                    );
                }
            }

            if (userId === ADMIN_ID && ctx.message && ctx.message.reply_to_message) {
                const replyMsg = ctx.message.reply_to_message;
                let targetUserId = null;
                const textToSearch = replyMsg.text || replyMsg.caption || '';
                const match = textToSearch.match(/🆔 (?:ইউজার আইডি|User ID):\s*`?(\d+)`?/i);
                if (match && match[1]) {
                    targetUserId = match[1];
                }
                if (targetUserId) {
                    if (ctx.message.text && !ctx.message.text.startsWith('/')) {
                        await bot.telegram.sendMessage(targetUserId, `💬 **অ্যাডমিন রিপ্লাই:**\n\n${ctx.message.text}`, { parse_mode: 'Markdown' });
                        return ctx.reply(`✅ মেসেজটি সফলভাবে কাস্টমারের কাছে পাঠানো হয়েছে! (\`${targetUserId}\`)`, { parse_mode: 'Markdown' });
                    } else if (ctx.message.photo) {
                        const photoId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
                        const caption = ctx.message.caption ? `💬 **অ্যাডমিন রিপ্লাই:**\n\n${ctx.message.caption}` : '💬 **অ্যাডমিন একটি ছবি পাঠিয়েছেন।**';
                        await bot.telegram.sendPhoto(targetUserId, photoId, { caption: caption, parse_mode: 'Markdown' });
                        return ctx.reply(`✅ ছবিটি সফলভাবে কাস্টমারের কাছে পাঠানো হয়েছে! (\`${targetUserId}\`)`, { parse_mode: 'Markdown' });
                    }
                }
            }
            if (userId !== ADMIN_ID) {
                if (!db.allowedUsers || !db.allowedUsers.includes(userId)) {
                    return ctx.reply('⛔ দুঃখিত! আপনার টেলিগ্রাম আইডিটি এই বট ব্যবহারের জন্য অনুমোদিত নয়। অনুগ্রহ করে অ্যাডমিনের কাছ থেকে এক্সেস নিয়ে নিন।');
                }
            }
            if (userId !== ADMIN_ID && ctx.message && !ctx.message.text?.match(/^sverify/i)) {
                const hasPhoto = ctx.message.photo && ctx.message.photo.length > 0;
                const captionText = ctx.message.caption ? `\n📝 ক্যাপশন: "${ctx.message.caption}"` : '';
                if (hasPhoto) {
                    const photoFileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
                    const captionMsg = `📷 **কাস্টমার ছবি পাঠিয়েছে!**\n\n👤 নাম: ${firstName}\n🔹 ইউজারনেম: ${username}\n🆔 ইউজার আইডি: \`${userId}\`${captionText}`;
                    await bot.telegram.sendPhoto(ADMIN_ID, photoFileId, { caption: captionMsg, parse_mode: 'Markdown' }).catch(err => console.error('Failed to forward photo:', err));
                } else if (ctx.message.text) {
                    const forwardText = `💬 **কাস্টমারের মেসেজ এসেছে!**\n\n👤 নাম: ${firstName}\n🔹 ইউজারনেম: ${username}\n🆔 ইউজার আইডি: \`${userId}\`\n\n✉️ মেসেজ: "${ctx.message.text}"`;
                    await bot.telegram.sendMessage(ADMIN_ID, forwardText, { parse_mode: 'Markdown' })
                        .catch(err => console.error('Failed to forward message:', err));
                }
            }
        }
        await next();
    } catch (err) {
        console.error('Middleware Error:', err);
    }
});

// বট স্টার্ট
bot.start((ctx) => {
    return ctx.reply('✨ **SIRTOPUP Special Customer Bot**-এ আপনাকে স্বাগতম!\n\nসব কমান্ড দেখতে `stp` লিখুন।', { parse_mode: 'Markdown' }).catch(()=>{});
});

// কাস্টমার কমান্ড: stp (মেনু)
bot.hears(/^stp$/i, (ctx) => {
    return ctx.reply(
        `📜 **বটের সকল কমান্ড ও নির্দেশিকা:**\n\n` +
        `• \`srate\` - প্যাকেজ ও দামের তালিকা দেখুন\n` +
        `• \`snumber\` - পেমেন্ট নম্বর দেখুন\n` +
        `• \`sbalance\` - আপনার বর্তমান ব্যালেন্স দেখুন\n` +
        `• \`spaid\` - আপনার লাইফটাইম পারচেস হিস্ট্রি দেখুন\n` +
        `• \`stp [Player_ID] [প্যাকেজ]\` - BD অটো অর্ডার\n` +
        `• \`indostp [Player_ID] [প্যাকেজ]\` - Indo অর্ডার\n` +
        `• \`sverify [TrxID]\` - পেমেন্ট ভেরিফাই করুন`,
        { parse_mode: 'Markdown' }
    ).catch(()=>{});
});

// --- SPAID হিস্ট্রি জেনারেটর ফাংশন ---
function generatePurchaseHistoryText(targetUserObj) {
    const name = targetUserObj.name || 'গ্রাহক';
    const username = targetUserObj.username || 'N/A';
    const userId = targetUserObj.userId || 'N/A';
    const joinedDateStr = targetUserObj.joinedAt ? getFormattedDateTime(targetUserObj.joinedAt) : 'N/A';
    const purchases = targetUserObj.purchases || {};
    const totalSpent = targetUserObj.totalSpent || 0;

    let bdMainText = "";
    for(let i = 0; i < 14; i++) {
        let item = BD_PACKAGE_ORDER[i];
        let count = purchases[item.name] || 0;
        bdMainText += `${item.display.padEnd(28, ' ')} ➪ × ${count}\n`;
    }

    let lvlUpText = "";
    for(let i = 15; i <= 20; i++) {
        let item = BD_PACKAGE_ORDER[i];
        let count = purchases[item.name] || 0;
        lvlUpText += `${item.display.padEnd(28, ' ')} ➪ × ${count}\n`;
    }

    let likeText = "";
    for(let i = 21; i < BD_PACKAGE_ORDER.length; i++) {
        let item = BD_PACKAGE_ORDER[i];
        let count = purchases[item.name] || 0;
        likeText += `${item.display.padEnd(28, ' ')} ➪ × ${count}\n`;
    }

    let message = "```💳 ✨ 𝑷𝑼𝑹𝑪𝑯𝑨𝑺𝑬 𝑯𝑰𝑺𝑻𝑶𝑹𝒀 ✨ 💳\n";
    message += "✨─────────────────────────────────────✨\n\n";
    message += `👤 Name       : ${name}\n`;
    message += `🔹 Username   : ${username}\n`;
    message += `🆔 User ID    : \`${userId}\`\n`;
    message += `📅 Joined Date: ${joinedDateStr}\n\n`;
    message += "🇧🇩 B𝗔𝗡𝗚𝗟𝗔𝗗𝗘𝗦𝗛 P𝗨𝗥𝗖𝗛𝗔𝗦𝗘𝗦:\n";
    message += "✨─────────────────────────────────────✨\n";
    message += bdMainText;
    message += "\n✦ ──────────────────────✦\n";
    message += "⚡ Lᴇᴠᴇl Uᴘ Pᴀss\n";
    message += "✦ ──────────────────────✦\n";
    message += lvlUpText;
    message += "\n✦ ──────────────────────✦\n";
    message += "(👍ᵔᴥᵔ)👍 FF Lɪᴋᴇ\n";
    message += "✦ ──────────────────────✦\n";
    message += likeText;
    message += "\n───────────────୨ৎ─────────\n";
    message += `💸 TOTAL BDT SPENT : ${totalSpent.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BDT\n`;
    message += "───────────────୨ৎ─────────\n";
    message += "M𝗮𝗻𝗮𝗴𝗲𝗱 𝗯𝘆 : S𝗜𝗥 T𝗼𝗽𝘂𝗽™```";

    return message;
}

// --- spaid কমান্ড ---
bot.hears(/^spaid(?:\s+(\d+))?$/i, async (ctx) => {
    try {
        const senderId = ctx.from.id.toString();
        const argUserId = ctx.match[1];
        const db = loadDatabase();

        let targetId = senderId;
        if (argUserId) {
            if (senderId !== ADMIN_ID) {
                return ctx.reply('⚠️ শুধুমাত্র অ্যাডমিন অন্য ইউজারের হিস্ট্রি দেখতে পারবেন!');
            }
            targetId = argUserId.trim();
        }

        if (!db.users || !db.users[targetId]) {
            return ctx.reply('❌ এই ইউজারের কোনো পারচেস হিস্ট্রি ডেটাবেজে পাওয়া যায়নি।', { parse_mode: 'Markdown' });
        }

        const userData = db.users[targetId];
        userData.userId = targetId;

        const historyMessage = generatePurchaseHistoryText(userData);
        return ctx.reply(historyMessage, { parse_mode: 'Markdown' }).catch(() => {});
    } catch (e) {
        console.error('Spaid Command Error:', e);
        return ctx.reply('❌ হিস্ট্রি লোড করতে সমস্যা হয়েছে।');
    }
});

// srate কমান্ড (ইউজারের নিজস্ব অ্যাসাইনড লিস্ট অনুযায়ী শো করবে)
bot.hears(/^srate$/i, (ctx) => {
    try {
        const userId = ctx.from.id.toString();
        const db = loadDatabase();
        const userObj = db.users && db.users[userId] ? db.users[userId] : {};
        const assignedListNum = userObj.priceList || '3'; // ডিফল্ট লিস্ট ৩
        const prices = getUserPriceList(userId);
        
        let message = "```💳 S𝗜𝗥 T𝗼𝗽𝘂𝗽 L𝗶𝘀𝘁 " + assignedListNum + " P𝗿𝗶𝗰𝗲 L𝗶𝘀𝘁..♡\n";
        message += "✨─────────────────────────────────────✨\n\n";
        message += "🇧🇩 B𝗔𝗡𝗚𝗟𝗔𝗗𝗘𝗦𝗛 U𝗜𝗗 T𝗢𝗣𝗨𝗣 L𝗜𝗦𝗧 💎\n";
        message += "✨─────────────────────────────────────✨\n\n";

        for(let i = 0; i < 3; i++) {
            let item = BD_PACKAGE_ORDER[i];
            let price = prices[item.name] || 'নিয়মিত আপডেট';
            message += `${item.display.padEnd(28, ' ')} ➪ ${price}\n`;
        }

        message += "\n";

        for(let i = 3; i < 14; i++) {
            let item = BD_PACKAGE_ORDER[i];
            let price = prices[item.name] || 'নিয়মিত আপডেট';
            message += `${item.display.padEnd(28, ' ')} ➪ ${price}\n`;
        }

        message += "\n✦ ──────────────────────✦\n";
        message += "⚡ Lᴇᴠᴇl Uᴘ Pᴀss\n";
        message += "✦ ──────────────────────✦\n";
        
        for(let i = 15; i <= 20; i++) {
            let item = BD_PACKAGE_ORDER[i];
            let price = prices[item.name] || 'নিয়মিত আপডেট';
            message += `${item.display.padEnd(28, ' ')} ➪ ${price}\n`;
        }

        message += "\n✦ ──────────────✦\n";
        message += "(👍ᵔᴥᵔ)👍 FF Lɪᴋᴇ\n";
        message += "✦ ──────────────✦\n";
        
        for(let i = 21; i < BD_PACKAGE_ORDER.length; i++) {
            let item = BD_PACKAGE_ORDER[i];
            let price = prices[item.name] || 'নিয়মিত আপডেট';
            message += `${item.display.padEnd(28, ' ')} ➪ ${price}\n`;
        }

        message += "\n✦ ──────────────────────✦\n";
        message += "🤖 Gᴜɪʟᴅ Gʟᴏʀʏ Bᴏ𝘁\n";
        message += "✦ ──────────────────────✦\n";
        let guildItem = BD_PACKAGE_ORDER[14];
        let guildPrice = prices[guildItem.name] || 'নিয়মিত আপডেট';
        message += `${guildItem.display.padEnd(28, ' ')} ➪ ${guildPrice}\n\n`;

        message += "✨─────────────────────────────────────✨\n";
        message += "🇮🇩 I𝗡𝗗𝗢𝗡𝗘𝗦𝗜𝗔 T𝗢𝗣𝗨𝗣 L𝗜𝗦𝗧 💎\n";
        message += "✨─────────────────────────────────────✨\n\n";

        for(let i = 0; i < 2; i++) {
            let item = INDO_PACKAGE_ORDER[i];
            let price = prices[item.name] || 'নিয়মিত আপডেট';
            message += `${item.display.padEnd(28, ' ')} ➪ ${price}\n`;
        }

        message += "\n";

        for(let i = 2; i < 9; i++) {
            let item = INDO_PACKAGE_ORDER[i];
            let price = prices[item.name] || 'নিয়মিত আপডেট';
            message += `${item.display.padEnd(28, ' ')} ➪ ${price}\n`;
        }

        message += "\n✦ ──────────────────────✦\n";
        message += "⚡ Iɴᴅᴏ Lᴇᴠᴇl Uᴘ Pᴀss\n";
        message += "✦ ──────────────────────✦\n";
        
        for(let i = 10; i < INDO_PACKAGE_ORDER.length; i++) {
            let item = INDO_PACKAGE_ORDER[i];
            let price = prices[item.name] || 'নিয়মিত আপডেট';
            message += `${item.display.padEnd(28, ' ')} ➪ ${price}\n`;
        }

        message += "\n✦ ──────────────✦\n";
        message += "🎟️ Bᴏᴏʏᴀʜ Pᴀss\n";
        message += "✦ ──────────────✦\n";
        let booyahItem = INDO_PACKAGE_ORDER[9];
        let booyahPrice = prices[booyahItem.name] || 'নিয়মিত আপডেট';
        message += `${booyahItem.display.padEnd(28, ' ')} ➪ ${booyahPrice}\n\n`;

        message += "───────────────୨ৎ─────────\n";
        message += "🛒 অর্ডার করার নিয়ম:\n";
        message += "🔹 BD Order: stp [Player_ID] [Package]\n";
        message += "🔹 Indo Order: indostp [Player_ID] [Package]\n";
        message += "───────────────୨ৎ─────────\n";
        message += "M𝗮𝗻𝗮𝗴𝗲𝗱 𝗯𝘆 : S𝗜𝗥 T𝗼𝗽𝘂𝗽™```";

        return ctx.reply(message, { parse_mode: 'Markdown' }).catch(() => {});
    } catch (e) {
        console.error('Srate Error:', e);
    }
});

// snumber
bot.hears(/^snumber$/i, (ctx) => {
    try {
        const db = loadDatabase();
        const num = db.numbers || {};
        const bkashNum = num.bkash || '01XXXXXXXXX';
        const nagadNum = num.nagad || '01XXXXXXXXX';
        const rocketNum = num.rocket || '01XXXXXXXXX';

        let message = `✨ **FLEX** ✨\n`;
        message += `➯ **PAYMENT NUMBERS ✔️**\n`;
        message += `━━━━━━━━━━━━━━━━━━━\n\n`;
        message += `➯ **bKash (Personal):** \`${bkashNum}\`\n\n`;
        message += `➯ **NAGAD (Personal):** \`${nagadNum}\`\n\n`;
        message += `➯ **ROCKET (Personal):** \`${rocketNum}\`\n\n`;
        message += `━━━━━━━━━━━━━━━━━━━\n`;
        message += `➥ টাকা পাঠানোর পর \`sverify transactionid\` পাঠাবেন। (^~^)\n\n`;
        message += `📢 **গুরুত্বপূর্ণ নোটিশ** 📢\n`;
        message += `⚠️ সর্বনিম্ন পেমেন্ট নির্দেশিকা:\n`;
        message += `আপনি বিকাশ, নগদ কিংবা রকেট—যেকোনো মাধ্যমেই পেমেন্ট করুন না কেন, সর্বনিম্ন ৬,০০০ টাকার নিচে অ্যাড মানি করলে আপনার অ্যাকাউন্টে ব্যালেন্স যোগ করা হবে না。\n\n`;
        message += `⚠️ বিশেষ দ্রষ্টব্য: অ্যাডমিনের সাথে সরাসরি কথা বলে ব্যালেন্স অ্যাড করাতে চাইলে অবশ্যই চার্জ বাবদ ৫০ টাকা কেটে নেওয়া হবে।\n\n`;
        message += `Powered by : SIR TOPUP™`;

        return ctx.reply(message, { parse_mode: 'Markdown' }).catch(()=>{});
    } catch(e) {
        console.error('Snumber Error:', e);
    }
});

// sbalance
bot.hears(/^sbalance$/i, (ctx) => {
    try {
        const db = loadDatabase();
        const userId = ctx.from.id.toString();
        const user = db.users[userId] || { balance: 0, name: ctx.from.first_name || 'গ্রাহক', username: ctx.from.username ? `@${ctx.from.username}` : 'N/A', priceList: '3' };
        
        const balanceText = `♡ Nᴀᴍᴇ          : ${user.name}\n\n` +
                            `✦ Usᴇʀɴᴀᴍᴇ   : ${user.username}\n` +
                            `✦ Uꜱᴇʀ ID  		 : \`${userId}\`\n` +
                            `✦ Pʀɪᴄᴇ Lɪsᴛ : List ${user.priceList || '3'}\n` +
                            `✦ BᴀʟᴀɴᴄE  	 : ${user.balance} BDT`;
                            
        return ctx.reply(balanceText, { parse_mode: 'Markdown' }).catch(()=>{});
    } catch(e) {
        console.error('Sbalance Error:', e);
    }
});

// sverify
bot.hears(/^sverify\s*(.*)$/i, async (ctx) => {
    try {
        const trxId = ctx.match[1].trim();
        const userId = ctx.from.id.toString();
        const username = ctx.from.username ? `@${ctx.from.username}` : 'N/A';
        const name = ctx.from.first_name || 'গ্রাহক';
        if (!trxId) {
            return ctx.reply('❌ সঠিক নিয়মে TrxID সহ লিখুন。\nউদাহরণ: `sverify 8XJ92KLM`', { parse_mode: 'Markdown' });
        }
        await ctx.reply(`🔍 **পেমেন্ট ভেরিফিকেশন ম্যানুয়ালি সাবমিট হয়েছে!**\n\n🆔 TrxID: \`${trxId}\`\n⏳ অ্যাডমিন খুব শীঘ্রই পেমেন্ট চেক করে আপনার ব্যালেন্স আপডেট করে দেবেন।`, { parse_mode: 'Markdown' });
        const adminMsg = `🔍 **নতুন পেমেন্ট ভেরিফাই রিকোয়েস্ট (ম্যানুয়াল)!** 🔍\n\n` +
                         `👤 নাম: ${name}\n` +
                         `🔹 ইউজারনেম: ${username}\n` +
                         `🆔 ইউজার আইডি: \`${userId}\`\n` +
                         `🧾 TrxID: \`${trxId}\``;
        await bot.telegram.sendMessage(ADMIN_ID, adminMsg, { parse_mode: 'Markdown' });
    } catch (e) {
        console.error('Sverify Error:', e);
    }
});

// --- প্যাকেজ ম্যাচিং (BD) ---
function matchBDPackage(input) {
    const cleanInput = input.toLowerCase()
        .replace(/[𝕨𝘄𝗐𝗐]/g, 'w').replace(/[𝚎𝗲𝘦𝘦]/g, 'e')
        .replace(/[𝚔𝚔𝚔𝚔]/g, 'k').replace(/[𝚕𝚕𝚕𝚕]/g, 'l').replace(/[𝚢𝚢𝚢𝚢]/g, 'y')
        .replace(/[𝚖𝗺𝗺𝗺]/g, 'm').replace(/[𝗼𝗼𝗼𝗼]/g, 'o').replace(/[𝗻𝗻𝗻𝗻]/g, 'n')
        .replace(/[𝘁𝘁𝘁𝘁]/g, 't').replace(/[𝚑𝚑𝚑𝚑]/g, 'h').replace(/[𝗽𝗽𝗽𝗽]/g, 'p')
        .replace(/[^a-z0-9]/g, '');
    
    for (const item of BD_PACKAGE_ORDER) {
        const dbNameClean = item.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (dbNameClean === cleanInput) return item.name;
    }
    for (const item of BD_PACKAGE_ORDER) {
        const dbNameClean = item.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (cleanInput.includes(dbNameClean)) return item.name;
    }

    if (cleanInput.includes('weeklylite') || cleanInput.includes('lite')) return "Weekly Lite";
    if (cleanInput.includes('weekly')) return "Weekly Membership";
    if (cleanInput.includes('monthly')) return "Monthly Membership";
    if (cleanInput.includes('squad') || clean.includes('bot')) return "1 SQUAD 4 BOT";
    if (cleanInput.includes('like')) {
        if (cleanInput.includes('200')) return "200 LIKE";
        return "100 LIKE";
    }
    if (cleanInput.includes('levelup') || cleanInput.includes('level') || cleanInput.includes('lvl')) {
        if (cleanInput.includes('30')) return "Level Up Package - Level 30";
        if (cleanInput.includes('25')) return "Level Up Package - Level 25";
        if (cleanInput.includes('20')) return "Level Up Package - Level 20";
        if (cleanInput.includes('15')) return "Level Up Package - Level 15";
        if (cleanInput.includes('10')) return "Level Up Package - Level 10";
        if (cleanInput.includes('6')) return "Level Up Package - Level 6";
    }

    const numbers = input.match(/\d+/);
    if (numbers) {
        const numStr = numbers[0];
        for (const item of BD_PACKAGE_ORDER) {
            if (item.name.toLowerCase().startsWith(numStr + ' diamond') || item.name.toLowerCase() === numStr + ' diamond') {
                return item.name;
            }
        }
    }
    return null;
}

// --- প্যাকেজ ম্যাচিং (Indo) ---
function matchIndoPackage(input) {
    const cleanInput = input.toLowerCase()
        .replace(/[𝕨𝘄𝗐𝗐]/g, 'w').replace(/[𝚎𝗲𝘦𝘦]/g, 'e')
        .replace(/[𝚔𝚔𝚔𝚔]/g, 'k').replace(/[𝚕𝚕𝚕𝚕]/g, 'l').replace(/[𝚢𝚢𝚢𝚢]/g, 'y')
        .replace(/[𝚖𝗺𝗺𝗺]/g, 'm').replace(/[𝗼𝗼𝗼𝗼]/g, 'o').replace(/[𝗻𝗻𝗻𝗻]/g, 'n')
        .replace(/[𝘁𝘁𝘁𝘁]/g, 't').replace(/[𝚑𝚑𝚑𝚑]/g, 'h').replace(/[𝗽𝗽𝗽𝗽]/g, 'p')
        .replace(/[^a-z0-9]/g, '');
    
    for (const item of INDO_PACKAGE_ORDER) {
        const dbNameClean = item.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (dbNameClean === cleanInput) return item.name;
    }
    for (const item of INDO_PACKAGE_ORDER) {
        const dbNameClean = item.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (cleanInput.includes(dbNameClean)) return item.name;
    }

    if (cleanInput.includes('weekly')) return "Weekly Membership Indo";
    if (cleanInput.includes('monthly')) return "Monthly Membership Indo";
    if (cleanInput.includes('booyah')) return "Booyah Pass Indo";
    if (cleanInput.includes('levelup') || cleanInput.includes('lvl')) {
        if (cleanInput.includes('30')) return "Level Up Pass [Lv.30] Indo";
        if (cleanInput.includes('25')) return "Level Up Pass [Lv.25] Indo";
        if (cleanInput.includes('20')) return "Level Up Pass [Lv.20] Indo";
        if (cleanInput.includes('15')) return "Level Up Pass [Lv.15] Indo";
        if (cleanInput.includes('10')) return "Level Up Pass [Lv.10] Indo";
        if (cleanInput.includes('6')) return "Level Up Pass [Lv.6] Indo";
    }

    const numbers = input.match(/\d+/);
    if (numbers) {
        const numStr = numbers[0];
        for (const item of INDO_PACKAGE_ORDER) {
            if (item.name.toLowerCase().includes(numStr)) {
                return item.name;
            }
        }
    }
    return null;
}

// --- বাংলাদেশ অর্ডার ---
bot.hears(/^stp\s+(.+)/i, async (ctx) => {
    try {
        const fullText = ctx.message.text.replace(/^stp\s+/i, '').trim();
        const parts = fullText.split(' ');
        if (parts.length < 2) {
            return ctx.reply('❌ অর্ডার করার সঠিক নিয়ম: `stp [Player_ID] [Package]`\nএকাধিক অর্ডারের নিয়ম: `stp [Player_ID] [Package] [Quantity]` বা সচিব `stp [Player_ID] [Package] * [Quantity]`', { parse_mode: 'Markdown' });
        }
        const playerId = parts[0];
        let rawPackageName = '';
        let quantity = 1;

        const lastPart = parts[parts.length - 1];
        if (!isNaN(lastPart) && parts.length >= 3) {
            quantity = parseInt(lastPart, 10);
            if (quantity < 1) quantity = 1;
            rawPackageName = parts.slice(1, parts.length - 1).join(' ');
        } else {
            const joinedRest = parts.slice(1).join(' ');
            const multiMatch = joinedRest.match(/(.+?)\s*(?:[\*xX])\s*(\d+)$/);
            if (multiMatch) {
                rawPackageName = multiMatch[1].trim();
                quantity = parseInt(multiMatch[2], 10);
                if (quantity < 1) quantity = 1;
            } else {
                rawPackageName = joinedRest;
            }
        }

        const userId = ctx.from.id.toString();
        
        const checkingMsg = await ctx.reply(`🔍 প্লেয়ার আইডি (\`${playerId}\`) চেক করা হচ্ছে...`, { parse_mode: 'Markdown' });
        const gameNickname = await checkFreeFireUID(playerId);
        try { await ctx.telegram.deleteMessage(ctx.chat.id, checkingMsg.message_id); } catch(err) {}

        const db = loadDatabase();
        if(!db.users[userId]) {
            db.users[userId] = { balance: 0, name: ctx.from.first_name || 'গ্রাহক', username: ctx.from.username ? `@${ctx.from.username}` : 'N/A', priceList: '3', joinedAt: Date.now(), purchases: {}, totalSpent: 0 };
        }
        const user = db.users[userId];
        const prices = getUserPriceList(userId);
        
        const exactPackageName = matchBDPackage(rawPackageName);
        if (!exactPackageName) {
            return ctx.reply(`❌ **'${rawPackageName}'** নামের কোনো প্যাকেজ খুঁজে পাওয়া যায়নি। \`srate\` চেক করুন।`, { parse_mode: 'Markdown' });
        }

        const priceStr = prices[exactPackageName] || DEFAULT_PRICES[exactPackageName];
        let unitPrice = 0;
        if (priceStr) {
            const numericPrice = parseFloat(priceStr.replace(/[^0-9.]/g, ''));
            if (!isNaN(numericPrice)) unitPrice = numericPrice;
        }

        const totalPrice = unitPrice * quantity;

        if (user.balance < totalPrice) {
            return ctx.reply(`❌ আপনার অ্যাকাউন্টে পর্যাপ্ত ব্যালেন্স নেই।\n\n💰 প্রয়োজনীয় ব্যালেন্স: **${totalPrice} BDT**\n💳 আপনার বর্তমান ব্যালেন্স: **${user.balance} BDT**`, { parse_mode: 'Markdown' });
        }

        const tempOrderId = 'ORD-' + Math.floor(100000 + Math.random() * 900000);
        const displayPackageText = quantity > 1 ? `${exactPackageName} x ${quantity}` : exactPackageName;

        const confirmMsg = `🛒 𝑶𝒓𝒅𝒆𝒓 𝑪𝒐𝒏𝒇𝒊𝒓𝒎𝒂𝒕𝒊𝒐𝒏 (𝑷𝒓𝒆𝒗𝒊𝒆𝒘)\n\n` +
                           `👤 Player Name : **${gameNickname}**\n` +
                           `🆔 Player ID : \`${playerId}\`\n` +
                           `💎 Package : **${displayPackageText}**\n` +
                           `💵 Order Price : **${totalPrice} BDT**\n` +
                           `💳 Your Balance: **${user.balance} BDT**\n\n` +
                           `⚠️ প্লেয়ার নাম ও আইডি ঠিক থাকলে **"Confirm Order"** বাটনে ক্লিক করুন।`;

        await ctx.reply(confirmMsg, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [
                    Markup.button.callback('✅ Confirm Order', `userconfirm_${tempOrderId}_BD`),
                    Markup.button.callback('❌ Cancel Order', `usercancel_${tempOrderId}`)
                ]
            ])
        });

        db.orders[tempOrderId] = {
            userId: userId,
            username: ctx.from.username ? `@${ctx.from.username}` : 'N/A',
            name: ctx.from.first_name || 'গ্রাহক',
            playerId: playerId,
            gameNickname: gameNickname,
            packageName: exactPackageName,
            quantity: quantity,
            price: totalPrice,
            orderType: 'BD',
            status: 'Preview'
        };
        saveDatabase(db);
    } catch (e) {
        console.error('Order Error:', e);
        return ctx.reply('❌ অর্ডার করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।');
    }
});

// --- ইন্দোনেশিয়া অর্ডার ---
bot.hears(/^indostp\s+(.+)/i, async (ctx) => {
    try {
        const text = ctx.message.text.replace(/^indostp\s+/i, '').trim();
        const parts = text.split(' ');
        if (parts.length < 2) {
            return ctx.reply('❌ অর্ডার করার সঠিক নিয়ম: `indostp [Player_ID] [Package]`', { parse_mode: 'Markdown' });
        }
        const playerId = parts[0];
        const rawPackageName = parts.slice(1).join(' ');
        const userId = ctx.from.id.toString();

        const checkingMsg = await ctx.reply(`🔍 ইন্দোনেশিয়া প্লেয়ার আইডি (\`${playerId}\`) চেক করা হচ্ছে...`, { parse_mode: 'Markdown' });
        const gameNickname = await checkFreeFireUID(playerId);
        try { await ctx.telegram.deleteMessage(ctx.chat.id, checkingMsg.message_id); } catch(err) {}

        const db = loadDatabase();
        if(!db.users[userId]) {
            db.users[userId] = { balance: 0, name: ctx.from.first_name || 'গ্রাহক', username: ctx.from.username ? `@${ctx.from.username}` : 'N/A', priceList: '3', joinedAt: Date.now(), purchases: {}, totalSpent: 0 };
        }
        const user = db.users[userId];
        const prices = getUserPriceList(userId);

        const exactPackageName = matchIndoPackage(rawPackageName);
        if (!exactPackageName) {
            return ctx.reply(`❌ ইন্দোনেশিয়া লিস্টে **'${rawPackageName}'** প্যাকেজটি পাওয়া যায়নি।`, { parse_mode: 'Markdown' });
        }

        const priceStr = prices[exactPackageName] || DEFAULT_PRICES[exactPackageName];
        let productPrice = 0;
        if (priceStr) {
            const numericPrice = parseFloat(priceStr.replace(/[^0-9.]/g, ''));
            if (!isNaN(numericPrice)) productPrice = numericPrice;
        }

        if (user.balance < productPrice) {
            return ctx.reply(`❌ পর্যাপ্ত ব্যালেন্স নেই। প্রয়োজনীয়: **${productPrice} BDT**`, { parse_mode: 'Markdown' });
        }

        const tempOrderId = 'INDO-' + Math.floor(100000 + Math.random() * 900000);
        const confirmMsg = `🛒 𝑰𝑵𝑫𝑶 𝑶𝒓𝒅𝒆𝒓 𝑪𝒐𝒏𝒇𝒊𝒓𝒎𝒂𝒕𝒊𝒐𝒏 (𝑷𝒓𝒆𝒗𝒊𝒆𝒘)\n\n` +
                           `👤 Player Name : **${gameNickname}**\n` +
                           `🆔 Player ID : \`${playerId}\`\n` +
                           `💎 Package : **${exactPackageName}**\n` +
                           `💵 Order Price : **${productPrice} BDT**\n` +
                           `💳 Your Balance: **${user.balance} BDT**\n\n` +
                           `⚠️ নাম ও আইডি ঠিক থাকলে **"Confirm Order"** বাটনে ক্লিক করুন।`;

        await ctx.reply(confirmMsg, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [
                    Markup.button.callback('✅ Confirm Order', `userconfirm_${tempOrderId}_INDO`),
                    Markup.button.callback('❌ Cancel Order', `usercancel_${tempOrderId}`)
                ]
            ])
        });

        db.orders[tempOrderId] = {
            userId: userId,
            username: ctx.from.username ? `@${ctx.from.username}` : 'N/A',
            name: ctx.from.first_name || 'গ্রাহক',
            playerId: playerId,
            gameNickname: gameNickname,
            packageName: exactPackageName,
            quantity: 1,
            price: productPrice,
            orderType: 'INDO',
            status: 'Preview'
        };
        saveDatabase(db);
    } catch (e) {
        console.error('Indo Order Error:', e);
        return ctx.reply('❌ অর্ডার করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।');
    }
});

// --- কাস্টমার বাটন ক্লিক হ্যান্ডলার ---
bot.action(/^userconfirm_(.+)_(.+)$/, async (ctx) => {
    try {
        const orderId = ctx.match[1];
        const orderType = ctx.match[2];
        const db = loadDatabase();
        if (!db.orders || !db.orders[orderId]) {
            await ctx.answerCbQuery('❌ এই অর্ডারের তথ্য পাওয়া যায়নি। আবার চেষ্টা করুন।');
            return ctx.editMessageText('❌ **অর্ডার মেয়াদোত্তীর্ণ বা বাতিল হয়ে গেছে।**');
        }
        const tempOrder = db.orders[orderId];
        const userId = ctx.from.id.toString();
        if (tempOrder.userId !== userId) {
            return ctx.answerCbQuery('⚠️ এটি আপনার অর্ডার নয়!');
        }
        if (!db.users[userId]) {
            db.users[userId] = { balance: 0, name: ctx.from.first_name || 'গ্রাহক', username: ctx.from.username ? `@${ctx.from.username}` : 'N/A', priceList: '3', joinedAt: Date.now(), purchases: {}, totalSpent: 0 };
        }
        const user = db.users[userId];
        if (user.balance < tempOrder.price) {
            await ctx.answerCbQuery('❌ আপনার অ্যাকাউন্টে পর্যাপ্ত ব্যালেন্স নেই!');
            return ctx.editMessageText('❌ **অর্ডার ব্যর্থ হয়েছে!** পর্যাপ্ত ব্যালেন্স নেই।');
        }

        const oldBalance = user.balance;
        user.balance -= tempOrder.price;
        const newBalance = user.balance;
        tempOrder.oldBalance = oldBalance;
        tempOrder.newBalance = newBalance;
        tempOrder.status = 'Pending';

        const displayPackageName = (tempOrder.quantity && tempOrder.quantity > 1) ? `${tempOrder.packageName} x ${tempOrder.quantity}` : tempOrder.packageName;

        await ctx.editMessageText(
            `✅ 𝒀𝒐𝒖𝒓 𝑶𝒓𝒅𝒆𝒓 𝑯𝒂𝒔 𝑩𝒆𝒆𝒏 𝑺𝒖ْب𝒎𝒊𝒕𝒕𝒆𝒅!\n\n` +
            `📋 Order ID : \`${orderId}\`\n` +
            `👤 Player : **${tempOrder.gameNickname}**\n` +
            `🆔 Player ID : \`${tempOrder.playerId}\`\n` +
            `💎 Package : **${displayPackageName}**\n` +
            `💵 Cost : **${tempOrder.price} BDT**\n` +
            `💳 Balance : **${newBalance} BDT**\n\n` +
            `⏳ অ্যাডমিন খুব শীঘ্রই আপনার অর্ডারটি সম্পন্ন করবেন।`,
            { parse_mode: 'Markdown' }
        );
        tempOrder.customerMessageId = ctx.callbackQuery.message.message_id;
        saveDatabase(db);

        const adminMsg = `🚨 𝑵𝒆𝒘 ${orderType} 𝑶𝒓𝒅𝒆𝒓 𝑹𝒆𝒄𝒆𝒊𝒗𝒆𝗱! 🚨\n\n` +
                         `📋 Order ID : \`${orderId}\`\n` +
                         `👤 Customer : ${tempOrder.name}\n` +
                         `🔹 Username : ${tempOrder.username}\n` +
                         `🆔 User ID : \`${userId}\`\n\n` +
                         `➖➖➖➖➖➖➖➖➖➖➖➖\n` +
                         `🎮 𝑷𝑳𝑨𝒀𝑬𝑅 𝑰𝑵𝑭𝑶𝑹𝑴𝑨𝑻𝑰𝑶𝑵 🎮\n` +
                         `👤 Player : **${tempOrder.gameNickname}**\n` +
                         `🆔 Player ID : \`${tempOrder.playerId}\`\n` +
                         `➖➖➖➖➖➖➖➖➖➖➖➖\n\n` +
                         `💎 Package : **${displayPackageName}**\n` +
                         `💵 Price : **${tempOrder.price} BDT**`;
        await bot.telegram.sendMessage(ADMIN_ID, adminMsg, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [
                    Markup.button.callback('✅ Complete', `complete_${orderId}`),
                    Markup.button.callback('❌ Cancel', `cancel_${orderId}`)
                ]
            ])
        });
        await ctx.answerCbQuery('অর্ডার সাবমিট হয়েছে!');
    } catch (e) {
        console.error('User Confirm Error:', e);
    }
});

bot.action(/^usercancel_(.+)$/, async (ctx) => {
    try {
        const orderId = ctx.match[1];
        const db = loadDatabase();
        if (db.orders && db.orders[orderId]) {
            delete db.orders[orderId];
            saveDatabase(db);
        }
        await ctx.editMessageText('❌ **অর্ডারটি ক্যানসেল করা হয়েছে।** কোনো টাকা কাটা হয়নি।');
        await ctx.answerCbQuery('অর্ডার ক্যানসেল করা হয়েছে!');
    } catch (e) {
        console.error('User Cancel Error:', e);
    }
});

// --- অ্যাডমিন বাটন ক্লিক হ্যান্ডলার (Complete & Cancel) ---
bot.action(/^(complete|cancel)_(.+)$/, async (ctx) => {
    if (!ctx.from || ctx.from.id.toString() !== ADMIN_ID) {
        return ctx.answerCbQuery('⚠️ অনুমোদিত নন!');
    }
    const action = ctx.match[1];
    const orderId = ctx.match[2];
    const db = loadDatabase();

    if (!db.orders || !db.orders[orderId]) {
        await ctx.answerCbQuery('❌ এই অর্ডারটি ডেটাবেজে পাওয়া যায়নি বা এটি অনেক পুরোনো।');
        return ctx.editMessageText('❌ **অর্ডারটি ডেটাবেজে খুঁজে পাওয়া যায়নি।**').catch(()=>{});
    }

    const order = db.orders[orderId];

    if (order.status === 'Completed' || order.status === 'Cancelled') {
        await ctx.answerCbQuery(`⚠️ এই অর্ডারটি ইতিমধ্যে ${order.status} করা হয়েছে!`);
        return;
    }

    const displayPackageName = (order.quantity && order.quantity > 1) ? `${order.packageName} x ${order.quantity}` : order.packageName;

    if (action === 'complete') {
        order.status = 'Completed';

        if (order.orderType === 'BD') {
            if (!db.users[order.userId]) {
                db.users[order.userId] = { balance: 0, name: order.name, username: order.username, priceList: '3', joinedAt: Date.now(), purchases: {}, totalSpent: 0 };
            }
            const uData = db.users[order.userId];
            if (!uData.purchases) uData.purchases = {};
            if (uData.totalSpent === undefined) uData.totalSpent = 0;

            const qty = order.quantity || 1;
            const pkgName = order.packageName;

            if (pkgName) {
                uData.purchases[pkgName] = (uData.purchases[pkgName] || 0) + qty;
            }

            uData.totalSpent += order.price;
        }

        saveDatabase(db);

        const adminCompleteMsg = `✅ 𝑶𝒓𝒅𝒆𝒓 𝑪𝒐𝒎𝒑𝒍𝒆𝒕𝒆ⴷ!\n\n` +
                                 `📋 Order ID : \`${orderId}\`\n` +
                                 `👤 Customer : ${order.name}\n` +
                                 `🆔 User ID : \`${order.userId}\`\n\n` +
                                 `🎮 Player : **${order.gameNickname || 'N/A'}**\n` +
                                 `🆔 Player ID : \`${order.playerId}\`\n\n` +
                                 `💎 Package : **${displayPackageName}**\n` +
                                 `💵 Price : **${order.price} BDT**`;
        
        try {
            await ctx.editMessageText(adminCompleteMsg, { parse_mode: 'Markdown' });
        } catch (err) {
            await ctx.reply(adminCompleteMsg, { parse_mode: 'Markdown' }).catch(()=>{});
        }

        const customerMsg = `🟢 𝑶𝒓𝒅𝒆𝒓 𝑪𝒐𝒎𝒑𝒍𝒆𝒕𝒆ⴷ 𝑺𝒖𝒄𝒄𝒆𝒔𝒔𝒇𝒖𝒍𝒍𝒚!\n\n` +
                            `📋 Order ID : \`${orderId}\`\n` +
                            `👤 Player : **${order.gameNickname || 'N/A'}**\n` +
                            `🆔 Player ID : \`${order.playerId}\`\n` +
                            `💎 Package : **${displayPackageName}**\n\n` +
                            `💰 𝑩𝒂𝒍𝒂𝒏𝒄𝒆 𝑺𝒖ｍｍ𝗮𝚛𝓎:\n` +
                            `💳 Previous Balance : **${order.oldBalance} BDT**\n` +
                            `🔻 Order Cost : **-${order.price} BDT**\n` +
                            `✨ Current Balance : **${order.newBalance} BDT**\n\n` +
                            `❤️ SIRTOPUP-এর সাথে থাকার জন্য ধন্যবাদ!`;

        try {
            if (order.customerMessageId) {
                await bot.telegram.editMessageText(order.userId, order.customerMessageId, null, customerMsg, { parse_mode: 'Markdown' });
            } else {
                await bot.telegram.sendMessage(order.userId, customerMsg, { parse_mode: 'Markdown' });
            }
        } catch (err) {
            await bot.telegram.sendMessage(order.userId, customerMsg, { parse_mode: 'Markdown' }).catch(()=>{});
        }
        await ctx.answerCbQuery('অর্ডার সফলভাবে কমপ্লিট করা হয়েছে!');
    } 
    else if (action === 'cancel') {
        order.status = 'Cancelled';
        if (!db.users[order.userId]) db.users[order.userId] = { balance: 0, priceList: '3', joinedAt: Date.now(), purchases: {}, totalSpent: 0 };
        db.users[order.userId].balance += order.price;
        const currentRefundedBalance = db.users[order.userId].balance;
        saveDatabase(db);

        const adminCancelMsg = `❌ 𝑶𝒓𝒅𝒆𝒓 𝑪𝒂𝒏𝒄𝒆𝒍𝒍𝒆ⴷ & 𝑹𝒆𝒇𝒖𝒏𝒅𝒆ⴷ!\n\n` +
                               `📋 Order ID : \`${orderId}\`\n` +
                               `👤 Customer : ${order.name}\n` +
                               `🆔 User ID : \`${order.userId}\`\n\n` +
                               `🎮 Player : **${order.gameNickname || 'N/A'}**\n` +
                               `🆔 Player ID : \`${order.playerId}\`\n\n` +
                               `💎 Package : **${displayPackageName}**\n` +
                               `💵 Refunded : **${order.price} BDT**`;
        
        try {
            await ctx.editMessageText(adminCancelMsg, { parse_mode: 'Markdown' });
        } catch (err) {
            await ctx.reply(adminCancelMsg, { parse_mode: 'Markdown' }).catch(()=>{});
        }

        const customerCancelMsg = `🔴 𝑶𝒓𝒅𝒆𝒓 𝑪𝒂𝒏𝒄𝒆𝒍𝒍𝒆ⴷ!\n\n` +
                                  `📋 Order ID : \`${orderId}\`\n` +
                                  `👤 Player : **${order.gameNickname || 'N/A'}**\n` +
                                  `🆔 Player ID : \`${order.playerId}\`\n` +
                                  `💎 Package : **${displayPackageName}**\n\n` +
                                  `💵 Refund Amount : **+${order.price} BDT**\n` +
                                  `💰 Current Balance: ${currentRefundedBalance} BDT`;

        try {
            if (order.customerMessageId) {
                await bot.telegram.editMessageText(order.userId, order.customerMessageId, null, customerCancelMsg, { parse_mode: 'Markdown' });
            } else {
                await bot.telegram.sendMessage(order.userId, customerCancelMsg, { parse_mode: 'Markdown' });
            }
        } catch (err) {
            await bot.telegram.sendMessage(order.userId, customerCancelMsg, { parse_mode: 'Markdown' }).catch(()=>{});
        }
        await ctx.answerCbQuery('অর্ডার বাতিল ও টাকা রিফান্ড করা হয়েছে!');
    }
});

// --- ব্রডকাস্ট কমান্ড (/allusersmsg) ---
bot.command('allusersmsg', async (ctx) => {
    if (!ctx.from || ctx.from.id.toString() !== ADMIN_ID) return;
    try {
        const customBroadcastText = ctx.message.text.replace(/^\/allusersmsg\s*/i, '').trim();
        if (!customBroadcastText) {
            return ctx.reply('❌ ব্রডকাস্ট করার জন্য মেসেজ দিন。\n\nউদাহরণ: `/allusersmsg পেমেন্ট নম্বর আপডেট করা হয়েছে! snumber চেক করুন।`', { parse_mode: 'Markdown' });
        }
        const db = loadDatabase();
        const users = db.users || {};
        const userKeys = Object.keys(users);
        if (userKeys.length === 0) {
            return ctx.reply('⚠️ ব্রডকাস্ট পাঠাতে কোনো কাস্টমার পাওয়া যায়নি।');
        }

        const formattedBroadcastMsg = `┌────────────────────────────────────────┐\n` +
                                      `│ 📢 ✨ 𝑺𝑰𝑹𝑻𝑶𝑷𝑼𝑷 𝑨𝑵𝑵𝑶𝑼𝑵𝑪𝑬𝑴𝑬𝑵𝑻 ✨ 📢 │\n` +
                                      `├────────────────────────────────────────┤\n` +
                                      `│\n` +
                                      `│ ${customBroadcastText}\n` +
                                      `│\n` +
                                      `└────────────────────────────────────────┘`;
        let successCount = 0;
        let failCount = 0;
        await ctx.reply(`⏳ সকল কাস্টমারের কাছে মেসেজ ব্রডকাস্ট করা হচ্ছে... (মোট: ${userKeys.length} জন)`);
        for (const targetId of userKeys) {
            try {
                await bot.telegram.sendMessage(targetId, formattedBroadcastMsg);
                successCount++;
            } catch (err) {
                failCount++;
            }
        }
        return ctx.reply(
            `📢 **ব্রডকাস্ট সম্পন্ন হয়েছে!**\n\n` +
            `✅ সফলভাবে পাঠানো হয়েছে: \`${successCount}\` জন\n` +
            `❌ ব্যর্থ (বট ব্লক করা): \`${failCount}\` জন`,
            { parse_mode: 'Markdown' }
        );
    } catch (e) {
        console.error('Broadcast Error:', e);
        return ctx.reply('❌ ব্রডকাস্ট পাঠাতে সমস্যা হয়েছে।');
    }
});

// --- /mybotuser ---
bot.command('mybotuser', async (ctx) => {
    if (!ctx.from || ctx.from.id.toString() !== ADMIN_ID) return;
    try {
        const db = loadDatabase();
        const users = db.users || {};
        const userKeys = Object.keys(users);
        const totalUsers = userKeys.length;
        if (totalUsers === 0) {
            return ctx.reply('🤖 **বর্তমানে আপনার বটে কোনো কাস্টমার যুক্ত নেই।**', { parse_mode: 'Markdown' });
        }
        let headerMsg = `👥 **বটের মোট কাস্টমার সংখ্যা:** \`${totalUsers}\` জন\n\n📋 **কাস্টমারদের তালিকা:**\n\n`;
        let userListText = '';
        let count = 1;
        for (const uId of userKeys) {
            const uData = users[uId];
            const name = uData.name || 'N/A';
            const username = uData.username || 'N/A';
            const balance = uData.balance !== undefined ? uData.balance : 0;
            const priceList = uData.priceList || '3';
            const entry = `*${count}.* 👤 **নাম:** ${name}\n` +
                          ` 🔹 **ইউজারনেম:** ${username}\n` +
                          ` 🆔 **ইউজার আইডি:** \`${uId}\`\n` +
                          ` 📋 **প্রাইস লিস্ট:** List ${priceList}\n` +
                          ` 💰 **ব্যালেন্স:** ${balance} BDT\n\n`;
            if ((headerMsg + userListText + entry).length > 3800) {
                await ctx.reply(headerMsg + userListText, { parse_mode: 'Markdown' });
                headerMsg = '';
                userListText = entry;
            } else {
                userListText += entry;
            }
            count++;
        }
        if (userListText.length > 0) {
            await ctx.reply(headerMsg + userListText, { parse_mode: 'Markdown' });
        }
    } catch (e) {
        console.error('Mybotuser Error:', e);
        return ctx.reply('❌ কাস্টমার লিস্ট লোড করতে সমস্যা হয়েছে।');
    }
});

// --- /smsg ---
bot.command('smsg', async (ctx) => {
    if (!ctx.from || ctx.from.id.toString() !== ADMIN_ID) return;
    try {
        const text = ctx.message.text.replace(/^\/smsg\s*/i, '').trim();
        const parts = text.split(' ');
        if (parts.length < 2) {
            return ctx.reply('❌ সঠিক নিয়মে লিখুন。\nব্যবহার: `/smsg [User_ID] [আপনার মেসেজ]`', { parse_mode: 'Markdown' });
        }
        const targetUserId = parts[0].trim();
        const customMessage = parts.slice(1).join(' ');
        await bot.telegram.sendMessage(targetUserId, `💬 **অ্যাডমিন মেসেজ:**\n\n${customMessage}`, { parse_mode: 'Markdown' });
        return ctx.reply(`✅ সফলভাবে ইউজার আইডি \`${targetUserId}\`-এর কাছে মেসেজ পাঠানো হয়েছে!`, { parse_mode: 'Markdown' });
    } catch (e) {
        console.error('Smsg Error:', e);
        return ctx.reply('❌ মেসেজ পাঠাতে সমস্যা হয়েছে। সঠিক User ID দিন।');
    }
});

// --- পেমেন্ট নম্বর সেটআপ ---
bot.command('setbkash', (ctx) => {
    if (!ctx.from || ctx.from.id.toString() !== ADMIN_ID) return;
    try {
        const num = ctx.message.text.split(' ')[1];
        if (!num) return ctx.reply('❌ বিকাশ নম্বর দিন।\nব্যবহার: `/setbkash 01XXXXXXXXX`', { parse_mode: 'Markdown' });
        const db = loadDatabase();
        if (!db.numbers) db.numbers = {};
        db.numbers.bkash = num;
        saveDatabase(db);
        return ctx.reply(`✅ বিকাশ নম্বর আপডেট হয়েছে: **${num}**`, { parse_mode: 'Markdown' });
    } catch(e) {}
});

bot.command('setnagad', (ctx) => {
    if (!ctx.from || ctx.from.id.toString() !== ADMIN_ID) return;
    try {
        const num = ctx.message.text.split(' ')[1];
        if (!num) return ctx.reply('❌ নগদ নম্বর দিন।\nব্যবহার: `/setnagad 01XXXXXXXXX`', { parse_mode: 'Markdown' });
        const db = loadDatabase();
        if (!db.numbers) db.numbers = {};
        db.numbers.nagad = num;
        saveDatabase(db);
        return ctx.reply(`✅ নগদ নম্বর আপডেট হয়েছে: **${num}**`, { parse_mode: 'Markdown' });
    } catch(e) {}
});

bot.command('setrocket', (ctx) => {
    if (!ctx.from || ctx.from.id.toString() !== ADMIN_ID) return;
    try {
        const num = ctx.message.text.split(' ')[1];
        if (!num) return ctx.reply('❌ রকেট নম্বর দিন।\nব্যবহার: `/setrocket 01XXXXXXXXX`', { parse_mode: 'Markdown' });
        const db = loadDatabase();
        if (!db.numbers) db.numbers = {};
        db.numbers.rocket = num;
        saveDatabase(db);
        return ctx.reply(`✅ রকেট নম্বর আপডেট হয়েছে: **${num}**`, { parse_mode: 'Markdown' });
    } catch(e) {}
});

// --- ইউজার ম্যানেজমেন্ট ও লিস্ট অ্যাসাইন ---
bot.command('slist1', (ctx) => {
    if (!ctx.from || ctx.from.id.toString() !== ADMIN_ID) return;
    try {
        const args = ctx.message.text.split(' ');
        if (args.length < 2) return ctx.reply('ব্যবহার: `/slist1 [User_ID]`', { parse_mode: 'Markdown' });
        const targetId = args[1].trim();
        const db = loadDatabase();
        if (!db.users) db.users = {};
        if (!db.users[targetId]) {
            db.users[targetId] = { balance: 0, name: 'User', username: 'N/A', priceList: '1', joinedAt: Date.now(), purchases: {}, totalSpent: 0 };
        } else {
            db.users[targetId].priceList = '1';
        }
        saveDatabase(db);
        return ctx.reply(`✅ ইউজার আইডি \`${targetId}\`-কে সফলভাবে **List 1** (Special)-এ যুক্ত করা হয়েছে!`, { parse_mode: 'Markdown' });
    } catch(e) { console.error('Slist1 Error:', e); }
});

bot.command('slist2', (ctx) => {
    if (!ctx.from || ctx.from.id.toString() !== ADMIN_ID) return;
    try {
        const args = ctx.message.text.split(' ');
        if (args.length < 2) return ctx.reply('ব্যবহার: `/slist2 [User_ID]`', { parse_mode: 'Markdown' });
        const targetId = args[1].trim();
        const db = loadDatabase();
        if (!db.users) db.users = {};
        if (!db.users[targetId]) {
            db.users[targetId] = { balance: 0, name: 'User', username: 'N/A', priceList: '2', joinedAt: Date.now(), purchases: {}, totalSpent: 0 };
        } else {
            db.users[targetId].priceList = '2';
        }
        saveDatabase(db);
        return ctx.reply(`✅ ইউজার আইডি \`${targetId}\`-কে সফলভাবে **List 2** (Wholesaler)-এ যুক্ত করা হয়েছে!`, { parse_mode: 'Markdown' });
    } catch(e) { console.error('Slist2 Error:', e); }
});

bot.command('slist3', (ctx) => {
    if (!ctx.from || ctx.from.id.toString() !== ADMIN_ID) return;
    try {
        const args = ctx.message.text.split(' ');
        if (args.length < 2) return ctx.reply('ব্যবহার: `/slist3 [User_ID]`', { parse_mode: 'Markdown' });
        const targetId = args[1].trim();
        const db = loadDatabase();
        if (!db.users) db.users = {};
        if (!db.users[targetId]) {
            db.users[targetId] = { balance: 0, name: 'User', username: 'N/A', priceList: '3', joinedAt: Date.now(), purchases: {}, totalSpent: 0 };
        } else {
            db.users[targetId].priceList = '3';
        }
        saveDatabase(db);
        return ctx.reply(`✅ ইউজার আইডি \`${targetId}\`-কে সফলভাবে **List 3** (Reseller)-এ যুক্ত করা হয়েছে!`, { parse_mode: 'Markdown' });
    } catch(e) { console.error('Slist3 Error:', e); }
});

bot.command('addbot', (ctx) => {
    if (!ctx.from || ctx.from.id.toString() !== ADMIN_ID) return;
    try {
        const args = ctx.message.text.split(' ');
        if (args.length < 2) return ctx.reply('ব্যবহার: `/addbot [User_ID]`', { parse_mode: 'Markdown' });
        const targetId = args[1].trim();
        const db = loadDatabase();
        if (!db.allowedUsers) db.allowedUsers = [];
        if (!db.allowedUsers.includes(targetId)) {
            db.allowedUsers.push(targetId);
            if (!db.users[targetId]) {
                db.users[targetId] = { balance: 0, name: 'User', username: 'N/A', priceList: '3', joinedAt: Date.now(), purchases: {}, totalSpent: 0 };
            }
            saveDatabase(db);
            return ctx.reply(`✅ সফলভাবে ইউজার আইডি \`${targetId}\`-কে বটের এক্সেস দেওয়া হয়েছে!`, { parse_mode: 'Markdown' });
        } else {
            return ctx.reply('⚠️ এই ইউজার আইডিটি ইতিমধ্যে অনুমোদিত তালিকায় রয়েছে।');
        }
    } catch (e) {}
});

bot.command('removebot', (ctx) => {
    if (!ctx.from || ctx.from.id.toString() !== ADMIN_ID) return;
    try {
        const args = ctx.message.text.split(' ');
        if (args.length < 2) return ctx.reply('ব্যবহার: `/removebot [User_ID]`', { parse_mode: 'Markdown' });
        const targetId = args[1].trim();
        const db = loadDatabase();
        let removed = false;
        if (db.allowedUsers) {
            const index = db.allowedUsers.indexOf(targetId);
            if (index !== -1) {
                db.allowedUsers.splice(index, 1);
                removed = true;
            }
        }
        if (db.users && db.users[targetId]) {
            delete db.users[targetId];
            removed = true;
        }
        if (removed) {
            saveDatabase(db);
            return ctx.reply(`🚪 ইউজার আইডি \`${targetId}\`-কে সফলভাবে রিমুভ ও কাস্টমার তালিকা থেকে মুছে ফেলা হয়েছে!`, { parse_mode: 'Markdown' });
        } else {
            return ctx.reply('⚠️ এই ইউজার আইডিটি অনুমোদিত বা কাস্টমার তালিকায় পাওয়া যায়নি।');
        }
    } catch (e) {}
});

// --- ফুল রেট লিস্ট আপডেট: /setprice [1/2/3] ---
bot.command('setprice', (ctx) => {
    if (!ctx.from || ctx.from.id.toString() !== ADMIN_ID) return;
    try {
        const text = ctx.message.text.replace(/^\/setprice\s*/, '').trim();
        if (!text) {
            return ctx.reply('❌ সঠিক নিয়মে লিখুন。\nব্যবহার: `/setprice [1/2/3]`\nউদাহরণ: `/setprice 1`', { parse_mode: 'Markdown' });
        }
        const listNum = text.trim();
        if (listNum !== '1' && listNum !== '2' && listNum !== '3') {
            return ctx.reply('❌ সঠিক লিস্ট নম্বর দিন: `1`, `2` অথবা `3`。\nউদাহরণ: `/setprice 1`', { parse_mode: 'Markdown' });
        }

        adminPriceUpdateSessions[ADMIN_ID] = listNum;

        return ctx.reply(
            `📋 **List ${listNum} সিলেক্ট করা হয়েছে।**\n\n` +
            `এখন আপনার পুরো রেট লিস্টের টেক্সট এখানে কপি করে পেস্ট করে সেন্ড করুন। বট একদম নিখুঁতভাবে প্যাকেজ চিনিয়ে আপডেট করে নেবে!`,
            { parse_mode: 'Markdown' }
        );
    } catch (e) {
        console.error('Setprice Session Error:', e);
        return ctx.reply('❌ সমস্যা হয়েছে। আবার চেষ্টা করুন।');
    }
});

// --- একক আইটেম আপডেট: /setitem ---
bot.command('setitem', (ctx) => {
    if (!ctx.from || ctx.from.id.toString() !== ADMIN_ID) return;
    try {
        const text = ctx.message.text.replace(/^\/setitem\s*/, '').trim();
        const parts = text.split(' ');
        if (parts.length < 3) {
            return ctx.reply('❌ সঠিক নিয়মে লিখুন。\nব্যবহার: `/setitem [লিস্ট নম্বর] [প্যাকেজের নাম] [দাম]`\nউদাহরণ: `/setitem 2 Weekly Membership 145৳`', { parse_mode: 'Markdown' });
        }
        const listNum = parts[0].trim();
        if (listNum !== '1' && listNum !== '2' && listNum !== '3') {
            return ctx.reply('❌ সঠিক লিস্ট নম্বর দিন: `1`, `2` অথবা `3`।', { parse_mode: 'Markdown' });
        }
        const restText = parts.slice(1).join(' ').trim();
        const lastSpaceIdx = restText.lastIndexOf(' ');
        if (lastSpaceIdx === -1) return ctx.reply('❌ সঠিক ফরম্যাটে লিখুন।');

        const rawPkgName = restText.substring(0, lastSpaceIdx).trim();
        const price = restText.substring(lastSpaceIdx + 1).trim();

        const matchedKey = identifyPackageKey(rawPkgName);
        if (!matchedKey) {
            return ctx.reply(`❌ **'${rawPkgName}'** নামের প্যাকেজটি চিনতে পারিনি। সঠিক প্যাকেজ নাম দিন।`);
        }

        const db = loadDatabase();
        db.prices = ensurePricesStructure(db.prices);
        db.prices[listNum][matchedKey] = price;
        saveDatabase(db);

        return ctx.reply(`✅ **List ${listNum}** সফলভাবে আপডেট হয়েছে:\n\n🔹 **${matchedKey}** ➡️ ${price}`, { parse_mode: 'Markdown' });
    } catch (e) {
        console.error('Setitem Error:', e);
        return ctx.reply('❌ আইটেম আপডেট করতে সমস্যা হয়েছে।');
    }
});

// --- প্রাইস লিস্ট দেখার ফাংশন ---
function sendPriceListToAdmin(ctx, listNum) {
    if (!ctx.from || ctx.from.id.toString() !== ADMIN_ID) return;
    try {
        const db = loadDatabase();
        db.prices = ensurePricesStructure(db.prices);
        const prices = db.prices[listNum] || DEFAULT_PRICES;

        let message = "```💳 S𝗜𝗥 T𝗼𝗽𝘂𝗽 L𝗶𝘀𝘁 " + listNum + " P𝗿𝗶𝗰𝗲 L𝗶𝘀𝘁..♡\n";
        message += "✨─────────────────────────────────────✨\n\n";
        message += "🇧🇩 B𝗔𝗡𝗚𝗟𝗔𝗗𝗘𝗦𝗛 U𝗜𝗗 T𝗢𝗣𝗨𝗣 L𝗜𝗦𝗧 💎\n";
        message += "✨─────────────────────────────────────✨\n\n";

        for(let i = 0; i < 3; i++) {
            let item = BD_PACKAGE_ORDER[i];
            let price = prices[item.name] || 'নিয়মিত আপডেট';
            message += `${item.display.padEnd(28, ' ')} ➪ ${price}\n`;
        }

        message += "\n";

        for(let i = 3; i < 14; i++) {
            let item = BD_PACKAGE_ORDER[i];
            let price = prices[item.name] || 'নিয়মিত আপডেট';
            message += `${item.display.padEnd(28, ' ')} ➪ ${price}\n`;
        }

        message += "\n✦ ──────────────────────✦\n";
        message += "⚡ Lᴇᴠᴇl Uᴘ Pᴀss\n";
        message += "✦ ──────────────────────✦\n";
        
        for(let i = 15; i <= 20; i++) {
            let item = BD_PACKAGE_ORDER[i];
            let price = prices[item.name] || 'নিয়মিত আপডেট';
            message += `${item.display.padEnd(28, ' ')} ➪ ${price}\n`;
        }

        message += "\n✦ ──────────────✦\n";
        message += "(👍ᵔᴥᵔ)👍 FF Lɪᴋᴇ\n";
        message += "✦ ──────────────✦\n";
        
        for(let i = 21; i < BD_PACKAGE_ORDER.length; i++) {
            let item = BD_PACKAGE_ORDER[i];
            let price = prices[item.name] || 'নিয়মিত আপডেট';
            message += `${item.display.padEnd(28, ' ')} ➪ ${price}\n`;
        }

        message += "\n✦ ──────────────────────✦\n";
        message += "🤖 Gᴜɪʟᴅ Gʟᴏʀʏ Bᴏ𝘁\n";
        message += "✦ ──────────────────────✦\n";
        let guildItem = BD_PACKAGE_ORDER[14];
        let guildPrice = prices[guildItem.name] || 'নিয়মিত আপডেট';
        message += `${guildItem.display.padEnd(28, ' ')} ➪ ${guildPrice}\n\n`;

        message += "✨─────────────────────────────────────✨\n";
        message += "🇮🇩 I𝗡𝗗𝗢𝗡𝗘𝗦𝗜𝗔 T𝗢𝗣𝗨𝗣 L𝗜𝗦𝗧 💎\n";
        message += "✨─────────────────────────────────────✨\n\n";

        for(let i = 0; i < 2; i++) {
            let item = INDO_PACKAGE_ORDER[i];
            let price = prices[item.name] || 'নিয়মিত আপডেট';
            message += `${item.display.padEnd(28, ' ')} ➪ ${price}\n`;
        }

        message += "\n";

        for(let i = 2; i < 9; i++) {
            let item = INDO_PACKAGE_ORDER[i];
            let price = prices[item.name] || 'নিয়মিত আপডেট';
            message += `${item.display.padEnd(28, ' ')} ➪ ${price}\n`;
        }

        message += "\n✦ ──────────────────────✦\n";
        message += "⚡ Iɴᴅᴏ Lᴇᴠᴇl Uᴘ Pᴀss\n";
        message += "✦ ──────────────────────✦\n";
        
        for(let i = 10; i < INDO_PACKAGE_ORDER.length; i++) {
            let item = INDO_PACKAGE_ORDER[i];
            let price = prices[item.name] || 'নিয়মিত আপডেট';
            message += `${item.display.padEnd(28, ' ')} ➪ ${price}\n`;
        }

        message += "\n✦ ──────────────✦\n";
        message += "🎟️ Bᴏᴏʏᴀʜ Pᴀss\n";
        message += "✦ ──────────────✦\n";
        let booyahItem = INDO_PACKAGE_ORDER[9];
        let booyahPrice = prices[booyahItem.name] || 'নিয়মিত আপডেট';
        message += `${booyahItem.display.padEnd(28, ' ')} ➪ ${booyahPrice}\n\n`;

        message += "───────────────୨ৎ─────────\n";
        message += `📋 Current View: List ${listNum}\n`;
        message += "───────────────୨ৎ─────────\n";
        message += "M𝗮𝗻𝗮𝗴𝗲𝗱 𝗯𝘆 : S𝗜𝗥 T𝗼𝗽𝘂𝗽™```";

        return ctx.reply(message, { parse_mode: 'Markdown' }).catch(() => {});
    } catch (e) {
        console.error('Getlist Error:', e);
        return ctx.reply('❌ লিস্ট দেখতে সমস্যা হয়েছে।');
    }
}

bot.command('getlist1', (ctx) => sendPriceListToAdmin(ctx, '1'));
bot.command('getlist2', (ctx) => sendPriceListToAdmin(ctx, '2'));
bot.command('getlist3', (ctx) => sendPriceListToAdmin(ctx, '3'));

bot.command('checkbalance', (ctx) => {
    if (!ctx.from || ctx.from.id.toString() !== ADMIN_ID) return;
    try {
        const args = ctx.message.text.split(' ');
        if (args.length < 2) return ctx.reply('ব্যবহার: `/checkbalance [User_ID]`', { parse_mode: 'Markdown' });
        const targetId = args[1];
        const db = loadDatabase();
        const user = db.users[targetId] || { balance: 0, name: 'Unknown', username: 'N/A', priceList: '3' };
        
        const checkText = `♡ Nᴀᴍᴇ          : ${user.name}\n\n` +
                          `✦ Usᴇʀɴᴀᴍᴇ   : ${user.username}\n` +
                          `✦ Uꜱᴇʀ ID  		 : \`${targetId}\`\n` +
                          `✦ Pʀɪᴄᴇ Lɪsᴛ : List ${user.priceList || '3'}\n` +
                          `✦ BᴀʟᴀɴᴄE  	 : ${user.balance} BDT`;
                          
        return ctx.reply(checkText, { parse_mode: 'Markdown' });
    } catch(e) {}
});

// --- অ্যাডমিন ব্যালেন্স অ্যাড ---
bot.command('addbalance', (ctx) => {
    if (!ctx.from || ctx.from.id.toString() !== ADMIN_ID) return;
    try {
        const args = ctx.message.text.split(' ');
        if (args.length < 3) return ctx.reply('ব্যবহার: `/addbalance [User_ID] [টাকা]`', { parse_mode: 'Markdown' });
        const targetId = args[1];
        const amount = parseFloat(args[2]);
        if (isNaN(amount)) return ctx.reply('❌ সঠিক টাকার পরিমাণ লিখুন।');
        
        const db = loadDatabase();
        if (!db.users) db.users = {};
        if (!db.users[targetId]) db.users[targetId] = { balance: 0, name: 'Unknown', username: 'N/A', priceList: '3', joinedAt: Date.now(), purchases: {}, totalSpent: 0 };
        
        const oldBalance = db.users[targetId].balance;
        db.users[targetId].balance += amount;
        const newBalance = db.users[targetId].balance;
        saveDatabase(db);

        if (amount >= 0) {
            const customerMsg = `🎉 𝐁𝐀𝐋𝐀𝐍𝐂𝐄 𝐀𝐃𝐃𝐄𝐃 𝐒𝐔𝐂𝐂𝐄𝐒𝐒𝐅𝐔𝐋𝐋𝐘!\n` +
                                `✨────────────────────────✨\n\n` +
                                `💳 Previous Balance : ${oldBalance} BDT\n` +
                                `➕ Added Amount   : ${amount} BDT\n` +
                                `💰 Current Balance  : ${newBalance} BDT\n\n` +
                                `✨────────────────────────✨\n` +
                                `❤️ Thank you for using SIR TOPUP™!`;

            bot.telegram.sendMessage(targetId, customerMsg).catch(()=>{});
            return ctx.reply(`✅ সফলভাবে ইউজার **${targetId}**-এর অ্যাকাউন্টে **${amount} BDT** যোগ করা হয়েছে।`, { parse_mode: 'Markdown' });
        } else {
            const positiveAmount = Math.abs(amount);
            bot.telegram.sendMessage(targetId, `⚠️ **Balance Deducted!**\nAmount: -${positiveAmount} BDT\nCurrent Balance: ${newBalance} BDT`).catch(()=>{});
            return ctx.reply(`🔻 ইউজার **${targetId}**-এর অ্যাকাউন্ট থেকে **${positiveAmount} BDT** বিয়োগ করা হয়েছে।`, { parse_mode: 'Markdown' });
        }
    } catch(e) {}
});

// --- 📌 উন্নত ও ফাঁকা ফাঁকা ড্যাশবোর্ড স্টাইল পিন মেনু (/pinmenu) ---
bot.command('pinmenu', async (ctx) => {
    if (!ctx.from || ctx.from.id.toString() !== ADMIN_ID) return;
    try {
        const menuText = `⚙️ 𝐒𝐈𝐑𝐓𝐎𝐏𝐔𝐏 𝐀𝐃𝐌𝐈𝐍 𝐂𝐎𝐍𝐓𝐑𝐎𝐋 𝐃𝐀𝐒𝐇𝐁𝐎𝐀𝐑𝐃 ⚙️\n` +
                         `✨────────────────────────────────────────✨\n\n` +
                         `📢 **1. BROADCAST & MESSAGING**\n` +
                         `----------------------------------------\n` +
                         `• \`/allusersmsg [মেসেজ]\`\n` +
                         `  (সকল কাস্টমারদের ইনবক্সে ব্রডকাস্ট পাঠাতে)\n\n` +
                         `• \`/smsg [User_ID] [মেসেজ]\`\n` +
                         `  (নির্দিষ্ট ইউজারের কাছে ডিরেক্ট মেসেজ পাঠাতে)\n\n\n` +
                         `💰 **2. BALANCE & HISTORY**\n` +
                         `----------------------------------------\n` +
                         `• \`/addbalance [User_ID] [টাকা]\`\n` +
                         `  (ইউজারের ব্যালেন্স যোগ বা বিয়োগ করতে)\n\n` +
                         `• \`/checkbalance [User_ID]\`\n` +
                         `  (ইউজারের বর্তমান ব্যালেন্স চেক করতে)\n\n` +
                         `• \`/spaid [User_ID]\`\n` +
                         `  (ইউজারের লাইফটাইম পারচেস হিস্ট্রি দেখতে)\n\n\n` +
                         `👥 **3. USER & LIST MANAGEMENT**\n` +
                         `----------------------------------------\n` +
                         `• \`/mybotuser\`\n` +
                         `  (মোট কাস্টমার তালিকা ও লিস্ট স্ট্যাটাস দেখতে)\n\n` +
                         `• \`/addbot [User_ID]\`\n` +
                         `  (নতুন ইউজারকে বটের এক্সেস দিতে)\n\n` +
                         `• \`/removebot [User_ID]\`\n` +
                         `  (ইউজারের বটের এক্সেস বাতিল করতে)\n\n\n` +
                         `📋 **4. PRICE LIST ASSIGNMENT**\n` +
                         `----------------------------------------\n` +
                         `• \`/slist1 [User_ID]\` ➔ List 1 (VIP)\n` +
                         `• \`/slist2 [User_ID]\` ➔ List 2 (Wholesaler)\n` +
                         `• \`/slist3 [User_ID]\` ➔ List 3 (Reseller / Default)\n\n\n` +
                         `🛠️ **5. PRICE & PAYMENT SETUP**\n` +
                         `----------------------------------------\n` +
                         `• \`/getlist1\` / \`/getlist2\` / \`/getlist3\`\n` +
                         `  (নির্দিষ্ট লিস্টের প্রাইস দেখতে)\n\n` +
                         `• \`/setprice [1/2/3]\`\n` +
                         `  (ফুল রেট লিস্ট ইন্টারেক্টিভ আপডেট করতে)\n\n` +
                         `• \`/setitem [1/2/3] [প্যাকেজ] [দাম]\`\n` +
                         `  (একক আইটেম আপডেট করতে)\n\n` +
                         `• \`/setbkash\` | \`/setnagad\` | \`/setrocket [নম্বর]\`\n` +
                         `  (পেমেন্ট নম্বর সেট করতে)\n\n` +
                         `✨────────────────────────────────────────✨\n` +
                         `M𝗮𝗻𝗮𝗴𝗲𝗱 𝗯𝘆 : S𝗜𝗥 T𝗼𝗽𝘂𝗽™`;

        const msg = await ctx.reply(menuText, { parse_mode: 'Markdown' });
        await ctx.pinChatMessage(msg.message_id);
        await ctx.reply('✅ অ্যাডমিন ড্যাশবোর্ড ও কমান্ড লিস্টটি সফলভাবে পিন করা হয়েছে!', { parse_mode: 'Markdown' });
    } catch (e) {
        console.error('Pinmenu Error:', e);
        return ctx.reply('❌ চ্যাটে পিন করতে সমস্যা হয়েছে।');
    }
});

// Webhook ও Server ইন্টিগ্রেশন (ক্রন-জব পিং অপ্টিমাইজড)
const webhookPath = `/secret-path-${BOT_TOKEN.split(':')[0]}`;
const fullWebhookUrl = `${RENDER_URL}${webhookPath}`;

bot.telegram.setWebhook(fullWebhookUrl, { drop_pending_updates: true })
    .then(() => console.log(`Webhook set successfully to: ${fullWebhookUrl}`))
    .catch((err) => console.error('Webhook set error:', err));

const server = http.createServer((req, res) => {
    try {
        if (req.url === webhookPath && req.method === 'POST') {
            return bot.webhookCallback(webhookPath)(req, res);
        } else if (req.url === '/' || req.url === '/ping') {
            res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Connection': 'keep-alive' });
            return res.end('OK');
        } else {
            res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
            return res.end('Bot is running live via Webhook!');
        }
    } catch (err) {
        console.error('Server Request Error:', err);
        try {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Internal Server Error');
        } catch (e) {}
    }
});

server.listen(PORT, () => {
    console.log(`HTTP Server listening on port ${PORT}`);
    
    // সেলফ-পিং লজিক (রেন্ডারকে সচল রাখার ব্যাকআপ মেকানিজম)
    setInterval(() => {
        https.get(`${RENDER_URL}/ping`, (res) => {
            res.on('data', () => {}); // ডাটা ড্রেইন করার জন্য
        }).on('error', (err) => {});
    }, 60 * 1000);
});

process.once('SIGINT', () => {
    if (bot && typeof bot.stop === 'function') bot.stop('SIGINT');
});
process.once('SIGTERM', () => {
    if (bot && typeof bot.stop === 'function') bot.stop('SIGTERM');
});
