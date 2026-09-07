// ==========================================
// ARSLANCHAT BACKEND SUNUCUSU
// Geliştirici: Sedanur Arslan (Akademik Proje İmzası)
// ==========================================
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const session = require('express-session');
const path = require('path');

const authRouter = require('./server/auth');
const apiRouter = require('./server/api');
const { setupWebSocket } = require('./server/wsHandler');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws' });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const sessionParser = session({
  secret: 'irc-webrtc-super-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
});
app.use(sessionParser);

app.use('/auth', authRouter);
app.use('/api', apiRouter);

app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

setupWebSocket(wss, sessionParser);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🚀 Sunucu çalışıyor: http://localhost:${PORT}`);
  console.log(`📡 WebSocket: ws://localhost:${PORT}/ws\n`);
});