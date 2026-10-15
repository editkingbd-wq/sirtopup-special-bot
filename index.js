const { Telegraf } = require('telegraf');
const fs = require('fs');
const express = require('express');

// Render 24/7 Uptime-এর জন্য Express Server
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Sir Topup Bot is Running Successfully!');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// টোকেন ও অ্যাডমিন আইডি
const BOT_TOKEN = '8395471740:AAGa-UhRJNfRdqwLJbtrjBYNO5aVyvdPB4Y'; 
const ADMIN_ID = 5932254012; 

const bot = new Telegraf(BOT_TOKEN);

// ডাটাবেজ সংরক্ষণ ব্যবস্থার ফাইল
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
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// ------------------- CUSTOMER COMMANDS & HELP MENU -------------------

// Srate - প্রোডাক্ট প্রাইস লিস্ট প্রদর্শন
bot.hears(['Srate', 'srate', 'SRATE'], (ctx) => {
    let text = "💳 **SIR TOPUP Price List** 💳\n---------------------------------\n";
    for (let item in db.prices) {
        text += `🔹 ${item.replace(/_/g, ' ')} ➡${db.prices[item]} BDT\n`;
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

// ------------------- MAIN MESSAGE HANDLER & LIVE CHAT -------------------

bot.on('text', (ctx) => {
    const text = ctx.message.text.trim();
    const userId = ctx.from.id;

    // ১. অ্যাডমিন যদি কাস্টমারের কোনো নোটিফিকেশন মেসেজে Reply দেয়
    if (userId === ADMIN_ID && ctx.message.reply_to_message) {
        const replyText = ctx.message.reply_to_message.text || ctx.message.reply_to_message.caption || "";
        
        const match = replyText.match(/User ID:\s*`?(\d+)`?/i) || replyText.match(/Customer ID:\s*`?(\d+)`?/i);
        
        if (match && match[1]) {
            const targetUser = match[1];
            bot.telegram.sendMessage(targetUser, `👨‍💻 **Admin Reply:**\n\n${text}`)
                .then(() => ctx.reply("✅ আপনার মেসেজটি কাস্টমারের কাছে পাঠানো হয়েছে।"))
                .catch(() => ctx.reply("❌ মেসেজ পাঠানো সম্ভব হয়নি। কাস্টমার হয়তো বট ব্লক করে রেখেছে।"));
        } else {
            ctx.reply("❌ ইউজার আইডি সনাক্ত করা যায়নি। কাস্টমারের মূল মেসেজটিতে Reply দিন।");
        }
        return;
    }

    if (userId === ADMIN_ID) return;

    // ২. শুধু "STP" লিখলে বটের নির্দেশিকা ও কমান্ড লিস্ট দেখাবে
    if (text.toLowerCase() === 'stp') {
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
        
        return ctx.replyWithMarkdown(helpMenu);
    }

    // ৩. Sverify [TrxID] - পেমেন্ট ভেরিফিকেশন রিকোয়েস্ট
    if (text.toLowerCase().startsWith('sverify')) {
        const parts = text.split(' ');
        if (parts.length < 2) {
            return ctx.reply("❌ ফরম্যাট সঠিক নয়! টাকা পাঠানোর পর এভাবে লিখুন: Sverify [TrxID]");
        }

        const trxId = parts.slice(1).join(' ');
        
        ctx.reply("✅ আপনার ট্রানজেকশন আইডি গ্রহন করা হয়েছে। অ্যাডমিন পেমেন্ট চেক করে খুব শীঘ্রই ব্যালেন্স যুক্ত করে দেবে।");

        const adminMsg = `💳 **NEW PAYMENT VERIFY REQUEST** 💳\n\n👤 **Customer Name:** ${ctx.from.first_name || 'N/A'}\n🆔 **User ID:** \`${userId}\`\n🔢 **TrxID:** \`${trxId}\`\n\nব্যালেন্স এড করতে লিখুন:\n\`/addbalance ${userId} AMOUNT\``;
        bot.telegram.sendMessage(ADMIN_ID, adminMsg, { parse_mode: 'Markdown' });
        return;
    }

    // ৪. STP [UID] [Package] - অর্ডার সাবমিট করা
    if (text.toLowerCase().startsWith('stp ')) {
        const parts = text.split(' ');
        if (parts.length < 3) {
            return ctx.reply("❌ ফরম্যাট সঠিক নয়! এভাবে লিখুন: STP [UID] [Package_Name]\n*(সাহায্যের জন্য শুধু STP লিখে পাঠান)*");
        }

        const uid = parts[1];
        const pkg = parts[2];
        const userBal = db.users[userId] || 0;

        const priceKey = Object.keys(db.prices).find(k => k.toLowerCase() === pkg.toLowerCase());
        
        if (!priceKey) {
            return ctx.reply("❌ এই নামের কোনো প্যাকেজ খুঁজে পাওয়া যায়নি! সঠিক প্যাকেজের নাম দেখতে Srate চেক করুন।");
        }

        const price = db.prices[priceKey];

        if (userBal < price) {
            return ctx.reply("⚠️ আপনার অ্যাকাউন্টে পর্যাপ্ত ব্যালেন্স নেই! Snumber দেখে টাকা পাঠিয়ে Sverify দিয়ে ব্যালেন্স এড করুন।");
        }

        db.users[userId] = userBal - price;
        saveDB();

        ctx.reply(`✅ আপনার অর্ডারটি সফলভাবে গ্রহন করা হয়েছে!\n\n📦 প্যাকেজ: ${priceKey}\n🆔 UID: ${uid}\n💸 কাটা হয়েছে: ${price} BDT\n💰 অবশিষ্ট ব্যালেন্স: ${db.users[userId]} BDT`);

        const adminMsg = `🛒 **NEW ORDER RECEIVED** 🛒\n\n👤 **Customer ID:** \`${userId}\`\n📝 **UID:** \`${uid}\`\n📦 **Package:** ${priceKey}\n💵 **Amount:** ${price} BDT\n\nকমপ্লিট করতে লিখুন: \`/complete ${userId}\`\nক্যানসেল করতে লিখুন: \`/cancel ${userId} ${price}\``;
        bot.telegram.sendMessage(ADMIN_ID, adminMsg, { parse_mode: 'Markdown' });
        return;
    }

    // ৫. কাস্টমার অন্য কোনো মেসেজ লিখলে তা সরাসরি অ্যাডমিন সাপোর্ট চ্যাটে যাবে
    ctx.reply("📩 আপনার মেসেজটি অ্যাডমিনের কাছে পাঠানো হয়েছে। অনুগ্রহ করে উত্তরের জন্য অপেক্ষা করুন।");

    const userMsgToAdmin = `💬 **NEW CUSTOMER MESSAGE** 💬\n\n👤 **Name:** ${ctx.from.first_name || 'N/A'}\n🆔 **User ID:** \`${userId}\`\n💬 **Message:** ${text}\n\n*(উত্তর দিতে এই মেসেজটিতে Reply দিন)*`;
    bot.telegram.sendMessage(ADMIN_ID, userMsgToAdmin, { parse_mode: 'Markdown' });
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

// ২. নতুন প্রোডাক্ট যোগ করা বা দাম পরিবর্তন করা: /setprice [Package_Name] [Price]
bot.command('setprice', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const args = ctx.message.text.split(' ');
    const pkgName = args[1];
    const price = parseFloat(args[2]);

    if (!pkgName || isNaN(price)) {
        return ctx.reply("❌ সঠিক নিয়ম: /setprice [Package_Name] [Price]\nউদাহরণ: /setprice 200_Diamond 190");
    }

    db.prices[pkgName] = price;
    saveDB();

    ctx.reply(`✅ ${pkgName} প্যাকেজের দাম ${price} BDT হিসেবে যুক্ত/আপডেট করা হয়েছে!`);
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

// ৪. অর্ডার বাতিল ও রিফান্ড: /cancel [User_ID] [Refund_Amount]
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
