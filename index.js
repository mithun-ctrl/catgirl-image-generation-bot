const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const dotenv = require('dotenv');
const express = require('express');

dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;
let bot;

// Different bot configuration for production and development
if (process.env.NODE_ENV === 'production') {
    bot = new TelegramBot(token, { polling: true });
} else {
    bot = new TelegramBot(token, { polling: true });
}

// API endpoint
const API_URL = 'https://api.nekosia.cat/api/v1/images/catgirl';

// Store active intervals
const activeIntervals = new Map();

// Function to send catgirl image
async function sendCatgirlImage(chatId) {
    try {
        // Send a "generating" message
        const loadingMessage = await bot.sendMessage(chatId, '🐱 Generating a cute catgirl image...');
        
        // Fetch image from API with proper error handling
        const response = await axios.get(API_URL, {
            timeout: 10000, // 10 second timeout
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'TelegramBot/1.0'
            }
        });

        // Check if response has the expected structure
        if (response.data && response.data.url) {
            const imageUrl = response.data.url;
            
            // Send the image
            await bot.sendPhoto(chatId, imageUrl, {
                caption: '🎀 Here\'s your catgirl image!\n\nUse /stop to stop generating images'
            });
        } else {
            throw new Error('Invalid API response format');
        }
        
        // Delete the loading message
        await bot.deleteMessage(chatId, loadingMessage.message_id).catch(() => {
            // Ignore errors from deleting messages
        });
        
    } catch (error) {
        console.error('Error in sendCatgirlImage:', error.message);
        
        // Send error message to user
        try {
            await bot.sendMessage(chatId, '😿 Sorry, there was an error generating the image. Trying again in 15 seconds!');
        } catch (sendError) {
            console.error('Error sending error message:', sendError.message);
        }
    }
}

// Handle /start command
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    
    try {
        // Clear any existing interval for this chat
        if (activeIntervals.has(chatId)) {
            clearInterval(activeIntervals.get(chatId));
            activeIntervals.delete(chatId);
        }
        
        // Send initial message
        await bot.sendMessage(chatId, '🌟 Starting automatic catgirl image generation every 15 seconds!\n\nUse /stop to stop generating images');
        
        // Send first image immediately
        await sendCatgirlImage(chatId);
        
        // Set up interval for subsequent images
        const interval = setInterval(() => {
            sendCatgirlImage(chatId);
        }, 15000); // 15 seconds
        
        // Store the interval
        activeIntervals.set(chatId, interval);
        
    } catch (error) {
        console.error('Error in start command:', error.message);
    }
});

// Handle /stop command
bot.onText(/\/stop/, async (msg) => {
    const chatId = msg.chat.id;
    
    try {
        if (activeIntervals.has(chatId)) {
            clearInterval(activeIntervals.get(chatId));
            activeIntervals.delete(chatId);
            await bot.sendMessage(chatId, '✨ Stopped generating images!\n\nUse /start to begin generating again');
        } else {
            await bot.sendMessage(chatId, '😊 No active image generation to stop.\n\nUse /start to begin generating images');
        }
    } catch (error) {
        console.error('Error in stop command:', error.message);
    }
});

// Clean up intervals when bot stops
process.on('SIGINT', () => {
    activeIntervals.forEach((interval) => {
        clearInterval(interval);
    });
    process.exit();
});

// Handle polling errors
bot.on('polling_error', (error) => {
    console.error('Polling error:', error.message);
});

// Express server setup
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Bot is running!');
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

// General error handling
process.on('unhandledRejection', (error) => {
    console.error('Unhandled Promise Rejection:', error.message);
});

console.log('Bot is running...');