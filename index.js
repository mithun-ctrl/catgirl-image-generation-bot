const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const fs = require('fs');
require('dotenv').config();
const botMonitor = require('./activity/monitor');
const databaseConnection = require("./database/db")
const Admin = require("./models/admin")
const Waifu = require("./models/waifu")

databaseConnection();

const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });


const ADMIN_IDS = (process.env.ADMIN_IDS || '').split(',').map(id => Number(id));
const OWNER_ID = Number(process.env.OWNER_ID);


const SESSIONS_FILE = 'active_sessions.json';
const PREFERENCES_FILE = 'user_preferences.json';


const activeSessions = new Map();


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


function saveSessions() {
    try {
        const sessions = Array.from(activeSessions.keys());
        fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions));
    } catch (error) {
        console.error('Error saving sessions:', error);
    }
}


function savePreferences() {
    try {
        const preferences = Object.fromEntries(userPreferences);
        fs.writeFileSync(PREFERENCES_FILE, JSON.stringify(preferences));
    } catch (error) {
        console.error('Error saving preferences:', error);
    }
}


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

const userPreferences = new Map();


function isAuthorized(userId) {
    return ADMIN_IDS.includes(userId) || userId === OWNER_ID;
}


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
    // Handle cases where category might be an object or undefined
    const categoryParam = typeof category === 'object' ? category.category : category;
    return categoryParam ? `${baseUrl}?${categoryParam}` : baseUrl;
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

bot.onText(/\/addadmin/, async (msg) => {
    const userId = msg.from.id;
    const chatId = msg.chat.id;

    if (userId !== OWNER_ID) {
        await bot.sendMessage(chatId, '⚠️ This command is restricted to the bot owner.');
        return;
    }

    await bot.sendMessage(chatId, 'Please forward a message from the user you want to add as an admin.');

    // Set up a one-time message listener for forwarded message
    bot.once('message', async (forwardedMsg) => {
        if (!forwardedMsg.forward_from) {
            await bot.sendMessage(chatId, '❌ No user information found. Please forward a message from the user.');
            return;
        }

        const newAdminId = forwardedMsg.forward_from.id;
        const username = forwardedMsg.forward_from.username;

        try {
            // Check if admin already exists
            const existingAdmin = await Admin.findOne({ userId: newAdminId });
            if (existingAdmin) {
                await bot.sendMessage(chatId, `⚠️ User ${newAdminId} is already an admin`);
                return;
            }

            // Create new admin
            const newAdmin = new Admin({ 
                userId: newAdminId, 
                username: username 
            });
            await newAdmin.save();

            await bot.sendMessage(chatId, `✅ Admin added: ${newAdminId} (${username || 'No username'})`);
        } catch (error) {
            console.error('Error adding admin:', error);
            await bot.sendMessage(chatId, '❌ Failed to add admin. Please try again.');
        }
    });
});

bot.onText(/\/removeadmin/, async (msg) => {
    const userId = msg.from.id;
    const chatId = msg.chat.id;

    if (userId !== OWNER_ID) {
        await bot.sendMessage(chatId, '⚠️ This command is restricted to the bot owner.');
        return;
    }

    await bot.sendMessage(chatId, 'Please forward a message from the admin you want to remove.');

    // Set up a one-time message listener for forwarded message
    bot.once('message', async (forwardedMsg) => {
        if (!forwardedMsg.forward_from) {
            await bot.sendMessage(chatId, '❌ No user information found. Please forward a message from the user.');
            return;
        }

        const adminToRemove = forwardedMsg.forward_from.id;

        try {
            const result = await Admin.findOneAndDelete({ userId: adminToRemove });
            
            if (result) {
                await bot.sendMessage(chatId, `✅ Admin removed: ${adminToRemove}`);
            } else {
                await bot.sendMessage(chatId, `⚠️ User ${adminToRemove} is not an admin`);
            }
        } catch (error) {
            console.error('Error removing admin:', error);
            await bot.sendMessage(chatId, '❌ Failed to remove admin. Please try again.');
        }
    });
});

