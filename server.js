require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const bcrypt = require('bcryptjs');

const User = require('./models/User');
const Post = require('./models/Post');
const Comment = require('./models/Comment');

const app = express();

connectDB();

app.use(express.json());
app.use(cors());
const verifyUserAndRole = async (userId, requiredRole, res) => {
    if (!userId) {
        res.status(401).json({ msg: 'Unauthorized: User ID missing.' });
        return null;
    }
    const user = await User.findById(userId);
    if (!user) {
        res.status(404).json({ msg: 'Unauthorized: User not found.' });
        return null;
    }
    // যদি নির্দিষ্ট রোলের প্রয়োজন হয় (যেমন অ্যাডমিন), এবং ইউজার সেই রোল বা অ্যাডমিন না হয়
    if (requiredRole && user.role !== requiredRole && user.role !== 'admin') {
        res.status(403).json({ msg: 'Forbidden: Insufficient role.' });
        return null;
    }
    return user;
};

// --- API Routes ---
app.post('/api/register', async (req, res) => {
    console.log('Register body:', req.body); // এখানে দেখো role আসছে কিনা
    const { username, email, password, role } = req.body;

    try {
        // চেক করো ইউজারনেম বা ইমেইল অলরেডি আছে কিনা
        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ msg: 'User already exists with this email.' });
        }
        user = await User.findOne({ username });
        if (user) {
            return res.status(400).json({ msg: 'Username already taken.' });
        }

        // নতুন ইউজার অবজেক্ট তৈরি করো
        user = new User({
            username,
            email,
            password,
            role: role || 'user',
        });

        // পাসওয়ার্ড হ্যাশ করো
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);

        // ইউজারকে ডেটাবেসে সেভ করো
        await user.save();
        res.status(201).json({ msg: 'User registered successfully!' });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        let user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ msg: 'Invalid Credentials' });
        }

        // পাসওয়ার্ড চেক করো
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ msg: 'Invalid Credentials' });
        }

        // সফলভাবে লগইন হলে, ইউজার আইডি, ইউজারনেম, ইমেইল, রোল ফ্রন্টএন্ডে ফেরত পাঠাও
        res.json({
            msg: 'Logged in successfully!',
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
            },
        });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

