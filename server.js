const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Environment Variables
const BOT_TOKEN = process.env.BOT_TOKEN || '9159680621:AAGkvHRcM5wYLt5X_FDOcl0J1y6XYC2A19M';
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://Alpha:406976aaa@cluster0.sgcjmyi.mongodb.net/omega_bot?retryWrites=true&w=majority';
const CHANNEL_USERNAME = '@alpha_ads_earn';
const ADMIN_ID = '8319043148';

// Connect to MongoDB
mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log('MongoDB Connected Successfully')).catch(err => console.log('MongoDB Connection Error:', err));

// User Schema
const userSchema = new mongoose.Schema({
    userId: { type: Number, required: true, unique: true },
    username: { type: String },
    balance: { type: Number, default: 0 },
    earningWallet: { type: Number, default: 0 },
    totalEarned: { type: Number, default: 0 },
    withdrawn: { type: Number, default: 0 },
    adsWatched: { type: Number, default: 0 },
    referredBy: { type: Number, default: null },
    validReferrals: { type: Number, default: 0 },
    pendingReferrals: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// Telegram Bot Setup
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    bot.sendMessage(chatId, `Welcome to Alpha Ads Earn! 🚀\n\nClick below to start earning ETB by watching ads and inviting friends.`, {
        reply_markup: {
            inline_keyboard: [
                [{ text: '🚀 Open Mini App', web_app: { url: `https://alpha-ads.onrender.com?userId=${userId}` } }],
                [{ text: '📢 Join Channel', url: `https://t.me/alpha_ads_earn` }]
            ]
        }
    });
});

// API: Init / Get User Data & Handle Referrals
app.post('/api/user/init', async (req, res) => {
    try {
        const { userId, username, referrerId } = req.body;
        let user = await User.findOne({ userId });
        
        if (!user) {
            user = new User({ userId, username: username || 'USER' });

            // If referred by someone valid
            if (referrerId && parseInt(referrerId) !== userId) {
                const referrer = await User.findOne({ userId: parseInt(referrerId) });
                if (referrer) {
                    user.referredBy = referrer.userId;
                    referrer.pendingReferrals += 1; // Add to referrer's pending
                    await referrer.save();
                }
            }
            await user.save();
        }
        res.json({ success: true, user });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// API: Verify Channel Membership
app.get('/api/verify/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        const chatMember = await bot.getChatMember(CHANNEL_USERNAME, userId);
        const isMember = ['member', 'administrator', 'creator'].includes(chatMember.status);
        res.json({ joined: isMember });
    } catch (e) {
        res.json({ joined: true });
    }
});

// API: Update User Stats (Watch Ad)
app.post('/api/update-activity', async (req, res) => {
    try {
        const { userId, adWatched } = req.body;
        let user = await User.findOne({ userId });
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        if (adWatched) {
            user.adsWatched += 1;
            user.earningWallet += 0.40;
            user.totalEarned += 0.40;

            // If user watched their 1st ad and was pending for someone, convert to valid referral!
            if (user.adsWatched === 1 && user.referredBy) {
                const referrer = await User.findOne({ userId: user.referredBy });
                if (referrer && referrer.pendingReferrals > 0) {
                    referrer.pendingReferrals -= 1;
                    referrer.validReferrals += 1;
                    referrer.balance += 3.00; // 3 ETB reward
                    await referrer.save();
                }
            }
        }

        await user.save();
        res.json({ success: true, user });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// API: Withdraw Request
app.post('/api/withdraw', async (req, res) => {
    try {
        const { userId, username, amount, adsWatched, method, account } = req.body;
        let user = await User.findOne({ userId });

        if (!user || user.balance < amount) {
            return res.json({ success: false, message: 'Insufficient balance!' });
        }

        user.balance -= amount;
        user.withdrawn += amount;
        await user.save();

        // Send notification to Admin
        bot.sendMessage(ADMIN_ID, `🔔 **New Withdrawal Request**\n\n👤 User: @${username || userId}\n💰 Amount: ${amount} ETB\n📱 Method: ${method}\nacc: ${account}\n📺 Ads Watched: ${adsWatched}`);

        res.json({ success: true, message: 'Withdrawal request sent successfully!' });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
