const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');
const http = require('http');
const https = require('https');

// --- আল্ট্রা-সিকিউর গ্লোবাল এরর হ্যান্ডলার ---
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

// --- শক্তিশালী মাল্টি-এপিআই প্লেয়ার নাম ফেচ ফাংশন ---
function checkFreeFireUID(uid) {
    return new Promise((resolve) => {
        // নতুন ও সচল এপিআই রুটসমূহ
        const apiUrls = [
            `https://glob-info2.vercel.app/info?uid=${uid}`,
            `https://free-fire-api-six.vercel.app/get_player_personal_show?server=ind&uid=${uid}`,
            `https://ff-api-src.vercel.app/api/ff?uid=${uid}`,
            `https://api.vytal.id/ff?uid=${uid}`
        ];

        let index = 0;

        function tryNextApi() {
            if (index >= apiUrls.length) {
                // সব এপিআই ব্যর্থ হলে ব্যাকআপ হিসেবে টাইটেল দেবে
                resolve(`Player (${uid})`);
                return;
            }

            const url = apiUrls[index++];
            const req = https.get(url, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);
                        // বিভিন্ন এপিআইয়ের ডাটা স্ট্রাকচার থেকে নাম ফিল্টার করা
                        let nickname = 
                            parsed.basicInfo?.nickname || 
                            parsed.name || 
                            parsed.username || 
                            parsed.data?.identity?.username || 
                            parsed.accountName ||
                            parsed.nickname;

                        if (nickname && nickname.trim() !== '') {
                            resolve(nickname);
                        } else {
                            tryNextApi();
                        }
                    } catch (e) {
                        tryNextApi();
                    }
                });
            });

            req.on('error', () => {
                tryNextApi();
            });

            req.setTimeout(3500, () => {
                req.destroy();
                tryNextApi();
            });
        }

        tryNextApi();
    });
}

// --- প্যাকেজ সিরিয়াল ও সঠিক ইমোজি লিস্ট ---
const BD_PACKAGE_ORDER = [
  { name: "Weekly Membership", display: "Weekly Membership 💳" },
  { name: "Monthly Membership", display: "Monthly Membership 💳" },
  { name: "Weekly Lite", display: "Weekly Lite 💳" },
  { name: "25 Diamond", display: "25 💎 Diamond" },
  { name: "50 Diamond", display: "50 💎 Diamond" },
  { name: "100 Diamond", display: "100 💎 Diamond" },
  { name: "115 Diamond", display: "115 💎 Diamond" },
  { name: "240 Diamond", display: "240 💎 Diamond" },
  { name: "355 Diamond", display: "355 💎 Diamond" },
  { name: "610 Diamond", display: "610 💎 Diamond" },
  { name: "1090 Diamond", display: "1090 💎 Diamond" },
  { name: "1240 Diamond", display: "1240 💎 Diamond" },
  { name: "2530 Diamond", display: "2530 💎 Diamond" },
  { name: "5060 Diamond", display: "5060 💎 Diamond" },
  { name: "1 SQUAD 4 BOT", display: "1 SQUAD 4 BOT 🤖" },
  { name: "Level Up Package - Level 6", display: "Level Up Package - Level 6 💳" },
  { name: "Level Up Package - Level 10", display: "Level Up Package - Level 10 💳" },
  { name: "Level Up Package - Level 15", display: "Level Up Package - Level 15 💳" },
  { name: "Level Up Package - Level 20", display: "Level Up Package - Level 20 💳" },
  { name: "Level Up Package - Level 25", display: "Level Up Package - Level 25 💳" },
  { name: "Level Up Package - Level 30", display: "Level Up Package - Level 30 💳" },
  { name: "100 LIKE", display: "100 👍 LIKE" },
  { name: "200 LIKE", display: "200 👍 LIKE" }
];

