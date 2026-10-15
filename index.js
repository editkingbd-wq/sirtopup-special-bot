const { Telegraf } = require('telegraf');
const fs = require('fs');

// --- Advanced Global Error Handlers (বট শতভাগ ক্র্যাশ-প্রুফ) ---
process.on('uncaughtException', (err) => {
    console.error('CRITICAL UNCAUGHT EXCEPTION:', err);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('CRITICAL UNHANDLED REJECTION:', reason);
});

// কনফিগারেশন
const BOT_TOKEN = process.env.BOT_TOKEN || '8395471740:AAH_nVx7DbJMsLJLzmpYvm2d1OrmEryy8ZI';
const ADMIN_ID = process.env.ADMIN_ID || '5932254012';

const bot = new Telegraf(BOT_TOKEN);
const DB_FILE = 'database.json';

// নিরাপদ ডাটাবেজ লোড ফাংশন (অটো-রিকভারি সহ)
function loadDatabase() {
    try {
        if (fs.existsSync(DB_FILE)) {
            const data = fs.readFileSync(DB_FILE, 'utf8');
            if (data.trim() === '') return { users: {}, prices: {}, numbers: {} };
            return JSON.parse(data);
        }
    } catch (e) {
        console.error('DB Load Error (Recovering):', e);
    }
    return { users: {}, prices: {}, numbers: {} };
}

// নিরাপদ ডাটাবেজ সেভ ফাংশন
function saveDatabase(data) {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('DB Save Error:', e);
    }
}

// সেফটি মিডলওয়্যার (ইউজারের তথ্য নিশ্চিত করতে)
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
            `bkash: ${num.bkash || 'N/A'} (Personal)\n` +
            `Nagad: ${num.nagad || 'N/A'} (Personal)\n` +
            `Rocket: ${num.rocket || 'N/A'} (Personal)`,
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
        const user = db.users[userId] || { balance: 0 };
        return ctx.reply(`💰 আপনার বর্তমান ব্যালেন্স: **${user.balance} BDT**`, { parse_mode: 'Markdown' }).catch(()=>{});
    } catch(e) {
        console.error('Sbalance Error:', e);
    }
});

// অ্যাডমিন কমান্ড: /setprice (ফ্লেক্সিবল স্টাইল ও ইমোজি সহ)
bot.command('setprice', (ctx) => {
    if (!ctx.from || ctx.from.id.toString() !== ADMIN_ID) return;
    
    try {
        const text = ctx.message.text.replace(/^\/setprice\s*/, '').trim();
        if (!text) {
            return ctx.reply('ব্যবহার: `/setprice [পুরো প্যাকেজের নাম ও স্টাইল] [দাম]`\nউদাহরণ: `/setprice Wᴇᴇᴋʟʏ Mᴇᴍʙᴇʀsʜɪᴘ 150৳`', { parse_mode: 'Markdown' });
        }

        const lastSpaceIdx = text.lastIndexOf(' ');
        if (lastSpaceIdx === -1) {
            return ctx.reply('❌ দয়া করে প্যাকেজ নামের পরে দাম উল্লেখ করুন।');
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

// অ্যাডমিন কমান্ড: ব্যালেন্স চেক
bot.command('checkbalance', (ctx) => {
    if (!ctx.from || ctx.from.id.toString() !== ADMIN_ID) return;
    try {
        const args = ctx.message.text.split(' ');
        if (args.length < 2) return ctx.reply('ব্যবহার: `/checkbalance [User_ID]`', { parse_mode: 'Markdown' });
        
        const targetId = args[1];
        const db = loadDatabase();
        const user = db.users[targetId] || { balance: 0 };
        return ctx.reply(`👤 ইউজার ID: ${targetId}\n💰 বর্তমান ব্যালেন্স: ${user.balance} BDT`);
    } catch(e) {
        console.error('Checkbalance Error:', e);
    }
});

// অ্যাডমিন কমান্ড: ব্যালেন্স অ্যাড
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

        return ctx.reply(`✅ ইউজার ${targetId}-এর অ্যাকাউন্টে ${amount} BDT যোগ করা হয়েছে।`);
    } catch(e) {
        console.error('Addbalance Error:', e);
    }
});

// নম্বর সেটআপ
bot.command('setbkash', (ctx) => {
    if (!ctx.from || ctx.from.id.toString() !== ADMIN_ID) return;
    try {
        const num = ctx.message.text.split(' ')[1];
        if (!num) return ctx.reply('❌ বিকাশ নম্বর দিন।');
        const db = loadDatabase();
        if (!db.numbers) db.numbers = {};
        db.numbers.bkash = num;
        saveDatabase(db);
        return ctx.reply(`✅ বিকাশ নম্বর আপডেট হয়েছে: ${num}`);
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
        return ctx.reply(`✅ নগদ নম্বর আপডেট হয়েছে: ${num}`);
    } catch(e) { console.error(e); }
});

// বট লঞ্চ ও গ্লোবাল হ্যান্ডলার
bot.launch().then(() => {
    console.log('Secure Bot is running smoothly...');
}).catch(err => {
    console.error('Launch error:', err);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
