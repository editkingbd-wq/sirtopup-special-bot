const { Telegraf } = require('telegraf');
const fs = require('fs');
const express = require('express');

// Render-এর জন্য ওয়েব সার্ভার পার্ট
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Sir Topup Bot is Running Successfully!');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// আপনার দেওয়া টেলিগ্রাম বট টোকেন
const BOT_TOKEN = '8395471740:AAGa-UhRJNfRdqwLJbtrjBYNO5aVyvdPB4Y'; 

// আপনার টেলিগ্রাম ইউজার আইডি
const ADMIN_ID = 5932254012; 

const bot = new Telegraf(BOT_TOKEN);

// ডাটাবেজ সেভ করার ফাইল লজিক
const DB_FILE = './database.json';
let db = {
    users: {},
    prices: {
        "25_Diamond": 25,
        "50_Diamond": 48,
        "100_Diamond": 95,
        "Weekly_Lite": 36
    },
    payment_info: "📢 **Payment Numbers**\n\nBkash: 017XXXXXXXX\nNagad: 017XXXXXXXX\nRocket: 017XXXXXXXX\n\nটাকা পাঠিয়ে TRD ID সহ চ্যাটে মেসেজ দিন।"
};

if (fs.existsSync(DB_FILE)) {
    try { db = JSON.parse(fs.readFileSync(DB_FILE)); } catch (e) {}
}

function saveDB() {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// ------------------- CUSTOMER COMMANDS -------------------

// Srate - প্রোডাক্ট প্রাইস লিস্ট দেখানো
bot.hears(['Srate', 'srate', 'SRATE'], (ctx) => {
    let text = "💳 **SIR TOPUP Price List** 💳\n---------------------------------\n";
    for (let item in db.prices) {
        text += `🔹 ${item.replace('_', ' ')} ➡${db.prices[item]} BDT\n`;
    }
    ctx.replyWithMarkdown(text);
});

// Sbalance - কাস্টমারের ব্যালেন্স চেক
bot.hears(['Sbalance', 'sbalance', 'SBALANCE'], (ctx) => {
    const userId = ctx.from.id;
    const balance = db.users[userId] || 0;
    ctx.reply(`💰 আপনার বর্তমান ব্যালেন্স: ${balance} BDT`);
});

// Snumber - পেমেন্ট নাম্বার প্রদর্শন
bot.hears(['Snumber', 'snumber', 'SNUMBER'], (ctx) => {
    ctx.replyWithMarkdown(db.payment_info);
});

// STP [UID] [Package] - অর্ডার প্লেসমেন্ট
bot.on('text', (ctx, next) => {
    const text = ctx.message.text.trim();
    if (text.startsWith('STP') || text.startsWith('stp')) {
        const parts = text.split(' ');
        if (parts.length < 3) {
            return ctx.reply("❌ ফরম্যাট সঠিক নয়! এভাবে লিখুন: STP [UID] [Package_Name]");
        }

        const uid = parts[1];
        const pkg = parts[2];
        const userId = ctx.from.id;
        const userBal = db.users[userId] || 0;

        // প্যাকেজের দাম চেক
        const priceKey = Object.keys(db.prices).find(k => k.toLowerCase() === pkg.toLowerCase());
        
        if (!priceKey) {
            return ctx.reply("❌ এই নামের কোনো প্যাকেজ খুঁজে পাওয়া যায়নি! সঠিক প্যাকেজের জন্য Srate চেক করুন।");
        }

        const price = db.prices[priceKey];

        // ব্যালেন্স চেক
        if (userBal < price) {
            return ctx.reply("⚠️ আপনার অ্যাকাউন্টে পর্যাপ্ত ব্যালেন্স নেই! দয়া করে Snumber দেখে ব্যালেন্স এড করুন।");
        }

        // ব্যালেন্স মাইনাস করা
        db.users[userId] = userBal - price;
        saveDB();

        // কাস্টমারকে কনফার্মেশন
        ctx.reply(`✅ আপনার অর্ডারটি সফলভাবে গ্রহন করা হয়েছে!\n\n📦 প্যাকেজ: ${priceKey}\n🆔 UID: ${uid}\n💸 কাটা হয়েছে: ${price} BDT\n💰 অবশিষ্ট ব্যালেন্স: ${db.users[userId]} BDT`);

        // অ্যাডমিনকে নোটিফিকেশন পাঠানো
        const adminMsg = `🛒 **NEW ORDER RECEIVED** 🛒\n\n👤 **Customer ID:** \`${userId}\`\n📝 **UID:** \`${uid}\`\n📦 **Package:** ${priceKey}\n💵 **Amount:** ${price} BDT\n\nকমপ্লিট করতে লিখুন: \`/complete ${userId}\`\nক্যানসেল করতে লিখুন: \`/cancel ${userId}\``;
        bot.telegram.sendMessage(ADMIN_ID, adminMsg, { parse_mode: 'Markdown' });
    } else {
        return next();
    }
});

// ------------------- ADMIN COMMANDS -------------------

// ১. কাস্টমার ব্যালেন্স যুক্ত করা: /addbalance [User_ID] [Amount]
bot.command('addbalance', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const args = ctx.message.text.split(' ');
    const targetUser = args[1];
    const amount = parseFloat(args[2]);

    if (!targetUser || isNaN(amount)) {
        return ctx.reply("❌ সঠিক নিয়ম: /addbalance [User_ID] [Amount]");
    }

    db.users[targetUser] = (db.users[targetUser] || 0) + amount;
    saveDB();

    ctx.reply(`✅ User ${targetUser}-এর অ্যাকাউন্টে ${amount} BDT যোগ করা হয়েছে। নতুন ব্যালেন্স: ${db.users[targetUser]} BDT`);
    bot.telegram.sendMessage(targetUser, `🎉 আপনার অ্যাকাউন্টে ${amount} BDT এড করা হয়েছে! বর্তমান ব্যালেন্স: ${db.users[targetUser]} BDT`);
});