const INDO_PACKAGE_ORDER = [
  { name: "Monthly Membership Indo", display: "MONTHLY 💳 Indo" },
  { name: "Weekly Membership Indo", display: "WEEKLY 💳 Indo" },
  { name: "5 Diamond Indo", display: "5 💎 Indo" },
  { name: "50 Diamond Indo", display: "50 💎 Indo" },
  { name: "70 Diamond Indo", display: "70 💎 Indo" },
  { name: "140 Diamond Indo", display: "140 💎 Indo" },
  { name: "355 Diamond Indo", display: "355 💎 Indo" },
  { name: "720 Diamond Indo", display: "720 💎 Indo" },
  { name: "7290 Diamond Indo", display: "7290 💎 Indo" },
  { name: "Booyah Pass Indo", display: "BOOYAH PASS 💳 Indo" },
  { name: "Level Up Pass [Lv.6] Indo", display: "Level Up Pass [Lv.6] 💳 Indo" },
  { name: "Level Up Pass [Lv.10] Indo", display: "Level Up Pass [Lv.10] 💳 Indo" },
  { name: "Level Up Pass [Lv.15] Indo", display: "Level Up Pass [Lv.15] 💳 Indo" },
  { name: "Level Up Pass [Lv.20] Indo", display: "Level Up Pass [Lv.20] 💳 Indo" },
  { name: "Level Up Pass [Lv.25] Indo", display: "Level Up Pass [Lv.25] 💳 Indo" },
  { name: "Level Up Pass [Lv.30] Indo", display: "Level Up Pass [Lv.30] 💳 Indo" }
];

// ডিফল্ট প্রাইস লিস্ট
const DEFAULT_PRICES = {
  "Weekly Membership": "150৳",
  "Monthly Membership": "740৳",
  "Weekly Lite": "39৳",
  "25 Diamond": "20৳",
  "50 Diamond": "36৳",
  "100 Diamond": "72৳",
  "115 Diamond": "79৳",
  "240 Diamond": "157৳",
  "355 Diamond": "236৳",
  "610 Diamond": "403৳",
  "1090 Diamond": "714৳",
  "1240 Diamond": "800৳",
  "2530 Diamond": "1604৳",
  "5060 Diamond": "3210৳",
  "1 SQUAD 4 BOT": "190৳",
  "Level Up Package - Level 6": "39৳",
  "Level Up Package - Level 10": "66৳",
  "Level Up Package - Level 15": "66৳",
  "Level Up Package - Level 20": "66৳",
  "Level Up Package - Level 25": "66৳",
  "Level Up Package - Level 30": "95৳",
  "100 LIKE": "10৳",
  "200 LIKE": "19৳",
  "Monthly Membership Indo": "740৳",
  "Weekly Membership Indo": "240৳",
  "5 Diamond Indo": "10৳",
  "50 Diamond Indo": "63৳",
  "70 Diamond Indo": "82৳",
  "140 Diamond Indo": "164৳",
  "355 Diamond Indo": "410৳",
  "720 Diamond Indo": "820৳",
  "7290 Diamond Indo": "8000৳",
  "Booyah Pass Indo": "364৳",
  "Level Up Pass [Lv.6] Indo": "48৳",
  "Level Up Pass [Lv.10] Indo": "77৳",
  "Level Up Pass [Lv.15] Indo": "77৳",
  "Level Up Pass [Lv.20] Indo": "77৳",
  "Level Up Pass [Lv.25] Indo": "77৳",
  "Level Up Pass [Lv.30] Indo": "120৳"
};

// নিরাপদ ডাটাবেজ লোড ফাংশন
function loadDatabase() {
    try {
        if (fs.existsSync(DB_FILE)) {
            const data = fs.readFileSync(DB_FILE, 'utf8');
            if (data.trim() === '') return { users: {}, prices: DEFAULT_PRICES, numbers: {}, orders: {}, allowedUsers: [] };
            const parsed = JSON.parse(data);
            if (!parsed.orders) parsed.orders = {};
            if (!parsed.prices || Object.keys(parsed.prices).length === 0) {
                parsed.prices = DEFAULT_PRICES;
            } else {
                for (let key in DEFAULT_PRICES) {
                    if (!parsed.prices[key]) {
                        parsed.prices[key] = DEFAULT_PRICES[key];
                    }
                }
            }
            if (!parsed.users) parsed.users = {};
            if (!parsed.allowedUsers) parsed.allowedUsers = [];
            if (!parsed.numbers) parsed.numbers = {};
            return parsed;
        }
    } catch (e) {
        console.error('DB Load Error:', e);
    }
    return { users: {}, prices: DEFAULT_PRICES, numbers: {}, orders: {}, allowedUsers: [] };
}

