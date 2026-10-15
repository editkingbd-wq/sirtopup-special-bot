const { Telegraf } = require('telegraf');
const express = require('express');
const fs = require('fs');

// রেন্ডার সার্ভারের জন্য এক্সপ্রেস পোর্ট সেটআপ
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('SIR TOPUP Bot is running!');
});

app.listen(PORT, () => {
    console.log(`Web server is running on port ${PORT}`);
});

// সঠিক বট টোকেন
const BOT_TOKEN = process.env.BOT_TOKEN || '8395471740:AAGa-UhRJNfRdqwLJbtrjBYNO5aVyvdPB4Y';
const bot = new Telegraf(BOT_TOKEN);

// ডেটাবেজ রিড ফাংশন
function loadDatabase() {
    try {
        if (!fs.existsSync('database.json')) {
            const initialData = { users: {}, prices: {}, numbers: {} };
            fs.writeFileSync('database.json', JSON.stringify(initialData, null, 2));
            return initialData;
        }
        const data = fs.readFileSync('database.json', 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Database Load Error:', error);
        return { users: {}, prices: {}, numbers: {} };
    }
}

// ডেটাবেজ সেভ ফাংশন
function saveDatabase(data) {
    try {
        fs.writeFileSync('database.json', JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Database Save Error:', error);
    }
}

// স্টার্ট কমান্ড
bot.command(['start', 'stp'], (ctx) => {
    const helpMenu = `🤖 **SIR TOPUP Bot Help Menu** 🤖\n\n` +
        `🔹 **Srate** - সমস্ত প্যাকেজ ও বর্তমান দাম দেখতে পাবেন।\n` +
        `🔹 **Sbalance** - আপনার অ্যাকাউন্টে থাকা বর্তমান ব্যালেন্স চেক করতে।\n` +
        `🔹 **Snumber** - পেমেন্ট করার বিকাশ/নগদ নম্বর পেতে।\n` +
        `🔹 **Sverify [TrxID]** - পেমেন্ট করার পর ট্রানজেকশন আইডি দিয়ে ভেরিফাই করতে।\n\n` +
        `📦 **অর্ডার করার নিয়ম:**\n` +
        `STP [UID] [Package_Name]\n\n` +
        `💬 যেকোনো দরকারে এখানে মেসেজ লিখুন, সরাসরি অ্যাডমিন আপনার মেসেজ দেখতে পাবে!`;
    
    return ctx.replyWithMarkdown(helpMenu, {
        reply_markup: { remove_keyboard: true }
    }).catch(()=>{});
});

// মেসেজ ও কমান্ড হ্যান্ডেলার
bot.on('text', (ctx) => {
    const text = ctx.message.text.trim();
    const lowerText = text.toLowerCase();
    const db = loadDatabase();

    if (lowerText === 'srate') {
        const prices = db.prices || {
            '25_Diamond': '25 BDT',
            '50_Diamond': '48 BDT',
            '100_Diamond': '95 BDT',
            'Weekly_Lite': '36 BDT'
        };

        let priceText = `💳 **SIR TOPUP Price List** 💳\n\n`;
        for (const [pkg, price] of Object.entries(prices)) {
            priceText += `🔹 ${pkg.replace('_', ' ')} ➡️ ${price}\n`;
        }
        return ctx.replyWithMarkdown(priceText).catch(()=>{});
    }

    if (lowerText === 'snumber') {
        const numbers = db.numbers || {};
        const bkashNum = numbers.bkash || '01XXXXXXXXX';
        const nagadNum = numbers.nagad || '01XXXXXXXXX';
        const rocketNum = numbers.rocket || '01XXXXXXXXX';

        const numbersText = `💳 **SIR TOPUP Payment Numbers** 💳\n\n` +
            `📱 **Bkash (Personal):** ${bkashNum}\n` +
            `📱 **Nagad (Personal):** ${nagadNum}\n` +
            `📱 **Rocket (Personal):** ${rocketNum}\n\n` +
            `⚠️ **নিয়মাবলী:**\n` +
            `১. অবশ্যই Personal নম্বরে Send Money করবেন।\n` +
            `২. টাকা পাঠানোর পর TrxID টি কপি করে রাখবেন।\n` +
            `৩. পেমেন্ট ভেরিফাই করতে \`Sverify [TrxID]\` লিখে সেন্ড করুন।`;
        
        return ctx.replyWithMarkdown(numbersText).catch(()=>{});
    }

    if (lowerText === 'sbalance') {
        const userId = ctx.from.id.toString();
        const userBal = db.users?.[userId]?.balance || 0;
        return ctx.reply(`💰 আপনার বর্তমান অ্যাকাউন্ট ব্যালেন্স: ${userBal} BDT`);
    }
});

// অ্যাডমিন নম্বর আপডেট কমান্ড
bot.command('setbkash', (ctx) => {
    const args = ctx.message.text.split(' ');
    if (args.length < 2) return ctx.reply('❌ উদাহরণ: `/setbkash 01712345678`', { parse_mode: 'Markdown' });
    const db = loadDatabase();
    if (!db.numbers) db.numbers = {};
    db.numbers.bkash = args[1];
    saveDatabase(db);
    return ctx.reply(`✅ বিকাশ নম্বর আপডেট করে **${args[1]}** করা হয়েছে!`, { parse_mode: 'Markdown' });
});

bot.command('setnagad', (ctx) => {
    const args = ctx.message.text.split(' ');
    if (args.length < 2) return ctx.reply('❌ উদাহরণ: `/setnagad 01812345678`', { parse_mode: 'Markdown' });
    const db = loadDatabase();
    if (!db.numbers) db.numbers = {};
    db.numbers.nagad = args[1];
    saveDatabase(db);
    return ctx.reply(`✅ নগদ নম্বর আপডেট করে **${args[1]}** করা হয়েছে!`, { parse_mode: 'Markdown' });
});

bot.command('setrocket', (ctx) => {
    const args = ctx.message.text.split(' ');
    if (args.length < 2) return ctx.reply('❌ উদাহরণ: `/setrocket 01912345678`', { parse_mode: 'Markdown' });
    const db = loadDatabase();
    if (!db.numbers) db.numbers = {};
    db.numbers.rocket = args[1];
    saveDatabase(db);
    return ctx.reply(`✅ রকেট নম্বর আপডেট করে **${args[1]}** করা হয়েছে!`, { parse_mode: 'Markdown' });
});

// বট লঞ্চ
bot.launch().then(() => {
    console.log('Bot launched successfully!');
}).catch((err) => {
    console.error('Launch error:', err);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
