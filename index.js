const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const dotenv = require('dotenv');
const express = require('express');

dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

// API configuration
const BASE_URL = 'https://api.nekosia.cat/api/v1';
const API_CONFIG = {
    category: 'catgirl',
    params: {
        count: 1,
        rating: 'safe',
        additionalTags: 'cute',
        blacklistedTags: 'nsfw,suggestive'
    }
};

// Store active intervals
const activeIntervals = new Map();

// Function to fetch image from API
async function fetchImage() {
    const url = `${BASE_URL}/images/${API_CONFIG.category}`;
    const params = new URLSearchParams(API_CONFIG.params);
    
    const response = await axios.get(`${url}?${params}`, {
        timeout: 10000,
        headers: {
            'Accept': 'application/json',
            'User-Agent': 'TelegramBot/1.0'
        }
    });

    if (!response.data || !Array.isArray(response.data) || response.data.length === 0) {
        throw new Error('Invalid API response');
    }

    return response.data[0];
}

// Function to send catgirl image
async function sendCatgirlImage(chatId) {
    try {
        // Send a "generating" message
        const loadingMessage = await bot.sendMessage(chatId, '🐱 Generating a cute catgirl image...');
        
        // Fetch image from API
        const imageData = await fetchImage();
        
        if (!imageData || !imageData.url) {
            throw new Error('No image URL in response');
        }

        // Send the image with source info
        await bot.sendPhoto(chatId, imageData.url, {
            caption: `🎀 Here's your catgirl image!\n${imageData.source || ''}\n\nUse /stop to stop generating images`
        });
        
        // Delete the loading message
        await bot.deleteMessage(chatId, loadingMessage.message_id).catch(() => {
            // Ignore errors from deleting messages
        });
        
    } catch (error) {
        console.error('Error in sendCatgirlImage:', error.message);
        let errorMessage = '😿 Sorry, there was an error generating the image. Trying again in 15 seconds!';
        
        if (error.response) {
            console.error('API Error Response:', error.response.data);
            if (error.response.status === 429) {
                errorMessage = '😿 We are being rate limited. Please try again later!';
            }
        }
        
        try {
            await bot.sendMessage(chatId, errorMessage);
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
        
        // Send welcome message
        await bot.sendMessage(
            chatId,
            '🌟 Welcome to the Catgirl Image Generator Bot!\n\n' +
            '🎀 I will send you cute catgirl images every 15 seconds.\n' +
            '✨ All images are safe for work and family-friendly.\n\n' +
            'Use /stop to stop generating images.'
        );
        
        // Send first image immediately
        await sendCatgirlImage(chatId);
        
        // Set up interval for subsequent images
        const interval = setInterval(() => {
            sendCatgirlImage(chatId);
        }, 15000);
        
        // Store the interval
        activeIntervals.set(chatId, interval);
        
    } catch (error) {
        console.error('Error in start command:', error.message);
        await bot.sendMessage(chatId, '😿 Sorry, something went wrong. Please try again later!');
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

// Clean up on shutdown
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

// Express server for Railway
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Bot is running!');
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

// Error handling
process.on('unhandledRejection', (error) => {
    console.error('Unhandled Promise Rejection:', error.message);
});

console.log('Bot is running...');