// নিরাপদ ডাটাবেজ সেভ ফাংশন
function saveDatabase(data) {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('DB Save Error:', e);
    }
}

// --- হোয়াইটলিস্ট ও সিকিউরিটি মিডলওয়্যার ---
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
                    db.users[userId] = { balance: 0, name: firstName, username: username };
                } else {
                    db.users[userId].name = firstName;
                    db.users[userId].username = username;
                }
                saveDatabase(db);
            }

            // --- ADMIN REPLY TO CUSTOMER LOGIC ---
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
                    
                    await bot.telegram.sendPhoto(ADMIN_ID, photoFileId, {
                        caption: captionMsg,
                        parse_mode: 'Markdown'
                    }).catch(err => console.error('Failed to forward photo:', err));
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
        `🔹 \`srate\` - প্যাকেজ ও দামের তালিকা দেখুন\n` +
        `🔹 \`snumber\` - পেমেন্ট নম্বর দেখুন\n` +
        `🔹 \`sbalance\` - আপনার বর্তমান ব্যালেন্স দেখুন\n` +
        `🔹 \`stp [Player_ID] [প্যাকেজ]\` - BD অটো অর্ডার\n` +
        `🔹 \`indostp [Player_ID] [প্যাকেজ]\` - Indo অর্ডার\n` +
        `🔹 \`sverify [TrxID]\` - পেমেন্ট ভেরিফাই করুন`,
        { parse_mode: 'Markdown' }
    ).catch(()=>{});
});

// srate কমান্ড
bot.hears(/^srate$/i, (ctx) => {
    try {
        const db = loadDatabase();
        const prices = db.prices || DEFAULT_PRICES;

        let message = '🇧🇩 *BANGLADESH UID TOPUP LIST* 💎\n\n';
        BD_PACKAGE_ORDER.forEach(item => {
            let price = prices[item.name] || 'নিয়মিত আপডেট';
            message += `🔷 ${item.display} ➡️ ${price}\n`;
        });

        message += '\n🇮🇩 *INDONESIA TOPUP LIST* 💎\n\n';
        INDO_PACKAGE_ORDER.forEach(item => {
            let price = prices[item.name] || 'নিয়মিত আপডেট';
            message += `➡️ ${item.display} ➡️ ${price}\n`;
        });

        message += '\n🛒 *অর্ডার করার নিয়ম:*\n';
        message += '🔹 BD Order: `stp [Player_ID] [Package]`\n';
        message += '🔹 Indo Order: `indostp [Player_ID] [Package]`';

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
        return ctx.reply(
            `💳 **Payment Numbers** 💳\n\n` +
            `📱 Bkash: ${num.bkash || '01XXXXXXXXX'} (Personal)\n` +
            `📱 Nagad: ${num.nagad || '01XXXXXXXXX'} (Personal)\n` +
            `📱 Rocket: ${num.rocket || '01XXXXXXXXX'} (Personal)`,
            { parse_mode: 'Markdown' }
        ).catch(()=>{});
    } catch(e) {
        console.error('Snumber Error:', e);
    }
});

// sbalance
bot.hears(/^sbalance$/i, (ctx) => {
    try {
        const db = loadDatabase();
        const userId = ctx.from.id.toString();
        const user = db.users[userId] || { balance: 0, name: ctx.from.first_name || 'গ্রাহক', username: ctx.from.username ? `@${ctx.from.username}` : 'N/A' };
        
        const balanceText = 
            `👤 Nᴀᴍᴇ        : ${user.name}\n` +
            `🔹 Usᴇʀɴᴀᴍᴇ    : ${user.username}\n` +
            `🆔 Uꜱᴇʀ ID    : \`${userId}\`\n` +
            `✦ BᴀʟᴀɴᴄE     : ${user.balance} BDT`;

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

        const adminMsg = 
            `🔍 **নতুন পেমেন্ট ভেরিফাই রিকোয়েস্ট (ম্যানুয়াল)!** 🔍\n\n` +
            `👤 নাম: ${name}\n` +
            `🔹 ইউজারনেম: ${username}\n` +
            `🆔 ইউজার আইডি: \`${userId}\`\n` +
            `🧾 TrxID: \`${trxId}\``;

        await bot.telegram.sendMessage(ADMIN_ID, adminMsg, { parse_mode: 'Markdown' });

    } catch (e) {
        console.error('Sverify Error:', e);
    }
});

