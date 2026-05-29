export const characters = [
  { name: 'Lumi', style: 'Watercolor', persona: 'Curious Explorer', date: 'Created today · 10:24 AM', color: 'mint', badge: 'New!' },
  { name: 'Rex', style: 'Crayon', persona: 'Brave Buddy', date: 'Created May 12, 2024', color: 'dino' },
  { name: 'Nova', style: 'Sketch', persona: 'Space Adventurer', date: 'Created May 5, 2024', color: 'space' },
  { name: 'Bamboo', style: 'Ink', persona: 'Kind Friend', date: 'Created Apr 28, 2024', color: 'panda' },
  { name: 'Milo', style: 'Color Pencil', persona: 'Smarty Pants', date: 'Created Apr 20, 2024', color: 'cat' },
  { name: 'Zara', style: 'Marker', persona: 'Dreamer', date: 'Created Apr 15, 2024', color: 'unicorn' },
];

export const styles = [
  { name: 'Pixar 3D', desc: 'Bright, soft, and full of life.', prompt: 'Pixar style 3D rendered character, soft lighting, expressive', tone: 'pixar' },
  { name: 'Disney Classic', desc: 'Warm hand-drawn fairytale charm.', prompt: 'Classic Disney hand-drawn animation style, warm colors', tone: 'disney' },
  { name: 'Anime', desc: 'Detailed eyes with cel-shaded energy.', prompt: 'Japanese anime style, detailed eyes, cel-shaded', tone: 'anime' },
  { name: 'Western Comic', desc: 'Bold heroic outlines and action.', prompt: 'Western comic book style, bold outlines, halftone shading', tone: 'comic' },
  { name: 'Watercolor', desc: 'Soft edges and pastel magic.', prompt: 'Watercolor painting style, soft edges, pastel tones', tone: 'watercolor' },
  { name: 'Pixel Art', desc: 'Retro 16-bit game character spirit.', prompt: '16-bit pixel art style, retro game character sprite', tone: 'pixel' },
  { name: 'Cyberpunk', desc: 'Neon future with glowing accents.', prompt: 'Cyberpunk style, neon accents, futuristic', tone: 'cyber' },
  { name: 'Fantasy', desc: 'Medieval magic and ornate details.', prompt: 'Fantasy medieval style, ornate details, magical aura', tone: 'fantasy' },
  { name: 'Chibi Kawaii', desc: 'Big-head cute, tiny and adorable.', prompt: 'Chibi kawaii style, super-deformed, big head cute', tone: 'chibi' },
];

export const personas = [
  { name: 'Brave Explorer', desc: 'Curious, brave, and loves adventure!', voice: 'Warm voice', icon: '🦖', tone: 'green' },
  { name: 'Mischievous Prankster', desc: 'Loves tricks, giggles, and silly surprises!', voice: 'Playful voice', icon: '🦝', tone: 'purple' },
  { name: 'Gentle Guardian', desc: 'Kind, caring, and always by your side.', voice: 'Gentle voice', icon: '🐼', tone: 'blue' },
  { name: 'Wacky Inventor', desc: 'Bright ideas, wild experiments!', voice: 'Quirky voice', icon: '🦉', tone: 'orange' },
  { name: 'Cool Rebel', desc: 'Confident, chill, and breaks the rules.', voice: 'Cool voice', icon: '😎', tone: 'pink' },
  { name: 'Random', desc: "Can't decide? Let's go random!", voice: 'Random voice', icon: '🎁', tone: 'violet' },
];

export const apiKeys = [
  { name: 'ElevenLabs API Key', tag: 'Text to Speech', status: 'Valid', note: 'Last tested · 2 minutes ago', icon: 'Ⅱ', good: true },
  { name: 'D-ID API Key', tag: 'Video Generation', status: 'Missing', note: 'Not tested', icon: 'D-ID', good: false },
  { name: 'Image Gen API Key', tag: 'Image Generation', status: 'Valid', note: 'Last tested · 5 minutes ago', icon: '▧', good: true },
];

export const planSections = [
  {
    title: 'MVP 视觉与状态机',
    items: ['Next.js App Router 页面骨架', 'DRAW→STYLE→MORPH→PERSONA→TALKING 状态流', '浅色/深色主题与中英语言壳', '本地角色列表、续聊入口与错误页'],
  },
  {
    title: '绘画与上传',
    items: ['1024×1024 Canvas 与 D-ID 引导层', '12 色、3 档粗细、橡皮擦、撤销', '上传照片裁剪与基础质量检查', '导出前自动移除引导层'],
  },
  {
    title: 'AI 生成链路',
    items: ['颜色采样与风格 Prompt 组装', 'Image Gen Adapter：OpenAI / Stability / Custom', 'D-ID Avatar 创建与人脸校验', '失败重试、换风格、返回重画分支'],
  },
  {
    title: '实时对话',
    items: ['ElevenLabs Scribe v2 STT WebSocket', 'ElevenAgents 对话、TTS、turn-taking', 'D-ID WebRTC 实时头像渲染', '麦克风拒绝时降级文字聊天'],
  },
  {
    title: '存储与设置',
    items: ['API Keys AES-GCM 加密 localStorage', '角色与聊天 IndexedDB 持久化', 'LLM Source 与 Custom Endpoint 配置', '语言、隐私导出、清空数据'],
  },
  {
    title: '安全与发布',
    items: ['儿童友好内容过滤与敏感词拦截', '会话时长、重连、超时策略', '端到端冒烟与可访问性检查', '部署、监控、演示脚本与黑客松提交材料'],
  },
];
