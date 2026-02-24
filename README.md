# DKU Tarot (cs307bk2)

一个为 DKU 校园场景定制的塔罗牌网页应用：支持 **手势识别选牌**（MediaPipe Hands）+ **AI Oracle 流式解读**（SSE streaming），并针对 Daily / Course / Lost&Found / Next Steps 提供不同的提示词与解读风格。

## 功能一览

- **Landing 模块选择**：`index.html` 展示 4 个入口卡片
- **Reading 选牌 + 展示位**：`reading.html` 在牌列中选牌，卡牌会动画飞入展示位
- **手势交互（摄像头小窗）**
  - Open Palm：移动光标/控制牌列位置
  - Swipe Left/Right：牌列左右滑动
  - Fist（握拳并保持约 1s）：选中当前 hover 的牌/模块
- **AI Chat（Oracle）**：选满卡牌后弹出聊天面板，自动生成解读；支持 Markdown 渲染
- **本地设置**：右上角/齿轮按钮打开 Settings，配置 API Endpoint / API Key / Model（保存到 `localStorage`）


## AI 接口配置

本项目的前端请求格式是 **OpenAI Chat Completions + `stream: true`（SSE）**：

- 设置入口：页面上的 Settings（齿轮）
- 默认值在 `js/config.js`：
  - API Endpoint：`https://api.openai.com/v1/chat/completions`
  - Model：`gpt-4o-mini`

### 使用自带本地代理（Anthropic）

仓库提供了一个本地代理 `proxy.py`，用于把 **OpenAI 格式**请求转换成 **Anthropic** 的 streaming 响应。

启动：

```bash
python3 proxy.py
```

然后在 Settings 里设置：

- API Endpoint：`http://localhost:8787/v1/chat/completions`
- API Key：填你的 Anthropic key（会作为 `Authorization: Bearer ...` 被代理转发为 `x-api-key`）
- Model：例如 `claude-sonnet-4-5-20250929`（代理里有默认值）

## 手势与摄像头

- Landing（`index.html`）与 Reading（`reading.html`）都会显示左下角摄像头小窗
- 手势识别基于 MediaPipe Hands（CDN 引入）：
  - `@mediapipe/camera_utils`
  - `@mediapipe/drawing_utils`
  - `@mediapipe/hands`

隐私提示：摄像头画面只用于本地手势识别与 UI 反馈（video/canvas 预览），不会由本项目主动上传；但你配置的 AI Endpoint/代理可能会发送你输入的聊天内容与抽到的牌面摘要。

## 项目结构

- `index.html`：首页模块入口
- `reading.html`：抽牌/选牌页面 + chat overlay
- `css/`
  - `landing.css`：首页样式
  - `reading.css`：选牌页布局、摄像头小窗、动画、overlay
  - `cards.css`：卡牌尺寸与翻转效果
  - `chat.css`：聊天 UI
  - `variables.css` / `base.css`：全局变量与基础样式
- `js/`
  - `landing.js`：首页动画 + 手势选模块
  - `reading.js`：选牌逻辑、手势控制牌列、选满后触发解读
  - `gesture-engine.js`：MediaPipe Hands 封装（Open Palm / Fist / Swipe）
  - `card-engine.js`：渲染卡牌与牌列、生成抽牌摘要
  - `chat-engine.js`：SSE 流式聊天（OpenAI 格式）
  - `config.js`：Settings + `localStorage` 配置
  - `prompts.js`：DKU 场景系统提示词与各 section 文案
  - `tarot-data.js`：大阿卡纳数据
- `assets/tarot/pkt/`：塔罗牌图片资源
- `proxy.py`：本地 API 代理（OpenAI→Anthropic）

## 常见问题排查

- **看不到摄像头画面**：
  - 浏览器地址栏允许摄像头权限；Mac 上检查系统设置 → 隐私与安全 → 摄像头
- **手势识别不稳定**：光线不足/背光会显著影响；建议手掌完整入镜，离镜头 40–80cm
- **聊天报错 `API error ...`**：检查 Settings 中 API Endpoint/Key/Model 是否正确；如用 `proxy.py`，确认代理正在运行且端口是 `8787`

---

维护建议：`css/reading.css` 历史上出现过重复样式块，后续如果要大改布局，建议先做一次去重整理，避免“后定义覆盖前定义”带来的困惑。
