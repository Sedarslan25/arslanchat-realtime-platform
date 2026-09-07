// ==========================================
// ARSLANCHAT İSTEMCİ (CLIENT-SIDE) MANTIĞI
// Geliştirici: Sedanur Arslan (Akademik Proje İmzası)
// ==========================================
let me = null;
let ws = null;
let activeRoom = null;
let activeRoomType = null;
let channels = [];
let onlineUsers = [];
let unread = {};

let pc = null;
let localStream = null;
let callPeer = null;

let notificationSoundEnabled = true;
let selectedAvatar = '';

const ICE_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

// 5 adet Premium SVG Geometrik Gece Avatarları
const PREDEFINED_AVATARS = [
  `<svg viewBox="0 0 100 100"><defs><linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#00f0ff"/><stop offset="100%" stop-color="#7000ff"/></linearGradient></defs><circle cx="50" cy="50" r="50" fill="url(#g1)"/><circle cx="50" cy="50" r="30" fill="none" stroke="#fff" stroke-width="4" stroke-dasharray="10 6"/><circle cx="50" cy="50" r="10" fill="#fff"/></svg>`,
  `<svg viewBox="0 0 100 100"><defs><linearGradient id="g2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#10b981"/><stop offset="100%" stop-color="#059669"/></linearGradient></defs><circle cx="50" cy="50" r="50" fill="url(#g2)"/><path d="M30 30 L50 15 L70 30 L70 60 L50 80 L30 60 Z" fill="none" stroke="#fff" stroke-width="5" stroke-linejoin="round"/></svg>`,
  `<svg viewBox="0 0 100 100"><defs><linearGradient id="g3" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#bf55ec"/><stop offset="100%" stop-color="#f43f5e"/></linearGradient></defs><circle cx="50" cy="50" r="50" fill="url(#g3)"/><polygon points="50,20 80,50 50,80 20,50" fill="none" stroke="#fff" stroke-width="5"/></svg>`,
  `<svg viewBox="0 0 100 100"><defs><linearGradient id="g4" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#ff9f43"/><stop offset="100%" stop-color="#ff5252"/></linearGradient></defs><circle cx="50" cy="50" r="50" fill="url(#g4)"/><circle cx="50" cy="50" r="22" fill="#fff" opacity="0.9"/><path d="M50 10 L50 90 M10 50 L90 50" stroke="#fff" stroke-width="3" stroke-dasharray="5 5"/></svg>`,
  `<svg viewBox="0 0 100 100"><defs><linearGradient id="g5" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#0984e3"/><stop offset="100%" stop-color="#2d3436"/></linearGradient></defs><circle cx="50" cy="50" r="50" fill="url(#g5)"/><polygon points="50,15 80,32 80,68 50,85 20,68 20,32" fill="none" stroke="#fff" stroke-width="4"/><circle cx="50" cy="50" r="12" fill="#fff"/></svg>`
];

// WEB AUDIO API - BİLDİRİM SESLERİ SENTEZLEYİCİSİ
let audioCtx = null;
function initAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