// --- বাংলাদেশ অর্ডার (PREVIEW & VERIFICATION) ---
bot.hears(/^stp\s+(.+)/i, async (ctx) => {
    try {
        const text = ctx.message.text.replace(/^stp\s+/i, '').trim();
        const parts = text.split(' ');
        if (parts.length < 2) {
            return ctx.reply('❌ অর্ডার করার সঠিক নিয়ম: `stp [Player_ID] [প্যাকেজের নাম]`\nউদাহরণ: `stp 12345678 Weekly Membership`', { parse_mode: 'Markdown' });
        }

        const playerId = parts[0];
        const packageName = parts.slice(1).join(' ');
        const userId = ctx.from.id.toString();

        const checkingMsg = await ctx.reply(`🔍 প্লেয়ার আইডি (\`${playerId}\`) চেক করা হচ্ছে...`, { parse_mode: 'Markdown' });
        const gameNickname = await checkFreeFireUID(playerId);
        
        try {
            await ctx.telegram.deleteMessage(ctx.chat.id, checkingMsg.message_id);
        } catch(err) {}

        const db = loadDatabase();
        const user = db.users[userId] || { balance: 0 };
        const prices = db.prices || DEFAULT_PRICES;

        let productPrice = null;
        let exactPackageName = packageName;

        for (const item of BD_PACKAGE_ORDER) {
            if (item.name.toLowerCase().trim() === packageName.toLowerCase().trim()) {
                exactPackageName = item.name;
                const priceStr = prices[item.name] || DEFAULT_PRICES[item.name];
                if (priceStr) {
                    const numericPrice = parseFloat(priceStr.replace(/[^0-9.]/g, ''));
                    if (!isNaN(numericPrice)) productPrice = numericPrice;
                }
                break;
            }
        }

        if (productPrice === null) {
            return ctx.reply(`❌ **'${packageName}'** নামের কোনো প্যাকেজ খুঁজে পাওয়া যায়নি। \`srate\` দেখুন।`, { parse_mode: 'Markdown' });
        }

        if (user.balance < productPrice) {
            return ctx.reply(`❌ আপনার অ্যাকাউন্টে পর্যাপ্ত ব্যালেন্স নেই।\n\n💰 প্রয়োজনীয় ব্যালেন্স: **${productPrice} BDT**\n💳 আপনার বর্তমান ব্যালেন্স: **${user.balance} BDT**`, { parse_mode: 'Markdown' });
        }

        const tempOrderId = 'ORD-' + Math.floor(100000 + Math.random() * 900000);

        const confirmMsg = 
            `🛒 **অর্ডার কনফার্মেশন (Order Preview)**\n\n` +
            `🎮 প্লেয়ার নাম: **${gameNickname}**\n` +
            `🆔 প্লেয়ার আইডি: \`${playerId}\`\n` +
            `📦 প্যাকেজ: **${exactPackageName}**\n` +
            `💵 খরচ হবে: **${productPrice} BDT**\n` +
            `💳 বর্তমান ব্যালেন্স: **${user.balance} BDT**\n\n` +
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
            price: productPrice,
            orderType: 'BD',
            status: 'Preview'
        };
        saveDatabase(db);

    } catch (e) {
        console.error('Order Error:', e);
        return ctx.reply('❌ অর্ডার করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।');
    }
});

