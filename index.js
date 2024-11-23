const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
require('dotenv').config();

// Bot configuration
const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

// Admin configuration - Add these to your .env file
const ADMIN_IDS = (process.env.ADMIN_IDS || '').split(',').map(id => Number(id));
const OWNER_ID = Number(process.env.OWNER_ID);

// Store active generation sessions and their intervals
const activeSessions = new Map();

// Categories list
const categories = [
    'long_hair',
    'original',
    'blush',
    'brown_hair',
    'animal_ears',
    'thighhighs',
    'short_hair',
    'twintails',
    'blonde_hair',
    'navel',
    'purple_eyes',
    'panties',
    'red_eyes',
    'cleavage',
    'tail'
];

// User preferences storage
const userPreferences = new Map();

// Security middleware
function isAuthorized(userId) {
    return ADMIN_IDS.includes(userId) || userId === OWNER_ID;
}

// Command handler middleware
function commandMiddleware(handler) {
    return async (msg, match) => {
        const userId = msg.from.id;
        const chatId = msg.chat.id;
        
        if (!isAuthorized(userId)) {
            await bot.sendMessage(chatId, '⚠️ You are not authorized to use this bot. Please contact the bot owner.');
            // Notify owner of unauthorized access attempt
            const username = msg.from.username ? `@${msg.from.username}` : 'No username';
            const name = msg.from.first_name || 'Unknown';
            await bot.sendMessage(OWNER_ID, 
                `⚠️ Unauthorized access attempt:\nUser ID: ${userId}\nUsername: ${username}\nName: ${name}`
            );
            return;
        }
        
        handler(msg, match);
    };
}

// Generate random image URL with category
function generateImageUrl(category = '') {
    const baseUrl = 'https://pic.re/image';
    return category ? `${baseUrl}?${category}` : baseUrl;
}

// Admin commands
bot.onText(/\/admin/, async (msg) => {
    const userId = msg.from.id;
    if (userId !== OWNER_ID) {
        return;
    }
    
    const adminList = ADMIN_IDS.join('\n');
    await bot.sendMessage(userId, 
        `🔐 Admin Panel\n\nCurrent Admins:\n${adminList}\n\nCommands:\n` +
        `/addadmin [user_id] - Add new admin\n` +
        `/removeadmin [user_id] - Remove admin\n` +
        `/listadmins - Show all admins`
    );
});

// Add admin command (owner only)
bot.onText(/\/addadmin (.+)/, async (msg, match) => {
    const userId = msg.from.id;
    if (userId !== OWNER_ID) {
        return;
    }
    
    const newAdminId = Number(match[1]);
    if (!ADMIN_IDS.includes(newAdminId)) {
        ADMIN_IDS.push(newAdminId);
        await bot.sendMessage(userId, `✅ Admin added: ${newAdminId}`);
    } else {
        await bot.sendMessage(userId, `⚠️ User ${newAdminId} is already an admin`);
    }
});

// Remove admin command (owner only)
bot.onText(/\/removeadmin (.+)/, async (msg, match) => {
    const userId = msg.from.id;
    if (userId !== OWNER_ID) {
        return;
    }
    
    const adminToRemove = Number(match[1]);
    const index = ADMIN_IDS.indexOf(adminToRemove);
    if (index > -1) {
        ADMIN_IDS.splice(index, 1);
        await bot.sendMessage(userId, `✅ Admin removed: ${adminToRemove}`);
    } else {
        await bot.sendMessage(userId, `⚠️ User ${adminToRemove} is not an admin`);
    }
});

// List admins command (owner only)
bot.onText(/\/listadmins/, async (msg) => {
    const userId = msg.from.id;
    if (userId !== OWNER_ID) {
        return;
    }
    
    const adminList = ADMIN_IDS.join('\n');
    await bot.sendMessage(userId, `Current Admins:\n${adminList}`);
});

