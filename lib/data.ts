import type { AdvancedSettings, PersonaPreset, StylePreset } from './types';

export const DEFAULT_STYLE_ID = 'american-academy';

export const styles: StylePreset[] = [
  { id: 'american-academy', name: 'American Academy', nameZh: '美式学院', desc: 'Classic campus portrait with warm, natural academic style.', descZh: '经典校园肖像，带有温暖自然的学院风。', prompt: 'American academy style portrait, classic campus atmosphere, natural light, preppy outfit, warm realistic photography', tone: 'academy', image: '/images/styles/美式学院.png' },
  { id: 'soft-studio', name: 'Soft Studio', nameZh: '柔光棚拍', desc: 'Clean studio portrait with soft light and gentle shadows.', descZh: '干净的棚拍肖像，柔和光线搭配轻柔阴影。', prompt: 'Soft studio portrait photography, diffused lighting, light gray background, black turtleneck sweater, realistic face, gentle shadows', tone: 'studio', image: '/images/styles/柔光棚拍.png' },
  { id: 'western-comic', name: 'Children', nameZh: '儿童', desc: 'Natural child portrait with bright, clean, realistic photography.', descZh: '明亮干净的儿童肖像，真实自然的摄影质感。', prompt: 'Real child portrait photography, natural realistic face, bright clean lighting, soft youthful features, casual everyday outfit', tone: 'comic', image: '/images/styles/儿童.png' },
  { id: 'watercolor', name: 'Watercolor', nameZh: '水彩', desc: 'Soft watercolor portrait with a head-and-shoulders composition.', descZh: '柔和的水彩肖像，头肩构图。', prompt: 'Depict a frontal portrait of a real person in a watercolor style; the composition should capture the head and shoulders; no text or watermarks.', tone: 'watercolor', image: '/images/styles/水彩.png' },
  { id: 'cyberpunk', name: 'Cyberpunk', nameZh: '赛博朋克', desc: 'Neon accents, futuristic details and glowing atmosphere.', descZh: '霓虹点缀、未来细节和发光氛围。', prompt: 'Cyberpunk style, neon accents, futuristic city lights, glossy techwear, cinematic portrait', tone: 'cyber', image: '/images/styles/赛博朋克.png' },
  { id: 'fantasy-medieval', name: 'Fantasy Medieval', nameZh: '奇幻中世纪', desc: 'Medieval magic, ornate details and a dramatic fantasy aura.', descZh: '中世纪魔法、华丽细节和戏剧化奇幻气息。', prompt: 'Fantasy medieval style, ornate costume details, magical aura, cinematic royal portrait', tone: 'fantasy', image: '/images/styles/奇幻中世纪.png' },
];

export const childSafetyPrompt = `You are talking to a child. Rules:
- Never discuss violence, weapons, horror, death, adult topics, self-harm, hate, bullying, drugs, gambling, or private personal data
- Never provide instructions for dangerous, illegal, or harmful activities
- Keep language age-appropriate, short, warm, and encouraging
- If asked about inappropriate topics, gently redirect to a safe creative topic
- Do not ask the child for addresses, phone numbers, school names, passwords, or secrets
- Always be supportive and kind`;

export const personas: PersonaPreset[] = [
  { id: 'brave-explorer', name: 'Brave Explorer', nameZh: '勇敢探险家', desc: 'Curious, brave, and loves adventure!', descZh: '好奇、勇敢，热爱冒险！', voice: 'Warm explorer voice', voiceZh: '温暖探险音色', icon: '🧭', tone: 'green', systemPrompt: `Be enthusiastic, brave, and encouraging. Tell short exploration stories and invite the child to notice safe, wonderful details.\n${childSafetyPrompt}` },
  { id: 'mischievous-prankster', name: 'Mischievous Prankster', nameZh: '调皮捣蛋鬼', desc: 'Loves tricks, giggles, and silly surprises!', descZh: '喜欢小把戏、咯咯笑和有趣惊喜！', voice: 'Playful bright voice', voiceZh: '俏皮明亮音色', icon: '🎭', tone: 'purple', systemPrompt: `Be funny, playful, and silly without being mean. Use harmless jokes, wordplay, and pretend surprises only.\n${childSafetyPrompt}` },
  { id: 'gentle-guardian', name: 'Gentle Guardian', nameZh: '温柔守护者', desc: 'Kind, caring, and always by your side.', descZh: '善良体贴，总是在你身边。', voice: 'Gentle calm voice', voiceZh: '温柔平静音色', icon: '💗', tone: 'blue', systemPrompt: `Be patient, comforting, calm, and emotionally supportive. Validate feelings and suggest safe, simple next steps.\n${childSafetyPrompt}` },
  { id: 'wacky-inventor', name: 'Wacky Inventor', nameZh: '古怪发明家', desc: 'Bright ideas, wild experiments!', descZh: '点子超多，喜欢奇妙实验！', voice: 'Quirky inventor voice', voiceZh: '古怪发明音色', icon: '🧪', tone: 'orange', systemPrompt: `Be curious, talkative, imaginative, and excited about safe pretend inventions. Keep experiments fictional or harmless.\n${childSafetyPrompt}` },
  { id: 'cool-rebel', name: 'Cool Rebel', nameZh: '酷叛逆者', desc: 'Confident, chill, and breaks the rules.', descZh: '自信放松，喜欢打破常规。', voice: 'Cool relaxed voice', voiceZh: '酷感放松音色', icon: '🕶️', tone: 'pink', systemPrompt: `Be calm, concise, confident, kind, and lightly witty. Celebrate creativity while staying respectful and safe.\n${childSafetyPrompt}` },
  { id: 'random', name: 'Random', nameZh: '随机', desc: "Can't decide? Let's go random!", descZh: '拿不定主意？那就随机吧！', voice: 'Random voice', voiceZh: '随机音色', icon: '🎲', tone: 'violet', systemPrompt: childSafetyPrompt },
];