// --- ইন্দোনেশিয়া অর্ডার (PREVIEW & VERIFICATION) ---
bot.hears(/^indostp\s+(.+)/i, async (ctx) => {
    try {
        const text = ctx.message.text.replace(/^indostp\s+/i, '').trim();
        const parts = text.split(' ');
        if (parts.length < 2) {
            return ctx.reply('❌ অর্ডার করার সঠিক নিয়ম: `indostp [Player_ID] [প্যাকেজের নাম]`', { parse_mode: 'Markdown' });
        }

        const playerId = parts[0];
        const packageName = parts.slice(1).join(' ');
        const userId = ctx.from.id.toString();

        const checkingMsg = await ctx.reply(`🔍 ইন্দোনেশিয়া প্লেয়ার আইডি (\`${playerId}\`) চেক করা হচ্ছে...`, { parse_mode: 'Markdown' });
        const gameNickname = await checkFreeFireUID(playerId);
        
        try {
            await ctx.telegram.deleteMessage(ctx.chat.id, checkingMsg.message_id);
        } catch(err) {}

        const db = loadDatabase();
        const user = db.users[userId] || { balance: 0 };
        const prices = db.prices || DEFAULT_PRICES;

        let productPrice = null;
        let exactPackageName = packageName;

        for (const item of INDO_PACKAGE_ORDER) {
            if (item.name.toLowerCase().trim() === packageName.toLowerCase().trim()) {
                exactPackageName = item.name;
                const priceStr = prices[item.name] || DEFAULT_PRICES[item.name];
                if (priceStr) {
                    const numericPrice = parseFloat(priceStr.replace(/[^0-9.]/g, ''));
                    if (!isNaN(numericPrice)) productPrice = numericPrice;
                }
                break;
            }
        }

        if (productPrice === null) {
            return ctx.reply(`❌ ইন্দোনেশিয়া লিস্টে **'${packageName}'** প্যাকেজটি পাওয়া যায়নি।`, { parse_mode: 'Markdown' });
        }

        if (user.balance < productPrice) {
            return ctx.reply(`❌ পর্যাপ্ত ব্যালেন্স নেই। প্রয়োজনীয়: **${productPrice} BDT**`, { parse_mode: 'Markdown' });
        }

        const tempOrderId = 'INDO-' + Math.floor(100000 + Math.random() * 900000);

        const confirmMsg = 
            `🛒 **অর্ডার কনফার্মেশন (INDO Preview)**\n\n` +
            `🎮 প্লেয়ার নাম: **${gameNickname}**\n` +
            `🆔 প্লেয়ার আইডি: \`${playerId}\`\n` +
            `📦 প্যাকেজ: **${exactPackageName}**\n` +
            `💵 খরচ হবে: **${productPrice} BDT**\n` +
            `💳 বর্তমান ব্যালেন্স: **${user.balance} BDT**\n\n` +
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

// --- কাস্টমার বাটন ক্লিক হ্যান্ডলার (Confirm & Cancel) ---
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

        if (!db.users[userId]) db.users[userId] = { balance: 0 };
        const user = db.users[userId];

        if (user.balance < tempOrder.price) {
            await ctx.answerCbQuery('❌ আপনার অ্যাকাউন্টে পর্যাপ্ত ব্যালেন্স নেই!');
            return ctx.editMessageText('❌ **অর্ডার ব্যর্থ হয়েছে!** পর্যাপ্ত ব্যালেন্স নেই।');
        }

        // ব্যালেন্স কাটা হচ্ছে
        const oldBalance = user.balance;
        user.balance -= tempOrder.price;
        const newBalance = user.balance;

        tempOrder.oldBalance = oldBalance;
        tempOrder.newBalance = newBalance;
        tempOrder.status = 'Pending';
        saveDatabase(db);

        await ctx.editMessageText(
            `✅ **আপনার অর্ডারটি সফলভাবে সাবমিট হয়েছে!**\n\n` +
            `📦 অর্ডার আইডি: \`${orderId}\`\n` +
            `🎮 প্লেয়ার নাম: **${tempOrder.gameNickname}**\n` +
            `🆔 প্লেয়ার আইডি: \`${tempOrder.playerId}\`\n` +
            `📦 প্যাকেজ: **${tempOrder.packageName}**\n` +
            `💰 খরচ হয়েছে: **${tempOrder.price} BDT**\n` +
            `💳 অবশিষ্ট ব্যালেন্স: **${newBalance} BDT**\n\n` +
            `⏳ অ্যাডমিন খুব শীঘ্রই আপনার অর্ডারটি সম্পন্ন করবেন।`,
            { parse_mode: 'Markdown' }
        );

        const adminMsg = 
            `🚨 **নতুন ${orderType} অর্ডার এসেছে!** 🚨\n\n` +
            `🆔 অর্ডার আইডি: \`${orderId}\`\n` +
            `👤 নাম: ${tempOrder.name}\n` +
            `🔹 ইউজারনেম: ${tempOrder.username}\n` +
            `🆔 ইউজার আইডি: \`${userId}\`\n` +
            `🎮 প্লেয়ার নাম: **${tempOrder.gameNickname}**\n` +
            `🎮 প্লেয়ার আইডি: \`${tempOrder.playerId}\`\n` +
            `📦 প্যাকেজ: **${tempOrder.packageName}**\n` +
            `💵 দাম: **${tempOrder.price} BDT**`;

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
        return ctx.answerCbQuery('❌ অর্ডারটি পাওয়া যায়নি।');
    }

    const order = db.orders[orderId];

    if (action === 'complete') {
        order.status = 'Completed';
        saveDatabase(db);

        const adminCompleteMsg = 
            `✅ **অর্ডার কমপ্লিট!**\n\n` +
            `🆔 অর্ডার আইডি: \`${orderId}\`\n` +
            `👤 কাস্টমার নাম: ${order.name}\n` +
            `🆔 ইউজার আইডি: \`${order.userId}\`\n` +
            `🎮 প্লেয়ার নাম: **${order.gameNickname || 'N/A'}**\n` +
            `🎮 প্লেয়ার আইডি: \`${order.playerId}\`\n` +
            `📦 প্যাকেজ: **${order.packageName}**\n` +
            `💵 দাম: **${order.price} BDT**`;

        await ctx.editMessageText(adminCompleteMsg, { parse_mode: 'Markdown' });

        const customerMsg = 
            `🟢 **অর্ডার সফলভাবে সম্পূর্ণ হয়েছে! (Completed)**\n\n` +
            `🆔 অর্ডার আইডি: \`${orderId}\`\n` +
            `🎮 প্লেয়ার নাম: **${order.gameNickname || 'N/A'}**\n` +
            `🎮 প্লেয়ার ইউআইডি: \`${order.playerId}\`\n` +
            `📦 প্যাকেজের নাম: **${order.packageName}**\n\n` +
            `📊 **ব্যালেন্স হিসাব:**\n` +
            `💳 পূর্বের ব্যালেন্স: **${order.oldBalance} BDT**\n` +
            `🔻 মাইনাস হয়েছে: **-${order.price} BDT**\n` +
            `💰 বর্তমান অবশিষ্ট ব্যালেন্স: **${order.newBalance} BDT**\n\n` +
            `❤️ SIRTOPUP-এর সাথে থাকার জন্য ধন্যবাদ!`;

        await bot.telegram.sendMessage(order.userId, customerMsg, { parse_mode: 'Markdown' }).catch(()=>{});
        await ctx.answerCbQuery('কমপ্লিট করা হয়েছে!');

    } else if (action === 'cancel') {
        order.status = 'Cancelled';
        if (!db.users[order.userId]) db.users[order.userId] = { balance: 0 };
        
        db.users[order.userId].balance += order.price;
        const currentRefundedBalance = db.users[order.userId].balance;
        saveDatabase(db);

        const adminCancelMsg = 
            `❌ **অর্ডার বাতিল ও রিফান্ড করা হয়েছে!**\n\n` +
            `🆔 অর্ডার আইডি: \`${orderId}\`\n` +
            `👤 কাস্টমার নাম: ${order.name}\n` +
            `🆔 ইউজার আইডি: \`${order.userId}\`\n` +
            `🎮 প্লেয়ার নাম: **${order.gameNickname || 'N/A'}**\n` +
            `🎮 প্লেয়ার আইডি: \`${order.playerId}\`\n` +
            `📦 প্যাকেজ: **${order.packageName}**\n` +
            `💵 রিফান্ডকৃত পরিমাণ: **${order.price} BDT**`;

        await ctx.editMessageText(adminCancelMsg, { parse_mode: 'Markdown' });

        const customerCancelMsg = 
            `🔴 **অর্ডার বাতিল করা হয়েছে!**\n\n` +
            `🆔 অর্ডার আইডি: \`${orderId}\`\n` +
            `🎮 প্লেয়ার নাম: **${order.gameNickname || 'N/A'}**\n` +
            `🎮 প্লেয়ার ইউআইডি: \`${order.playerId}\`\n` +
            `📦 প্যাকেজ: **${order.packageName}**\n\n` +
            `💵 রিফান্ড করা ব্যালেন্স: **+${order.price} BDT**\n` +
            `💰 আপনার বর্তমান ব্যালেন্স: **${currentRefundedBalance} BDT**`;

        await bot.telegram.sendMessage(order.userId, customerCancelMsg, { parse_mode: 'Markdown' }).catch(()=>{});
        await ctx.answerCbQuery('বাতিল ও রিফান্ড করা হয়েছে!');
    }
});