function playTone(freq, type, duration, vol = 0.1) {
  try {
    initAudio();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch (e) {}
}

function playDualTone(freq1, freq2, type, duration, vol = 0.08) {
  playTone(freq1, type, duration, vol);
  playTone(freq2, type, duration, vol);
}

// Mesaj Geldi Chime Sesi
function playMessageSound() {
  if (!notificationSoundEnabled) return;
  playTone(587.33, 'sine', 0.15, 0.1); // D5
  setTimeout(() => playTone(880.00, 'sine', 0.25, 0.08), 100); // A5
}

// Arama Zil Sesi
let ringInterval = null;
function startRingtone() {
  if (!notificationSoundEnabled) return;
  stopRingtone();
  ringInterval = setInterval(() => {
    // Klasik Amerikan/Avrupa telefon zil sesi (440Hz + 480Hz karışımı)
    playDualTone(440, 480, 'sine', 0.5, 0.06);
    setTimeout(() => playDualTone(440, 480, 'sine', 0.5, 0.06), 650);
  }, 2500);
}

function stopRingtone() {
  if (ringInterval) {
    clearInterval(ringInterval);
    ringInterval = null;
  }
}

// SES AÇMA / KAPATMA KONTROLÜ
function toggleSound() {
  notificationSoundEnabled = !notificationSoundEnabled;
  const btn = document.getElementById('soundToggleBtn');
  if (notificationSoundEnabled) {
    btn.textContent = '🔊 Ses Açık';
    btn.classList.remove('muted');
    playTone(880, 'sine', 0.1, 0.05);
  } else {
    btn.textContent = '🔇 Ses Kapalı';
    btn.classList.add('muted');
  }
}

// MOBILE SIDEBAR TOGGLER
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

// TAB MENÜ KONTROLÜ (GİRİŞ/KAYIT)
function showTab(tab) {
  document.querySelectorAll('.tab-btn').forEach((b,i) => b.classList.toggle('active', i===(tab==='login'?0:1)));
  document.querySelectorAll('.tab-content').forEach((c,i) => c.classList.toggle('active', i===(tab==='login'?0:1)));
}

// AUTH API ÇAĞRILARI
async function doLogin() {
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errEl = document.getElementById('loginError');
  errEl.textContent = '';
  if (!username || !password) { errEl.textContent = 'Tüm alanları doldurun.'; return; }
  const res = await post('/auth/login', { username, password });
  if (res.success) { me = res.user; startApp(); }
  else errEl.textContent = res.error;
}

async function doRegister() {
  const username = document.getElementById('regUsername').value.trim();
  const password = document.getElementById('regPassword').value;
  const password2 = document.getElementById('regPassword2').value;
  const errEl = document.getElementById('regError');
  errEl.textContent = '';
  if (!username || !password) { errEl.textContent = 'Tüm alanları doldurun.'; return; }
  if (password !== password2) { errEl.textContent = 'Şifreler eşleşmiyor.'; return; }
  const res = await post('/auth/register', { username, password });
  if (res.success) { me = res.user; startApp(); }
  else errEl.textContent = res.error;
}

async function doLogout() {
  if (ws) ws.close();
  await post('/auth/logout', {});
  location.reload();
}

// UYGULAMAYI BAŞLAT
async function startApp() {
  document.getElementById('authPage').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('myUsername').textContent = `@${me.username}`;
  
  // Profil avatarını yükle
  updateMyAvatarUI(me.displayName, me.avatar);
  
  await loadChannels();
  connectWS();
}

function updateMyAvatarUI(displayName, avatar) {
  document.getElementById('myDisplayName').textContent = displayName;
  const avatarEl = document.getElementById('myAvatar');
  avatarEl.innerHTML = getAvatarHTML(avatar, displayName);
}

// KANALLARI REST API İLE ÇEK
async function loadChannels() {
  const res = await get('/api/channels');
  if (res.success) { channels = res.channels; renderChannelList(); }
}

// WEBSOCKET BAĞLANTISI VE SIGNALING
function connectWS() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}/ws`);
  ws.onopen = () => { joinChannel('genel'); };
  ws.onmessage = (e) => handleWS(JSON.parse(e.data));
  ws.onclose = () => { setTimeout(connectWS, 3000); };
}

function wsSend(data) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
}

// REAL-TIME WS DURUM YÖNETİCİSİ
function handleWS(data) {
  switch (data.type) {
    case 'connected':
      me.displayName = data.displayName;
      me.avatar = data.avatar;
      me.blocked = data.blocked || [];
      updateMyAvatarUI(me.displayName, me.avatar);
      onlineUsers = data.onlineUsers;
      renderUserList();
      renderRoomUserList();
      break;
    case 'channelDeleted':
      channels = channels.filter(ch => ch.name !== data.name);
      renderChannelList();
      if (activeRoom === data.name && activeRoomType === 'channel') {
        alert(`Oda #${data.name} kurucusu tarafından silindi.`);
        joinChannel('genel');
      }
      break;
    case 'userOnline':
    case 'userOffline':
      onlineUsers = data.onlineUsers;
      renderUserList();
      renderRoomUserList();
      break;
    case 'joinedChannel':
      renderMessages(data.messages);
      renderRoomUserList();
      break;
    case 'userJoined':
      appendSystemMsg(`${data.displayName} odaya katıldı.`);
      renderRoomUserList();
      break;
    case 'userLeft':
      appendSystemMsg(`${data.displayName} odadan ayrıldı.`);
      renderRoomUserList();
      break;
    case 'channelMessage':
      if (activeRoom === data.channel && activeRoomType === 'channel') {
        appendMessage(data.message);
        playMessageSound();
      } else {
        addUnread(data.channel);
        playMessageSound();
      }
      break;
    case 'privateMessage':
      const dmKey = `dm:${data.from === me.username ? data.to : data.from}`;
      if (activeRoom === dmKey && activeRoomType === 'dm') {
        appendMessage(data.message);
        playMessageSound();
      } else {
        addUnread(dmKey);
        playMessageSound();
      }
      break;
    case 'messageEdited':
      updateMessageInDOM(data.messageId, data.text);
      break;
    case 'messageDeleted':
      removeMessageFromDOM(data.messageId);
      break;
    case 'profileUpdated':
      // Çevrimiçi listesinde güncelle
      const uIndex = onlineUsers.findIndex(u => u.username === data.username);
      if (uIndex !== -1) {
        onlineUsers[uIndex].displayName = data.displayName;
        onlineUsers[uIndex].avatar = data.avatar;
      }
      renderUserList();
      renderRoomUserList();
      
      // Eğer ben isem kendimi de güncelle
      if (data.username === me.username) {
        me.displayName = data.displayName;
        me.avatar = data.avatar;
        updateMyAvatarUI(me.displayName, me.avatar);
      }
      break;
    case 'callInvite':
      showIncomingCall(data.from, data.fromDisplay);
      break;
    case 'callAccept':
      onCallAccepted(data.from);
      break;
    case 'callReject':
      onCallRejected(data.from);
      break;
    case 'callEnd':
      onCallEnded();
      break;
    case 'sdpOffer':
      onSdpOffer(data.from, data.sdp);
      break;
    case 'sdpAnswer':
      onSdpAnswer(data.sdp);
      break;
    case 'iceCandidate':
      onIceCandidate(data.candidate);
      break;
  }
}

