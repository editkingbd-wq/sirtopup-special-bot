const { Telegraf } = require('telegraf');
const express = require('express');
const fs = require('fs');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.status(200).send('SIR TOPUP Bot is online and healthy!');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// Render Keep-Alive Ping
const RENDER_URL = process.env.RENDER_EXTERNAL_URL || 'https://sirtopup-special-bot-1.onrender.com';
setInterval(() => {
    if (RENDER_URL) {
        https.get(RENDER_URL, (res) => {}).on('error', () => {});
    }
}, 3 * 60 * 1000);

const BOT_TOKEN = process.env.BOT_TOKEN || '8395471740:AAGa-UhRJNfRdqwLJbtrjBYNO5aVyvdPB4Y';
const ADMIN_ID = '5932254012'; // আপনার অ্যাডমিন ইউজার আইডি

const bot = new Telegraf(BOT_TOKEN);

function loadDatabase() {
    try {
        if (!fs.existsSync('database.json')) {
            const initialData = { users: {}, prices: {}, numbers: {}, orders: {}, adminReplies: {} };
            fs.writeFileSync('database.json', JSON.stringify(initialData, null, 2));
            return initialData;
        }
        return JSON.parse(fs.readFileSync('database.json', 'utf8'));
    } catch (e) {
        return { users: {}, prices: {}, numbers: {}, orders: {}, adminReplies: {} };
    }
}

function saveDatabase(data) {
    try {
        fs.writeFileSync('database.json', JSON.stringify(data, null, 2));
    } catch (e) {}
}

// ------------------- কাস্টমার ফটো/স্ক্রিনশট হ্যান্ডেলার -------------------

bot.on('photo', async (ctx) => {
    const userId = ctx.from.id;
    const db = loadDatabase();

    if (userId.toString() !== ADMIN_ID.toString()) {
        const caption = ctx.message.caption || '';
        const photos = ctx.message.photo;
        const photoId = photos[photos.length - 1].file_id;

        const sentMsg = await bot.telegram.sendPhoto(ADMIN_ID, photoId, {
            caption: `🖼️ **Customer Screenshot/Photo পাঠিয়েছে!**\n\n` +
                     `👤 User: [${ctx.from.first_name}](tg://user?id=${userId})\n` +
                     `🆔 User ID: \`${userId}\`\n` +
                     (caption ? `📝 Caption: ${caption}\n\n` : '') +
                     `*(এই মেসেজে সরাসরি Reply দিয়ে কাস্টমারকে উত্তর দিন)*`,
            parse_mode: 'Markdown'
        }).catch(()=>{});

        if (sentMsg) {
            if (!db.adminReplies) db.adminReplies = {};
            db.adminReplies[sentMsg.message_id] = userId;
            saveDatabase(db);
            ctx.reply('✅ আপনার স্ক্রিনশট/ছবিটি অ্যাডমিনের নিকট পাঠানো হয়েছে।').catch(()=>{});
        }
    }
});

// Document/File হিসেবে পাঠালেও ধরবে
bot.on('document', async (ctx) => {
    const userId = ctx.from.id;
    const db = loadDatabase();

    if (userId.toString() !== ADMIN_ID.toString()) {
        const caption = ctx.message.caption || '';
        const docId = ctx.message.document.file_id;

        const sentMsg = await bot.telegram.sendDocument(ADMIN_ID, docId, {
            caption: `📁 **Customer ফাইল/স্ক্রিনশট পাঠিয়েছে!**\n\n` +
                     `👤 User: [${ctx.from.first_name}](tg://user?id=${userId})\n` +
                     `🆔 User ID: \`${userId}\`\n` +
                     (caption ? `📝 Caption: ${caption}\n\n` : '') +
                     `*(এই মেসেজে সরাসরি Reply দিয়ে কাস্টমারকে উত্তর দিন)*`,
            parse_mode: 'Markdown'
        }).catch(()=>{});

        if (sentMsg) {
            if (!db.adminReplies) db.adminReplies = {};
            db.adminReplies[sentMsg.message_id] = userId;
            saveDatabase(db);
            ctx.reply('✅ আপনার ডকুমেন্ট/ছবিটি অ্যাডমিনের নিকট পাঠানো হয়েছে।').catch(()=>{});
        }
    }
});

// ------------------- সাধারণ টেক্সট ও কমান্ড হ্যান্ডেলার -------------------

