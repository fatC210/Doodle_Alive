# Doodle Alive 部署说明

## 目标

Doodle Alive 是零服务端存储应用。部署后，用户在浏览器 Settings 中填入自己的 ElevenLabs、D-ID API Key，并在 Advanced Configuration 中填写图像生成端点、模型和 API 密钥；密钥使用 AES-GCM 加密保存在本机 localStorage，角色档案、图片和聊天历史保存在 IndexedDB。

## 本地运行

```bash
npm install
npm run dev
```

默认打开 `http://localhost:3000`。

## 生产构建

```bash
npm run lint
npm run test
npm run build
```

当前版本会直接从浏览器调用第三方 API。真实上线给儿童使用前，应增加家长同意、额度限制和服务端代理层；黑客松演示模式下不需要后端数据库。

## 必填 Key

- ElevenLabs API Key：Settings → API Keys & Connections，用于 `/v1/user` 验证、ElevenAgents、STT/TTS。
- D-ID API Key：Settings → API Keys & Connections，用于 avatar/streaming 校验。
- 图像生成 API 密钥：用于所选图片生成服务，在 Advanced Configuration 中配置。

## 演示建议

- 确认三类 API Key 均已保存并通过连接测试。
- 使用真实 D-ID Streaming 时，Image Provider 应返回可公开访问的 HTTPS 图片 URL；本地 data URL 不能被 D-ID 拉取。
- 页面关闭或点击 End Chat 会释放麦克风 MediaStream。
