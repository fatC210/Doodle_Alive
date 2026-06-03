# 黑客松演示脚本

## 1. 开场

Doodle Alive lets a child draw a face, choose an art style, and turn the drawing into a talking animated character powered by D-ID and ElevenLabs.

## 2. 准备

1. 打开 Settings。
2. 填入 ElevenLabs API Key、D-ID API Key。
3. 点击每个 Test，确认状态为 Valid。
4. 在 Advanced Configuration 中填写图像生成端点、模型和 API 密钥，并确认选择真实服务。

## 3. 创建角色

1. 点击 New Character。
2. 在画布中画一个居中的正脸，眼睛睁开，嘴巴闭合。
3. 点击 Continue to Style。
4. 选择 美式学院 或 水彩。
5. 点击 Bring to Life。
6. Morphing 阶段会生成图并进行 D-ID face validation。

失败分支演示：如果校验失败，页面显示“角色还没准备好，试试画得更清楚或换个风格”，并回到绘画页保留草稿。

## 4. 选择人格

1. 选择 Brave Explorer、Mischievous Prankster、Gentle Guardian、Wacky Inventor 或 Cool Rebel。
2. 也可以点击 Skip for Random，系统会保存实际随机结果。
3. 点击 Start Chatting。

## 5. 实时对话

1. 点击麦克风开始监听。
2. 用户气泡显示转写文本，角色气泡显示回复文本。
3. 如果麦克风被拒绝，自动切换到文字模式。
4. 使用 Text instead 展开兜底输入框。
5. 点击 Wake up 演示断线后的 3 次自动重连 UI。
6. 点击 End Chat，释放音视频资源。

## 6. 续聊与刷新验证

1. 刷新页面。
2. 首页角色列表仍保留刚创建的角色。
3. 进入聊天页，聊天历史从 IndexedDB 恢复。
