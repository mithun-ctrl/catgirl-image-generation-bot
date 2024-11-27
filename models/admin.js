const mongoose = require("mongoose")

const AdminSchema = new mongoose.Schema({
    userId: { 
        type: Number, 
        unique: true, 
        required: true },
    
    username: String,
    
    addedAt: { 
        type: Date, 
        default: Date.now }
});

const Admin = mongoose.model('WaifuAdmin', AdminSchema)
module.exports = Admin;