// Start command handler
bot.onText(/\/start/, commandMiddleware((msg) => {
    const chatId = msg.chat.id;
    const message = `Welcome to the Random Image Generator Bot!\n\n` +
        `Commands:\n` +
        `/startgen - Start image generation\n` +
        `/stopgen - Stop image generation\n` +
        `/setcategory - Set image category\n` +
        `/showcategories - Show available categories\n` +
        `/currentcategory - Show your current category`;
    
    bot.sendMessage(chatId, message);
}));

// Show categories command handler
bot.onText(/\/showcategories/, commandMiddleware((msg) => {
    const chatId = msg.chat.id;
    const categoriesList = categories.join('\n• ');
    bot.sendMessage(chatId, `Available categories:\n\n• ${categoriesList}`);
}));

// Start generation command handler
bot.onText(/\/startgen/, commandMiddleware((msg) => {
    const chatId = msg.chat.id;
    
    if (activeSessions.has(chatId)) {
        bot.sendMessage(chatId, 'Image generation is already running!');
        return;
    }

    const category = userPreferences.get(chatId);
    bot.sendMessage(chatId, 'Starting image generation...');
    
    sendRandomImage(chatId);
    
    const interval = setInterval(() => {
        sendRandomImage(chatId);
    }, 30000);
    
    activeSessions.set(chatId, interval);
}));

// Stop generation command handler
bot.onText(/\/stopgen/, commandMiddleware((msg) => {
    const chatId = msg.chat.id;
    
    if (activeSessions.has(chatId)) {
        clearInterval(activeSessions.get(chatId));
        activeSessions.delete(chatId);
        bot.sendMessage(chatId, 'Image generation stopped.');
    } else {
        bot.sendMessage(chatId, 'No active image generation to stop.');
    }
}));

// Set category command handler
bot.onText(/\/setcategory/, commandMiddleware((msg) => {
    const chatId = msg.chat.id;
    
    const categoryKeyboard = {
        reply_markup: {
            inline_keyboard: categories.map(category => ([{
                text: category,
                callback_data: `category:${category}`
            }]))
        }
    };
    
    bot.sendMessage(chatId, 'Select a category:', categoryKeyboard);
}));

// Show current category command handler
bot.onText(/\/currentcategory/, commandMiddleware((msg) => {
    const chatId = msg.chat.id;
    const currentCategory = userPreferences.get(chatId) || 'No category set (random)';
    bot.sendMessage(chatId, `Your current category: ${currentCategory}`);
}));

// Category selection callback handler
bot.on('callback_query', async (callbackQuery) => {
    const userId = callbackQuery.from.id;
    if (!isAuthorized(userId)) {
        await bot.answerCallbackQuery(callbackQuery.id, {
            text: 'You are not authorized to use this bot.',
            show_alert: true
        });
        return;
    }
    
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;
    
    if (data.startsWith('category:')) {
        const category = data.split(':')[1];
        userPreferences.set(chatId, category);
        await bot.answerCallbackQuery(callbackQuery.id);
        bot.sendMessage(chatId, `Category set to: ${category}`);
    }
});

// Function to send random image
async function sendRandomImage(chatId) {
    try {
        const category = userPreferences.get(chatId);
        const imageUrl = generateImageUrl(category);
        
        const response = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
            headers: {
                'Accept': 'image/*'
            }
        });

        const contentType = response.headers['content-type'];
        const extension = contentType.split('/')[1] || 'jpg';
        const timestamp = Date.now();
        const filename = `image_${timestamp}.${extension}`;

        await bot.sendPhoto(chatId, Buffer.from(response.data), {
            filename: filename,
            contentType: contentType
        }, {
            filename: filename
        });
    } catch (error) {
        console.error('Error sending image:', error);
        bot.sendMessage(chatId, 'Error generating image. Please try again.');
    }
}

// Error handling
bot.on('polling_error', (error) => {
    console.error('Polling error:', error);
});

// Disable the deprecation warning
process.env.NTBA_FIX_319 = 1;

console.log('Bot is running...');