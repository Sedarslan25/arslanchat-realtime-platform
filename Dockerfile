# Node.js Resmi Görüntüsü
FROM node:18-alpine

# Çalışma Dizini Oluştur
WORKDIR /app

# Bağımlılık Dosyalarını Kopyala
COPY package*.json ./

# Bağımlılıkları Yükle
RUN npm install --omit=dev

# Tüm Kodları Kopyala
COPY . .

# Sunucu Portunu Dışarı Aç
EXPOSE 3000

# Uygulamayı Başlat
CMD ["node", "index.js"]