// --- অ্যাডমিন কমান্ড: /mybotuser ---
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

            const entry = 
                `*${count}.* 👤 **নাম:** ${name}\n` +
                `    🔹 **ইউজারনেম:** ${username}\n` +
                `    🆔 **ইউজার আইডি:** \`${uId}\`\n` +
                `    💰 **ব্যালেন্স:** ${balance} BDT\n\n`;

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

// --- অ্যাডমিন কমান্ড: /smsg ---
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
    } catch(e) { console.error(e); }
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
    } catch(e) { console.error(e); }
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
    } catch(e) { console.error(e); }
});

// --- ইউজার ম্যানেজমেন্ট ---
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
            saveDatabase(db);
            return ctx.reply(`✅ সফলভাবে ইউজার আইডি \`${targetId}\`-কে বটের এক্সেস দেওয়া হয়েছে!`, { parse_mode: 'Markdown' });
        } else {
            return ctx.reply('⚠️ এই ইউজার আইডিটি ইতিমধ্যে অনুমোদিত তালিকায় রয়েছে।');
        }
    } catch (e) { console.error('Addbot Error:', e); }
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
    } catch (e) { console.error('Removebot Error:', e); }
});

bot.command('setprice', (ctx) => {
    if (!ctx.from || ctx.from.id.toString() !== ADMIN_ID) return;
    
    try {
        const text = ctx.message.text.replace(/^\/setprice\s*/, '').trim();
        if (!text) {
            return ctx.reply('ব্যবহার: `/setprice [প্যাকেজ নাম] [দাম]`', { parse_mode: 'Markdown' });
        }

        const lastSpaceIdx = text.lastIndexOf(' ');
        if (lastSpaceIdx === -1) return ctx.reply('❌ সঠিক ফরম্যাটে লিখুন।');

        const pkgName = text.substring(0, lastSpaceIdx).trim();
        const price = text.substring(lastSpaceIdx + 1).trim();

        const db = loadDatabase();
        if (!db.prices) db.prices = DEFAULT_PRICES;
        db.prices[pkgName] = price;
        saveDatabase(db);

        return ctx.reply(`✅ সফলভাবে আপডেট হয়েছে:\n\n🔹 **${pkgName}** ➡️ ${price}`, { parse_mode: 'Markdown' });
    } catch (e) { console.error('Setprice Error:', e); }
});

