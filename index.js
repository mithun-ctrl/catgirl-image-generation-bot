const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const dotenv = require('dotenv');

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

// Handle /start command
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    
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
            caption: '🎀 Here\'s your catgirl image! Use /start to generate another one!'
        });
        
        // Delete the loading message
        bot.deleteMessage(chatId, loadingMessage.message_id);
        
    } catch (error) {
        console.error('Error:', error);
        bot.sendMessage(chatId, '😿 Sorry, there was an error generating the image. Please try again later!');
    }
});

// Handle errors
bot.on('error', (error) => {
    console.error('Telegram Bot Error:', error);
});

// Basic health check endpoint
const express = require('express');
const app = express();

app.get('/', (req, res) => {
    res.send('Bot is running!');
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

// Log when bot is running
console.log('Catgirl Bot is running...');

// Error handling for API request failures
process.on('unhandledRejection', (error) => {
    console.error('Unhandled Promise Rejection:', error);
});