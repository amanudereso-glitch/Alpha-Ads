const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const path = require('path');

const TOKEN = '9159680621:AAGkvHRcM5wYLt5X_FDOcl0J1y6XYC2A19M';
const ADMIN_ID = '8319043148';
const CHANNEL_USERNAME = '@alpha_ads_earn';

const bot = new TelegramBot(TOKEN, { polling: true });
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Check channel membership helper
async function checkMembership(userId) {
  try {
    const chatMember = await bot.getChatMember(CHANNEL_USERNAME, userId);
    return ['member', 'administrator', 'creator'].includes(chatMember.status);
  } catch (error) {
    console.error('Error checking membership:', error);
    return false;
  }
}

// Bot start command
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const isJoined = await checkMembership(chatId);

  const opts = {
    reply_markup: {
      inline_keyboard: [
        [{ text: '📢 Join Channel', url: 'https://t.me/alpha_ads_earn' }],
        [{ text: '🚀 Open Alpha Ads Earn', web_app: { url: `https://your-render-app-url.onrender.com?userId=${chatId}` } }]
      ]
    }
  };

  bot.sendMessage(chatId, `Welcome to Alpha Ads Earn!\n\nPlease join our channel first to use the app and earn money.`, opts);
});

// API endpoint to verify channel subscription
app.get('/api/verify/:userId', async (req, res) => {
  const userId = req.params.userId;
  const isJoined = await checkMembership(userId);
  res.json({ joined: isJoined });
});

// API endpoint to handle withdrawals and forward to admin
app.post('/api/withdraw', async (req, res) => {
  const { userId, username, amount, adsWatched, method, account } = req.body;

  if (adsWatched < 30) {
    return res.json({ success: false, message: 'You need at least 30 ads watched to withdraw!' });
  }

  if (amount < 50) {
    return res.json({ success: false, message: 'Minimum withdrawal amount is 50 ETB!' });
  }

  // Send withdrawal request to admin
  const adminMessage = `🚨 **New Withdrawal Request**\n\n👤 User: @${username || 'N/A'} (ID: \`${userId}\`)\n💰 Amount: \`${amount} ETB\`\n📺 Ads Watched: \`${adsWatched}/30\`\n💳 Method: \`${method}\`\n📋 Account: \`${account}\``;

  try {
    await bot.sendMessage(ADMIN_ID, adminMessage, { parse_mode: 'Markdown' });
    res.json({ success: true, message: 'Withdrawal request sent to admin successfully!' });
  } catch (error) {
    console.error('Failed to send withdrawal to admin:', error);
    res.json({ success: false, message: 'Failed to process withdrawal. Try again later.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
