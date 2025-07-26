// liverpool-fanpage-server/models/User.js
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true, // ইউজারনেম ইউনিক হবে
        trim: true,
    },
    email: {
        type: String,
        required: true,
        unique: true, // ইমেইল ইউনিক হবে
        trim: true,
        lowercase: true,
    },
    password: {
        type: String,
        required: true,
    },
    role: { // 'user', 'moderator', 'admin' - ইউজার রোল
        type: String,
        enum: ['user', 'moderator', 'admin'],
        default: 'user', // ডিফল্ট রোল 'user'
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model('User', UserSchema);