// liverpool-fanpage-server/models/Post.js
const mongoose = require('mongoose');

const PostSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
    },
    content: {
        type: String,
        required: true,
    },
    author: { // কোন ইউজার পোস্ট করেছে, তার ID
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // User মডেলকে রেফার করছে
        required: true,
    },
    category: { // যেমন 'transfer news', 'fan blog', 'match report'
        type: String,
        enum: ['transfer news', 'fan blog', 'match report', 'other'],
        default: 'fan blog',
    },
    isApproved: { // ইউজার পোস্ট মডারেটরের অ্যাপ্রুভালের জন্য
        type: Boolean,
        default: false, // ডিফল্টভাবে অপ্রুভড না
    },
    likes: { // লাইকের সংখ্যা
        type: Number,
        default: 0
    },
    likedBy: [{ // কারা লাইক করেছে তাদের User ID
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    }
});

// সার্চ ফাংশন এর জন্য Text Index
PostSchema.index({ title: 'text', content: 'text' });

module.exports = mongoose.model('Post', PostSchema);