bot.command('checkbalance', (ctx) => {
    if (!ctx.from || ctx.from.id.toString() !== ADMIN_ID) return;
    try {
        const args = ctx.message.text.split(' ');
        if (args.length < 2) return ctx.reply('ব্যবহার: `/checkbalance [User_ID]`', { parse_mode: 'Markdown' });
        
        const targetId = args[1];
        const db = loadDatabase();
        const user = db.users[targetId] || { balance: 0, name: 'Unknown', username: 'N/A' };
        
        const checkText = 
            `👤 Nᴀᴍᴇ        : ${user.name}\n` +
            `🔹 Usᴇʀɴᴀᴍᴇ    : ${user.username}\n` +
            `🆔 Uꜱᴇʀ ID    : \`${targetId}\`\n` +
            `✦ BᴀʟᴀɴᴄE     : ${user.balance} BDT`;

        return ctx.reply(checkText, { parse_mode: 'Markdown' });
    } catch(e) { console.error('Checkbalance Error:', e); }
});

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
        if (!db.users[targetId]) db.users[targetId] = { balance: 0, name: 'Unknown', username: 'N/A' };
        
        const oldBalance = db.users[targetId].balance;
        db.users[targetId].balance += amount;
        const newBalance = db.users[targetId].balance;
        saveDatabase(db);

        if (amount >= 0) {
            const customerMsg = 
                `🎉 **আপনার অ্যাড ব্যালেন্স সফলভাবে হয়েছে!**\n\n` +
                `💳 **আগের ব্যালেন্স:** ${oldBalance} BDT\n` +
                `➕ **নতুন অ্যাড হয়েছে:** ${amount} BDT\n` +
                `💰 **বর্তমান ব্যালেন্স:** ${newBalance} BDT`;

            bot.telegram.sendMessage(targetId, customerMsg, { parse_mode: 'Markdown' }).catch(()=>{});
            return ctx.reply(`✅ সফলভাবে ইউজার **${targetId}**-এর অ্যাকাউন্টে **${amount} BDT** যোগ করা হয়েছে।`, { parse_mode: 'Markdown' });
        } else {
            const positiveAmount = Math.abs(amount);
            bot.telegram.sendMessage(targetId, `⚠️ আপনার অ্যাকাউন্ট থেকে **${positiveAmount} BDT** কাটা হয়েছে!\n💰 বর্তমান ব্যালেন্স: **${newBalance} BDT**`, { parse_mode: 'Markdown' }).catch(()=>{});
            return ctx.reply(`🔻 ইউজার **${targetId}**-এর অ্যাকাউন্ট থেকে **${positiveAmount} BDT** বিয়োগ করা হয়েছে।`, { parse_mode: 'Markdown' });
        }

    } catch(e) { console.error('Addbalance Error:', e); }
});

