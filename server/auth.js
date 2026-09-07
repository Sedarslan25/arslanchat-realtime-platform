const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('./db');

router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.json({ success: false, error: 'Tüm alanları doldurun.' });
    if (username.length < 3) return res.json({ success: false, error: 'Kullanıcı adı en az 3 karakter olmalı.' });
    if (password.length < 6) return res.json({ success: false, error: 'Şifre en az 6 karakter olmalı.' });

    const existing = await db.users.findOne({ username: username.toLowerCase() });
    if (existing) return res.json({ success: false, error: 'Bu kullanıcı adı zaten alınmış.' });

    const hash = await bcrypt.hash(password, 12);
    const user = await db.users.insert({
      username: username.toLowerCase(),
      displayName: username,
      password: hash,
      createdAt: new Date(),
      online: false,
    });

    req.session.userId = user._id;
    req.session.username = user.username;
    req.session.displayName = user.displayName;

    res.json({ success: true, user: { id: user._id, username: user.username, displayName: user.displayName } });
  } catch (e) {
    res.json({ success: false, error: 'Sunucu hatası.' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await db.users.findOne({ username: username.toLowerCase() });
    if (!user) return res.json({ success: false, error: 'Kullanıcı bulunamadı.' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.json({ success: false, error: 'Şifre yanlış.' });

    req.session.userId = user._id;
    req.session.username = user.username;
    req.session.displayName = user.displayName;

    res.json({ success: true, user: { id: user._id, username: user.username, displayName: user.displayName } });
  } catch (e) {
    res.json({ success: false, error: 'Sunucu hatası.' });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

router.get('/me', (req, res) => {
  if (req.session.userId) {
    res.json({ loggedIn: true, user: { id: req.session.userId, username: req.session.username, displayName: req.session.displayName } });
  } else {
    res.json({ loggedIn: false });
  }
});

module.exports = router;