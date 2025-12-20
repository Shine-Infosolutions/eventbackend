const express = require('express');
const { login, getMe, createUser, getUsers, registerAdmin, updateUser, deleteUser } = require('../controllers/authController');
const { auth, authorize } = require('../middleware/auth');
const router = express.Router();

router.post('/register-admin', registerAdmin);
router.post('/login', login);
router.get('/me', auth, getMe);
router.post('/users', auth, authorize('Admin'), createUser);
router.get('/users', auth, authorize('Admin'), getUsers);
router.put('/users/:id', auth, authorize('Admin'), updateUser);
router.delete('/users/:id', auth, authorize('Admin'), deleteUser);

module.exports = router;