// KANALA KATILMA MANTIĞI
function joinChannel(name) {
  if (activeRoom === name && activeRoomType === 'channel') return;
  if (activeRoom && activeRoomType === 'channel') wsSend({ type: 'leave', channel: activeRoom });
  activeRoom = name; activeRoomType = 'channel';
  clearUnread(name);
  wsSend({ type: 'join', channel: name });
  document.getElementById('chatTitle').textContent = `#${name}`;
  document.getElementById('chatSubtitle').textContent = 'Kanal';
  
  // Yaratıcı yetki kontrolü (Kanal Yöneticisi)
  const chObj = channels.find(c => c.name === name);
  const actionsEl = document.getElementById('headerActions');
  actionsEl.innerHTML = '';
  if (chObj && chObj.createdBy === me.username) {
    actionsEl.innerHTML = `<button class="btn-control delete-channel-btn" onclick="deleteChannel('${name}')">🗑️ <span class="btn-text">Kanalı Sil</span></button>`;
  }

  document.getElementById('messageInput').disabled = false;
  document.getElementById('sendBtn').disabled = false;
  document.getElementById('messageInput').placeholder = `#${name} kanalına yaz...`;
  document.getElementById('rightPanel').style.display = 'flex';
  
  // Mobile sidebar close on channel join
  document.getElementById('sidebar').classList.remove('open');
  
  renderChannelList();
}

async function deleteChannel(name) {
  if (confirm(`#${name} odasını tamamen silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`)) {
    try {
      const res = await fetch(`/api/channels/${name}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        channels = channels.filter(ch => ch.name !== name);
        renderChannelList();
        joinChannel('genel');
      } else {
        alert(data.error);
      }
    } catch (e) {
      alert("Oda silinirken hata oluştu.");
    }
  }
}

// DM BAŞLATMA
function openDM(username, displayName) {
  if (username === me.username) return;
  if (activeRoom && activeRoomType === 'channel') wsSend({ type: 'leave', channel: activeRoom });
  activeRoom = `dm:${username}`; activeRoomType = 'dm';
  clearUnread(`dm:${username}`);
  document.getElementById('chatTitle').textContent = `💬 ${displayName}`;
  document.getElementById('chatSubtitle').textContent = 'Özel Sohbet';
  
  // Arama ve engelleme kontrollerini enjekte et
  updateDMHeaderActions(username, displayName);

  document.getElementById('messageInput').disabled = false;
  document.getElementById('sendBtn').disabled = false;
  document.getElementById('messageInput').placeholder = `${displayName} kullanıcısına özel yaz...`;
  document.getElementById('rightPanel').style.display = 'none';
  
  // Mobile sidebar close on DM select
  document.getElementById('sidebar').classList.remove('open');
  
  loadDMHistory(username);
  renderUserList();
}

function updateDMHeaderActions(username, displayName) {
  const isBlocked = me.blocked && me.blocked.includes(username);
  const blockBtnClass = isBlocked ? 'unblock-btn' : 'block-btn';
  document.getElementById('headerActions').innerHTML = `
    <button class="btn-call" onclick="startCall('${username}','${displayName}')">📹 <span class="btn-text">Görüntülü Ara</span></button>
    <button class="btn-control ${blockBtnClass}" onclick="toggleBlock('${username}', '${displayName}')">${isBlocked ? '✔' : '🚫'} <span class="btn-text">${isBlocked ? 'Engeli Kaldır' : 'Engelle'}</span></button>
  `;
}

async function toggleBlock(username, displayName) {
  const isBlocked = me.blocked && me.blocked.includes(username);
  const action = isBlocked ? 'unblock' : 'block';
  const confirmMsg = isBlocked 
    ? `@${username} kullanıcısının engelini kaldırmak istiyor musunuz?`
    : `@${username} kullanıcısını engellemek istiyor musunuz? Bu kullanıcıdan mesaj almayacaksınız.`;

  if (confirm(confirmMsg)) {
    try {
      const res = await fetch(`/api/blocks/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUsername: username })
      });
      const data = await res.json();
      if (data.success) {
        if (isBlocked) {
          me.blocked = me.blocked.filter(u => u !== username);
        } else {
          if (!me.blocked) me.blocked = [];
          me.blocked.push(username);
        }
        updateDMHeaderActions(username, displayName || username);
        renderUserList();
        
        // Profil modalı açıksa oradaki engellenen listesini de güncelle
        if (document.getElementById('profileModal') && !document.getElementById('profileModal').classList.contains('hidden')) {
          loadBlockedListUI();
        }
      } else {
        alert(data.error);
      }
    } catch (e) {
      alert("İşlem sırasında hata oluştu.");
    }
  }
}