bot.on('text', async (ctx, next) => {
    const text = ctx.message.text.trim();
    const lowerText = text.toLowerCase();
    const db = loadDatabase();
    const userId = ctx.from.id;

    // Admin Native Reply System
    if (userId.toString() === ADMIN_ID && ctx.message.reply_to_message) {
        const repliedMsgId = ctx.message.reply_to_message.message_id;
        const targetUserId = db.adminReplies?.[repliedMsgId];

        if (targetUserId) {
            return bot.telegram.sendMessage(targetUserId, `💬 **অ্যাডমিনের উত্তর:**\n\n${text}`)
                .then(() => ctx.reply(`✅ কাস্টমারকে উত্তর পাঠানো হয়েছে।`))
                .catch(() => ctx.reply(`❌ মেসেজ পাঠানো যায়নি! কাস্টমার হয়তো বটটি স্টপ করেছে।`));
        }
    }

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
        const userName = ctx.from.first_name || 'Customer';
        
        const balanceMsg = `♡ Nᴀᴍᴇ        : ${userName}\n✦ Bᴀʟᴀɴᴄᴇ     : ${bal} BDT`;
        return ctx.reply(balanceMsg);
    }

    if (lowerText === 'stp') {
        const helpMenu = `🤖 **SIR TOPUP Bot Main Menu** 🤖\n\n` +
            `🔹 **srate** - প্যাকেজের তালিকা ও দাম দেখতে।\n` +
            `🔹 **snumber** - পেমেন্ট করার নম্বর পেতে।\n` +
            `🔹 **sbalance** - আপনার অ্যাকাউন্টের ব্যালেন্স জানতে।\n` +
            `🔹 **stp [Player_ID] [প্যাকেজ_নাম]** - অর্ডার করতে।\n` +
            `   *(উদাহরণ: stp 123456789 25_Diamond)*\n` +
            `🔹 **sverify [TrxID]** - পেমেন্ট ভেরিফাই রিকোয়েস্ট পাঠাতে।`;
        return ctx.replyWithMarkdown(helpMenu).catch(()=>{});
    }

    if (lowerText.startsWith('sverify ')) {
        const trxId = text.split(' ')[1];
        if (!trxId) return ctx.reply('ব্যবহার: `sverify [TrxID]`', { parse_mode: 'Markdown' });
        
        ctx.reply('✅ আপনার পেমেন্ট ভেরিফিকেশন রিকোয়েস্ট অ্যাডমিনের নিকট পাঠানো হয়েছে।');
        
        const sentMsg = await bot.telegram.sendMessage(ADMIN_ID, 
            `📩 **নতুন পেমেন্ট ভেরিফাই রিকোয়েস্ট!**\n\n` +
            `👤 ইউজার: [${ctx.from.first_name}](tg://user?id=${userId})\n` +
            `🆔 User ID: \`${userId}\`\n` +
            `🔢 TrxID: \`${trxId}\`\n\n` +
            `ব্যালেন্স অ্যাড করতে:\n\`/addbalance ${userId} [টাকা]\`\n\n` +
            `*(এই মেসেজে সরাসরি Reply দিয়ে উত্তর পাঠাতে পারবেন)*`, 
            { parse_mode: 'Markdown' }
        ).catch(()=>{});

        if (sentMsg) {
            if (!db.adminReplies) db.adminReplies = {};
            db.adminReplies[sentMsg.message_id] = userId;
            saveDatabase(db);
        }
        return;
    }

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

        if (userBalance < price) {
            return ctx.reply(`❌ স্যার, আপনার অ্যাকাউন্টে পর্যাপ্ত ব্যালেন্স নেই!\n\n📦 প্যাকেজ মূল্য: ${price} BDT\n💰 আপনার বর্তমান ব্যালেন্স: ${userBalance} BDT\n\nদয়া করে প্রথমে পেমেন্ট করে ব্যালেন্স অ্যাড করুন।`);
        }

        if (!db.users[userId]) db.users[userId] = { balance: 0 };
        db.users[userId].balance -= price;
        
        const orderId = 'ORD' + Math.floor(1000 + Math.random() * 9000);
        if (!db.orders) db.orders = {};
        db.orders[orderId] = { userId, pkgName, playerId, price, status: 'Pending' };
        saveDatabase(db);

        ctx.reply(`✅ আপনার অর্ডার গ্রহণ করা হয়েছে!\n🆔 অর্ডার ID: #${orderId}\n🎮 Player ID: ${playerId}\n📦 প্যাকেজ: ${pkgName}\n💰 কাটা হয়েছে: ${price} BDT`);

        bot.telegram.sendMessage(ADMIN_ID, 
            `🛒 **নতুন টপ-আপ অর্ডার এসেছে!**\n\n` +
            `🆔 অর্ডার ID: \`#${orderId}\`\n` +
            `👤 ইউজার: [${ctx.from.first_name}](tg://user?id=${userId})\n` +
            `🆔 ইউজার ID: \`${userId}\`\n` +
            `🎮 Player ID: ${playerId}\n` +
            `📦 প্যাকেজ: **${pkgName}**\n` +
            `💰 মূল্য: ${price} BDT\n\n` +
            `কমপ্লিট করতে: \`/complete ${orderId}\`\n` +
            `বাতিল করতে: \`/cancel ${orderId}\``, 
            { parse_mode: 'Markdown' }
        ).catch(()=>{});
        
        return;
    }

    if (userId.toString() !== ADMIN_ID.toString()) {
        const sentMsg = await bot.telegram.sendMessage(ADMIN_ID, 
            `💬 **কাস্টমার মেসেজ পাঠিয়েছে!**\n\n` +
            `👤 ইউজার: [${ctx.from.first_name}](tg://user?id=${userId})\n` +
            `🆔 User ID: \`${userId}\`\n` +
            `✉️ মেসেজ: ${text}\n\n` +
            `*(এই মেসেজে সরাসরি Reply দিয়ে কাস্টমারকে উত্তর দিন)*`, 
            { parse_mode: 'Markdown' }
        ).catch(()=>{});

        if (sentMsg) {
            if (!db.adminReplies) db.adminReplies = {};
            db.adminReplies[sentMsg.message_id] = userId;
            saveDatabase(db);
        }
    }

    return next();
});