app.post('/api/posts', async (req, res) => {
    const { title, content, authorId, category, isApproved } = req.body;

    try {
        // ইউজারকে ভেরিফাই করো (অনিরাপদ)
        const user = await verifyUserAndRole(authorId, null, res); // কোনো নির্দিষ্ট রোলের প্রয়োজন নেই, কিন্তু ইউজার থাকতে হবে
        if (!user) return; // verifyUserAndRole ফাংশন রেসপন্স পাঠিয়ে দিলে এখানেই শেষ

        let postCategory = category || 'fan blog';
        let postIsApproved = isApproved || false; // ডিফল্টভাবে ইউজার পোস্ট অপ্রুভড থাকে

        // অ্যাডমিন/মডারেটররা সরাসরি 'transfer news' পোস্ট করতে পারবে এবং অ্যাপ্রুভাল স্টেটাস সেট করতে পারবে
        if (user.role === 'admin' || user.role === 'moderator') {
            if (category === 'transfer news') {
                postCategory = 'transfer news';
                postIsApproved = true; // অ্যাডমিন/মডারেটর পোস্ট ডিফল্টভাবে অ্যাপ্রুভড
            } else {
                postIsApproved = isApproved !== undefined ? isApproved : true; // অ্যাডমিন/মডারেটর অ্যাপ্রুভাল সেট করতে পারবে
            }
        } else { // সাধারণ ইউজার
            if (category === 'transfer news') {
                return res.status(403).json({ msg: 'Forbidden: Only admin/moderator can post transfer news directly.' });
            }
            postCategory = 'fan blog'; // সাধারণ ইউজারদের জন্য ক্যাটাগরি 'fan blog'
            postIsApproved = false; // সাধারণ ইউজারদের পোস্ট অবশ্যই অ্যাপ্রুভাল লাগবে
        }

        const newPost = new Post({
            title,
            content,
            author: authorId,
            category: postCategory,
            isApproved: postIsApproved
        });

        const post = await newPost.save();
        res.status(201).json(post);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

app.get('/api/posts', async (req, res) => {
    const { category, authorId, requesterRole } = req.query; // requesterRole দিয়ে অ্যাডমিন/মডারেটর কিনা চেক করা হবে

    let filter = { isApproved: true }; // ডিফল্ট: শুধুমাত্র অ্যাপ্রুভড পোস্ট দেখাও

    if (category) {
        filter.category = category;
    }
    if (authorId) { // যদি নির্দিষ্ট ইউজারের পোস্ট দেখতে চাই
        filter.author = authorId;
    }

    // যদি রিকোয়েস্টকারী অ্যাডমিন বা মডারেটর হয়, তারা আনঅ্যাপ্রুভড পোস্টও দেখতে পাবে
    if (requesterRole === 'admin' || requesterRole === 'moderator') {
        delete filter.isApproved; // অ্যাপ্রুভাল ফিল্টার তুলে দাও
    }

    try {
        // 'author' ফিল্ড পপুলেট করে ইউজারের ইউজারনেম এবং রোল দেখাচ্ছি
        const posts = await Post.find(filter).populate('author', 'username role').sort({ createdAt: -1 });
        res.json(posts);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

app.get('/api/posts/:id', async (req, res) => {
    try {
        const post = await Post.findById(req.params.id).populate('author', 'username role');
        if (!post) {
            return res.status(404).json({ msg: 'Post not found' });
        }
        res.json(post);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});


app.put('/api/posts/:id', async (req, res) => {
    const { title, content, category, isApproved, editorId, editorRole } = req.body;
    const postId = req.params.id;

    try {
        const post = await Post.findById(postId);
        if (!post) {
            return res.status(404).json({ msg: 'Post not found' });
        }

        // এডিটর এবং তার রোল ভেরিফাই করো
        const editorUser = await verifyUserAndRole(editorId, null, res);
        if (!editorUser) return;

        // পোস্টের মালিক অথবা অ্যাডমিন/মডারেটর ছাড়া কেউ এডিট করতে পারবে না
        if (post.author.toString() !== editorId && editorUser.role !== 'admin' && editorUser.role !== 'moderator') {
            return res.status(403).json({ msg: 'Forbidden: You are not authorized to update this post.' });
        }

        // দেওয়া ফিল্ডগুলো আপডেট করো
        if (title) post.title = title;
        if (content) post.content = content;
        if (category) {
            // শুধুমাত্র অ্যাডমিন/মডারেটর 'transfer news' ক্যাটাগরিতে পরিবর্তন করতে পারবে
            if (editorUser.role === 'admin' || editorUser.role === 'moderator') {
                post.category = category;
            } else if (category !== 'transfer news') { // সাধারণ ইউজাররা অন্য নন-ট্রান্সফার নিউজ ক্যাটাগরিতে পরিবর্তন করতে পারবে
                post.category = category;
            } else {
                 return res.status(403).json({ msg: 'Forbidden: Only admin/moderator can change post category to transfer news.' });
            }
        }
        if (isApproved !== undefined) {
            if (editorUser.role === 'admin' || editorUser.role === 'moderator') {
                post.isApproved = isApproved;
            } else {
                return res.status(403).json({ msg: 'Forbidden: Only admin/moderator can change approval status.' });
            }
        }
        post.updatedAt = Date.now();

        await post.save();
        res.json(post);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});


app.delete('/api/posts/:id', async (req, res) => {
    const { deleterId, deleterRole } = req.body;
    const postId = req.params.id;

    try {
        const post = await Post.findById(postId);
        if (!post) {
            return res.status(404).json({ msg: 'Post not found' });
        }

        // ডিলিটকারী এবং তার রোল ভেরিফাই করো
        const deleterUser = await verifyUserAndRole(deleterId, null, res);
        if (!deleterUser) return;

        // পোস্টের মালিক অথবা অ্যাডমিন/মডারেটর ছাড়া কেউ ডিলিট করতে পারবে না
        if (post.author.toString() !== deleterId && deleterUser.role !== 'admin' && deleterUser.role !== 'moderator') {
            return res.status(403).json({ msg: 'Forbidden: You are not authorized to delete this post.' });
        }

        await Post.deleteOne({ _id: postId }); // Post ডিলিট করো
        // পোস্টে থাকা সব কমেন্টও ডিলিট করো
        await Comment.deleteMany({ post: postId });

        res.json({ msg: 'Post and associated comments removed' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});


app.post('/api/posts/:postId/comments', async (req, res) => {
    const { content, authorId } = req.body;
    const postId = req.params.postId;

    try {
        const user = await verifyUserAndRole(authorId, null, res);
        if (!user) return;

        const post = await Post.findById(postId);
        if (!post) {
            return res.status(404).json({ msg: 'Post not found' });
        }

        const newComment = new Comment({
            content,
            author: authorId,
            post: postId,
        });

        const comment = await newComment.save();
        res.status(201).json(comment);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

app.get('/api/posts/:postId/comments', async (req, res) => {
    try {
        const comments = await Comment.find({ post: req.params.postId }).populate('author', 'username').sort({ createdAt: 1 });
        res.json(comments);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

app.put('/api/comments/:id', async (req, res) => {
    const { content, editorId, editorRole } = req.body;
    const commentId = req.params.id;

    try {
        const comment = await Comment.findById(commentId);
        if (!comment) {
            return res.status(404).json({ msg: 'Comment not found' });
        }

        const editorUser = await verifyUserAndRole(editorId, null, res);
        if (!editorUser) return;

        if (comment.author.toString() !== editorId && editorUser.role !== 'admin' && editorUser.role !== 'moderator') {
            return res.status(403).json({ msg: 'Forbidden: You are not authorized to edit this comment.' });
        }

        comment.content = content;
        comment.updatedAt = Date.now();
        await comment.save();
        res.json(comment);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});


app.delete('/api/comments/:id', async (req, res) => {
    const { deleterId, deleterRole } = req.body;
    const commentId = req.params.id;

    try {
        const comment = await Comment.findById(commentId);
        if (!comment) {
            return res.status(404).json({ msg: 'Comment not found' });
        }

        const deleterUser = await verifyUserAndRole(deleterId, null, res);
        if (!deleterUser) return;

        if (comment.author.toString() !== deleterId && deleterUser.role !== 'admin' && deleterUser.role !== 'moderator') {
            return res.status(403).json({ msg: 'Forbidden: You are not authorized to delete this comment.' });
        }

        await Comment.deleteOne({ _id: commentId });
        res.json({ msg: 'Comment removed' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

app.post('/api/posts/:id/like', async (req, res) => {
    const postId = req.params.id;
    const { userId } = req.body;

    try {
        const user = await verifyUserAndRole(userId, null, res);
        if (!user) return;

        const post = await Post.findById(postId);
        if (!post) {
            return res.status(404).json({ msg: 'Post not found' });
        }

        // ইউজার কি অলরেডি লাইক করেছে?
        const hasLiked = post.likedBy.includes(userId);

        if (hasLiked) {
            // আনলাইক করো
            post.likes = (post.likes || 1) - 1; // 0 এর নিচে যেন না যায়
            post.likedBy = post.likedBy.filter(id => id.toString() !== userId);
            res.json({ msg: 'Post unliked', likes: post.likes });
        } else {
            // লাইক করো
            post.likes = (post.likes || 0) + 1;
            post.likedBy.push(userId);
            res.json({ msg: 'Post liked', likes: post.likes });
        }
        await post.save();

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

app.get('/api/posts/:id/likes/count', async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) {
            return res.status(404).json({ msg: 'Post not found' });
        }
        res.json({ likes: post.likes });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

app.get('/api/search', async (req, res) => {
    const { q, requesterRole } = req.query; // q হলো সার্চ কোয়েরি

    if (!q) {
        return res.status(400).json({ msg: 'Search query (q) is required.' });
    }

    let filter = { $text: { $search: q } };
    // যদি রিকোয়েস্টকারী অ্যাডমিন বা মডারেটর না হয়, তাহলে শুধুমাত্র অ্যাপ্রুভড পোস্ট দেখাও
    if (!(requesterRole === 'admin' || requesterRole === 'moderator')) {
        filter.isApproved = true;
    }

    try {
        const posts = await Post.find(filter, { score: { $meta: "textScore" } })
                                .sort({ score: { $meta: "textScore" } })
                                .populate('author', 'username role');
        res.json(posts);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

app.get('/api/users/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password'); // পাসওয়ার্ড ছাড়া ইউজার ডেটা
        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }

        // ওই ইউজারের সব পোস্টও দেখাও
        const userPosts = await Post.find({ author: req.params.id })
                                    .populate('author', 'username')
                                    .sort({ createdAt: -1 });

        res.json({ user, posts: userPosts });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));