async function loadDMHistory(username) {
  const res = await get(`/api/dm/${username}`);
  if (res.success) renderMessages(res.messages);
}

// MESAJ GÖNDERME
function sendMessage() {
  const input = document.getElementById('messageInput');
  const text = input.value.trim();
  if (!text || !activeRoom) return;
  if (activeRoomType === 'channel') {
    wsSend({ type: 'channelMessage', channel: activeRoom, text });
  } else {
    wsSend({ type: 'privateMessage', to: activeRoom.replace('dm:', ''), text });
  }
  input.value = '';
}

// GERÇEK DOSYA / GÖRSEL YÜKLEME VE PAYLAŞMA MANTIĞI
function triggerFileUpload() {
  document.getElementById('fileUploadInput').click();
}

async function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('file', file);

  const input = document.getElementById('messageInput');
  const oldPlaceholder = input.placeholder;
  input.placeholder = "Dosya yükleniyor...";
  input.disabled = true;

  try {
    const r = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });
    const res = await r.json();
    if (res.success) {
      const isImg = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file.name);
      const msgText = isImg ? res.fileUrl : `📁 Dosya: ${res.fileName} (${res.fileUrl})`;
      if (activeRoomType === 'channel') {
        wsSend({ type: 'channelMessage', channel: activeRoom, text: msgText });
      } else {
        wsSend({ type: 'privateMessage', to: activeRoom.replace('dm:', ''), text: msgText });
      }
    } else {
      alert("Yükleme başarısız: " + res.error);
    }
  } catch (e) {
    alert("Yükleme sırasında hata oluştu: " + e.message);
  } finally {
    input.placeholder = oldPlaceholder;
    input.disabled = false;
    input.focus();
    event.target.value = '';
  }
}

// EMOJI SEÇİCİ KONTROLLERİ
function toggleEmojiPicker() {
  const picker = document.getElementById('emojiPicker');
  picker.classList.toggle('hidden');
}

function insertEmoji(emoji) {
  const input = document.getElementById('messageInput');
  input.value += emoji;
  input.focus();
  document.getElementById('emojiPicker').classList.add('hidden');
}

// KANAL OLUŞTURMA MODALI
function showCreateChannel() {
  document.getElementById('createChannelModal').classList.remove('hidden');
  document.getElementById('newChannelName').value = '';
  document.getElementById('channelError').textContent = '';
}

async function createChannel() {
  const name = document.getElementById('newChannelName').value.trim().toLowerCase();
  const res = await post('/api/channels', { name });
  if (res.success) {
    channels.push(res.channel);
    renderChannelList();
    closeModal('createChannelModal');
    joinChannel(name);
  } else {
    document.getElementById('channelError').textContent = res.error;
  }
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}

// YARDIMCI HTML AVATAR GÖRÜNTÜLEYİCİ
function getAvatarHTML(avatar, name) {
  if (avatar && avatar.startsWith('<svg')) {
    return avatar;
  }
  const initial = name ? name[0].toUpperCase() : '?';
  // Deterministic avatar gradient color backgrounds
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const colors = [
    'linear-gradient(135deg, #00f0ff, #0081ff)',
    'linear-gradient(135deg, #10b981, #059669)',
    'linear-gradient(135deg, #bf55ec, #f43f5e)',
    'linear-gradient(135deg, #ff9f43, #ff5252)',
    'linear-gradient(135deg, #0984e3, #2d3436)'
  ];
  const color = colors[Math.abs(hash) % colors.length];
  return `<div class="user-avatar" style="background:${color}">${initial}</div>`;
}

// LİSTELERİ YAZDIRMA
function renderChannelList() {
  const ul = document.getElementById('channelList');
  ul.innerHTML = '';
  channels.forEach(ch => {
    const li = document.createElement('li');
    const u = unread[ch.name] || 0;
    li.innerHTML = `<span style="color:var(--accent);font-weight:700">#</span> ${ch.name}${u?`<span class="badge">${u}</span>`:''}`;
    li.classList.toggle('active', activeRoom === ch.name && activeRoomType === 'channel');
    li.onclick = () => joinChannel(ch.name);
    ul.appendChild(li);
  });
}

function renderUserList() {
  const ul = document.getElementById('userList');
  ul.innerHTML = '';
  onlineUsers.forEach(u => {
    const li = document.createElement('li');
    const isSelf = u.username === me.username;
    const dmKey = `dm:${u.username}`;
    const unreadCount = unread[dmKey] || 0;
    
    li.innerHTML = `
      <div class="list-user-avatar">${getAvatarHTML(u.avatar, u.displayName)}</div>
      <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1">${u.displayName}${isSelf?' <span style="color:var(--text-dim);font-size:.7rem">(sen)</span>':''}</span>
      ${unreadCount?`<span class="badge">${unreadCount}</span>`:''}
      ${!isSelf?`<button class="call-user-btn" onclick="event.stopPropagation();startCall('${u.username}','${u.displayName}')">📹 Ara</button>`:''}
    `;
    li.classList.toggle('active', activeRoom === dmKey && activeRoomType === 'dm');
    if (!isSelf) li.onclick = () => openDM(u.username, u.displayName);
    ul.appendChild(li);
  });
}

