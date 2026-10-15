const { Telegraf } = require('telegraf');
const express = require('express');
const fs = require('fs');

// রেন্ডার পোর্ট বাইন্ডিংয়ের জন্য মিনিমাল এক্সপ্রেস সার্ভার
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Bot is active!');
});

app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});

// টেলিগ্রাম বট টোকেন
const BOT_TOKEN = process.env.BOT_TOKEN || '8395471740:AAGa-UhRJNfRdqwLJbtrjBYNO5aVyvdPB4Y';
const bot = new Telegraf(BOT_TOKEN);

// ডেটাবেজ হ্যান্ডেলার
function loadDatabase() {
    try {
        if (!fs.existsSync('database.json')) {
            const initialData = { users: {}, prices: {}, numbers: {} };
            fs.writeFileSync('database.json', JSON.stringify(initialData, null, 2));
            return initialData;
        }
        return JSON.parse(fs.readFileSync('database.json', 'utf8'));
    } catch (e) {
        return { users: {}, prices: {}, numbers: {} };
    }
}

function saveDatabase(data) {
    try {
        fs.writeFileSync('database.json', JSON.stringify(data, null, 2));
    } catch (e) {}
}

// কমান্ডসমূহ
bot.command(['start', 'stp'], (ctx) => {
    const helpMenu = `🤖 **SIR TOPUP Bot Help Menu** 🤖\n\n` +
        `🔹 **Srate** - বর্তমান দাম দেখতে পাবেন।\n` +
        `🔹 **Sbalance** - অ্যাকাউন্ট ব্যালেন্স চেক করতে।\n` +
        `🔹 **Snumber** - পেমেন্ট নম্বর পেতে।\n` +
        `🔹 **Sverify [TrxID]** - পেমেন্ট ভেরিফাই করতে।`;
    return ctx.replyWithMarkdown(helpMenu).catch(()=>{});
});

bot.on('text', (ctx) => {
    const text = ctx.message.text.trim().toLowerCase();
    const db = loadDatabase();

    if (text === 'srate') {
        let priceText = `💳 **SIR TOPUP Price List** 💳\n\n`;
        const prices = db.prices || { '25_Diamond': '25 BDT', 'Weekly_Lite': '36 BDT' };
        for (const [pkg, price] of Object.entries(prices)) {
            priceText += `🔹 ${pkg.replace('_', ' ')} ➡️ ${price}\n`;
        }
        return ctx.replyWithMarkdown(priceText).catch(()=>{});
    }

    if (text === 'snumber') {
        const num = db.numbers || {};
        return ctx.replyWithMarkdown(
            `💳 **Payment Numbers** 💳\n\n` +
            `📱 **Bkash:** ${num.bkash || '01XXXXXXXXX'}\n` +
            `📱 **Nagad:** ${num.nagad || '01XXXXXXXXX'}\n` +
            `📱 **Rocket:** ${num.rocket || '01XXXXXXXXX'}`
        ).catch(()=>{});
    }

    if (text === 'sbalance') {
        const bal = db.users?.[ctx.from.id]?.balance || 0;
        return ctx.reply(`💰 অ্যাকাউন্ট ব্যালেন্স: ${bal} BDT`);
    }
});

// অ্যাডমিন নম্বর আপডেট কমান্ড
bot.command('setbkash', (ctx) => {
    const args = ctx.message.text.split(' ');
    if (args.length < 2) return ctx.reply('ব্যবহার: `/setbkash [নম্বর]`', { parse_mode: 'Markdown' });
    const db = loadDatabase();
    if (!db.numbers) db.numbers = {};
    db.numbers.bkash = args[1];
    saveDatabase(db);
    return ctx.reply(`✅ বিকাশ নম্বর আপডেট হয়ে হয়েছে: ${args[1]}`);
});

bot.command('setnagad', (ctx) => {
    const args = ctx.message.text.split(' ');
    if (args.length < 2) return ctx.reply('ব্যবহার: `/setnagad [নম্বর]`', { parse_mode: 'Markdown' });
    const db = loadDatabase();
    if (!db.numbers) db.numbers = {};
    db.numbers.nagad = args[1];
    saveDatabase(db);
    return ctx.reply(`✅ নগদ নম্বর আপডেট হয়ে হয়েছে: ${args[1]}`);
});

bot.command('setrocket', (ctx) => {
    const args = ctx.message.text.split(' ');
    if (args.length < 2) return ctx.reply('ব্যবহার: `/setrocket [নম্বর]`', { parse_mode: 'Markdown' });
    const db = loadDatabase();
    if (!db.numbers) db.numbers = {};
    db.numbers.rocket = args[1];
    saveDatabase(db);
    return ctx.reply(`✅ রকেট নম্বর আপডেট হয়ে হয়েছে: ${args[1]}`);
});

bot.launch();
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
