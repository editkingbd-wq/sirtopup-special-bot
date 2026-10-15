const { Telegraf } = require('telegraf');
const fs = require('fs');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

// Web-ping endpoint to keep service awake 24/7
app.get('/', (req, res) => {
    res.send('Sir Topup Bot is Active & Running 24/7!');
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

const BOT_TOKEN = '8395471740:AAGa-UhRJNfRdqwLJbtrjBYNO5aVyvdPB4Y'; 
const ADMIN_ID = 5932254012; 

const bot = new Telegraf(BOT_TOKEN);

const DB_FILE = './database.json';
let db = {
    users: {},
    prices: {
        "25_Diamond": 25,
        "50_Diamond": 48,
        "100_Diamond": 95,
        "Weekly_Lite": 36
    },
    payment_info: "📢 **Payment Numbers**\n\nBkash: 017XXXXXXXX\nNagad: 017XXXXXXXX\nRocket: 017XXXXXXXX\n\nটাকা পাঠিয়ে `Sverify TRXID` লিখে চ্যাটে মেসেজ দিন।"
};

if (fs.existsSync(DB_FILE)) {
    try { db = JSON.parse(fs.readFileSync(DB_FILE)); } catch (e) {}
}

function saveDB() {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    } catch (e) {}
}

// 🛡️ crash-protection (বট যাতে কখনো অফলাইন বা ক্র্যাশ না করে)
process.on('uncaughtException', (err) => {
    console.error('Crash Shield Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('Crash Shield Rejection:', promise, 'reason:', reason);
});

// ------------------- ADMIN COMMANDS -------------------

bot.command('addbalance', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const args = ctx.message.text.split(' ');
    const targetUser = args[1];
    const amount = parseFloat(args[2]);

    if (!targetUser || isNaN(amount)) {
        return ctx.reply("❌ নিয়ম: /addbalance [User_ID] [Amount]").catch(()=>{});
    }

    db.users[targetUser] = (db.users[targetUser] || 0) + amount;
    saveDB();

    ctx.reply(`✅ User ${targetUser}-এর অ্যাকাউন্টে ${amount} BDT যোগ করা হয়েছে।`).catch(()=>{});
    bot.telegram.sendMessage(targetUser, `🎉 আপনার অ্যাকাউন্টে ${amount} BDT এড করা হয়েছে!`).catch(()=>{});
});

bot.command('setprice', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const args = ctx.message.text.split(' ');
    const pkgName = args[1];
    const price = parseFloat(args[2]);

    if (!pkgName || isNaN(price)) {
        return ctx.reply("❌ নিয়ম: /setprice [Package_Name] [Price]").catch(()=>{});
    }

    db.prices[pkgName] = price;
    saveDB();
    ctx.reply(`✅ ${pkgName} দাম ${price} BDT সেট করা হয়েছে!`).catch(()=>{});
});

bot.command('complete', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const args = ctx.message.text.split(' ');
    const targetUser = args[1];

    if (!targetUser) return ctx.reply("❌ নিয়ম: /complete [User_ID]").catch(()=>{});

    bot.telegram.sendMessage(targetUser, "✅ আপনার অর্ডারটি সফলভাবে সম্পন্ন হয়েছে!").catch(()=>{});
    ctx.reply(`✅ User ${targetUser}-কে কমপ্লিট মেসেজ পাঠানো হয়েছে।`).catch(()=>{});
});

bot.command('cancel', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const args = ctx.message.text.split(' ');
    const targetUser = args[1];
    const refundPrice = parseFloat(args[2]);

    if (!targetUser || isNaN(refundPrice)) return ctx.reply("❌ নিয়ম: /cancel [User_ID] [Refund_Amount]").catch(()=>{});

    db.users[targetUser] = (db.users[targetUser] || 0) + refundPrice;
    saveDB();

    bot.telegram.sendMessage(targetUser, `❌ অর্ডার বাতিল এবং ${refundPrice} BDT রিফান্ড করা হয়েছে।`).catch(()=>{});
    ctx.reply(`❌ Refunded ${refundPrice} BDT to${targetUser}`).catch(()=>{});
});

