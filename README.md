# AI Word - 智能文档创作助手

<div align="center">

**AI 驱动的 Markdown 编辑器，内置 Agent 级智能工作流**

[![React](https://img.shields.io/badge/React-19.2.0-61DAFB?style=flat-square&logo=react)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-7.3.1-646CFF?style=flat-square&logo=vite)](https://vitejs.dev/)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

[✨ 核心亮点](#-核心亮点) • [功能特性](#功能特性) • [快速开始](#快速开始) • [使用指南](#使用指南) • [技术栈](#技术栈) • [贡献指南](#贡献指南)

</div>

---

## 项目简介

**AI Word** 是一款现代化的 Markdown 文档编辑器，深度集成了人工智能能力。它不仅提供流畅的 Markdown 编辑体验，还内置了 **Agent 级的 AI 工作流引擎**，让 AI 能够自主完成复杂的文档编辑任务。

### 核心亮点 ⚡

#### 1. AI 工作流引擎（最厉害的功能！）
- **自主决策** - AI 自动分析需求，规划执行步骤
- **多步操作** - 支持获取文档、插入内容、删除行、替换内容等连续操作
- **事务机制** - 所有操作可回滚，安全可靠
- **智能验证** - 自动检查任务是否完成，必要时继续优化
- **可视化面板** - 实时展示 AI 决策过程、操作记录和日志

#### 2. 多模型支持
- 支持 OpenAI、Anthropic Claude、Azure OpenAI、Ollama 本地模型等多种 AI 服务
- 兼容所有 OpenAI 格式的 API

#### 3. 强大的文档编辑功能
- 实时预览，编辑与预览同步
- 一键美化、局部编辑、Diff 对比
- 支持导出 Markdown、HTML、PDF、Word 格式

### 项目背景

在数字化写作时代，Markdown 因其简洁优雅的语法成为技术文档、博客文章的首选格式。然而，传统的 Markdown 编辑器功能单一，缺乏智能辅助能力。AI Word 应运而生，将先进的 AI 技术与 Markdown 编辑完美结合，为用户打造智能化的写作环境。

### 核心价值

- **智能增强** - AI 助手帮你优化文本、扩展内容、润色语言
- **Agent 级工作流** - AI 自主完成复杂任务，无需一步步操作
- **实时预览** - 编辑与预览同步，所见即所得
- **本地存储** - 数据安全存储在本地 IndexedDB，容量大性能好
- **开箱即用** - 无需复杂配置，快速上手

---

## 功能特性

### ⚡ AI 工作流引擎（核心功能）

这是项目最厉害的功能！一个完整的 Agent 级智能工作流系统：

#### 工作流特性
- **自主决策** - AI 自动分析用户需求，规划执行步骤
- **多步操作** - 支持获取文档、插入内容、删除行、替换内容等连续操作
- **事务机制** - 所有操作支持回滚，安全可靠
- **智能验证** - 自动检查任务是否完成，必要时继续优化
- **容错处理** - JSON 智能修复、备用解析策略、自动重试
- **进度追踪** - 实时显示迭代次数、进度分数、验证次数

#### 可视化面板
- 🧠 **AI 决策过程** - 展示每一轮的分析和决策
- 🔧 **操作记录** - 记录执行的所有操作
- 📋 **详细日志** - 完整的执行日志
- 📝 **修改预览** - Diff 对比视图，确认后再应用
- 🤖 **AI 总结** - 自动生成任务总结

#### 可用的 MCP 函数
AI 可以调用以下函数来操作文档：

| 函数名 | 功能描述 |
|--------|----------|
| `getDocumentById` | 根据文档 ID 获取完整内容 |
| `getAllDocument` | 获取所有文档的元数据信息 |
| `insertEnd` | 在文档末尾追加内容 |
| `deleteByRange` | 删除指定行范围的内容 |
| `deleteAndSwap` | 删除指定行并替换为新内容 |

### 文档管理

- 创建、编辑、删除 Markdown 文档
- 文档自动保存到 IndexedDB（容量更大，性能更好）
- 支持从 localStorage 迁移数据
- 文档列表展示，支持快速切换

### Markdown 编辑器

- 实时预览，编辑与预览分栏显示
- 支持拖拽调整编辑器与预览区比例
- 完整支持 GFM (GitHub Flavored Markdown)
  - 表格、任务列表、删除线
  - 代码块语法高亮
  - 自动链接转换

### AI 智能功能

#### AI 助手面板
- 输入自然语言指令，AI 生成内容
- 支持流式输出，实时显示生成进度
- 一键将 AI 生成内容插入文档

#### 一键美化
- 选中文本后点击美化按钮
- AI 自动优化文本表达，使其更专业流畅

#### 局部编辑
- 选中文本后输入自定义指令
- 支持翻译、扩写、缩写、改写等多种操作
- Diff 对比视图，修改前后一目了然

### 多 AI 服务商支持

| 服务商 | 特点 | 模型列表 |
|--------|------|----------|
| OpenAI | GPT 系列模型 | 自动拉取 |
| Anthropic | Claude 系列模型 | 手动输入 |
| Azure OpenAI | 企业级部署 | 手动输入 |
| Ollama | 本地运行，隐私安全 | 自动拉取 |
| 自定义 | OpenAI 兼容接口 | 自动拉取 |

### 模型参数配置

- Temperature - 控制输出随机性
- Max Tokens - 最大生成长度
- Top P - 核采样参数
- Frequency Penalty - 频率惩罚
- Presence Penalty - 存在惩罚

---

## 快速开始

### 环境要求

- Node.js >= 18.0.0
- npm >= 9.0.0 或 pnpm >= 8.0.0

### 安装步骤

1. **克隆项目**

```bash
git clone https://github.com/your-username/ai-word.git
cd ai-word
```

2. **安装依赖**

```bash
npm install
# 或使用 pnpm
pnpm install
```

3. **启动开发服务器**

```bash
npm run dev
```

4. **访问应用**

打开浏览器访问 `http://localhost:5173`

### 构建生产版本

```bash
npm run build
npm run preview
```

---

## 使用指南

### 基础操作

#### 创建新文档

1. 点击左侧边栏的「+ 新建」按钮
2. 输入文档标题
3. 按 Enter 确认或点击 ✓ 按钮

#### 编辑文档

- 在左侧编辑区输入 Markdown 内容
- 右侧预览区实时显示渲染效果
- 内容自动保存到本地存储

#### 删除文档

- 点击文档卡片右侧的垃圾桶图标
- 确认删除操作

### AI 功能使用

#### 配置 AI 服务

1. 点击右上角 ⚙️ 设置按钮
2. 选择 AI 服务商
3. 输入 API Key
4. 配置 Base URL（可选，使用默认值）
5. 点击「拉取模型」获取可用模型列表
6. 选择要使用的模型
7. 调整模型参数（可选）
8. 点击「保存并关闭」

#### 使用 AI 工作流（最推荐！）

这是项目最强大的功能，AI 会自主完成复杂任务！

1. 点击右上角 ⚡ 按钮打开 AI 工作流面板
2. 在输入框中描述你的需求，例如：
   - 「在文档末尾添加一段关于人工智能的介绍」
   - 「删除文档的第 3 到第 5 行，然后在末尾添加总结」
   - 「把第 2 到第 3 行替换为更正式的内容」
3. 点击「🚀 开始」按钮
4. 观察 AI 的执行过程：
   - 🧠 查看 AI 决策过程
   - 🔧 查看操作记录
   - 📋 查看详细日志
5. 任务完成后，在 Diff 对比视图中查看修改
6. 点击「✅ 接受修改」应用更改，或「❌ 拒绝修改」撤销

**工作流原理：**
- AI 自动分析需求 → 规划执行步骤 → 调用 MCP 函数 → 验证结果 → 循环直到完成
- 所有操作都在事务中，可随时回滚
- AI 会自动验证任务是否满足要求

#### 使用 AI 助手

1. 点击右上角 🤖 按钮打开 AI 面板
2. 在输入框中描述你的需求
   - 例如：「帮我写一段关于人工智能的介绍」
   - 例如：「继续扩展这段内容」
3. 点击「生成」或按 Ctrl + Enter
4. 查看生成的结果
5. 点击「插入文档」将内容添加到当前文档

#### 一键美化文本

1. 在编辑器中选中需要美化的文本
2. 点击编辑器顶部的「✨ 一键美化」按钮
3. 等待 AI 处理完成
4. 在 Diff 对比视图中查看修改
5. 点击「确认替代」应用修改，或「放弃修改」取消

#### 局部编辑

1. 在编辑器中选中文本
2. 点击「🎨 局部编辑」按钮
3. 输入你的指令
   - 例如：「翻译成英文」
   - 例如：「改成更正式的语气」
   - 例如：「总结成一句话」
4. 点击「生成」
5. 在 Diff 对比视图中确认修改

### 快捷键

| 快捷键 | 功能 |
|--------|------|
| Ctrl + Enter | 发送 AI 请求 |
| Escape | 取消输入/关闭弹窗 |

---

## 技术栈

### 前端框架

- **React 19** - 最新的 React 版本，支持并发特性
- **Vite 7** - 下一代前端构建工具，极速开发体验

### 核心依赖

| 依赖 | 版本 | 用途 |
|------|------|------|
| react-markdown | 10.1.0 | Markdown 渲染 |
| remark-gfm | 4.0.1 | GFM 语法支持 |
| idb | 8.0.3 | IndexedDB 封装，本地数据存储 |
| react-diff-viewer-continued | 4.1.2 | Diff 对比视图 |
| react-hot-toast | 2.6.0 | 消息提示 |
| docx | 9.5.3 | Word 文档导出 |
| jspdf | 4.1.0 | PDF 导出 |
| html2canvas | 1.4.1 | 截图功能 |
| file-saver | 2.0.5 | 文件下载 |
| marked | 17.0.2 | Markdown 解析 |

### 开发工具

- **ESLint** - 代码质量检查
- **Vitest** - 单元测试框架
- **@vitejs/plugin-react** - React Fast Refresh
- **jsdom** - 测试环境 DOM 模拟

---

## 项目结构

```
ai-word/
├── public/                 # 静态资源
│   └── vite.svg           # 网站图标
├── src/
│   ├── assets/            # 资源文件
│   │   └── react.svg
│   ├── components/        # React 组件
│   │   ├── AIWorkflowPanel.jsx    # AI 工作流面板
│   │   ├── AiPanel.jsx            # AI 助手面板
│   │   ├── DiffHighlighter.jsx    # Diff 高亮组件
│   │   ├── DiffModal.jsx          # Diff 对比弹窗
│   │   ├── EditorPane.jsx         # 编辑器面板
│   │   ├── ExportMenu.jsx         # 导出菜单
│   │   ├── LocalEditPanel.jsx     # 局部编辑面板
│   │   ├── SettingsModal.jsx      # 设置弹窗
│   │   └── Sidebar.jsx            # 侧边栏
│   ├── hooks/             # 自定义 Hooks
│   │   ├── useAIWorkflow.js       # AI 工作流 Hook
│   │   ├── useDocuments.js        # 文档管理 Hook
│   │   ├── useLLMConfig.js        # LLM 配置 Hook
│   │   ├── usePerformance.js      # 性能 Hook
│   │   └── useUndoRedo.js         # 撤销重做 Hook
│   ├── utils/             # 工具函数
│   │   ├── aiWorkflow.js          # AI 工作流引擎（核心）
│   │   ├── aiWorkflow.test.js     # 工作流测试
│   │   ├── api.js                 # API 请求
│   │   ├── db.js                  # IndexedDB 数据库
│   │   ├── db.test.js             # 数据库测试
│   │   ├── exportUtils.js         # 导出工具
│   │   ├── mcpFunctions.js        # MCP 函数系统
│   │   ├── mcpFunctions.test.js   # MCP 函数测试
│   │   └── toast.js               # 消息提示
│   ├── constants/         # 常量定义
│   │   └── index.js
│   ├── App.jsx            # 主应用组件
│   ├── App.css            # 应用样式
│   ├── index.css          # 全局样式
│   └── main.jsx           # 应用入口
├── index.html             # HTML 模板
├── package.json           # 项目配置
├── vite.config.js         # Vite 配置
├── eslint.config.js       # ESLint 配置
└── README.md              # 项目文档
```
---

## 常见问题

### Q: API Key 安全吗？

A: API Key 存储在浏览器 localStorage 中，仅在你的本地浏览器中保存，不会上传到任何服务器。但请注意不要在公共电脑上保存敏感信息。

### Q: 支持哪些 AI 模型？

A: 支持所有 OpenAI 兼容的 API，包括 OpenAI GPT 系列、Anthropic Claude 系列、Azure OpenAI、Ollama 本地模型等。

### Q: 数据会丢失吗？

A: 文档数据保存在浏览器本地存储中，只要不清除浏览器数据，文档就会一直保留。建议定期导出重要文档作为备份。

### Q: 如何使用本地模型？

A: 安装 Ollama 并下载模型后，在设置中选择「Ollama (本地)」服务商，确保 Ollama 服务运行在默认端口 11434 即可。

---

## 路线图

### ✅ 已完成
- [x] 支持文档导出（Markdown、HTML、PDF、Word）
- [x] 添加撤销/重做功能
- [x] AI 工作流引擎（Agent 级智能系统）
- [x] MCP 函数系统
- [x] 事务机制与回滚
- [x] IndexedDB 本地存储
- [x] Diff 对比视图

### 🚧 计划中
- [ ] 支持多种主题切换
- [ ] 添加文档搜索功能
- [ ] 支持图片上传和管理
- [ ] 添加协作编辑功能
- [ ] 国际化支持（i18n）
- [ ] 移动端适配优化

---

## 许可证

本项目基于 [MIT License](LICENSE) 开源。



<div align="center">

**如果这个项目对你有帮助，请给一个 ⭐ Star 支持一下！**

Made with ❤️ by AI Word Team

</div>
