const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const fs = require('fs');
require('dotenv').config();

// Bot configuration
const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

// Admin configuration
const ADMIN_IDS = (process.env.ADMIN_IDS || '').split(',').map(id => Number(id));
const OWNER_ID = Number(process.env.OWNER_ID);

// File paths for persistent storage
const SESSIONS_FILE = 'active_sessions.json';
const PREFERENCES_FILE = 'user_preferences.json';

// Store active generation sessions and their intervals
const activeSessions = new Map();

// Load saved sessions and preferences
function loadSavedData() {
    try {
        if (fs.existsSync(SESSIONS_FILE)) {
            const sessions = JSON.parse(fs.readFileSync(SESSIONS_FILE));
            sessions.forEach(chatId => {
                startImageGeneration(Number(chatId));
            });
            console.log('Restored sessions:', sessions);
        }

        if (fs.existsSync(PREFERENCES_FILE)) {
            const preferences = JSON.parse(fs.readFileSync(PREFERENCES_FILE));
            Object.entries(preferences).forEach(([chatId, category]) => {
                userPreferences.set(Number(chatId), category);
            });
            console.log('Restored preferences');
        }
    } catch (error) {
        console.error('Error loading saved data:', error);
    }
}

// Save active sessions to file
function saveSessions() {
    try {
        const sessions = Array.from(activeSessions.keys());
        fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions));
    } catch (error) {
        console.error('Error saving sessions:', error);
    }
}

// Save user preferences to file
function savePreferences() {
    try {
        const preferences = Object.fromEntries(userPreferences);
        fs.writeFileSync(PREFERENCES_FILE, JSON.stringify(preferences));
    } catch (error) {
        console.error('Error saving preferences:', error);
    }
}

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
            await bot.sendMessage(OWNER_ID, 
                `⚠️ Unauthorized access attempt:\nUser ID: ${userId}\nUsername: ${msg.from.username || 'No username'}\nName: ${msg.from.first_name || 'Unknown'}`
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

// Start image generation function
function startImageGeneration(chatId) {
    if (activeSessions.has(chatId)) {
        clearInterval(activeSessions.get(chatId));
    }

    // Send first image immediately
    sendRandomImage(chatId);
    
    // Set up interval for subsequent images
    const interval = setInterval(() => {
        sendRandomImage(chatId);
    }, 216000);
    
    activeSessions.set(chatId, interval);
    saveSessions();
}

// Admin commands
bot.onText(/\/admin/, async (msg) => {
    const userId = msg.from.id;
    if (userId !== OWNER_ID) return;
    
    const adminList = ADMIN_IDS.join('\n');
    await bot.sendMessage(userId, 
        `🔐 Admin Panel\n\nCurrent Admins:\n${adminList}\n\nCommands:\n` +
        `/addadmin [user_id] - Add new admin\n` +
        `/removeadmin [user_id] - Remove admin\n` +
        `/listadmins - Show all admins`
    );
});

bot.onText(/\/addadmin (.+)/, async (msg, match) => {
    const userId = msg.from.id;
    if (userId !== OWNER_ID) return;
    
    const newAdminId = Number(match[1]);
    if (!ADMIN_IDS.includes(newAdminId)) {
        ADMIN_IDS.push(newAdminId);
        await bot.sendMessage(userId, `✅ Admin added: ${newAdminId}`);
    } else {
        await bot.sendMessage(userId, `⚠️ User ${newAdminId} is already an admin`);
    }
});

bot.onText(/\/removeadmin (.+)/, async (msg, match) => {
    const userId = msg.from.id;
    if (userId !== OWNER_ID) return;
    
    const adminToRemove = Number(match[1]);
    const index = ADMIN_IDS.indexOf(adminToRemove);
    if (index > -1) {
        ADMIN_IDS.splice(index, 1);
        await bot.sendMessage(userId, `✅ Admin removed: ${adminToRemove}`);
    } else {
        await bot.sendMessage(userId, `⚠️ User ${adminToRemove} is not an admin`);
    }
});

bot.onText(/\/listadmins/, async (msg) => {
    const userId = msg.from.id;
    if (userId !== OWNER_ID) return;
    
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
    startImageGeneration(chatId);
    bot.sendMessage(chatId, 'Starting image generation...');
}));

// Stop generation command handler
bot.onText(/\/stopgen/, commandMiddleware((msg) => {
    const chatId = msg.chat.id;
    
    if (activeSessions.has(chatId)) {
        clearInterval(activeSessions.get(chatId));
        activeSessions.delete(chatId);
        saveSessions();
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
        savePreferences();
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

// Handle process termination
process.on('SIGINT', () => {
    saveSessions();
    savePreferences();
    process.exit();
});

process.on('SIGTERM', () => {
    saveSessions();
    savePreferences();
    process.exit();
});

// Disable the deprecation warning
process.env.NTBA_FIX_319 = 1;

// Load saved sessions and preferences on startup
loadSavedData();

console.log('Bot is running...');
