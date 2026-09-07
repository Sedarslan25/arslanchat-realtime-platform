const Datastore = require('nedb-promises');
const path = require('path');

const dbDir = path.join(__dirname, '..', 'database');

const db = {
  users: Datastore.create({ filename: path.join(dbDir, 'users.db'), autoload: true }),
  channels: Datastore.create({ filename: path.join(dbDir, 'channels.db'), autoload: true }),
  messages: Datastore.create({ filename: path.join(dbDir, 'messages.db'), autoload: true }),
};

async function initDB() {
  const defaultChannels = ['genel', 'ders', 'yardim', 'proje'];
  for (const name of defaultChannels) {
    const exists = await db.channels.findOne({ name });
    if (!exists) {
      await db.channels.insert({ name, createdAt: new Date(), topic: `#${name} kanalına hoş geldiniz!` });
    }
  }
  console.log('Veritabanı hazır.');
}

initDB();

module.exports = db;