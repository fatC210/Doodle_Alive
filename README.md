<div align="center">
  <h1>🎨 Doodle Alive</h1>
  <p>
    <strong>Turn kids' doodles and photos into styled, talking AI characters.</strong>
  </p>
  <p>
    <a href="README.zh-CN.md">中文 README</a>
  </p>
  <img src="public/images/readme-banner.png" alt="Doodle Alive banner" width="100%" />
</div>

## ✨ What It Does

**Doodle Alive** turns a child’s doodle or uploaded photo into a styled, talking character. Kids can draw a face, choose a magic style, give the character a personality, and start a voice conversation in the browser.

- 🖍️ **Draw or upload**: Start from a 1024 × 1024 drawing canvas or import a photo.
- 🌈 **Choose a style**: Transform the original image with AI using presets such as academy, watercolor, cyberpunk, fantasy, studio, and child-friendly portrait styles.
- 🪄 **Bring it to life**: Generate a clean front-facing avatar and validate whether D-ID can animate the face.
- 🎭 **Pick a personality**: Choose a persona, voice tone, and character name before saving.
- 🎙️ **Talk in real time**: Chat with the animated character through the D-ID Agent embed, with voice handled by D-ID and ElevenLabs.
- 💾 **Continue later**: Saved characters and chat history are restored from browser storage.

## 🚀 Product Flow

1. 🖌️ **Draw** — create a doodle on canvas or upload a photo, with tips for centered faces, clear colors, and open eyes.
2. 🎨 **Style** — select a visual style or let the app choose one randomly.
3. ✨ **Magic** — generate the avatar image, extract accent colors, and run D-ID face validation.
4. 🧒 **Persona** — name the character and choose how it behaves and speaks.
5. 💬 **Talk** — open the character page and start a voice conversation.

## 🌟 Highlights

- 🛡️ **Kid-focused experience**: Built-in safety prompt and keyword filtering help redirect unsafe topics toward positive, age-appropriate adventures.
- 🌐 **Bilingual UI**: English and Chinese are supported, with instant language switching.
- 🏠 **Local-first storage**: Settings, drafts, characters, generated images, and chat history are stored in the browser.
- 🤖 **Configurable AI image generation**: The app supports a custom image-generation endpoint, model, and API key from Advanced Configuration.
- 🗣️ **D-ID Agent integration**: D-ID provisions animated agents for generated characters, while optional ElevenLabs voice settings can power expressive voices.
- ☁️ **Vercel-ready hosting**: Vercel Blob can provide public HTTPS image URLs when generated images need to be loaded by D-ID.

## 🧭 Screens & Routes

- 🏡 `/` — Home page and saved character gallery.
- ✏️ `/create` — Drawing canvas and photo upload.
- 🎨 `/create/style` — Style selection.
- 🪄 `/create/morph` — AI transformation and face validation.
- 🎭 `/create/persona` — Character naming and persona selection.
- 💬 `/chat/[characterId]` — Animated character conversation.
- ⚙️ `/settings` — D-ID connection, language, and configuration entry points.
- 🧰 `/settings/advanced` — Image generation and advanced runtime settings.

## ⚙️ Configuration

The app is designed to run without a database, but the live AI and voice features require service credentials.

### 🔑 In-App Settings

- **D-ID API Key**: Used to validate faces and provision animated agents.
- **Image generation endpoint, model, and API key**: Used to transform doodles into avatar images.
- **Language**: Switches the UI between English and Chinese.

### 🧩 Environment Variables

Copy `.env.example` to `.env.local` and fill only what your deployment needs.

Important options include:

- `DID_ALLOWED_DOMAINS` — domains allowed to use generated D-ID client keys.
- `BLOB_READ_WRITE_TOKEN` and `BLOB_STORE_ID` — Vercel Blob configuration for public image hosting.
- `DID_LLM_PROVIDER`, `DID_LLM_MODEL`, and voice override variables — optional D-ID Agent behavior controls.
- `NEXT_PUBLIC_DID_AGENT_ID`, `NEXT_PUBLIC_DID_CLIENT_KEY`, `NEXT_PUBLIC_DID_EMBED_SRC` — optional fallback embed settings.

## 🛠️ Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Useful checks:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## 🧱 Tech Stack

- ⚡ **Framework**: Next.js 16, React 19, TypeScript
- 🎛️ **UI**: CSS modules/global styles, Lucide icons
- 🗄️ **Storage**: localStorage, IndexedDB, encrypted local secrets
- 🤖 **AI & voice**: Custom image-generation API, D-ID Agent, ElevenLabs voice options
- ☁️ **Hosting utilities**: Vercel Blob for public generated-image URLs

## 📝 Notes

- Browser-stored data is local to the current device and browser profile.
- For real child-facing deployment, add parental consent, quotas, stricter moderation, abuse monitoring, and server-side policy controls.
- D-ID animation requires a clean, front-facing, publicly loadable image URL when the generated image cannot be embedded directly.
