// ==========================================
// ARSLANCHAT WEBSOCKET & WEBRTC SIGNALING HANDLER
// Geliştirici: Sedanur Arslan (Akademik Proje İmzası)
// ==========================================
const db = require('./db');

const clients = new Map();

function broadcast(data, excludeWs = null) {
  const msg = JSON.stringify(data);
  for (const [, client] of clients) {
    if (client.ws !== excludeWs && client.ws.readyState === 1) {
      client.ws.send(msg);
    }
  }
}

function sendTo(username, data) {
  const client = clients.get(username);
  if (client && client.ws.readyState === 1) {
    client.ws.send(JSON.stringify(data));
  }
}

function sendToChannel(channel, data, excludeWs = null) {
  const msg = JSON.stringify(data);
  for (const [, client] of clients) {
    if (client.ws !== excludeWs && client.ws.readyState === 1 && client.channels.has(channel)) {
      client.ws.send(msg);
    }
  }
}

function getOnlineUsers() {
  return Array.from(clients.values()).map(c => ({
    username: c.username,
    displayName: c.displayName,
    avatar: c.avatar || ''
  }));
}

function setupWebSocket(wss, sessionParser) {
  wss.on('connection', (ws, req) => {
    sessionParser(req, {}, async () => {
      if (!req.session.userId) { ws.close(1008, 'Yetkisiz'); return; }

      const username = req.session.username;
      
      // Load user profile to check for avatar and blocked list
      const user = await db.users.findOne({ username });
      let displayName = user ? (user.displayName || username) : username;
      let avatar = user ? (user.avatar || '') : '';
      let blocked = user ? (user.blocked || []) : [];

      if (clients.has(username)) clients.get(username).ws.close();
      clients.set(username, { ws, username, displayName, avatar, blocked, channels: new Set() });
      await db.users.update({ username }, { $set: { online: true } });

      ws.send(JSON.stringify({ type: 'connected', username, displayName, avatar, blocked, onlineUsers: getOnlineUsers() }));
      broadcast({ type: 'userOnline', username, displayName, avatar, onlineUsers: getOnlineUsers() }, ws);

      ws.on('message', async (raw) => {
        let data;
        try { data = JSON.parse(raw); } catch { return; }
        const client = clients.get(username);
        if (!client) return;

        switch (data.type) {
          case 'join': {
            const ch = data.channel;
            if (!ch) break;
            client.channels.add(ch);
            const messages = await db.messages.find({ channel: ch }).sort({ createdAt: -1 }).limit(80);
            ws.send(JSON.stringify({ type: 'joinedChannel', channel: ch, messages: messages.reverse() }));
            sendToChannel(ch, { type: 'userJoined', channel: ch, username, displayName: client.displayName, avatar: client.avatar }, ws);
            break;
          }
          case 'leave': {
            client.channels.delete(data.channel);
            sendToChannel(data.channel, { type: 'userLeft', channel: data.channel, username, displayName: client.displayName });
            break;
          }
          case 'channelMessage': {
            const { channel, text } = data;
            if (!channel || !text?.trim()) break;
            const msg = await db.messages.insert({
              channel, sender: username, senderDisplay: client.displayName,
              text: text.trim(), createdAt: new Date(),
            });
            sendToChannel(channel, { type: 'channelMessage', channel, message: msg });
            break;
          }
          case 'privateMessage': {
            const { to, text } = data;
            if (!to || !text?.trim()) break;

            // Engelleme kontrolü
            const recipientUser = await db.users.findOne({ username: to });
            const senderUser = await db.users.findOne({ username });
            const isRecipientBlockingSender = recipientUser && recipientUser.blocked && recipientUser.blocked.includes(username);
            const isSenderBlockingRecipient = senderUser && senderUser.blocked && senderUser.blocked.includes(to);

            if (isRecipientBlockingSender || isSenderBlockingRecipient) {
              ws.send(JSON.stringify({
                type: 'privateMessage',
                from: username,
                fromDisplay: client.displayName,
                to,
                message: {
                  channel: `dm:${username}:${to}`,
                  sender: 'system',
                  senderDisplay: 'Sistem',
                  text: '🚫 Bu kullanıcıya mesaj gönderilemedi. Engelleme durumu mevcut.',
                  createdAt: new Date(),
                  _id: 'system-' + Date.now()
                }
              }));
              break;
            }

            const msg = await db.messages.insert({
              channel: `dm:${username}:${to}`, sender: username,
              senderDisplay: client.displayName, recipient: to,
              text: text.trim(), createdAt: new Date(), isDM: true,
            });
            const payload = { type: 'privateMessage', from: username, fromDisplay: client.displayName, to, message: msg };
            ws.send(JSON.stringify(payload));
            sendTo(to, payload);
            break;
          }
          case 'editMessage': {
            const { messageId, text } = data;
            if (!messageId || !text?.trim()) break;
            const msg = await db.messages.findOne({ _id: messageId });
            if (!msg || msg.sender !== username) break;

            await db.messages.update({ _id: messageId }, { $set: { text: text.trim(), edited: true, editedAt: new Date() } });

            const payload = { type: 'messageEdited', messageId, text: text.trim(), channel: msg.channel };
            if (msg.isDM) {
              sendTo(msg.sender, payload);
              sendTo(msg.recipient, payload);
            } else {
              sendToChannel(msg.channel, payload);
            }
            break;
          }
          case 'deleteMessage': {
            const { messageId } = data;
            if (!messageId) break;
            const msg = await db.messages.findOne({ _id: messageId });
            if (!msg || msg.sender !== username) break;

            await db.messages.remove({ _id: messageId });

            const payload = { type: 'messageDeleted', messageId, channel: msg.channel };
            if (msg.isDM) {
              sendTo(msg.sender, payload);
              sendTo(msg.recipient, payload);
            } else {
              sendToChannel(msg.channel, payload);
            }
            break;
          }
          case 'updateProfile': {
            const { displayName: newDisplayName, avatar: newAvatar } = data;
            if (!newDisplayName || newDisplayName.trim().length < 2) break;

            const cleanName = newDisplayName.trim();
            client.displayName = cleanName;
            client.avatar = newAvatar || '';

            await db.users.update({ username }, { $set: { displayName: cleanName, avatar: client.avatar } });
            
            // Save to session
            if (req.session) {
              req.session.displayName = cleanName;
              req.session.save();
            }

            broadcast({
              type: 'profileUpdated',
              username,
              displayName: cleanName,
              avatar: client.avatar,
              onlineUsers: getOnlineUsers()
            });
            break;
          }
          case 'callInvite':   sendTo(data.to, { type: 'callInvite',   from: username, fromDisplay: client.displayName }); break;
          case 'callAccept':   sendTo(data.to, { type: 'callAccept',   from: username, fromDisplay: client.displayName }); break;
          case 'callReject':   sendTo(data.to, { type: 'callReject',   from: username }); break;
          case 'callEnd':      sendTo(data.to, { type: 'callEnd',      from: username }); break;
          case 'sdpOffer':     sendTo(data.to, { type: 'sdpOffer',     from: username, sdp: data.sdp }); break;
          case 'sdpAnswer':    sendTo(data.to, { type: 'sdpAnswer',    from: username, sdp: data.sdp }); break;
          case 'iceCandidate': sendTo(data.to, { type: 'iceCandidate', from: username, candidate: data.candidate }); break;
        }
      });

      ws.on('close', async () => {
        const client = clients.get(username);
        if (client && client.ws === ws) {
          clients.delete(username);
          await db.users.update({ username }, { $set: { online: false } });
          broadcast({ type: 'userOffline', username, onlineUsers: getOnlineUsers() });
        }
      });
    });
  });
}

module.exports = { setupWebSocket, broadcast };