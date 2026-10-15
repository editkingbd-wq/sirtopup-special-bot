const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');
const http = require('http');

// --- আল্ট্রা-সিকিউর গ্লোবাল এরর হ্যান্ডলার (বট কখনো অফ বা ক্র্যাশ করবে না) ---
process.on('uncaughtException', (err) => {
    console.error('CRITICAL UNCAUGHT EXCEPTION:', err);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('CRITICAL UNHANDLED REJECTION:', reason);
});

// কনফিগারেশন
const BOT_TOKEN = process.env.BOT_TOKEN || '8395471740:AAH_nVx7DbJMsLJLzmpYvm2d1OrmEryy8ZI';
const ADMIN_ID = process.env.ADMIN_ID || '5932254012';

// Render URL নির্ধারণ (Render ফ্রিতে স্বয়ংক্রিয়ভাবে RENDER_EXTERNAL_URL পাওয়া যায়)
const RENDER_URL = process.env.RENDER_EXTERNAL_URL || 'https://sirtopup-special-bot-1.onrender.com';
const PORT = process.env.PORT || 3000;

const bot = new Telegraf(BOT_TOKEN);
const DB_FILE = 'database.json';

// নিরাপদ ডাটাবেজ লোড ফাংশন
function loadDatabase() {
    try {
        if (fs.existsSync(DB_FILE)) {
            const data = fs.readFileSync(DB_FILE, 'utf8');
            if (data.trim() === '') return { users: {}, prices: {}, numbers: {}, orders: {} };
            const parsed = JSON.parse(data);
            if (!parsed.orders) parsed.orders = {};
            if (!parsed.prices) parsed.prices = {};
            return parsed;
        }
    } catch (e) {
        console.error('DB Load Error:', e);
    }
    return { users: {}, prices: {}, numbers: {}, orders: {} };
}

// নিরাপদ ডাটাবেজ সেভ ফাংশন
function saveDatabase(data) {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('DB Save Error:', e);
    }
}

