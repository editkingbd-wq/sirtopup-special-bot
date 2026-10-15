const { Telegraf } = require('telegraf');
const express = require('express');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.status(200).send('SIR TOPUP Bot is online and healthy!');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

const BOT_TOKEN = process.env.BOT_TOKEN || '8395471740:AAGa-UhRJNfRdqwLJbtrjBYNO5aVyvdPB4Y';
const ADMIN_ID = process.env.ADMIN_ID || 'YOUR_TELEGRAM_USER_ID';

const bot = new Telegraf(BOT_TOKEN);

function loadDatabase() {
    try {
        if (!fs.existsSync('database.json')) {
            const initialData = { users: {}, prices: {}, numbers: {}, orders: {} };
            fs.writeFileSync('database.json', JSON.stringify(initialData, null, 2));
            return initialData;
        }
        return JSON.parse(fs.readFileSync('database.json', 'utf8'));
    } catch (e) {
        return { users: {}, prices: {}, numbers: {}, orders: {} };
    }
}

function saveDatabase(data) {
    try {
        fs.writeFileSync('database.json', JSON.stringify(data, null, 2));
    } catch (e) {}
}

// ------------------- কাস্টমার হ্যান্ডেলার -------------------

bot.command(['start', 'help'], (ctx) => {
    const helpMenu = `🤖 **SIR TOPUP Bot Main Menu** 🤖\n\n` +
        `🔹 **srate** - প্যাকেজের তালিকা ও দাম দেখতে।\n` +
        `🔹 **snumber** - পেমেন্ট করার নম্বর পেতে।\n` +
        `🔹 **sbalance** - আপনার অ্যাকাউন্টের ব্যালেন্স জানতে।\n` +
        `🔹 **stp [Player_ID] [প্যাকেজ_নাম]** - অর্ডার করতে।\n` +
        `   *(উদাহরণ: stp 123456789 25_Diamond)*\n` +
        `🔹 **sverify [TrxID]** - পেমেন্ট ভেরিফাই রিকোয়েস্ট পাঠাতে।`;
    return ctx.replyWithMarkdown(helpMenu).catch(()=>{});
});

