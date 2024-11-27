const mongoose = require("mongoose")

const WaifuSchema = new mongoose.Schema({
    userId: { 
        type: Number, 
        required: true },
    
    name: { 
        type: String, 
        required: true },
    
    imageUrl: { 
        type: String, 
        required: true },

    category: String,
    
    addedAt: { 
        type: Date, 
        default: Date.now }
});

const Waifu = mongoose.model("Waifu", WaifuSchema)
module.exports = Waifu;