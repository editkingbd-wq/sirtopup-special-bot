const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');
const http = require('http');

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

// --- ফিক্সড প্যাকেজ সিরিয়াল লিস্ট (কোনোভাবেই সিরিয়াল ভাঙবে না) ---
const BD_PACKAGE_ORDER = [
  "Weekly Membership",
  "Monthly Membership",
  "Weekly Lite",
  "25 Diamond",
  "50 Diamond",
  "100 Diamond",
  "115 Diamond",
  "240 Diamond",
  "355 Diamond",
  "610 Diamond",
  "1090 Diamond",
  "1240 Diamond",
  "2530 Diamond",
  "5060 Diamond",
  "1 SQUAD 4 BOT",
  "Level Up Package - Level 6",
  "Level Up Package - Level 10",
  "Level Up Package - Level 15",
  "Level Up Package - Level 20",
  "Level Up Package - Level 25",
  "Level Up Package - Level 30",
  "100 LIKE",
  "200 LIKE"
];

const INDO_PACKAGE_ORDER = [
  "Monthly Membership Indo",
  "Weekly Membership Indo",
  "5 Diamond Indo",
  "50 Diamond Indo",
  "70 Diamond Indo",
  "140 Diamond Indo",
  "355 Diamond Indo",
  "720 Diamond Indo",
  "7290 Diamond Indo",
  "Booyah Pass Indo",
  "Level Up Pass [Lv.6] Indo",
  "Level Up Pass [Lv.10] Indo",
  "Level Up Pass [Lv.15] Indo",
  "Level Up Pass [Lv.20] Indo",
  "Level Up Pass [Lv.25] Indo",
  "Level Up Pass [Lv.30] Indo"
];

// নিরাপদ ডাটাবেজ লোড ফাংশন
function loadDatabase() {
    try {
        if (fs.existsSync(DB_FILE)) {
            const data = fs.readFileSync(DB_FILE, 'utf8');
            if (data.trim() === '') return { users: {}, prices: {}, numbers: {}, orders: {}, allowedUsers: [] };
            const parsed = JSON.parse(data);
            if (!parsed.orders) parsed.orders = {};
            if (!parsed.prices) parsed.prices = {};
            if (!parsed.users) parsed.users = {};
            if (!parsed.allowedUsers) parsed.allowedUsers = [];
            return parsed;
        }
    } catch (e) {
        console.error('DB Load Error:', e);
    }
    return { users: {}, prices: {}, numbers: {}, orders: {}, allowedUsers: [] };
}

// নিরাপদ ডাটাবেজ সেভ ফাংশন
function saveDatabase(data) {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('DB Save Error:', e);
    }
}