// ------------------- অ্যাডমিন কমান্ডসমূহ -------------------

bot.command('checkbalance', (ctx) => {
    if (ctx.from.id.toString() !== ADMIN_ID) return;
    const args = ctx.message.text.split(' ');
    if (args.length < 2) return ctx.reply('ব্যবহার: `/checkbalance [User_ID]`', { parse_mode: 'Markdown' });
    const targetUserId = args[1];
    const db = loadDatabase();
    const bal = db.users?.[targetUserId]?.balance || 0;
    return ctx.reply(`👤 ইউজার ID: \`${targetUserId}\`\n💰 বর্তমান ব্যালেন্স: ${bal} BDT`, { parse_mode: 'Markdown' });
});

bot.command('addbalance', (ctx) => {
    if (ctx.from.id.toString() !== ADMIN_ID) return;
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
    if (ctx.from.id.toString() !== ADMIN_ID) return;
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
    if (ctx.from.id.toString() !== ADMIN_ID) return;
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
    if (ctx.from.id.toString() !== ADMIN_ID) return;
    const args = ctx.message.text.split(' ');
    if (args.length < 2) return ctx.reply('ব্যবহার: `/setbkash [নম্বর]`', { parse_mode: 'Markdown' });
    const db = loadDatabase();
    if (!db.numbers) db.numbers = {};
    db.numbers.bkash = args[1];
    saveDatabase(db);
    return ctx.reply(`✅ বিকাশ নম্বর আপডেট হয়েছে: ${args[1]}`);
});

bot.command('setnagad', (ctx) => {
    if (ctx.from.id.toString() !== ADMIN_ID) return;
    const args = ctx.message.text.split(' ');
    if (args.length < 2) return ctx.reply('ব্যবহার: `/setnagad [নম্বর]`', { parse_mode: 'Markdown' });
    const db = loadDatabase();
    if (!db.numbers) db.numbers = {};
    db.numbers.nagad = args[1];
    saveDatabase(db);
    return ctx.reply(`✅ নগদ নম্বর আপডেট হয়েছে: ${args[1]}`);
});

bot.command('setrocket', (ctx) => {
    if (ctx.from.id.toString() !== ADMIN_ID) return;
    const args = ctx.message.text.split(' ');
    if (args.length < 2) return ctx.reply('ব্যবহার: `/setrocket [নম্বর]`', { parse_mode: 'Markdown' });
    const db = loadDatabase();
    if (!db.numbers) db.numbers = {};
    db.numbers.rocket = args[1];
    saveDatabase(db);
    return ctx.reply(`✅ রকেট নম্বর আপডেট হয়েছে: ${args[1]}`);
});

bot.command('complete', (ctx) => {
    if (ctx.from.id.toString() !== ADMIN_ID) return;
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
    if (ctx.from.id.toString() !== ADMIN_ID) return;
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

// পুরনো কিবোর্ড মেনু ডিলিট করার কমান্ড
bot.command('removemenu', (ctx) => {
    return ctx.reply('🗑️ পুরনো কিবোর্ড মেনু সফলভাবে রিমুভ করা হয়েছে!', {
        reply_markup: {
            remove_keyboard: true
        }
    });
});

bot.launch();
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