bot.onText(/\/listadmins/, async (msg) => {
    const userId = msg.from.id;
    const chatId = msg.chat.id;

    if (userId !== OWNER_ID) {
        await bot.sendMessage(chatId, '⚠️ This command is restricted to the bot owner.');
        return;
    }
    
    try {
        const admins = await Admin.find({});
        const adminList = admins.map(admin => 
            `ID: ${admin.userId}, Username: ${admin.username || 'No username'}`
        ).join('\n');
        
        await bot.sendMessage(chatId, `Current Admins:\n${adminList || 'No admins found'}`);
    } catch (error) {
        console.error('Error listing admins:', error);
        await bot.sendMessage(chatId, '❌ Failed to retrieve admin list.');
    }
});


// Favorite command handler
bot.onText(/\/fav/, commandMiddleware((msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 'Reply to an image with /fav to save it to your waifu collection!');
}));

bot.onText(/\/start/, commandMiddleware((msg) => {
    
    const chatId = msg.chat.id;
    botMonitor.incrementMessageCount('message');

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

bot.onText(/\/status/, commandMiddleware((msg) =>{

    const userId = msg.from.id
    const chatId = msg.chat.id
    if (userId !== OWNER_ID) {
        bot.sendMessage(chatId, '⚠️ This command is restricted to the bot owner.');
        return;
    }
    const report = botMonitor.generateReport()
    bot.sendMessage(chatId, report)
}));

// Category selection callback handler
bot.on('callback_query', async (callbackQuery) => {
    const userId = callbackQuery.from.id;
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;

    if (!await isAuthorized(userId)) {
        await bot.answerCallbackQuery(callbackQuery.id, {
            text: 'You are not authorized to use this bot.',
            show_alert: true
        });
        return;
    }

    if (data.startsWith('waifu_category:')) {
        const category = data.split(':')[1];
        
        // Temporarily store category in user preferences
        userPreferences.set(chatId, { 
            type: 'waifu_category', 
            category 
        });

        await bot.answerCallbackQuery(callbackQuery.id);
        await bot.sendMessage(chatId, `Category set to: ${category}. Now send me the name of your waifu.`);
    }
});

bot.on('inline_query', async (inlineQuery) => {
    try {
        const userId = inlineQuery.from.id;
        
        // Fetch user's waifus
        const waifus = await Waifu.find({ userId });
        
        // Create inline query results
        const results = waifus.map((waifu, index) => ({
            type: 'photo',
            id: waifu._id.toString(),
            photo_url: waifu.imageUrl,
            thumb_url: waifu.imageUrl,
            caption: `Waifu #${index + 1}: ${waifu.name || 'Unnamed'}`,
            title: waifu.name || `Waifu #${index + 1}`,
        }));

        // Respond to inline query
        await bot.answerInlineQuery(inlineQuery.id, results, {
            cache_time: 0
        });
    } catch (error) {
        console.error('Inline query error:', error);
    }
});

bot.on('message', async (msg) => {
    // Check if the message is a reply to the /fav command
    if (msg.reply_to_message && msg.text === '/fav') {
        const userId = msg.from.id;
        const chatId = msg.chat.id;

        try {
            // Check if the replied message has a photo
            if (!msg.reply_to_message.photo) {
                await bot.sendMessage(chatId, 'Please reply to an image to save it as a waifu.');
                return;
            }

            // Get the largest photo
            const photo = msg.reply_to_message.photo[msg.reply_to_message.photo.length - 1];
            
            // Get the file details
            const file = await bot.getFile(photo.file_id);
            const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;

            // Save waifu to database
            const newWaifu = new Waifu({
                userId,
                name: msg.reply_to_message.caption || 'Unnamed Waifu',
                imageUrl: fileUrl,
                category: 'custom'
            });
            await newWaifu.save();

            await bot.sendMessage(chatId, '💕 Waifu added to your collection!');
        } catch (error) {
            console.error('Error saving waifu:', error);
            await bot.sendMessage(chatId, '❌ Failed to save waifu. Please try again.');
        }
    }
});

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
        botMonitor.incrementMessageCount('image')
    } catch (error) {
        console.error('Error sending image:', error);
        bot.sendMessage(chatId, 'Error generating image. Please try again.');

        botMonitor.incrementMessageCount('error')
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