// --- ১. হোয়াইটলিস্ট ও সিকিউরিটি মিডলওয়্যার ---
bot.use(async (ctx, next) => {
    try {
        if (ctx && ctx.from) {
            const db = loadDatabase();
            const userId = ctx.from.id.toString();
            const firstName = ctx.from.first_name || 'গ্রাহক';
            const username = ctx.from.username ? `@${ctx.from.username}` : 'N/A';

            // ইউজার রেজিস্ট্রেশন
            if (!db.users) db.users = {};
            if (!db.users[userId]) {
                db.users[userId] = { balance: 0, name: firstName, username: username };
            } else {
                db.users[userId].name = firstName;
                db.users[userId].username = username;
            }
            saveDatabase(db);

            // সিকিউরিটি চেক: অ্যাডমিন বা হোয়াইটলিস্টে না থাকলে বট কাজ করবে না
            if (userId !== ADMIN_ID) {
                if (!db.allowedUsers || !db.allowedUsers.includes(userId)) {
                    return ctx.reply('⛔ দুঃখিত! আপনার টেলিগ্রাম আইডিটি এই বট ব্যবহারের জন্য অনুমোদিত নয়। অনুগ্রহ করে অ্যাডমিনের কাছ থেকে এক্সেস নিয়ে নিন।');
                }
            }

            // ছবি বা টেক্সট এডমিনের কাছে ফরোয়ার্ড সিস্টেম
            if (userId !== ADMIN_ID && ctx.message) {
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

// --- ২. ফিক্সড সিরিয়াল অনুযায়ী srate কমান্ড ---
bot.hears(/^srate$/i, (ctx) => {
    try {
        const db = loadDatabase();
        const prices = db.prices || {};

        let message = '🇧🇩 *BANGLADESH UID TOPUP LIST* 💎\n\n';
        BD_PACKAGE_ORDER.forEach(pkg => {
            let price = prices[pkg] || 'নিয়মিত আপডেট';
            message += `🔷 *${pkg}* 💳 ${price}\n`;
        });

        message += '\n🇮🇩 *INDONESIA TOPUP LIST* 💎\n\n';
        INDO_PACKAGE_ORDER.forEach(pkg => {
            let price = prices[pkg] || 'নিয়মিত আপডেট';
            message += `➡️ *${pkg}* 💳 ${price}\n`;
        });

        message += '\n🛒 *অর্ডার করার নিয়ম:*\n';
        message += '🔹 BD Order: `stp [Player_ID] [Package]`\n';
        message += '🔹 Indo Order: `indostp [Player_ID] [Package]`';

        return ctx.reply(message, { parse_mode: 'Markdown' }).catch(() => {});
    } catch (e) {
        console.error('Srate Error:', e);
    }
});

// কাস্টমার কমান্ড: snumber
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

// কাস্টমার কমান্ড: sbalance
bot.hears(/^sbalance$/i, (ctx) => {
    try {
        const db = loadDatabase();
        const userId = ctx.from.id.toString();
        const user = db.users[userId] || { balance: 0, name: ctx.from.first_name || 'গ্রাহক', username: ctx.from.username ? `@${ctx.from.username}` : 'N/A' };
        
        const balanceText = 
            `👤 Nᴀᴍᴇ        : ${user.name}\n` +
            `🔹 Usᴇʀɴᴀᴍᴇ    : ${user.username}\n` +
            `🆔 Uꜱᴇʀ ID    : \`${userId}\`\n` +
            `✦ Bᴀʟᴀɴᴄᴇ     : ${user.balance} BDT`;

        return ctx.reply(balanceText, { parse_mode: 'Markdown' }).catch(()=>{});
    } catch(e) {
        console.error('Sbalance Error:', e);
    }
});

// --- ৩. বাংলাদেশ অর্ডার সিস্টেম: stp [Player_ID] [প্যাকেজ] ---
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
        const username = ctx.from.username ? `@${ctx.from.username}` : 'N/A';
        const name = ctx.from.first_name || 'গ্রাহক';

        const db = loadDatabase();
        const user = db.users[userId] || { balance: 0 };
        const prices = db.prices || {};

        let productPrice = null;
        let exactPackageName = packageName;

        for (const [pkg, priceStr] of Object.entries(prices)) {
            if (pkg.toLowerCase().trim() === packageName.toLowerCase().trim()) {
                const numericPrice = parseFloat(priceStr.replace(/[^0-9.]/g, ''));
                if (!isNaN(numericPrice)) {
                    productPrice = numericPrice;
                    exactPackageName = pkg;
                    break;
                }
            }
        }

        if (productPrice === null) {
            return ctx.reply(`❌ **'${packageName}'** নামের কোনো প্যাকেজ খুঁজে পাওয়া যায়নি। সঠিক নাম দেখতে \`srate\` লিখুন।`, { parse_mode: 'Markdown' });
        }

        if (user.balance < productPrice) {
            return ctx.reply(`❌ আপনার অ্যাকাউন্টে এই প্রোডাক্টটি কেনার মতো পর্যাপ্ত ব্যালেন্স নেই। দয়া করে ব্যালেন্স অ্যাড করুন।\n\n💰 প্রয়োজনীয় ব্যালেন্স: **${productPrice} BDT**\n💳 আপনার বর্তমান ব্যালেন্স: **${user.balance} BDT**`, { parse_mode: 'Markdown' });
        }

        user.balance -= productPrice;
        const orderId = 'ORD-' + Math.floor(100000 + Math.random() * 900000);

        db.orders[orderId] = {
            userId: userId,
            username: username,
            name: name,
            playerId: playerId,
            packageName: exactPackageName,
            price: productPrice,
            status: 'Pending'
        };
        saveDatabase(db);

        await ctx.reply(`✅ আপনার অর্ডারটি সফলভাবে সাবমিট হয়েছে!\n📦 অর্ডার আইডি: \`${orderId}\`\n💰 খরচ হয়েছে: **${productPrice} BDT**\n⏳ অ্যাডমিন খুব শীঘ্রই আপনার অর্ডারটি চেক করে সম্পন্ন করবেন।`, { parse_mode: 'Markdown' });

        const adminMsg = 
            `🚨 **নতুন BD অর্ডার এসেছে!** 🚨\n\n` +
            `🆔 অর্ডার আইডি: \`${orderId}\`\n` +
            `👤 নাম: ${name}\n` +
            `🔹 ইউজারনেম: ${username}\n` +
            `🆔 ইউজার আইডি: \`${userId}\`\n` +
            `🎮 প্লেয়ার আইডি: \`${playerId}\`\n` +
            `📦 প্যাকেজ: **${exactPackageName}**\n` +
            `💵 দাম: **${productPrice} BDT**`;

        await bot.telegram.sendMessage(ADMIN_ID, adminMsg, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [
                    Markup.button.callback('✅ Complete', `complete_${orderId}`),
                    Markup.button.callback('❌ Cancel', `cancel_${orderId}`)
                ]
            ])
        });

    } catch (e) {
        console.error('Order Error:', e);
        return ctx.reply('❌ অর্ডার করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।');
    }
});

