const express = require('express');
const router = express.Router();
const db = require('./db');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const uploadDir = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.json({ success: false, error: 'Giriş yapmalısınız.' });
  next();
}

router.post('/upload', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.json({ success: false, error: 'Dosya yüklenemedi.' });
  }
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({ 
    success: true, 
    fileUrl, 
    fileName: req.file.originalname, 
    fileSize: req.file.size 
  });
});

router.get('/channels', requireAuth, async (req, res) => {
  const channels = await db.channels.find({}).sort({ name: 1 });
  res.json({ success: true, channels });
});

router.post('/channels', requireAuth, async (req, res) => {
  const { name } = req.body;
  if (!name || !/^[a-z0-9_-]+$/.test(name))
    return res.json({ success: false, error: 'Geçersiz kanal adı.' });

  const exists = await db.channels.findOne({ name });
  if (exists) return res.json({ success: false, error: 'Bu kanal zaten mevcut.' });

  const ch = await db.channels.insert({ name, createdBy: req.session.username, createdAt: new Date(), topic: '' });
  res.json({ success: true, channel: ch });
});

router.get('/messages/:channel', requireAuth, async (req, res) => {
  const messages = await db.messages.find({ channel: req.params.channel })
    .sort({ createdAt: -1 }).limit(100);
  res.json({ success: true, messages: messages.reverse() });
});

router.get('/dm/:withUser', requireAuth, async (req, res) => {
  const me = req.session.username;
  const other = req.params.withUser;
  const messages = await db.messages.find({
    channel: { $in: [`dm:${me}:${other}`, `dm:${other}:${me}`] }
  }).sort({ createdAt: -1 }).limit(100);
  res.json({ success: true, messages: messages.reverse() });
});

// KANAL SİLME ROTASI (Sadece Yaratıcısı İçin)
router.delete('/channels/:name', requireAuth, async (req, res) => {
  const { name } = req.params;
  const username = req.session.username;
  const defaultChannels = ['genel', 'ders', 'yardim', 'proje'];

  if (defaultChannels.includes(name)) {
    return res.json({ success: false, error: 'Varsayılan sistem kanalları silinemez.' });
  }

  const channel = await db.channels.findOne({ name });
  if (!channel) {
    return res.json({ success: false, error: 'Kanal bulunamadı.' });
  }

  if (channel.createdBy !== username) {
    return res.json({ success: false, error: 'Bu kanalı silme yetkiniz yok.' });
  }

  await db.channels.remove({ name });
  await db.messages.remove({ channel: name }, { multi: true });

  // WebSocket üzerinden tüm kullanıcılara bildir
  try {
    const { broadcast } = require('./wsHandler');
    broadcast({ type: 'channelDeleted', name });
  } catch (e) {}

  res.json({ success: true });
});

// KULLANICI ENGELLEME ROTALARI
router.get('/blocks', requireAuth, async (req, res) => {
  const username = req.session.username;
  const user = await db.users.findOne({ username });
  res.json({ success: true, blocked: user.blocked || [] });
});

router.post('/blocks/block', requireAuth, async (req, res) => {
  const username = req.session.username;
  const { targetUsername } = req.body;
  if (!targetUsername || targetUsername === username) {
    return res.json({ success: false, error: 'Geçersiz istek.' });
  }

  const targetUser = await db.users.findOne({ username: targetUsername });
  if (!targetUser) {
    return res.json({ success: false, error: 'Kullanıcı bulunamadı.' });
  }

  await db.users.update(
    { username },
    { $addToSet: { blocked: targetUsername } }
  );
  res.json({ success: true });
});

router.post('/blocks/unblock', requireAuth, async (req, res) => {
  const username = req.session.username;
  const { targetUsername } = req.body;
  if (!targetUsername) {
    return res.json({ success: false, error: 'Geçersiz istek.' });
  }

  await db.users.update(
    { username },
    { $pull: { blocked: targetUsername } }
  );
  res.json({ success: true });
});

module.exports = router;