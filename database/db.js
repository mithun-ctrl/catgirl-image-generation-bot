const mongoose = require('mongoose');
require('dotenv').config();

URI = process.env.MONGODB_URI
const databaseConnection = async () => {
    try {
        await mongoose.connect(URI);
        console.log('✅ Connected to MongoDB successfully');
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        // Exit process with failure
        process.exit(1);
    }
};

// Event listeners for mongoose connection
mongoose.connection.on('disconnected', () => {
    console.log('⚠️ MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
    console.log('🔄 MongoDB reconnected');
});

module.exports = databaseConnection;