// --- পিন মেনু কমান্ড ---
bot.command('pinmenu', async (ctx) => {
    if (!ctx.from || ctx.from.id.toString() !== ADMIN_ID) return;
    try {
        const menuText = 
            `📌 **SIRTOPUP ADMIN COMMAND LIST**\n\n` +
            `🔹 \`/addbalance [User_ID] [টাকা]\` - ব্যালেন্স যোগ/বিয়োগ\n` +
            `🔹 \`/checkbalance [User_ID]\` - ব্যালেন্স চেক\n` +
            `🔹 \`/mybotuser\` - মোট কাস্টমার তালিকা\n` +
            `🔹 \`/smsg [User_ID] [মেসেজ]\` - ডিরেক্ট মেসেজ\n` +
            `🔹 \`/setprice [প্যাকেজ] [দাম]\` - দাম আপডেট\n` +
            `🔹 \`/setbkash [নম্বর]\` - বিকাশ নম্বর\n` +
            `🔹 \`/setnagad [নম্বর]\` - নগদ নম্বর\n` +
            `🔹 \`/setrocket [নম্বর]\` - রকেট নম্বর\n` +
            `🔹 \`/addbot [User_ID]\` - এক্সেস দেওয়া\n` +
            `🔹 \`/removebot [User_ID]\` - এক্সেস বাতিল`;

        const msg = await ctx.reply(menuText, { parse_mode: 'Markdown' });
        await ctx.pinChatMessage(msg.message_id);
        await ctx.reply('✅ অ্যাডমিন কমান্ড লিস্টটি আপনার ইনবক্সে সফলভাবে পিন করা হয়েছে!', { parse_mode: 'Markdown' });
    } catch (e) {
        console.error('Pinmenu Error:', e);
        return ctx.reply('❌ চ্যাটে পিন করতে সমস্যা হয়েছে।');
    }
});

// Webhook ও Server ইন্টিগ্রেশন
const webhookPath = `/secret-path-${BOT_TOKEN.split(':')[0]}`;
const fullWebhookUrl = `${RENDER_URL}${webhookPath}`;

bot.telegram.setWebhook(fullWebhookUrl, { drop_pending_updates: true })
    .then(() => console.log(`Webhook set successfully to: ${fullWebhookUrl}`))
    .catch((err) => console.error('Webhook set error:', err));

const server = http.createServer((req, res) => {
    if (req.url === webhookPath && req.method === 'POST') {
        bot.webhookCallback(webhookPath)(req, res);
    } else if (req.url === '/ping') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('OK');
    } else {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Bot is running live via Webhook!');
    }
});

server.listen(PORT, () => {
    console.log(`HTTP Server listening on port ${PORT}`);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
