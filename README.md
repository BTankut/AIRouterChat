# AI Router Chat

Modern bir AI sohbet arayüzü. OpenRouter API'sini kullanarak çeşitli AI modelleriyle gerçek zamanlı sohbet imkanı sağlar.

## Özellikler

- ⚡️ Gerçek zamanlı metin akışı
- 🎨 Modern ve kullanıcı dostu arayüz
- 🔄 Dinamik model seçimi
- 💰 Model bazlı fiyatlandırma gösterimi
- 🗑️ Sohbet geçmişi temizleme

## Teknolojiler

- React + TypeScript
- OpenRouter API
- TanStack Query
- Tailwind CSS
- shadcn/ui
- Express.js

## Kurulum

1. Repoyu klonlayın
```bash
git clone https://github.com/BTankut/AIRouterChat.git
cd AIRouterChat
```

2. Bağımlılıkları yükleyin
```bash
npm install
```

3. Ortam değişkenlerini ayarlayın
`.env` dosyası oluşturun ve OpenRouter API anahtarınızı ekleyin:
```
OPENROUTER_API_KEY=your_api_key_here
```

4. Uygulamayı başlatın
```bash
npm run dev
```

Uygulama varsayılan olarak `http://localhost:5000` adresinde çalışacaktır.

## Ortam Değişkenleri

| Değişken | Açıklama |
|----------|-----------|
| OPENROUTER_API_KEY | OpenRouter API anahtarı. [OpenRouter](https://openrouter.ai/docs) üzerinden alabilirsiniz. |

## Lisans

MIT
