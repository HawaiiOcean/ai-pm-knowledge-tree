# 知枝 · AI 产品知识树

从大语言模型的根系出发，沿着上下文、知识检索与智能体的枝干，长出产品判断。

一个面向中文 AI 产品经理的交互学习网站。无需 API Key、数据库、登录或付费模型接口，所有核心功能都在浏览器内运行。

在线访问：https://hawaiiocean.github.io/ai-pm-knowledge-tree/

## 功能

- 用树干、分枝和十片章节叶子呈现的知识树；树上仅显示大章节名称，点击后进入知识点。支持拖动、缩放、触控和键盘平移。
- 每个节点包含中英文术语、定义、产品案例、PM 追问、误区、自测和延伸来源。
- 基础入门、企业知识库、任务型 Agent、面试复习四条学习路线。
- 中英文全文搜索，知识清单，单个知识点链接（`#node/rag-intro`）。
- 阅读和自测通过分开记录；支持收藏、复习、学习记录 JSON 导入导出。
- 适配桌面与移动端，支持键盘操作与减少动画偏好。

## 本地运行

使用 Node.js 20 或以上版本，无需安装依赖：

```sh
npm start
```

访问终端显示的 `http://127.0.0.1:4173`。可以通过 `PORT` 环境变量指定端口。ES 模块需要 HTTP 服务，不要直接双击 HTML。

```sh
npm test
npm run build
```

`build` 对静态产物进行语法和资源检查，`dist/` 本身就是完整发布目录。

## GitHub Pages 部署

仓库已包含 `.github/workflows/pages.yml`。在 GitHub 仓库的 **Settings → Pages → Source** 选择 **GitHub Actions**，推送 `main` 或手动运行工作流即可。Pull Request 只验证，不发布。

```sh
git clone https://github.com/HawaiiOcean/ai-pm-knowledge-tree.git
cd ai-pm-knowledge-tree
npm start
```

所有资源使用相对路径，兼容 GitHub Pages 的项目子路径。也可以将 `dist/` 直接发布到任意静态托管服务。部署实现依据 [GitHub Pages 官方工作流文档](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。

## 项目结构

```text
dist/
  index.html       页面语义结构
  styles.css       响应式视觉与地图样式
  app.js           地图、阅读面板、路线和交互
  content.js       知识卡片、领域、学习路线和来源
  state.js         进度数据清洗与搜索
  tree-layout.js   章节叶片与树枝共用的布局坐标
scripts/
  serve.mjs        本地静态服务器
  check.mjs        发布前检查
tests/
  content.test.js  内容完整性、路径引用、搜索与进度导入测试
.github/workflows/pages.yml
```

## 补充知识内容

在 `dist/content.js` 的 `nodes` 中添加 `n(...)` 条目，提供唯一 ID、所属分支、中英文标题、概念解释、案例、PM 追问、误区、独立自测与关联节点。`groups` 定义章节信息，`tree-layout.js` 定义叶片位置和配色，`routes` 定义学习路径。提交前运行 `npm test` 校验引用和内容完整性。

内容按学习认知组织，树的空间位置不代表系统执行顺序。评测、工程和安全需要贯穿整个产品过程。文中的情境为教学示例，不是性能实测；模型接口、法规和价格等具体信息需以当前官方资料为准。每个知识点都提供原始资料入口与更新时间。

## 学习数据与隐私

学习进度仅保存在当前浏览器的 `localStorage` 中，不上传服务器、不同浏览器不自动同步。可从侧栏或“我的复习”导出备份，再导入到另一台设备；合并时保留既有自测通过状态。清除浏览器数据会删除未备份进度。

本站无第三方分析脚本、外部字体或运行时依赖。外链由用户主动打开，网站代码不调用模型服务。

## License

MIT。第三方论文与文档链接的内容遵循其各自的授权。