bot.on('text', async (ctx, next) => {
    const text = ctx.message.text.trim();
    const lowerText = text.toLowerCase();
    const db = loadDatabase();
    const userId = ctx.from.id;

    if (lowerText === 'srate') {
        let priceText = `💳 **SIR TOPUP Price List** 💳\n\n`;
        const prices = db.prices || { '25_Diamond': '25 BDT', 'Weekly_Lite': '36 BDT' };
        for (const [pkg, price] of Object.entries(prices)) {
            priceText += `🔹 **${pkg.replace(/_/g, ' ')}** ➡️ ${price}\n`;
        }
        return ctx.replyWithMarkdown(priceText).catch(()=>{});
    }

    if (lowerText === 'snumber') {
        const num = db.numbers || {};
        return ctx.replyWithMarkdown(
            `💳 **Payment Numbers** 💳\n\n` +
            `📱 **Bkash:** \`${num.bkash || '01XXXXXXXXX'}\` (Personal)\n` +
            `📱 **Nagad:** \`${num.nagad || '01XXXXXXXXX'}\` (Personal)\n` +
            `📱 **Rocket:** \`${num.rocket || '01XXXXXXXXX'}\` (Personal)`
        ).catch(()=>{});
    }

    if (lowerText === 'sbalance') {
        const bal = db.users?.[userId]?.balance || 0;
        return ctx.reply(`💰 আপনার বর্তমান অ্যাকাউন্ট ব্যালেন্স: ${bal} BDT`);
    }

    if (lowerText.startsWith('sverify ')) {
        const trxId = text.split(' ')[1];
        if (!trxId) return ctx.reply('ব্যবহার: `sverify [TrxID]`');
        
        ctx.reply('✅ আপনার পেমেন্ট ভেরিফিকেশন রিকোয়েস্ট অ্যাডমিনের নিকট পাঠানো হয়েছে।');
        if (ADMIN_ID !== 'YOUR_TELEGRAM_USER_ID') {
            bot.telegram.sendMessage(ADMIN_ID, `📩 **নতুন পেমেন্ট ভেরিফাই রিকোয়েস্ট!**\n\n👤 ইউজার: [${ctx.from.first_name}](tg://user?id=${userId})\n🆔 ID: \`${userId}\`\n🔢 TrxID: \`${trxId}\``, { parse_mode: 'Markdown' }).catch(()=>{});
        }
        return;
    }

    // অর্ডার ফরম্যাট: stp [Player_ID] [Package_Name]
    if (lowerText.startsWith('stp ')) {
        const args = text.split(' ');
        if (args.length < 3) {
            return ctx.reply('❌ সঠিক ফরম্যাটে লিখুন!\nউদাহরণ: `stp 123456789 25_Diamond`', { parse_mode: 'Markdown' });
        }

        const playerId = args[1];
        const pkgName = args[2];
        
        if (!db.prices[pkgName]) {
            return ctx.reply('❌ এই প্যাকেজটি পাওয়া যায়নি! `srate` লিখে সঠিক প্যাকেজের নাম দেখে নিন।');
        }

        const price = parseInt(db.prices[pkgName]);
        const userBalance = db.users?.[userId]?.balance || 0;

        // ব্যালেন্স না থাকলে বা কম থাকলে কাস্টমারকে অটো মেসেজ পাঠানো (অ্যাডমিনের কাছে অর্ডার যাবে না)
        if (userBalance < price) {
            return ctx.reply(`❌ স্যার, আপনার অ্যাকাউন্টে পর্যাপ্ত ব্যালেন্স নেই!\n\n📦 প্যাকেজ মূল্য: ${price} BDT\n💰 আপনার বর্তমান ব্যালেন্স: ${userBalance} BDT\n\nদয়া করে প্রথমে পেমেন্ট করে ব্যালেন্স অ্যাড করুন।`);
        }

        // অটো ব্যালেন্স কাটা
        if (!db.users[userId]) db.users[userId] = { balance: 0 };
        db.users[userId].balance -= price;
        
        const orderId = 'ORD' + Math.floor(1000 + Math.random() * 9000);
        if (!db.orders) db.orders = {};
        db.orders[orderId] = { userId, pkgName, playerId, price, status: 'Pending' };
        saveDatabase(db);

        ctx.reply(`✅ আপনার অর্ডার গ্রহণ করা হয়েছে!\n🆔 অর্ডার ID: #${orderId}\n🎮 Player ID: ${playerId}\n📦 প্যাকেজ: ${pkgName}\n💰 কাটা হয়েছে: ${price} BDT`);

        // অ্যাডমিন নোটিফিকেশন
        if (ADMIN_ID !== 'YOUR_TELEGRAM_USER_ID') {
            bot.telegram.sendMessage(ADMIN_ID, 
                `🛒 **নতুন টপ-আপ অর্ডার এসেছে!**\n\n` +
                `🆔 অর্ডার ID: \`#${orderId}\`\n` +
                `👤 ইউজার ID: \`${userId}\`\n` +
                `🎮 Player ID: \`${playerId}\`\n` +
                `📦 প্যাকেজ: **${pkgName}**\n` +
                `💰 মূল্য: ${price} BDT\n\n` +
                `কমপ্লিট করতে: \`/complete ${orderId}\`\n` +
                `বাতিল করতে: \`/cancel ${orderId}\``, 
                { parse_mode: 'Markdown' }
            ).catch(()=>{});
        }
        return;
    }

    return next();
});


// ------------------- অ্যাডমিন কমান্ডসমূহ -------------------

bot.command('checkbalance', (ctx) => {
    const args = ctx.message.text.split(' ');
    if (args.length < 2) return ctx.reply('ব্যবহার: `/checkbalance [User_ID]`', { parse_mode: 'Markdown' });
    const targetUserId = args[1];
    const db = loadDatabase();
    const bal = db.users?.[targetUserId]?.balance || 0;
    return ctx.reply(`👤 ইউজার ID: \`${targetUserId}\`\n💰 বর্তমান ব্যালেন্স: ${bal} BDT`, { parse_mode: 'Markdown' });
});

bot.command('addbalance', (ctx) => {
    const args = ctx.message.text.split(' ');
    if (args.length < 3) return ctx.reply('ব্যবহার: `/addbalance [User_ID] [টাকা]`', { parse_mode: 'Markdown' });
    const targetUserId = args[1];
    const amount = parseInt(args[2]);
    const db = loadDatabase();

    if (!db.users[targetUserId]) db.users[targetUserId] = { balance: 0 };
    db.users[targetUserId].balance += amount;
    saveDatabase(db);

    ctx.reply(`✅ ইউজার \`${targetUserId}\`-এর অ্যাকাউন্টে ${amount} BDT যোগ করা হয়েছে।`, { parse_mode: 'Markdown' });
    bot.telegram.sendMessage(targetUserId, `🎉 আপনার অ্যাকাউন্টে ${amount} BDT অ্যাড করা হয়েছে!\n💰 বর্তমান ব্যালেন্স: ${db.users[targetUserId].balance} BDT`).catch(()=>{});
});

bot.command('cutbalance', (ctx) => {
    const args = ctx.message.text.split(' ');
    if (args.length < 3) return ctx.reply('ব্যবহার: `/cutbalance [User_ID] [টাকা]`', { parse_mode: 'Markdown' });
    const targetUserId = args[1];
    const amount = parseInt(args[2]);
    const db = loadDatabase();

    if (!db.users[targetUserId]) db.users[targetUserId] = { balance: 0 };
    db.users[targetUserId].balance = Math.max(0, db.users[targetUserId].balance - amount);
    saveDatabase(db);

    return ctx.reply(`✅ ইউজার \`${targetUserId}\`-এর অ্যাকাউন্ট থেকে ${amount} BDT কেটে নেওয়া হয়েছে।`, { parse_mode: 'Markdown' });
});