// SAĞ PANEL: ODA İÇİNDEKİLER
function renderRoomUserList() {
  const ul = document.getElementById('roomUserList');
  ul.innerHTML = '';
  if (activeRoomType === 'channel') {
    const chObj = channels.find(c => c.name === activeRoom);
    onlineUsers.forEach(u => {
      const li = document.createElement('li');
      const isSelf = u.username === me.username;
      const isCreator = chObj && chObj.createdBy === u.username;
      const crown = isCreator ? ' <span title="Kanal Yöneticisi" style="color:#f59e0b">👑</span>' : '';
      
      li.innerHTML = `
        <div class="list-user-avatar">${getAvatarHTML(u.avatar, u.displayName)}</div>
        <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1">${u.displayName}${crown}${isSelf?' <span style="color:var(--text-dim)">(sen)</span>':''}</span>
      `;
      ul.appendChild(li);
    });
  }
}

// MESAJLARI YAZDIRMA
function renderMessages(messages) {
  const area = document.getElementById('messagesArea');
  area.innerHTML = '';
  let lastSender = null;
  messages.forEach(msg => { appendMessageToEl(area, msg, lastSender); lastSender = msg.sender; });
  area.scrollTop = area.scrollHeight;
}

function appendMessage(msg) {
  const area = document.getElementById('messagesArea');
  const lastGroup = area.querySelector('.message-group:last-child');
  const lastSender = lastGroup ? lastGroup.dataset.sender : null;
  appendMessageToEl(area, msg, lastSender);
  area.scrollTop = area.scrollHeight;
}

function revealBlockedMessage(msgId) {
  const placeholder = document.getElementById(`blocked-placeholder-${msgId}`);
  const content = document.getElementById(`blocked-content-${msgId}`);
  if (placeholder) placeholder.remove();
  if (content) content.classList.remove('hidden');
}

function appendMessageToEl(area, msg, lastSender) {
  const isBlocked = me.blocked && me.blocked.includes(msg.sender);
  const isNew = isBlocked ? true : (msg.sender !== lastSender);
  const isMe = msg.sender === me.username;
  const time = new Date(msg.createdAt).toLocaleTimeString('tr-TR', {hour:'2-digit',minute:'2-digit'});
  
  // Dosya yükleme tespiti ve özel formatlama
  let msgContentHTML = escHtml(msg.text);
  let filePreviewHTML = '';
  
  if (msg.text.startsWith('📁 Dosya: ')) {
    const fileRegex = /📁 Dosya: (.*?) \((\/uploads\/\S+)\)/i;
    const fileMatches = msg.text.match(fileRegex);
    if (fileMatches) {
      const fileName = fileMatches[1];
      const fileUrl = fileMatches[2];
      msgContentHTML = ''; // Metni temizle, sadece kart gösterilecek
      filePreviewHTML = `
        <div class="msg-file-preview">
          <span class="file-icon">📁</span>
          <div class="file-info">
            <span class="file-name">${escHtml(fileName)}</span>
            <a class="btn-file-download" href="${fileUrl}" download="${escHtml(fileName)}" target="_blank">İndir</a>
          </div>
        </div>
      `;
    }
  }

  // Resim URL önizleme tespiti (sadece dosya kartı değilse)
  const imgRegex = /(https?:\/\/\S+\.(?:png|jpg|jpeg|gif|webp|svg)(?:\?\S+)?)/gi;
  const matches = msg.text.match(imgRegex);
  let mediaPreviewHTML = '';
  if (matches && !filePreviewHTML) {
    matches.forEach(url => {
      mediaPreviewHTML += `<div class="msg-media-preview"><img src="${url}" alt="Medya Önizleme" onerror="this.style.display='none'"></div>`;
    });
  }

  // Mesaj Düzenle/Sil İşlem Butonları (Yalnızca benim kendi mesajlarım için)
  const actionBtnsHTML = isMe ? `
    <div class="msg-actions">
      <button class="btn-action-tiny" onclick="openEditMessage('${msg._id}')" title="Düzenle">✏️</button>
      <button class="btn-action-tiny btn-delete" onclick="deleteMessage('${msg._id}')" title="Sil">🗑️</button>
    </div>
  ` : '';

  const editedBadgeHTML = msg.edited ? `<span class="edited-badge" title="Mesaj düzenlendi">(düzenlendi)</span>` : '';

  if (isBlocked) {
    const placeholder = document.createElement('div');
    placeholder.className = 'msg-blocked-placeholder';
    placeholder.id = `blocked-placeholder-${msg._id}`;
    placeholder.innerHTML = `
      <span>🚫 Engellediğiniz kullanıcıdan mesaj (@${msg.sender})</span>
      <button class="btn-show-blocked" onclick="revealBlockedMessage('${msg._id}')">Mesajı Göster</button>
    `;
    area.appendChild(placeholder);
  }

  if (isNew) {
    const group = document.createElement('div');
    group.className = 'message-group' + (isBlocked ? ' hidden' : '');
    group.dataset.sender = msg.sender;
    group.id = isBlocked ? `blocked-content-${msg._id}` : `msg-${msg._id}`;
    group.innerHTML = `
      <div class="meta">
        <span class="author ${isMe?'me':''}">${msg.senderDisplay}</span>
        <span class="time">${time}</span>
        ${editedBadgeHTML}
      </div>
      <div class="msg-container">
        ${msgContentHTML ? `<div class="msg-text">${msgContentHTML}</div>` : ''}
        ${filePreviewHTML}
        ${mediaPreviewHTML}
        ${actionBtnsHTML}
      </div>
    `;
    area.appendChild(group);
  } else {
    // Aynı kişinin peş peşe gelen mesajları için grubu genişlet
    const last = area.querySelector('.message-group:last-child');
    if (last) {
      const container = document.createElement('div');
      container.className = 'msg-container';
      container.id = `sub-msg-${msg._id}`; // alt-mesaj için de id
      container.innerHTML = `
        ${msgContentHTML ? `<div class="msg-text">${msgContentHTML}</div>` : ''}
        ${filePreviewHTML}
        ${mediaPreviewHTML}
        ${isMe ? `
          <div class="msg-actions">
            <button class="btn-action-tiny" onclick="openEditMessage('${msg._id}', true)" title="Düzenle">✏️</button>
            <button class="btn-action-tiny btn-delete" onclick="deleteMessage('${msg._id}', true)" title="Sil">🗑️</button>
          </div>
        ` : ''}
      `;
      last.appendChild(container);
    }
  }
}