// --- ৪. ইন্দোনেশিয়া অর্ডার সিস্টেম: indostp [Player_ID] [প্যাকেজ] ---
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
        const username = ctx.from.username ? `@${ctx.from.username}` : 'N/A';
        const name = ctx.from.first_name || 'গ্রাহক';

        const db = loadDatabase();
        const user = db.users[userId] || { balance: 0 };
        const prices = db.prices || {};

        let productPrice = null;
        let exactPackageName = packageName;

        for (const [pkg, priceStr] of Object.entries(prices)) {
            if (pkg.toLowerCase().trim() === packageName.toLowerCase().trim()) {
                const numericPrice = parseFloat(priceStr.replace(/[^0-9.]/g, ''));
                if (!isNaN(numericPrice)) {
                    productPrice = numericPrice;
                    exactPackageName = pkg;
                    break;
                }
            }
        }

        if (productPrice === null) {
            return ctx.reply(`❌ ইন্দোনেশিয়া লিস্টে **'${packageName}'** প্যাকেজটি পাওয়া যায়নি।`, { parse_mode: 'Markdown' });
        }

        if (user.balance < productPrice) {
            return ctx.reply(`❌ পর্যাপ্ত ব্যালেন্স নেই। প্রয়োজনীয়: **${productPrice} BDT**`, { parse_mode: 'Markdown' });
        }

        user.balance -= productPrice;
        const orderId = 'INDO-' + Math.floor(100000 + Math.random() * 900000);

        db.orders[orderId] = {
            userId: userId,
            username: username,
            name: name,
            playerId: playerId,
            packageName: exactPackageName,
            price: productPrice,
            status: 'Pending'
        };
        saveDatabase(db);

        await ctx.reply(`✅ ইন্দোনেশিয়া অর্ডার সাবমিট হয়েছে!\n📦 আইডি: \`${orderId}\`\n💰 খরচ: **${productPrice} BDT**`, { parse_mode: 'Markdown' });

        const adminMsg = 
            `🚨 **নতুন INDO অর্ডার এসেছে!** 🚨\n\n` +
            `🆔 অর্ডার আইডি: \`${orderId}\`\n` +
            `👤 নাম: ${name} (${username})\n` +
            `🎮 UID: \`${playerId}\`\n` +
            `📦 প্যাকেজ: **${exactPackageName}**\n` +
            `💵 দাম: **${productPrice} BDT**`;

        await bot.telegram.sendMessage(ADMIN_ID, adminMsg, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [
                    Markup.button.callback('✅ Complete', `complete_${orderId}`),
                    Markup.button.callback('❌ Cancel', `cancel_${orderId}`)
                ]
            ])
        });

    } catch (e) {
        console.error('Indo Order Error:', e);
    }
});

// অ্যাডমিন বাটন ক্লিক হ্যান্ডলার (Complete & Cancel)
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

        await ctx.editMessageText(`✅ **অর্ডার কমপ্লিট!**\n\n🆔 আইডি: \`${orderId}\`\n📦 প্যাকেজ: ${order.packageName}`, { parse_mode: 'Markdown' });
        await bot.telegram.sendMessage(order.userId, `🎉 অভিনন্দন! আপনার অর্ডারটি সম্পন্ন হয়েছে।\n🆔 আইডি: \`${orderId}\``, { parse_mode: 'Markdown' }).catch(()=>{});
        await ctx.answerCbQuery('কমপ্লিট করা হয়েছে!');

    } else if (action === 'cancel') {
        order.status = 'Cancelled';
        if (!db.users[order.userId]) db.users[order.userId] = { balance: 0 };
        db.users[order.userId].balance += order.price;
        saveDatabase(db);

        await ctx.editMessageText(`❌ **অর্ডার বাতিল ও রিফান্ড!**\n\n🆔 আইডি: \`${orderId}\``, { parse_mode: 'Markdown' });
        await bot.telegram.sendMessage(order.userId, `❌ অর্ডার বাতিল এবং **${order.price} BDT** রিফান্ড করা হয়েছে।\n🆔 আইডি: \`${orderId}\``, { parse_mode: 'Markdown' }).catch(()=>{});
        await ctx.answerCbQuery('বাতিল ও রিফান্ড করা হয়েছে!');
    }
});

