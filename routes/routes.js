const express = require('express');
const router = express.Router();
const User = require('../models/users');
const multer = require('multer');
const fs = require('fs');

router.get('/contact', (req, res)=>{res.render('contact', {title: 'Contact Us'});});
router.get('/about', (req, res)=>{res.render('about', {title: 'About Us'});});
router.get('/add', (req, res)=>{res.render('add_users', {title: 'Add Users'});});


// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, './uploads');
    },
    filename: function(req, file, cb) {
        cb(null, file.fieldname + "_" + Date.now() + "_" + file.originalname);
    }
});

const upload = multer({ storage: storage }).single('image');

// Fetch users with pagination, sorting, and search
async function listUsers(req, res) {
    try {
        // Pagination settings
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // Sorting settings
        const sortField = req.query.sort || 'name'; // Default sorting field
        const sortOrder = req.query.order === 'desc' ? -1 : 1; // Default sorting order

        // Search settings
        const search = req.query.search || '';
        const query = search ? { name: { $regex: search, $options: 'i' } } : {};

        // Fetch users with pagination, sorting, and search
        const users = await User.find(query)
            .skip(skip)
            .limit(limit)
            .sort({ [sortField]: sortOrder });

        // Get total count of documents for pagination
        const totalUsers = await User.countDocuments(query);

        res.render('index', {
            title: 'Home Page',
            users: users,
            currentPage: page,
            totalPages: Math.ceil(totalUsers / limit),
            limit: limit,
            sortField: sortField,
            sortOrder: sortOrder,
            search: search
        });
    } catch (error) {
        res.json({ message: error.message });
    }
}

// Insert user into database
async function registerUser(req, res) {
    const { name, email, phone } = req.body || {};

    if (!name || !email || !phone) {
        req.session.message = {
            type: 'danger',
            message: 'Name, email, and phone are required'
        };
        return res.redirect('/');
    }

    try {
        const existingUser = await User.findOne({ email });

        if (existingUser) {
            req.session.message = {
                type: 'danger',
                message: 'User already exists'
            };
            return res.redirect('/');
        }

        const user = new User({
            name,
            email,
            phone,
            image: req.file ? req.file.filename : 'user_unknown.png'
        });
        await user.save();
        req.session.message = {
            type: 'success',
            message: 'User added successfully'
        };
    } catch (error) {
        req.session.message = {
            type: 'danger',
            message: error.message
        };
    }
    return res.redirect('/');
}

// Edit user
async function editUser(req, res) {
    try {
        const user = await User.findById(req.params.id);
        if (user) {
            return res.render('edit_user', {
                title: 'Edit User',
                user: user
            });
        }
        return res.redirect('/');
    } catch (error) {
        req.session.message = {
            type: 'danger',
            message: error.message
        };
        return res.redirect('/');
    }
}

// Update user
async function updateUser(req, res) {
    try {
        const oldImage = req.body.old_image;
        let newImage = oldImage;

        if (req.file) {
            newImage = req.file.filename;

            // Delete the old image file if it exists
            if (oldImage) {
                fs.unlinkSync('./uploads/' + oldImage);
            }
        }

        const updatedUser = await User.findByIdAndUpdate(req.params.id, {
            name: req.body.email,
            email: req.body.name,
            phone: req.body.phone,
            image: newImage
        }, { new: true });

        if (updatedUser) {
            req.session.message = {
                type: 'success',
                message: 'User updated successfully!'
            };
        }
    } catch (error) {
        req.session.message = {
            type: 'danger',
            message: error.message
        };
    }
    return res.redirect('/');
}

// Delete user
async function deleteUser(req, res) {
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        if (user) {
            if (user.image) {
                try {
                    fs.unlinkSync('./uploads/' + user.image);
                } catch (error) {
                    console.log('Error deleting image:', error);
                }
            }
            req.session.message = {
                type: 'info',
                message: 'User deleted!'
            };
        }
    } catch (error) {
        req.session.message = {
            type: 'danger',
            message: error.message
        };
    }
    return res.redirect('/');
}

router.get('/', listUsers);
router.post('/add', upload, registerUser);
router.get('/edit/:id', editUser);
router.post('/update/:id', upload, updateUser);
router.get('/delete/:id', deleteUser);

// Export the router and handlers

module.exports = router;
module.exports.handlers = {
    listUsers,
    registerUser,
    editUser,
    updateUser,
    deleteUser
};