// ------------------- CUSTOMER COMMANDS & LIVE CHAT -------------------

bot.on('text', (ctx) => {
    const rawText = ctx.message.text.trim();
    const text = rawText.toLowerCase(); // কেস-ইনসেনসিটিভ করার জন্য
    const userId = ctx.from.id;

    // ১. অ্যাডমিন কাস্টমারকে রিপ্লাই দিলে
    if (userId === ADMIN_ID && ctx.message.reply_to_message) {
        const replyText = ctx.message.reply_to_message.text || "";
        const match = replyText.match(/User ID:\s*`?(\d+)`?/i);
        
        if (match && match[1]) {
            bot.telegram.sendMessage(match[1], `👨‍💻 **Admin Reply:**\n\n${rawText}`)
                .then(() => ctx.reply("✅ মেসেজ পাঠানো হয়েছে।"))
                .catch(() => ctx.reply("❌ মেসেজ পাঠানো সম্ভব হয়নি।"));
        } else {
            ctx.reply("❌ ইউজার আইডি সনাক্ত করা যায়নি।").catch(()=>{});
        }
        return;
    }

    if (userId === ADMIN_ID) return;

    // ২. /start অথবা STP / stp - হেল্প গাইড
    if (text === '/start' || text === 'stp') {
        const helpMenu = `🤖 **SIR TOPUP Bot Help Menu** 🤖\n\n` +
            `🔹 **Srate** - সমস্ত প্যাকেজ ও বর্তমান দাম দেখতে পাবেন।\n` +
            `🔹 **Sbalance** - আপনার অ্যাকাউন্টে থাকা বর্তমান ব্যালেন্স চেক করতে।\n` +
            `🔹 **Snumber** - পেমেন্ট করার বিকাশ/নগদ নম্বর পেতে।\n` +
            `🔹 **Sverify [TrxID]** - পেমেন্ট করার পর ট্রানজেকশন আইডি দিয়ে ভেরিফাই করতে।\n` +
            `   *(উদাহরণ: Sverify 9H7654321)*\n\n` +
            `📦 **অর্ডার করার নিয়ম:**\n` +
            `STP [UID] [Package_Name]\n` +
            `   *(উদাহরণ: STP 12345678 25_Diamond)*\n\n` +
            `💬 যেকোনো দরকারে এখানে মেসেজ লিখুন, সরাসরি অ্যাডমিন আপনার মেসেজ দেখতে পাবে!`;
        return ctx.replyWithMarkdown(helpMenu).catch(()=>{});
    }

    // ৩. Srate / srate / SRATE - দামের তালিকা
    if (text === 'srate') {
        let listText = "💳 **SIR TOPUP Price List** 💳\n---------------------------------\n";
        for (let item in db.prices) {
            listText += `🔹 ${item.replace(/_/g, ' ')} ➡${db.prices[item]} BDT\n`;
        }
        return ctx.replyWithMarkdown(listText).catch(()=>{});
    }

    // ৪. Sbalance / sbalance / SBALANCE - ব্যালেন্স চেক
    if (text === 'sbalance') {
        const balance = db.users[userId] || 0;
        return ctx.reply(`💰 আপনার বর্তমান ব্যালেন্স: ${balance} BDT`).catch(()=>{});
    }

    // ৫. Snumber / snumber / SNUMBER - পেমেন্ট বিবরণী
    if (text === 'snumber') {
        return ctx.replyWithMarkdown(db.payment_info).catch(()=>{});
    }

    // ৬. Sverify / sverify / SVERIFY [TrxID] - ট্রানজেকশন ভেরিফাই
    if (text.startsWith('sverify')) {
        const parts = rawText.split(' ');
        if (parts.length < 2) {
            return ctx.reply("❌ ফরম্যাট সঠিক নয়! টাকা পাঠানোর পর এভাবে লিখুন: Sverify [TrxID]").catch(()=>{});
        }

        const trxId = parts.slice(1).join(' ');
        ctx.reply("✅ আপনার ট্রানজেকশন আইডি গ্রহন করা হয়েছে। অ্যাডমিন চেক করে শীঘ্রই ব্যালেন্স যুক্ত করে দেবে।").catch(()=>{});

        const adminMsg = `💳 **NEW PAYMENT VERIFY REQUEST** 💳\n\n👤 **Customer Name:** ${ctx.from.first_name || 'N/A'}\n🆔 **User ID:** \`${userId}\`\n🔢 **TrxID:** \`${trxId}\`\n\nব্যালেন্স এড করতে লিখুন:\n\`/addbalance ${userId} AMOUNT\``;
        bot.telegram.sendMessage(ADMIN_ID, adminMsg, { parse_mode: 'Markdown' }).catch(()=>{});
        return;
    }

    // ৭. STP / stp / Stp [UID] [Package] - টপআপ অর্ডার
    if (text.startsWith('stp ')) {
        const parts = rawText.split(' ');
        if (parts.length < 3) {
            return ctx.reply("❌ ফরম্যাট সঠিক নয়! এভাবে লিখুন: STP [UID] [Package_Name]").catch(()=>{});
        }

        const uid = parts[1];
        const pkg = parts[2];
        const userBal = db.users[userId] || 0;

        const priceKey = Object.keys(db.prices).find(k => k.toLowerCase() === pkg.toLowerCase());
        if (!priceKey) {
            return ctx.reply("❌ এই নামের কোনো প্যাকেজ খুঁজে পাওয়া যায়নি! সঠিক নামের জন্য Srate চেক করুন।").catch(()=>{});
        }

        const price = db.prices[priceKey];
        if (userBal < price) {
            return ctx.reply("⚠️ আপনার অ্যাকাউন্টে পর্যাপ্ত ব্যালেন্স নেই! টাকা পাঠিয়ে Sverify করুন।").catch(()=>{});
        }

        db.users[userId] = userBal - price;
        saveDB();

        ctx.reply(`✅ আপনার অর্ডারটি গ্রহণ করা হয়েছে!\n\n📦 প্যাকেজ: ${priceKey}\n🆔 UID: ${uid}\n💸 কাটা হয়েছে: ${price} BDT\n💰 অবশিষ্ট ব্যালেন্স: ${db.users[userId]} BDT`).catch(()=>{});

        const adminMsg = `🛒 **NEW ORDER RECEIVED** 🛒\n\n👤 **Customer ID:** \`${userId}\`\n📝 **UID:** \`${uid}\`\n📦 **Package:** ${priceKey}\n💵 **Amount:** ${price} BDT\n\nকমপ্লিট করতে লিখুন: \`/complete ${userId}\`\nক্যানসেল করতে লিখুন: \`/cancel ${userId} ${price}\``;
        bot.telegram.sendMessage(ADMIN_ID, adminMsg, { parse_mode: 'Markdown' }).catch(()=>{});
        return;
    }

    // ৮. সাধারণ কাস্টমার সাপোর্ট চ্যাট (কাস্টমার অন্য যেকোনো কিছু লিখলে)
    ctx.reply("📩 আপনার মেসেজটি অ্যাডমিনের কাছে পাঠানো হয়েছে। অনুগ্রহ করে উত্তরের জন্য অপেক্ষা করুন।").catch(()=>{});

    const userMsgToAdmin = `💬 **NEW CUSTOMER MESSAGE** 💬\n\n👤 **Name:** ${ctx.from.first_name || 'N/A'}\n🆔 **User ID:** \`${userId}\`\n💬 **Message:** ${rawText}\n\n*(উত্তর দিতে এই মেসেজটিতে Reply দিন)*`;
    bot.telegram.sendMessage(ADMIN_ID, userMsgToAdmin, { parse_mode: 'Markdown' }).catch(()=>{});
});

bot.launch().then(() => console.log("Sir Topup Bot 24/7 Active")).catch(err => console.error(err));