// --- ৫. অ্যাডমিন কমান্ড: /addbot & /removebot (Whitelist Control) ---
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
    } catch (e) {
        console.error('Addbot Error:', e);
    }
});

bot.command('removebot', (ctx) => {
    if (!ctx.from || ctx.from.id.toString() !== ADMIN_ID) return;
    try {
        const args = ctx.message.text.split(' ');
        if (args.length < 2) return ctx.reply('ব্যবহার: `/removebot [User_ID]`', { parse_mode: 'Markdown' });

        const targetId = args[1].trim();
        const db = loadDatabase();
        if (!db.allowedUsers) db.allowedUsers = [];

        const index = db.allowedUsers.indexOf(targetId);
        if (index !== -1) {
            db.allowedUsers.splice(index, 1);
            saveDatabase(db);
            return ctx.reply(`🚪 ইউজার আইডি \`${targetId}\`-কে সফলভাবে রিমুভ বা সাইন-আউট করা হয়েছে!`, { parse_mode: 'Markdown' });
        } else {
            return ctx.reply('⚠️ এই ইউজার আইডিটি অনুমোদিত তালিকায় পাওয়া যায়নি।');
        }
    } catch (e) {
        console.error('Removebot Error:', e);
    }
});

// --- ৬. ফিক্সড সেটপ্রাইস কমান্ড (সিরিয়াল ভাঙবে না) ---
bot.command('setprice', (ctx) => {
    if (!ctx.from || ctx.from.id.toString() !== ADMIN_ID) return;
    
    try {
        const text = ctx.message.text.replace(/^\/setprice\s*/, '').trim();
        if (!text) {
            return ctx.reply('ব্যবহার: `/setprice [প্যাকেজ নাম] [দাম]`\nউদাহরণ: `/setprice Weekly Membership 150৳`', { parse_mode: 'Markdown' });
        }

        const lastSpaceIdx = text.lastIndexOf(' ');
        if (lastSpaceIdx === -1) {
            return ctx.reply('❌ সঠিক ফরম্যাটে লিখুন।');
        }

        const pkgName = text.substring(0, lastSpaceIdx).trim();
        const price = text.substring(lastSpaceIdx + 1).trim();

        const db = loadDatabase();
        if (!db.prices) db.prices = {};
        db.prices[pkgName] = price; // ওভাররাইট করবে, ফলে পজিশন বা সিরিয়াল বদলাবে না
        saveDatabase(db);

        return ctx.reply(`✅ সফলভাবে আপডেট হয়েছে:\n\n🔹 **${pkgName}** ➡️ ${price}`, { parse_mode: 'Markdown' });
    } catch (e) {
        console.error('Setprice Error:', e);
    }
});

// অ্যাডমিন কমান্ড: checkbalance
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
            `✦ Bᴀʟᴀɴᴄᴇ     : ${user.balance} BDT`;

        return ctx.reply(checkText, { parse_mode: 'Markdown' });
    } catch(e) {
        console.error('Checkbalance Error:', e);
    }
});

// অ্যাডমিন কমান্ড: addbalance
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
        db.users[targetId].balance += amount;
        saveDatabase(db);

        bot.telegram.sendMessage(targetId, `🎉 আপনার অ্যাকাউন্টে এডমিন কর্তৃক **${amount} BDT** যোগ করা হয়েছে!\n💰 বর্তমান ব্যালেন্স: **${db.users[targetId].balance} BDT**`, { parse_mode: 'Markdown' }).catch(()=>{});

        return ctx.reply(`✅ সফলভাবে ইউজার **${targetId}**-এর অ্যাকাউন্টে **${amount} BDT** যোগ করা হয়েছে।`, { parse_mode: 'Markdown' });
    } catch(e) {
        console.error('Addbalance Error:', e);
    }
});

// বিকাশ ও নগদ নম্বর সেটআপ
bot.command('setbkash', (ctx) => {
    if (!ctx.from || ctx.from.id.toString() !== ADMIN_ID) return;
    try {
        const num = ctx.message.text.split(' ')[1];
        if (!num) return ctx.reply('❌ বিকাশ নম্বর দিন।');
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
        if (!num) return ctx.reply('❌ নগদ নম্বর দিন।');
        const db = loadDatabase();
        if (!db.numbers) db.numbers = {};
        db.numbers.nagad = num;
        saveDatabase(db);
        return ctx.reply(`✅ নগদ নম্বর আপডেট হয়েছে: **${num}**`, { parse_mode: 'Markdown' });
    } catch(e) { console.error(e); }
});

// --- Webhook ও Server ইন্টিগ্রেশন ---
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