function appendSystemMsg(text) {
  const area = document.getElementById('messagesArea');
  const div = document.createElement('div');
  div.className = 'system-msg';
  div.textContent = text;
  area.appendChild(div);
  area.scrollTop = area.scrollHeight;
}

// MESAJ YÖNETİMİ: DÜZENLEME & SİLME (WS UYUMLU)
function openEditMessage(id, isSubMsg = false) {
  const el = document.getElementById(isSubMsg ? `sub-msg-${id}` : `msg-${id}`);
  if (!el) return;
  const msgTextEl = el.querySelector('.msg-text');
  if (!msgTextEl) return; // Dosyalar veya sadece görsel içeren mesajlar düzenlenemez
  
  const text = msgTextEl.textContent;
  
  document.getElementById('editMessageId').value = id;
  const inputEl = document.getElementById('editMessageInput');
  inputEl.value = text;
  document.getElementById('editMessageModal').classList.remove('hidden');
  
  // Modalı açınca input alanına otomatik odaklan ve imleci sona al
  setTimeout(() => {
    inputEl.focus();
    inputEl.setSelectionRange(inputEl.value.length, inputEl.value.length);
  }, 50);
}

function saveEditedMessage() {
  const id = document.getElementById('editMessageId').value;
  const text = document.getElementById('editMessageInput').value.trim();
  if (!text) return;
  
  wsSend({ type: 'editMessage', messageId: id, text });
  closeModal('editMessageModal');
}

function deleteMessage(id) {
  if (confirm("Bu mesajı silmek istediğinize emin misiniz?")) {
    wsSend({ type: 'deleteMessage', messageId: id });
  }
}

// REAL-TIME DOM MANİPÜLASYONU
function updateMessageInDOM(messageId, text) {
  // Hem normal mesaj hem de alt mesaj kontrolü yap
  let el = document.getElementById(`msg-${messageId}`);
  if (el) {
    const msgTextEl = el.querySelector('.msg-text');
    if (msgTextEl) {
      msgTextEl.textContent = text;
    }
    // (düzenlendi) badge'i ekle
    if (!el.querySelector('.edited-badge')) {
      const b = document.createElement('span');
      b.className = 'edited-badge';
      b.textContent = '(düzenlendi)';
      const metaEl = el.querySelector('.meta');
      if (metaEl) metaEl.appendChild(b);
    }
    
    // Resim önizlemesini güncelle
    const imgRegex = /(https?:\/\/\S+\.(?:png|jpg|jpeg|gif|webp|svg)(?:\?\S+)?)/gi;
    const matches = text.match(imgRegex);
    const prevMedia = el.querySelector('.msg-media-preview');
    if (prevMedia) prevMedia.remove();
    
    if (matches) {
      matches.forEach(url => {
        const preview = document.createElement('div');
        preview.className = 'msg-media-preview';
        preview.innerHTML = `<img src="${url}" alt="Medya Önizleme" onerror="this.style.display='none'">`;
        const containerEl = el.querySelector('.msg-container');
        if (containerEl) containerEl.appendChild(preview);
      });
    }
  } else {
    // Alt mesaj ise güncelle
    el = document.getElementById(`sub-msg-${messageId}`);
    if (el) {
      const msgTextEl = el.querySelector('.msg-text');
      if (msgTextEl) {
        msgTextEl.textContent = text;
      }
      // Resim önizleme güncelle
      const imgRegex = /(https?:\/\/\S+\.(?:png|jpg|jpeg|gif|webp|svg)(?:\?\S+)?)/gi;
      const matches = text.match(imgRegex);
      const prevMedia = el.querySelector('.msg-media-preview');
      if (prevMedia) prevMedia.remove();
      
      if (matches) {
        matches.forEach(url => {
          const preview = document.createElement('div');
          preview.className = 'msg-media-preview';
          preview.innerHTML = `<img src="${url}" alt="Medya Önizleme" onerror="this.style.display='none'">`;
          el.appendChild(preview);
        });
      }
    }
  }
}

