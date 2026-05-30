# Doodle Alive 全功能开发计划

## 阶段 0：项目基础与设计系统
- 搭建 Next.js App Router、TypeScript、全局主题、路由结构。
- 建立 PRD 中的状态机：DRAW → STYLE → MORPHING → PERSONA → TALKING。
- 完成浅色 / 深色视觉系统、渐变按钮、玻璃卡片、响应式布局。
- 建立中英双语文案字典与语言切换入口。

## 阶段 1：绘画面板
- 实现 1024×1024 HTML5 Canvas 画板。
- 添加 D-ID Optimal Image Guidelines 对齐的头部、五官、肩线引导层。
- 支持 12 色、3 级粗细、橡皮擦、撤销、清空、6 种浅色背景。
- 支持照片上传、裁剪、缩放、居中和基础清晰度校验。
- 导出生图前自动移除引导层，仅保留用户画作和背景。

## 阶段 2：风格选择与 Prompt 编排
- 实现 9 种风格的 3×3 网格选择和 Random 随机。
- 为每种风格维护英文名、中文名、Prompt 关键词、预览图和描述。
- 实现原图 → 选中风格预览侧栏。
- 采样 Canvas 像素，提取 top-3 非白 / 非引导色作为 accent colors。
- 组装最终图像生成 Prompt：风格关键词、正面头像、上半身、清晰五官、颜色特征、儿童友好。

## 阶段 3：魔法变身与图像生成
- 实现 Magic Morphing 动画：粒子、彩虹旋涡、进度时间线。
- 建立 Image Gen Adapter 层：OpenAI 兼容、Stability AI、Custom HTTP Provider。
- 实现 OpenAI 兼容 Provider 的请求地址、API 密钥、模型名配置。
- 处理无效图片、超时、Key 缺失、重试、换风格、返回重画。
- 保存原始画作、生成图、风格、颜色特征和状态记录。

## 阶段 4：D-ID Avatar 链路
- 使用生成图创建 D-ID Avatar / Streaming 资源。
- 实现人脸检测与 Avatar validation 成功 / 失败分支。
- 失败时提示“角色还没准备好，试试画得更清楚或换个风格”。
- 建立 WebRTC 播放容器、视频控制、音量、全屏、连接状态。
- 对 Streaming 断线、超时、重连做 UI 状态反馈。

## 阶段 5：人格与声音
- 实现 5 种人格 + Random：Brave Explorer、Mischievous Prankster、Gentle Guardian、Wacky Inventor、Cool Rebel。
- 为每种人格维护 System Prompt、语气约束、推荐声线、儿童安全边界。
- 支持跳过并随机分配人格。
- 将人格、风格、角色名、角色图写入本地角色档案。

## 阶段 6：实时对话
- 接入 ElevenLabs Scribe v2 Realtime WebSocket 进行 STT。
- 接入 ElevenAgents WebSocket 完成 LLM、TTS、turn-taking。
- 将 ElevenAgents 音频输出同步驱动 D-ID Avatar Streaming。
- 实现 Live / STT / Agent / Avatar 状态条和麦克风主按钮。
- 支持 quick replies、收起式文字输入、消息气泡、聊天时间戳。

## 阶段 7：降级、错误与安全
- 麦克风权限被拒时自动进入 Text Mode。
- ElevenAgents 断开时自动重连 3 次，失败提示“角色睡着了，点我唤醒”。
- Custom LLM Endpoint 无响应时 fallback 到 built-in 模型。
- 接入儿童友好内容过滤：输入过滤、模型输出过滤、敏感场景拒答。
- 设置单次对话时长、空闲超时、家长提示与安全说明。

## 阶段 8：设置与本地存储
- API Keys 管理：ElevenLabs、D-ID；图像生成密钥走高级配置并加密保存。
- 用 Web Crypto AES-GCM 加密 Key，不在明文中保存。
- Key 验证：ElevenLabs GET /v1/user、D-ID GET /avatars、生图测试请求。
- LLM Source 支持 built-in / custom，Custom 支持 API Key 与 OpenAI-compatible endpoint。
- IndexedDB 保存角色、聊天历史、图片资产索引、最后续聊时间。
- 实现数据导出、清空、隐私说明。

## 阶段 9：测试、性能与发布
- 单元测试：颜色采样、Prompt 组装、图像请求体、状态机分支。
- 组件测试：绘画、风格选择、设置验证、Text Mode、错误提示。
- E2E 冒烟：创建角色 → 变身 → 人格 → 进入聊天。
- 性能优化：图片压缩、懒加载、WebRTC 资源释放、IndexedDB 清理。
- 发布准备：环境变量说明、部署文档、演示脚本、黑客松提交材料。