bot.command('setprice', (ctx) => {
    const args = ctx.message.text.split(' ');
    if (args.length < 3) return ctx.reply('ব্যবহার: `/setprice [প্যাকেজ_নাম] [দাম]`\nউদাহরণ: `/setprice 25_Diamond 25_BDT`', { parse_mode: 'Markdown' });
    const pkgName = args[1];
    const price = args[2].replace('_', ' ');
    const db = loadDatabase();

    if (!db.prices) db.prices = {};
    db.prices[pkgName] = price;
    saveDatabase(db);

    return ctx.reply(`✅ প্যাকেজ আপডেট হয়েছে: **${pkgName}** ➡️ ${price}`, { parse_mode: 'Markdown' });
});

bot.command('setbkash', (ctx) => {
    const args = ctx.message.text.split(' ');
    if (args.length < 2) return ctx.reply('ব্যবহার: `/setbkash [নম্বর]`', { parse_mode: 'Markdown' });
    const db = loadDatabase();
    if (!db.numbers) db.numbers = {};
    db.numbers.bkash = args[1];
    saveDatabase(db);
    return ctx.reply(`✅ বিকাশ নম্বর আপডেট হয়েছে: ${args[1]}`);
});

bot.command('setnagad', (ctx) => {
    const args = ctx.message.text.split(' ');
    if (args.length < 2) return ctx.reply('ব্যবহার: `/setnagad [নম্বর]`', { parse_mode: 'Markdown' });
    const db = loadDatabase();
    if (!db.numbers) db.numbers = {};
    db.numbers.nagad = args[1];
    saveDatabase(db);
    return ctx.reply(`✅ নগদ নম্বর আপডেট হয়েছে: ${args[1]}`);
});

bot.command('setrocket', (ctx) => {
    const args = ctx.message.text.split(' ');
    if (args.length < 2) return ctx.reply('ব্যবহার: `/setrocket [নম্বর]`', { parse_mode: 'Markdown' });
    const db = loadDatabase();
    if (!db.numbers) db.numbers = {};
    db.numbers.rocket = args[1];
    saveDatabase(db);
    return ctx.reply(`✅ রকেট নম্বর আপডেট হয়েছে: ${args[1]}`);
});

bot.command('complete', (ctx) => {
    const args = ctx.message.text.split(' ');
    if (args.length < 2) return ctx.reply('ব্যবহার: `/complete [Order_ID]`', { parse_mode: 'Markdown' });
    const orderId = args[1].replace('#', '');
    const db = loadDatabase();
    const order = db.orders?.[orderId];

    if (!order) return ctx.reply('❌ অর্ডার নম্বরটি পাওয়া যায়নি!');

    order.status = 'Completed';
    saveDatabase(db);

    ctx.reply(`✅ অর্ডার #${orderId} সফলভাবে কমপ্লিট করা হয়েছে!`);
    bot.telegram.sendMessage(order.userId, `🎉 **আপনার অর্ডার কমপ্লিট হয়েছে!**\n🆔 অর্ডার ID: #${orderId}\n🎮 Player ID: ${order.playerId}\n📦 প্যাক: ${order.pkgName}\n\nSIR TOPUP-এর সাথে থাকার জন্য ধন্যবাদ!`).catch(()=>{});
});

bot.command('cancel', (ctx) => {
    const args = ctx.message.text.split(' ');
    if (args.length < 2) return ctx.reply('ব্যবহার: `/cancel [Order_ID]`', { parse_mode: 'Markdown' });
    const orderId = args[1].replace('#', '');
    const db = loadDatabase();
    const order = db.orders?.[orderId];

    if (!order) return ctx.reply('❌ অর্ডার নম্বরটি পাওয়া যায়নি!');

    if (!db.users[order.userId]) db.users[order.userId] = { balance: 0 };
    db.users[order.userId].balance += order.price;
    order.status = 'Cancelled';
    saveDatabase(db);

    ctx.reply(`⚠️ অর্ডার #${orderId} বাতিল করা হয়েছে এবং কাস্টমারকে ${order.price} BDT ফেরত দেওয়া হয়েছে।`);
    bot.telegram.sendMessage(order.userId, `❌ **আপনার অর্ডারটি বাতিল করা হয়েছে!**\n🆔 অর্ডার ID: #${orderId}\n💰 আপনার অ্যাকাউন্টে ${order.price} BDT রিফান্ড করা হয়েছে।`).catch(()=>{});
});

bot.launch();
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