function removeMessageFromDOM(messageId) {
  const el = document.getElementById(`msg-${messageId}`) || document.getElementById(`sub-msg-${messageId}`);
  if (el) el.remove();
}

// BİLDİRİM OKUNDU / OKUNMADI KONTROLÜ
function addUnread(key) {
  unread[key] = (unread[key]||0)+1;
  renderChannelList();
  renderUserList();
}

function clearUnread(key) {
  unread[key] = 0;
  renderChannelList();
  renderUserList();
}

// PROFİL MODALI VE AYARLARI
async function openProfileModal() {
  document.getElementById('profileDisplayName').value = me.displayName;
  document.getElementById('profileAvatarPreview').innerHTML = getAvatarHTML(me.avatar, me.displayName);
  selectedAvatar = me.avatar || '';
  
  const grid = document.getElementById('avatarGrid');
  grid.innerHTML = '';
  
  // Geometrik avatarları listele
  PREDEFINED_AVATARS.forEach((svg, idx) => {
    const div = document.createElement('div');
    div.className = `avatar-option ${selectedAvatar === svg ? 'selected' : ''}`;
    div.innerHTML = svg;
    div.onclick = () => {
      document.querySelectorAll('.avatar-option').forEach(opt => opt.classList.remove('selected'));
      div.classList.add('selected');
      selectedAvatar = svg;
      document.getElementById('profileAvatarPreview').innerHTML = svg;
    };
    grid.appendChild(div);
  });
  
  // Engellenen kullanıcı listesini yükle
  await loadBlockedListUI();
  
  document.getElementById('profileModal').classList.remove('hidden');
}

async function loadBlockedListUI() {
  const listEl = document.getElementById('profileBlockedList');
  if (!listEl) return;
  listEl.innerHTML = '';
  const res = await get('/api/blocks');
  if (res.success) {
    me.blocked = res.blocked || [];
    if (me.blocked.length === 0) {
      listEl.innerHTML = '<li style="color:var(--text-muted);font-weight:500;justify-content:center;background:none;border:none">Engellenen kullanıcı yok.</li>';
    } else {
      me.blocked.forEach(username => {
        const li = document.createElement('li');
        li.innerHTML = `
          <span>@${username}</span>
          <button class="btn-unblock-tiny" onclick="toggleBlock('${username}', '')">Engeli Kaldır</button>
        `;
        listEl.appendChild(li);
      });
    }
  }
}

function saveProfile() {
  const name = document.getElementById('profileDisplayName').value.trim();
  if (name.length < 2) {
    alert("Görünen ad en az 2 karakter olmalıdır.");
    return;
  }
  
  wsSend({
    type: 'updateProfile',
    displayName: name,
    avatar: selectedAvatar
  });
  
  closeModal('profileModal');
}

// WEBRTC GÖRÜNTÜLÜ GÖRÜŞME ÇAĞRI AKIŞI
async function startCall(username, displayName) {
  if (pc) { alert('Zaten bir görüşmedesiniz.'); return; }
  callPeer = username;
  wsSend({ type: 'callInvite', to: username });
  showCallModal(`📞 ${displayName} aranıyor...`);
  
  // Giden arama esnasında sesli çalma tonu
  startOutgoingRing();
  
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    document.getElementById('localVideo').srcObject = localStream;
  } catch(e) {
    alert('Kamera/mikrofon erişimi alınamadı: ' + e.message);
    endCall();
  }
}

let outgoingRingInterval = null;
function startOutgoingRing() {
  if (!notificationSoundEnabled) return;
  stopOutgoingRing();
  outgoingRingInterval = setInterval(() => {
    // Klasik hat arama sinyal sesi (440Hz + 480Hz kısa sinyaller)
    playDualTone(440, 480, 'sine', 1.0, 0.05);
  }, 3000);
}

function stopOutgoingRing() {
  if (outgoingRingInterval) {
    clearInterval(outgoingRingInterval);
    outgoingRingInterval = null;
  }
}