// ইউজার অটো-রেজিস্ট্রেশন মিডলওয়্যার
bot.use(async (ctx, next) => {
    try {
        if (ctx && ctx.from) {
            const db = loadDatabase();
            const userId = ctx.from.id.toString();
            if (!db.users) db.users = {};
            if (!db.users[userId]) {
                db.users[userId] = { balance: 0 };
                saveDatabase(db);
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
        `🔹 \`stp [Player_ID] [প্যাকেজ]\` - অটো অর্ডার করুন\n` +
        `🔹 \`sverify [TrxID]\` - পেমেন্ট ভেরিফাই করুন`,
        { parse_mode: 'Markdown' }
    ).catch(()=>{});
});

// কাস্টমার কমান্ড: srate (প্যাকেজ তালিকা)
bot.hears(/^srate$/i, (ctx) => {
    try {
        const db = loadDatabase();
        let priceText = `💳 **SIR TOPUP Price List** 💳\n\n`;
        const prices = db.prices || {};
        
        if (Object.keys(prices).length === 0) {
            priceText += `❌ এই মুহূর্তে কোনো প্যাকেজ যুক্ত করা হয়নি।`;
        } else {
            for (const [pkg, price] of Object.entries(prices)) {
                priceText += `🔹 ${pkg} ➡️ ${price}\n`;
            }
        }
        return ctx.reply(priceText, { parse_mode: 'Markdown' }).catch(() => {});
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

// কাস্টমার কমান্ড: sbalance (আপনার কাঙ্ক্ষিত ফ্যান্সি ফরম্যাট)
bot.hears(/^sbalance$/i, (ctx) => {
    try {
        const db = loadDatabase();
        const userId = ctx.from.id.toString();
        const user = db.users[userId] || { balance: 0 };
        
        const balanceText = 
            `♡ Nᴀᴍᴇ        : ${userId}\n` +
            `✦ Bᴀʟᴀɴᴄᴇ     : ${user.balance} BDT`;

        return ctx.reply(balanceText, { parse_mode: 'Markdown' }).catch(()=>{});
    } catch(e) {
        console.error('Sbalance Error:', e);
    }
});

// কাস্টমার স্মার্ট অর্ডার সিস্টেম: stp [Player_ID] [প্যাকেজ]
bot.hears(/^stp\s+(.+)/i, async (ctx) => {
    try {
        const text = ctx.message.text.replace(/^stp\s+/i, '').trim();
        const parts = text.split(' ');
        if (parts.length < 2) {
            return ctx.reply('❌ অর্ডার করার সঠিক নিয়ম: `stp [Player_ID] [প্যাকেজের নাম]`\nউদাহরণ: `stp 12345678 Wᴇᴇᴋʟʏ Mᴇᴍʙᴇʀsʜɪᴘ`', { parse_mode: 'Markdown' });
        }

        const playerId = parts[0];
        const packageName = parts.slice(1).join(' ');
        const userId = ctx.from.id.toString();
        const username = ctx.from.username ? `@${ctx.from.username}` : 'N/A';

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

        // ⚠️ ব্যালেন্স চেক (কম থাকলে অ্যাডমিনকে মেসেজ যাবে না)
        if (user.balance < productPrice) {
            return ctx.reply(`❌ আপনার অ্যাকাউন্টে এই প্রোডাক্টটি কেনার মতো পর্যাপ্ত ব্যালেন্স নেই। দয়া করে ব্যালেন্স অ্যাড করুন।\n\n💰 প্রয়োজনীয় ব্যালেন্স: **${productPrice} BDT**\n💳 আপনার বর্তমান ব্যালেন্স: **${user.balance} BDT**`, { parse_mode: 'Markdown' });
        }

        user.balance -= productPrice;

        const orderId = 'ORD-' + Math.floor(100000 + Math.random() * 900000);

        db.orders[orderId] = {
            userId: userId,
            username: username,
            playerId: playerId,
            packageName: exactPackageName,
            price: productPrice,
            status: 'Pending'
        };
        saveDatabase(db);

        await ctx.reply(`✅ আপনার অর্ডারটি সফলভাবে সাবমিট হয়েছে!\n📦 অর্ডার আইডি: \`${orderId}\`\n💰 খরচ হয়েছে: **${productPrice} BDT**\n⏳ অ্যাডমিন খুব শীঘ্রই আপনার অর্ডারটি চেক করে সম্পন্ন করবেন।`, { parse_mode: 'Markdown' });

        const adminMsg = 
            `🚨 **নতুন অর্ডার এসেছে!** 🚨\n\n` +
            `🆔 অর্ডার আইডি: \`${orderId}\`\n` +
            `👤 ইউজার আইডি: \`${userId}\` (${username})\n` +
            `🎮 প্লেয়ার আইডি: \`${playerId}\`\n` +
            `📦 প্যাকেজ: **${exactPackageName}**\n` +
            `💵 দাম: **${productPrice} BDT**\n` +
            `📌 স্ট্যাটাস: পেন্ডিং`;

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

// অ্যাডমিন বাটন ক্লিক হ্যান্ডলার (Complete & Cancel)
bot.action(/^(complete|cancel)_(.+)$/, async (ctx) => {
    if (!ctx.from || ctx.from.id.toString() !== ADMIN_ID) {
        return ctx.answerCbQuery('⚠️ আপনি এই কাজের জন্য অনুমোদিত নন!');
    }

    const action = ctx.match[1];
    const orderId = ctx.match[2];

    const db = loadDatabase();
    if (!db.orders || !db.orders[orderId]) {
        return ctx.answerCbQuery('❌ অর্ডারটি খুঁজে পাওয়া যায়নি বা ইতিমধ্যে প্রসেস হয়েছে।');
    }

    const order = db.orders[orderId];

    if (action === 'complete') {
        order.status = 'Completed';
        saveDatabase(db);

        await ctx.editMessageText(`✅ **অর্ডার কমপ্লিট করা হয়েছে!**\n\n🆔 অর্ডার আইডি: \`${orderId}\`\n👤 ইউজার: \`${order.userId}\`\n📦 প্যাকেজ: ${order.packageName}\n📌 স্ট্যাটাস: Completed`, { parse_mode: 'Markdown' });

        try {
            await bot.telegram.sendMessage(order.userId, `🎉 অভিনন্দন! আপনার অর্ডারটি সফলভাবে সম্পন্ন হয়েছে।\n📦 অর্ডার আইডি: \`${orderId}\`\n📦 প্যাকেজ: ${order.packageName}`, { parse_mode: 'Markdown' });
        } catch (err) {
            console.error('Failed to notify user:', err);
        }

        await ctx.answerCbQuery('অর্ডার সফলভাবে কমপ্লিট করা হয়েছে!');

    } else if (action === 'cancel') {
        order.status = 'Cancelled';
        
        if (!db.users[order.userId]) db.users[order.userId] = { balance: 0 };
        db.users[order.userId].balance += order.price;
        saveDatabase(db);

        await ctx.editMessageText(`❌ **অর্ডার বাতিল করা হয়েছে (টাকা রিফান্ড করা হয়েছে)!**\n\n🆔 অর্ডার আইডি: \`${orderId}\`\n👤 ইউজার: \`${order.userId}\`\n📦 প্যাকেজ: ${order.packageName}\n📌 স্ট্যাটাস: Cancelled`, { parse_mode: 'Markdown' });

        try {
            await bot.telegram.sendMessage(order.userId, `❌ দুঃখিত! আপনার অর্ডারটি বাতিল করা হয়েছে এবং **${order.price} BDT** আপনার ব্যালেন্সে রিফান্ড করা হয়েছে।\n📦 অর্ডার আইডি: \`${orderId}\``, { parse_mode: 'Markdown' });
        } catch (err) {
            console.error('Failed to notify user:', err);
        }

        await ctx.answerCbQuery('অর্ডার বাতিল এবং ব্যালেন্স রিফান্ড করা হয়েছে!');
    }
});

// অ্যাডমিন কমান্ড: /setprice
bot.command('setprice', (ctx) => {
    if (!ctx.from || ctx.from.id.toString() !== ADMIN_ID) return;
    
    try {
        const text = ctx.message.text.replace(/^\/setprice\s*/, '').trim();
        if (!text) {
            return ctx.reply('ব্যবহার: `/setprice [প্যাকেজ নাম ও ইমোজি] [দাম]`\nউদাহরণ: `/setprice Wᴇᴇᴋʟʏ Mᴇᴍʙᴇʀsʜɪᴘ 💳 150৳`', { parse_mode: 'Markdown' });
        }

        const lastSpaceIdx = text.lastIndexOf(' ');
        if (lastSpaceIdx === -1) {
            return ctx.reply('❌ দয়া করে প্যাকেজ নামের পরে একটি স্পেস দিয়ে দাম লিখুন।');
        }

        const pkgName = text.substring(0, lastSpaceIdx).trim();
        const price = text.substring(lastSpaceIdx + 1).trim();

        const db = loadDatabase();
        if (!db.prices) db.prices = {};
        db.prices[pkgName] = price;
        saveDatabase(db);

        return ctx.reply(`✅ সফলভাবে প্যাকেজ যুক্ত হয়েছে:\n\n🔹 **${pkgName}** ➡️ ${price}`, { parse_mode: 'Markdown' });
    } catch (e) {
        console.error('Setprice Error:', e);
        return ctx.reply('❌ প্যাকেজ সেট করতে গিয়ে সমস্যা হয়েছে। আবার চেষ্টা করুন।');
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
        const user = db.users[targetId] || { balance: 0 };
        
        const checkText = 
            `♡ Nᴀᴍᴇ        : ${targetId}\n` +
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
        if (!db.users[targetId]) db.users[targetId] = { balance: 0 };
        db.users[targetId].balance += amount;
        saveDatabase(db);

        return ctx.reply(`✅ সফলভাবে ইউজার **${targetId}**-এর অ্যাকাউন্টে **${amount} BDT** যোগ করা হয়েছে।`, { parse_mode: 'Markdown' });
    } catch(e) {
        console.error('Addbalance Error:', e);
    }
});

// বিকাশ ও নগদ সেটআপ
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

// --- Webhook ও Server ইন্টিগ্রেশন (৪০৯ কনফ্লিক্ট চিরতরে দূর করতে) ---
const webhookPath = `/secret-path-${BOT_TOKEN.split(':')[0]}`;
const fullWebhookUrl = `${RENDER_URL}${webhookPath}`;

// টেলিগ্রাম সার্ভারে ওয়েবহুক সেট করা
bot.telegram.setWebhook(fullWebhookUrl, { drop_pending_updates: true })
    .then(() => {
        console.log(`Webhook set successfully to: ${fullWebhookUrl}`);
    })
    .catch((err) => {
        console.error('Webhook set error:', err);
    });

// সার্ভার চালু করা যা রেন্ডার থেকে আসা আপডেট হ্যান্ডেল করবে
const server = http.createServer((req, res) => {
    if (req.url === webhookPath && req.method === 'POST') {
        bot.webhookCallback(webhookPath)(req, res);
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
