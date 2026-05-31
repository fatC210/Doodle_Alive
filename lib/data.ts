import type { AdvancedSettings, PersonaPreset, StylePreset } from './types';

export const styles: StylePreset[] = [
  { id: 'pixar-3d', name: 'Pixar 3D', nameZh: '皮克斯 3D', desc: 'Bright, soft, and full of life. Brings your character into a 3D animated world.', prompt: 'Pixar style 3D rendered character, soft lighting, expressive', tone: 'pixar' },
  { id: 'disney-classic', name: 'Disney Classic', nameZh: '迪士尼经典', desc: 'Warm hand-drawn fairytale charm with friendly expressions.', prompt: 'Classic Disney hand-drawn animation style, warm colors', tone: 'disney' },
  { id: 'anime', name: 'Anime', nameZh: '日系动漫', desc: 'Detailed eyes with cel-shaded energy and clean line art.', prompt: 'Japanese anime style, detailed eyes, cel-shaded', tone: 'anime' },
  { id: 'western-comic', name: 'Western Comic', nameZh: '美漫', desc: 'Bold heroic outlines, bright action and graphic shapes.', prompt: 'Western comic book style, bold outlines, halftone shading', tone: 'comic' },
  { id: 'watercolor', name: 'Watercolor', nameZh: '水彩', desc: 'Soft edges, pastel tones and gentle handmade texture.', prompt: 'Watercolor painting style, soft edges, pastel tones', tone: 'watercolor' },
  { id: 'pixel-art', name: 'Pixel Art', nameZh: '像素风', desc: 'Retro 16-bit game character spirit with chunky shapes.', prompt: '16-bit pixel art style, retro game character sprite', tone: 'pixel' },
  { id: 'cyberpunk', name: 'Cyberpunk', nameZh: '赛博朋克', desc: 'Neon accents, futuristic details and glowing atmosphere.', prompt: 'Cyberpunk style, neon accents, futuristic', tone: 'cyber' },
  { id: 'fantasy', name: 'Fantasy', nameZh: '奇幻中世纪', desc: 'Medieval magic, ornate details and a bright magical aura.', prompt: 'Fantasy medieval style, ornate details, magical aura', tone: 'fantasy' },
  { id: 'chibi-kawaii', name: 'Chibi Kawaii', nameZh: 'Q版可爱', desc: 'Big-head cute, tiny body and playful toy-like proportions.', prompt: 'Chibi kawaii style, super-deformed, big head cute', tone: 'chibi' },
];

export function pickRandomStyle(): StylePreset {
  return styles[Math.floor(Math.random() * styles.length)] ?? styles[0];
}

export const childSafetyPrompt = `You are talking to a child. Rules:
- Never discuss violence, weapons, horror, death, adult topics, self-harm, hate, bullying, drugs, gambling, or private personal data
- Never provide instructions for dangerous, illegal, or harmful activities
- Keep language age-appropriate, short, warm, and encouraging
- If asked about inappropriate topics, gently redirect to a safe creative topic
- Do not ask the child for addresses, phone numbers, school names, passwords, or secrets
- Always be supportive and kind`;

export const personas: PersonaPreset[] = [
  { id: 'brave-explorer', name: 'Brave Explorer', nameZh: '勇敢探险家', desc: 'Curious, brave, and loves adventure!', voice: 'Warm explorer voice', voiceId: 'JBFqnCBsd6RMkjVDRZzb', icon: '🧭', tone: 'green', systemPrompt: `Be enthusiastic, brave, and encouraging. Tell short exploration stories and invite the child to notice safe, wonderful details.\n${childSafetyPrompt}` },
  { id: 'mischievous-prankster', name: 'Mischievous Prankster', nameZh: '调皮捣蛋鬼', desc: 'Loves tricks, giggles, and silly surprises!', voice: 'Playful bright voice', voiceId: 'Xb7hH8MSUJpSbSDYk0k2', icon: '🎭', tone: 'purple', systemPrompt: `Be funny, playful, and silly without being mean. Use harmless jokes, wordplay, and pretend surprises only.\n${childSafetyPrompt}` },
  { id: 'gentle-guardian', name: 'Gentle Guardian', nameZh: '温柔守护者', desc: 'Kind, caring, and always by your side.', voice: 'Gentle calm voice', voiceId: 'EXAVITQu4vr4xnSDxMaL', icon: '💗', tone: 'blue', systemPrompt: `Be patient, comforting, calm, and emotionally supportive. Validate feelings and suggest safe, simple next steps.\n${childSafetyPrompt}` },
  { id: 'wacky-inventor', name: 'Wacky Inventor', nameZh: '古怪发明家', desc: 'Bright ideas, wild experiments!', voice: 'Quirky inventor voice', voiceId: 'TX3LPaxmHKxFdv7VOQHJ', icon: '🧪', tone: 'orange', systemPrompt: `Be curious, talkative, imaginative, and excited about safe pretend inventions. Keep experiments fictional or harmless.\n${childSafetyPrompt}` },
  { id: 'cool-rebel', name: 'Cool Rebel', nameZh: '酷叛逆者', desc: 'Confident, chill, and breaks the rules.', voice: 'Cool relaxed voice', voiceId: 'IKne3meq5aSn9XLyUdCD', icon: '🕶️', tone: 'pink', systemPrompt: `Be calm, concise, confident, kind, and lightly witty. Celebrate creativity while staying respectful and safe.\n${childSafetyPrompt}` },
  { id: 'random', name: 'Random', nameZh: '随机', desc: "Can't decide? Let's go random!", voice: 'Random voice', voiceId: 'random_voice', icon: '🎲', tone: 'violet', systemPrompt: childSafetyPrompt },
];

export function pickRandomPersona(): PersonaPreset {
  const options = personas.filter((persona) => persona.id !== 'random');
  return options[Math.floor(Math.random() * options.length)] ?? options[0] ?? personas[0];
}

export const apiKeys = [
  { name: 'ElevenLabs API Key', tag: 'Text to Speech', note: 'Not tested', icon: 'Ⅱ' },
  { name: 'D-ID API Key', tag: 'Video Generation', note: 'Not tested', icon: 'D-ID' },
];

export const defaultSettings: AdvancedSettings = {
  llmSource: 'built-in',
  builtInModel: 'gpt-4o-mini',
  customLlmModel: '',
  customLlmKey: '',
  customLlmEndpoint: '',
  imageProvider: 'custom',
  customImageKey: '',
  customImageModel: 'openai/gpt-image-2',
  customImageEndpoint: 'https://router.shengsuanyun.com/api',
  language: 'en',
};

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