// ২. ডায়নামিক প্রাইস আপডেট বা ড্রপ করা: /setprice [Package_Name] [Price]
bot.command('setprice', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const args = ctx.message.text.split(' ');
    const pkgName = args[1];
    const price = parseFloat(args[2]);

    if (!pkgName || isNaN(price)) {
        return ctx.reply("❌ সঠিক নিয়ম: /setprice [Package_Name] [Price]\nউদাহরণ: /setprice 25_Diamond 30");
    }

    db.prices[pkgName] = price;
    saveDB();

    ctx.reply(`✅ ${pkgName} প্যাকেজের দাম ${price} BDT আপডেট করা হয়েছে!`);
});

// ৩. অর্ডার কমপ্লিট করা: /complete [User_ID]
bot.command('complete', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const args = ctx.message.text.split(' ');
    const targetUser = args[1];

    if (!targetUser) return ctx.reply("❌ নিয়ম: /complete [User_ID]");

    bot.telegram.sendMessage(targetUser, "✅ আপনার অর্ডারটি সফলভাবে সম্পন্ন (Completed) হয়েছে! ধন্যবাদ আমাদের সাথে থাকার জন্য।");
    ctx.reply(`✅ User ${targetUser}-কে অর্ডার কমপ্লিট মেসেজ পাঠানো হয়েছে।`);
});

// ৪. অর্ডার ক্যানসেল করা ও রিফান্ড দেওয়া: /cancel [User_ID] [Price]
bot.command('cancel', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const args = ctx.message.text.split(' ');
    const targetUser = args[1];
    const refundPrice = parseFloat(args[2]);

    if (!targetUser || isNaN(refundPrice)) return ctx.reply("❌ নিয়ম: /cancel [User_ID] [Refund_Amount]");

    db.users[targetUser] = (db.users[targetUser] || 0) + refundPrice;
    saveDB();

    bot.telegram.sendMessage(targetUser, `❌ আপনার অর্ডারটি বাতিল করা হয়েছে এবং ${refundPrice} BDT আপনার অ্যাকাউন্টে রিফান্ড করা হয়েছে।`);
    ctx.reply(`❌ Order Canceled & ${refundPrice} BDT Refunded to ${targetUser}`);
});

bot.launch();
console.log("Sir Topup Bot is running...");
