const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const dotenv = require('dotenv');
const express = require('express');

dotenv.config();

// Use environment variable for bot token
const token = process.env.TELEGRAM_BOT_TOKEN;

// Create bot instance with appropriate options for Railway
const bot = new TelegramBot(token, {
    polling: true,
    webHook: {
        port: process.env.PORT
    }
});

// API endpoint
const API_URL = 'https://api.nekosia.cat/api/v1/images/catgirl';

// Store active intervals
const activeIntervals = new Map();

// Function to send catgirl image
async function sendCatgirlImage(chatId) {
    try {
        // Send a "generating" message
        const loadingMessage = await bot.sendMessage(chatId, '🐱 Generating a cute catgirl image...');
        
        // Fetch image from API
        const response = await axios.get(API_URL);
        const imageUrl = response.data.url;
        
        if (!imageUrl) {
            throw new Error('No image URL received from API');
        }
        
        // Send the image
        await bot.sendPhoto(chatId, imageUrl, {
            caption: '🎀 Here\'s your catgirl image!\n\nUse /stop to stop generating images'
        });
        
        // Delete the loading message
        bot.deleteMessage(chatId, loadingMessage.message_id);
        
    } catch (error) {
        console.error('Error:', error);
        bot.sendMessage(chatId, '😿 Sorry, there was an error generating the image. Please try again later!');
    }
}

// Handle /start command
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    
    // Clear any existing interval for this chat
    if (activeIntervals.has(chatId)) {
        clearInterval(activeIntervals.get(chatId));
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
});

// Handle /stop command
bot.onText(/\/stop/, (msg) => {
    const chatId = msg.chat.id;
    
    if (activeIntervals.has(chatId)) {
        clearInterval(activeIntervals.get(chatId));
        activeIntervals.delete(chatId);
        bot.sendMessage(chatId, '✨ Stopped generating images!\n\nUse /start to begin generating again');
    } else {
        bot.sendMessage(chatId, '😊 No active image generation to stop.\n\nUse /start to begin generating images');
    }
});

// Clean up intervals when bot stops
process.on('SIGINT', () => {
    activeIntervals.forEach((interval) => {
        clearInterval(interval);
    });
    process.exit();
});

// Handle errors
bot.on('error', (error) => {
    console.error('Telegram Bot Error:', error);
});

// Basic health check endpoint for Railway
const app = express();

app.get('/', (req, res) => {
    res.send('Bot is running!');
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

// Log when bot is running
console.log('Timed Catgirl Bot is running...');

// Error handling for API request failures
process.on('unhandledRejection', (error) => {
    console.error('Unhandled Promise Rejection:', error);
});