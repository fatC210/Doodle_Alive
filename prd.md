     # Doodle Alive
    
    ## 1. 项目概述
    
    **一句话**：孩子画一张脸 → 选择画风 → AI 将画作"魔法变身"为可交互角色 → 角色开口说话、做表情、与孩子实时对话。
    
    **Slogan**：Draw it. Watch it come alive.
    
    **核心卖点**：画作变身那一刻的"魔法感"是纯语音/纯文字产品无法提供的——这正是 D-ID 富有表现力的虚拟形象 + ElevenAgents 自然语音的**不可替代组合**。
    
    **黑客松赛道**：ElevenHacks #11 — D-ID × ElevenLabs
    
    ---
    
    ## 2. 目标用户
    
    | 维度 | 描述 |
    | --- | --- |
    | 核心用户 | 4-12 岁儿童（能画简笔画、能说话或打字） |
    | 次要用户 | 家长/成人创意爱好者 |
    | 操作门槛 | 无需家长在场，界面直觉可操作 |
    | 语言 | 中/英双语，默认英文 |
    
    ---
    
    ## 3. 核心功能
    
    ### 3.1 绘画面板
    
    - **双入口**：网页 Canvas 直接画 / 纸上画完拍照上传
    - **引导框**：画布上预置淡色五官+身体引导线（详见 3.1.1）
    - **画笔**：12 色 + 3 级粗细 + 橡皮擦 + 撤销
    - **画布尺寸**：1024×1024px（对齐 D-ID 输出规格 + 主流生图模型默认分辨率）
    
    ### 3.1.1 引导框布局（严格对齐 D-ID Optimal Image Guidelines）
    
    ```
    ┌──────────────── 1024px ────────────────┐
    │             30% 顶部留白 (~307px)       │
    │    ┌──────────────────────────┐         │
    │    │     ○            ○       │         │  ← 眼睛引导圈
    │    │          △              │         │  ← 鼻子引导线
    │    │         ―──             │         │  ← 嘴巴引导弧线
    │    │    ╱  头部轮廓  ╲        │         │  ← 头部椭圆引导框
    │    │   ╱  (≥200×200px)  ╲    │         │
    │    └──────────────────────────┘         │
    │          ╲  肩线  ╱                    │  ← 肩膀引导线
    │       ┌──── 上半身 ────┐               │  ← 服装绘制区域
    │       │  (可自由绘画)   │               │
    │       └────────────────┘               │
    │             底部留白                    │
    └────────────────────────────────────────┘
      ←30%→                  ←30%→
      ~307px                  ~307px
    ```
    
    **关键约束**：
    
    - 头部引导框中心位于画布 (512, 384)，确保头部距四边均 ≥30%
    - 头部区域内最小可绘尺寸 200×200px（引导框实际提供 ~410×280px）
    - 五官引导元素透明度 10%，不影响最终输出；生成前自动移除引导层
    - 固体背景色（默认白色，可切换 6 种浅色）
    
    ### 3.2 风格选择
    
    9 种画风，每种附带示例预览图（缩略图 200×200px）：
    
    | # | 风格 | 英文名 | Prompt 关键词 | 预览图描述 |
    | --- | --- | --- | --- | --- |
    | 1 | 皮克斯 3D | Pixar 3D | `Pixar style 3D rendered character, soft lighting, expressive` | 玩具总动员风男孩 |
    | 2 | 迪士尼经典 | Disney Classic | `Classic Disney hand-drawn animation style, warm colors` | 90年代迪士尼公主风 |
    | 3 | 日系动漫 | Anime | `Japanese anime style, detailed eyes, cel-shaded` | 少年漫主角风 |
    | 4 | 美漫 | Western Comic | `Western comic book style, bold outlines, halftone shading` | 漫威/DC风英雄 |
    | 5 | 水彩 | Watercolor | `Watercolor painting style, soft edges, pastel tones` | 温柔水彩肖像 |
    | 6 | 像素风 | Pixel Art | `16-bit pixel art style, retro game character sprite` | 像素游戏角色 |
    | 7 | 赛博朋克 | Cyberpunk | `Cyberpunk style, neon accents, futuristic` | 霓虹未来风角色 |
    | 8 | 奇幻中世纪 | Fantasy | `Fantasy medieval style, ornate details, magical aura` | 魔法世界角色 |
    | 9 | Q版可爱 | Chibi Kawaii | `Chibi kawaii style, super-deformed, big head cute` | 大头Q版角色 |
    
    **选择页 UI**：3×3 网格，每格=风格名+预览图，点击选中（高亮边框），底部"🎲 Random"按钮。
    
    ### 3.3 魔法变身
    
    用户点击"✨ Bring to Life"后：
    
    1. **移除引导层**：从 Canvas 导出纯净画作（不含引导线）
    2. **提取颜色特征**：对画作 Canvas 像素采样，提取 top-3 非白非引导色，记为 `[accent_colors]`
    3. **调用生图 API**（用户自带 key）：
        - Prompt 模板：`[风格关键词], frontal facing portrait, upper body, neutral expression, closed mouth, open eyes, solid [背景色] background, illustrated avatar inspired by a child's drawing, wearing [accent_colors] colored clothes and accessories`
        - 输出尺寸：1024×1024px
    4. **魔法变身动画**（纯前端 CSS/Canvas 动画，≈2 秒）：
        - Phase 1：画作开始发光（白色径向渐变从中心扩散）
        - Phase 2：粒子飞散效果（sparkle particles outward）
        - Phase 3：crossfade 到生成图
        - Phase 4：生成图从静止 → 轻微呼吸动画（scale 微动）
    5. **生成图校验**：尝试用 D-ID API 创建 avatar，若人脸检测失败 → 提示用户重新画或换风格，返回 DRAW 步骤
    
    ### 3.4 人格选择
    
    | # | 人格 | 英文名 | System Prompt 概要 | ElevenLabs 声线匹配 |
    | --- | --- | --- | --- | --- |
    | 1 | 勇敢探险家 | Brave Explorer | 热情、鼓励冒险、讲探索故事 | 深沉温暖男声 |
    | 2 | 调皮捣蛋鬼 | Mischievous Prankster | 幽默、爱开玩笑、偶尔恶作剧 | 高亢活泼女声/童声 |
    | 3 | 温柔守护者 | Gentle Guardian | 安慰、耐心、善解人意 | 柔和舒缓女声 |
    | 4 | 古怪发明家 | Wacky Inventor | 好奇、话多、天马行空 | 怪趣快语男声 |
    | 5 | 酷叛逆者 | Cool Rebel | 酷、少言但精准、偶尔吐槽 | 低沉慵懒男声 |
    | 🎲 | 随机 | Random | — | — |
    - **默认**：不选 = 随机（人格 + 声线同时随机）
    - 选择人格后声线自动匹配，用户无需单独选声音
    
    ### 3.5 实时对话
    
    ### 3.5.1 交互模式
    
    - **主模式**：语音对话 — 点击麦克风按钮开始，全程监听
    - **兜底模式**：文字输入框（默认收起，点击小图标展开；输入后自动发送）
    - **视觉反馈**：对话时显示文字气泡（角色说的话 + 用户说的话的 STT 转写）
    
    ### 3.5.2 技术链路
    
    ```
    用户语音 ──→ ElevenLabs Scribe v2 Realtime (STT)
         │
         ↓ 文本
    ElevenAgents (内置 LLM + 对话逻辑 + TTS + 内容过滤 + turn-taking)
         │
         ↓ 回复文本 + TTS 音频流
    D-ID Real-time Streaming Avatar (WebRTC, 口型+表情驱动)
         │
         ↓ 实时视频流
    前端 <video> 渲染
    ```
    
    - **STT**：ElevenLabs Scribe v2 Realtime WebSocket，VAD 自动提交，支持语言自动检测
    - **Agent**：ElevenAgents 配置，system prompt 含人格描述 + 儿童安全约束；LLM 模型由用户在 Settings 选择（默认使用内置模型，无需额外 Key）
    - **TTS**：ElevenAgents 内置 TTS，voice_id 根据人格自动匹配
    - **Avatar**：D-ID Real-time Streaming API（WebRTC），输入生成图作为 avatar source
    - **全程监听**：对话期间 STT 持续开启，ElevenAgents turn-taking 处理抢话/打断
    
    ### 3.5.3 内容安全过滤
    
    双层过滤：
    
    1. **ElevenAgents 内置 moderation**（平台级）
    2. **System Prompt 硬约束**：
        
        ```
        You are talking to a child. Rules:
        - Never discuss violence, weapons, horror, death, or adult topics
        - Never provide instructions for dangerous activities
        - Keep language age-appropriate and encouraging
        - If asked about inappropriate topics, gently redirect:
          "That's not something I can help with, but let me tell you about..."
        - Always be supportive and kind
        ```
        
    
    ### 3.5.4 对话时长
    
    无限制，用户主动退出或关闭页面即结束。
    
    ### 3.6 角色保存 & 续聊
    
    - 生成角色后自动保存到 **IndexedDB**：
        - 原始画作（Canvas 导出 PNG blob）
        - 生成图（生图 API 返回 URL → fetch → blob 存储）
        - 风格 ID / 人格 ID / 声线 voice_id
        - D-ID avatar ID
        - ElevenAgents agent ID
        - 创建时间
    - 首页展示"我的角色"网格，点击任意角色可继续对话
    - 对话历史存入 IndexedDB（角色 ID 为 key，每条记录含 role/content/timestamp）
    
    ---
    
    ## 4. 设置页
    
    ### 4.1 API Key 管理（全部存 localStorage）
    
    | Key | 用途 | 验证方式 |
    | --- | --- | --- |
    | ElevenLabs API Key | STT + Agent(含内置LLM) + TTS | 调用 `GET /v1/user` 成功即通过 |
    | D-ID API Key | Avatar 创建 + Streaming | 调用 `GET /avatars` 成功即通过 |
    | 图像生成 API 密钥 | 生图 | 发送测试请求，能返回图片即通过 |
    
    所有 Key 在 localStorage 中 **AES-GCM 加密**存储（密钥由用户设备指纹派生）。
    
    ### 4.2 LLM 模型配置
    
    | 配置项 | 类型 | 默认值 | 说明 |
    | --- | --- | --- | --- |
    | LLM Source | `built-in` / `custom` | `built-in` | built-in 用 ElevenAgents 内置模型，无需额外 Key |
    | Built-in Model | 下拉选择 | `gpt-4o-mini` | 从 ElevenAgents 支持列表选：gpt-4o, gpt-4o-mini, claude-sonnet-4, gemini-2.5-flash 等 |
    | Custom LLM Key | 文本输入 | — | 仅 custom 模式显示 |
    | Custom LLM Endpoint | 文本输入 | — | 仅 custom 模式显示，OpenAI 兼容端点 URL |
    
    ### 4.3 生图 API 配置
    
    - **Provider 类型**：下拉选择 `OpenAI DALL-E 3` / `Stability AI` / `Custom`
    - **Custom 模式**：用户自行填写 OpenAI 兼容请求地址、API 密钥和模型名
    - 验证：发送一个最小请求，返回有效图片 URL 即通过
    
    ### 4.4 界面语言
    
    - 中/英切换，默认英文
    - 切换即时生效，无需刷新
    
    ---
    
    ## 5. 技术架构
    
    ```
    ┌────────────────────────────────────────────────────────┐
    │                  Next.js 16 App                         │
    │                  (Turbopack + React 19.2)               │
    │                                                          │
    │  ┌──────────┐  ┌──────────┐  ┌───────────────┐         │
    │  │  Drawing  │  │  Style   │  │  Chat UI      │         │
    │  │  Canvas   │  │  Picker  │  │  (Voice+Text)  │         │
    │  └─────┬────┘  └────┬─────┘  └───────┬───────┘         │
    │        │             │                │                   │
    │  ┌─────▼─────────────▼────────────────▼───────────────┐ │
    │  │              Core Orchestrator                      │ │
    │  │  (State Machine: DRAW→STYLE→MORPH→PERSONA→TALK)    │ │
    │  └──┬──────┬──────────┬──────────┬────────────────────┘ │
    │     │      │          │          │                        │
    │  ┌──▼──┐ ┌─▼───┐ ┌───▼───┐ ┌───▼────┐                  │
    │  │IdxDB│ │STT  │ │Agents │ │D-ID    │                  │
    │  │Local│ │WS   │ │WS     │ │Stream  │                  │
    │  └─────┘ └─────┘ └───────┘ └────────┘                  │
    │                                                          │
    │  ┌────────────────────────────────────────────────────┐  │
    │  │  Image Gen Adapter Layer                           │  │
    │  │  (OpenAI-compatible | Stability AI | Custom)      │  │
    │  └────────────────────────────────────────────────────┘  │
    │                                                          │
    │  localStorage: API Keys + Settings (AES-GCM encrypted)   │
    │  IndexedDB: Characters + Chat History                    │
    └──────────────────────────────────────────────────────────┘
    ```
    
    ### 5.1 状态机
    
    ```
      DRAW ──→ STYLE ──→ MORPHING ──→ PERSONA ──→ TALKING
       │          │          │             │             │
       │←─────────┘          │             │             │
       │  (可返回重画)        │             │             │
                            │             │             │
                       失败→返回DRAW   可跳过(随机)   可随时退出→Home
    ```
    
    ### 5.2 关键技术选型
    
    | 层 | 技术 | 说明 |
    | --- | --- | --- |
    | 前端框架 | Next.js 16 (App Router, Turbopack) | React 19.2 |
    | Canvas 画板 | HTML5 Canvas API + fabric.js | 支持引导层叠加/移除 |
    | STT | ElevenLabs Scribe v2 Realtime WebSocket | 全程监听，VAD 自动提交 |
    | Agent | ElevenAgents WebSocket API | 内置 LLM + TTS + turn-taking |
    | Avatar | D-ID Real-time Streaming API (WebRTC) | 生成图 → 创建 avatar → 流式渲染 |
    | 生图 | Adapter 模式，默认 OpenAI DALL-E 3 | 用户自带 key |
    | 本地存储 | localStorage (AES-GCM 加密) + IndexedDB | 零服务端存储 |
    | 动画 | CSS @keyframes + Canvas particle system | 魔法变身效果 |
    | 国际化 | next-intl | 中/英切换 |
    
    ---
    
    ## 6. 页面结构
    
    ```
    / (Home)
    ├── 我的角色网格 + "新建角色"按钮
    │
    /create
    ├── Step 1: 绘画 (Canvas / 上传)
    ├── Step 2: 选风格 (3×3 网格 + 随机)
    ├── Step 3: 魔法变身 (动画 + D-ID 校验)
    ├── Step 4: 选人格 (6 选项含随机，可跳过)
    │
    /chat/[characterId]
    ├── 角色视频流 (D-ID avatar)
    ├── 文字气泡
    ├── 麦克风按钮 (主交互)
    ├── 文字输入 (收起式，点击展开)
    │
    /settings
    ├── API Keys 管理 (ElevenLabs / D-ID)
    ├── 图像生成高级配置 (request URL / API key / model)
    ├── LLM 配置 (built-in 模型选择 / custom)
    ├── 生图 Provider 配置
    ├── 语言切换
    ```
    
    ---
    
    ## 7. 错误处理
    
    | 场景 | 处理 |
    | --- | --- |
    | D-ID 人脸检测失败 | 提示"角色还没准备好，试试画得更清楚或换个风格" → 返回 DRAW |
    | 生图 API 返回无效 | 提示"魔法失败了，再试一次？" → 重试或换风格 |
    | ElevenAgents 连接断开 | 自动重连 3 次，仍失败则提示"角色睡着了，点我唤醒" |
    | 麦克风权限被拒 | 自动降级为纯文字模式，提示可开启麦克风 |
    | API Key 缺失/无效 | 进入 Settings 页高亮缺失项 |
    | Custom LLM 端点无响应 | fallback 到 built-in 模型，提示"已切换到默认大脑" |
    
    ---