export function pickRandomPersona(): PersonaPreset {
  const options = personas.filter((persona) => persona.id !== 'random');
  return options[Math.floor(Math.random() * options.length)] ?? options[0] ?? personas[0];
}

export const defaultSettings: AdvancedSettings = {
  imageProvider: 'custom',
  customImageKey: '',
  customImageModel: '',
  customImageEndpoint: '',
  language: 'en',
};

export const planSections = [
  {
    title: 'MVP Visuals & State Machine',
    titleZh: 'MVP 视觉与状态机',
    items: ['Next.js App Router page scaffold', 'DRAW→STYLE→MORPH→PERSONA→TALKING state flow', 'Light/dark themes and bilingual shell', 'Local character list, continue-chat entry, and error pages'],
    itemsZh: ['Next.js App Router 页面骨架', 'DRAW→STYLE→MORPH→PERSONA→TALKING 状态流', '浅色/深色主题与中英语言壳', '本地角色列表、续聊入口与错误页'],
  },
  {
    title: 'Drawing & Upload',
    titleZh: '绘画与上传',
    items: ['1024×1024 Canvas with D-ID guide layer', '12 colors, 3 brush sizes, eraser, and undo', 'Uploaded photo crop and basic quality checks', 'Automatically remove guide layer before export'],
    itemsZh: ['1024×1024 Canvas 与 D-ID 引导层', '12 色、3 档粗细、橡皮擦、撤销', '上传照片裁剪与基础质量检查', '导出前自动移除引导层'],
  },
  {
    title: 'AI Generation Flow',
    titleZh: 'AI 生成链路',
    items: ['Color sampling and style prompt assembly', 'Image Gen Adapter: OpenAI / Stability / Custom', 'D-ID Avatar creation and face validation', 'Retry, change style, and return-to-draw branches'],
    itemsZh: ['颜色采样与风格 Prompt 组装', 'Image Gen Adapter：OpenAI / Stability / Custom', 'D-ID Avatar 创建与人脸校验', '失败重试、换风格、返回重画分支'],
  },
  {
    title: 'Realtime Chat',
    titleZh: '实时对话',
    items: ['ElevenLabs Scribe v2 STT WebSocket', 'ElevenAgents conversation, TTS, and turn-taking', 'D-ID WebRTC realtime avatar rendering', 'Fallback to text chat when microphone access is denied'],
    itemsZh: ['ElevenLabs Scribe v2 STT WebSocket', 'ElevenAgents 对话、TTS、turn-taking', 'D-ID WebRTC 实时头像渲染', '麦克风拒绝时降级文字聊天'],
  },
  {
    title: 'Storage & Settings',
    titleZh: '存储与设置',
    items: ['API Keys encrypted in localStorage with AES-GCM', 'Character and chat persistence in IndexedDB', 'LLM Source and Custom Endpoint configuration', 'Language, privacy export, and data clearing'],
    itemsZh: ['API Keys AES-GCM 加密 localStorage', '角色与聊天 IndexedDB 持久化', 'LLM Source 与 Custom Endpoint 配置', '语言、隐私导出、清空数据'],
  },
  {
    title: 'Safety & Release',
    titleZh: '安全与发布',
    items: ['Child-friendly content filtering and sensitive-word blocking', 'Session duration, reconnect, and timeout strategies', 'End-to-end smoke tests and accessibility checks', 'Deployment, monitoring, demo script, and hackathon submission assets'],
    itemsZh: ['儿童友好内容过滤与敏感词拦截', '会话时长、重连、超时策略', '端到端冒烟与可访问性检查', '部署、监控、演示脚本与黑客松提交材料'],
  },
];
