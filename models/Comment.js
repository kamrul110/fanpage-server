// liverpool-fanpage-server/models/Comment.js
const mongoose = require('mongoose');

const CommentSchema = new mongoose.Schema({
    content: {
        type: String,
        required: true,
        trim: true,
    },
    author: { // কোন ইউজার কমেন্ট করেছে
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    post: { // কোন পোস্টে কমেন্ট করেছে
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Post',
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    }
});

module.exports = mongoose.model('Comment', CommentSchema);