async function onCallAccepted(from) {
  stopOutgoingRing();
  document.getElementById('callStatus').textContent = '🟢 Bağlantı Kuruluyor...';
  await createPeerConnection(true);
}

function onCallRejected(from) {
  stopOutgoingRing();
  appendSystemMsg(`${from} aramayı reddetti.`);
  endCall();
}

function onCallEnded() {
  stopOutgoingRing();
  stopRingtone();
  appendSystemMsg('Görüşme sona erdi.');
  endCall();
}

let incomingCaller = null;
function showIncomingCall(from, fromDisplay) {
  if (pc) {
    // Meşgul sinyali gönder
    wsSend({ type: 'callReject', to: from });
    return;
  }
  incomingCaller = from;
  document.getElementById('callerName').textContent = `${fromDisplay} sizi arıyor...`;
  document.getElementById('incomingCall').classList.remove('hidden');
  
  // Gelen arama zil sesi çal
  startRingtone();
}

async function acceptCall() {
  stopRingtone();
  document.getElementById('incomingCall').classList.add('hidden');
  callPeer = incomingCaller;
  wsSend({ type: 'callAccept', to: incomingCaller });
  showCallModal('🟢 Görüşme bağlanıyor...');
  
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    document.getElementById('localVideo').srcObject = localStream;
  } catch(e) {
    alert('Kamera/mikrofon erişimi alınamadı: ' + e.message);
    endCall();
    return;
  }
  await createPeerConnection(false);
}

function rejectCall() {
  stopRingtone();
  document.getElementById('incomingCall').classList.add('hidden');
  wsSend({ type: 'callReject', to: incomingCaller });
  incomingCaller = null;
}

// PEER BAĞLANTISI YAPILANDIRMA
async function createPeerConnection(isInitiator) {
  pc = new RTCPeerConnection(ICE_CONFIG);
  
  if (localStream) {
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
  }
  
  pc.ontrack = (e) => {
    document.getElementById('remoteVideo').srcObject = e.streams[0];
  };
  
  pc.onicecandidate = (e) => {
    if (e.candidate) wsSend({ type: 'iceCandidate', to: callPeer, candidate: e.candidate });
  };
  
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'connected') {
      document.getElementById('callStatus').textContent = '🟢 Bağlı';
    }
    if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
      endCall();
    }
  };
  
  if (isInitiator) {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    wsSend({ type: 'sdpOffer', to: callPeer, sdp: offer });
  }
}

async function onSdpOffer(from, sdp) {
  if (!pc) await createPeerConnection(false);
  await pc.setRemoteDescription(new RTCSessionDescription(sdp));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  wsSend({ type: 'sdpAnswer', to: from, sdp: answer });
  document.getElementById('callStatus').textContent = '🟢 Bağlandı';
  document.getElementById('remoteLabel').textContent = from;
}

async function onSdpAnswer(sdp) {
  if (pc) await pc.setRemoteDescription(new RTCSessionDescription(sdp));
}

async function onIceCandidate(candidate) {
  if (pc) {
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch(e) {}
  }
}

function endCall() {
  stopOutgoingRing();
  stopRingtone();
  if (pc) { pc.close(); pc = null; }
  if (localStream) {
    localStream.getTracks().forEach(t => t.stop());
    localStream = null;
  }
  document.getElementById('callModal').classList.add('hidden');
  document.getElementById('localVideo').srcObject = null;
  document.getElementById('remoteVideo').srcObject = null;
  if (callPeer) {
    wsSend({ type: 'callEnd', to: callPeer });
    callPeer = null;
  }
}

function showCallModal(status) {
  document.getElementById('callStatus').textContent = status;
  document.getElementById('callModal').classList.remove('hidden');
}

function toggleMic() {
  if (!localStream) return;
  const track = localStream.getAudioTracks()[0];
  if (!track) return;
  track.enabled = !track.enabled;
  document.getElementById('micBtn').classList.toggle('muted', !track.enabled);
  document.getElementById('micBtn').textContent = track.enabled ? '🎤' : '🔇';
}

function toggleCam() {
  if (!localStream) return;
  const track = localStream.getVideoTracks()[0];
  if (!track) return;
  track.enabled = !track.enabled;
  document.getElementById('camBtn').classList.toggle('muted', !track.enabled);
  document.getElementById('camBtn').textContent = track.enabled ? '📷' : '📵';
}

// REST HELPER FONKSİYONLARI
async function post(url, body) {
  const r = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
  return r.json();
}

async function get(url) {
  return (await fetch(url)).json();
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// GİRİŞ KONTROLÜ (İLK AÇILIŞTA)
(async () => {
  const res = await get('/auth/me');
  if (res.loggedIn) {
    me = res.user;
    startApp();
  }
})();

// PWA SERVICE WORKER REGISTRATION
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('ServiceWorker registered successfully:', reg.scope))
      .catch(err => console.log('ServiceWorker registration failed:', err));
  });
}