# 人事管理系统欢迎页设计交接

## 设计结论

建议新增一个轻量欢迎工作台，作为用户进入系统后的第一屏：`/` 或 `/welcome` 展示欢迎页，主按钮进入现有 `/upload` 文件上传流程。Rotating Text 可以使用，但只作为主标题中的“动态关键词”，不要让它贯穿业务页持续播放。

这个系统是人事核算工具，核心任务是上传 Excel、计算升降级评分、查看评分与参培结果、追溯操作日志。视觉升级应该偏“专业、清晰、有一点智能感”，而不是做成营销官网或大面积炫技动画。

## 当前问题

当前界面优点是结构清楚，顶栏、侧栏、步骤页都比较直接。但整体观感偏普通后台：

- 首次进入直接到上传卡片，缺少任务导向和产品记忆点。
- 页面只有大白卡片 + 浅灰背景，层次感不足。
- 上传、计算、结果之间的关系主要靠左侧步骤表达，首屏没有告诉用户“这个系统能帮我完成什么”。
- 动效几乎没有，导致 AI 计算类工具显得比较静态。

## 推荐方案：欢迎工作台

### 页面定位

欢迎页不是落地页，也不是宣传页，而是“进入本次核算任务的入口”。用户打开系统后应立即知道三件事：

- 这个系统处理的是升降级评分与参培人数核算。
- 本次流程分为上传文件、AI 核算、查看结果。
- 可以从这里继续上次任务、开始新核算、查看历史日志。

### 信息架构

首屏建议分成 3 个区域：

1. 顶部欢迎区
   - 主标题：`让升降级核算更` + RotatingText
   - RotatingText 轮播词：`清晰`、`快速`、`可追溯`
   - 副标题：`上传月度 Excel 后，系统将并行计算入职评分与参培人数，并生成可下载结果。`
   - 主按钮：`开始上传`
   - 次按钮：`查看操作日志`

2. 流程入口区
   - 三个横向步骤：`文件上传`、`智能计算`、`结果核对`
   - 每个步骤使用 Ant Design 图标，不做嵌套卡片。
   - 当前没有任务时，突出 `文件上传`；有计算结果时，突出 `查看结果`。

3. 状态摘要区
   - 如果有本地 store 中的 `scoringResult`：显示 `最近一次计算已完成`、`查看结果`。
   - 如果 `processing.isProcessing`：显示 `计算进行中`、进度提示、进入上传页查看进度。
   - 如果没有任务：显示 `尚未开始本次核算`、引导上传文件。

## 进入和跳转

推荐路由策略：

- 新增 `Welcome` 页面。
- 将 `/` 从直接重定向 `/upload` 改为渲染欢迎页。
- 顶栏品牌点击回到 `/`。
- 顶栏 `升降级评分` 点击仍进入 `/upload`，保留效率入口。
- 欢迎页主按钮跳转 `/upload`。
- 欢迎页次按钮跳转 `/logs`。
- 如果用户已经在 `/upload`、`/scoring`、`/assessment`，左侧步骤保持现状。

也可以选择新增 `/welcome`，然后 `/` 重定向 `/welcome`。但从产品心智上，直接让 `/` 是欢迎工作台更自然。

## Rotating Text 使用建议

可以用，适合放在主标题里：

```tsx
<h1 className={styles.heroTitle}>
  让升降级核算更
  <RotatingText
    texts={['清晰', '快速', '可追溯']}
    mainClassName={styles.rotatingText}
    splitLevelClassName={styles.rotatingTextWord}
    initial={{ y: '100%', opacity: 0 }}
    animate={{ y: 0, opacity: 1 }}
    exit={{ y: '-120%', opacity: 0 }}
    transition={{ type: 'spring', damping: 30, stiffness: 400 }}
    rotationInterval={2200}
    staggerDuration={0.02}
    staggerFrom="last"
    splitBy="characters"
    auto
    loop
  />
</h1>
```

不建议使用官网示例里的 Tailwind class 字符串，比如 `px-2 bg-cyan-300 rounded-lg`，因为当前项目主要使用 CSS Modules + Ant Design。建议改成 CSS Modules：

```css
.rotatingText {
  display: inline-flex;
  align-items: center;
  margin-left: 10px;
  padding: 4px 12px;
  border-radius: 8px;
  color: #063b74;
  background: linear-gradient(180deg, #e6f4ff 0%, #d6ecff 100%);
  box-shadow: inset 0 0 0 1px rgba(22, 119, 255, 0.16);
}

.rotatingTextWord {
  overflow: hidden;
  padding-bottom: 2px;
}
```

实现注意：

- 你贴的组件引入的是 `motion/react`，项目当前没有 `motion` 依赖，需要安装。
- 如果不想新增依赖，可以不用 ReactBits，改成 CSS keyframes 做简单淡入上移，但效果会弱一些。
- 动画只在欢迎页主标题使用，不要在上传区、表格区和日志区循环播放。
- `rotationInterval` 建议 2200-2800ms，太快会显得不稳重。
- 给 `prefers-reduced-motion` 用户提供降级：停止轮播或只显示第一个词。

## 视觉风格

保留现有深色顶栏和 Ant Design 体系，但欢迎页可以比业务页更有层次。

### 色彩

建议从现有蓝色 `#1677ff` 延展，而不是换一套品牌色：

- 顶栏：继续使用深蓝黑。
- 页面背景：`#f5f7fb`，延续现有上传页。
- 主强调色：`#1677ff`。
- 辅助成功色：`#52c41a`，用于流程完成和结果可查看。
- 数据提示色：少量使用青蓝、绿色，不要整页都变成蓝色。

### 首屏布局

桌面端：

- 内容最大宽度 1300px，与现有业务卡片对齐。
- 上方欢迎区高度控制在 280-340px，底部露出流程入口区，避免变成空洞大 hero。
- 欢迎区可以使用轻微渐变和细网格背景，但不要用大面积装饰球、漂浮光斑。

移动端：

- 主标题换行：`让升降级核算更` 独占一行，RotatingText 下一行显示。
- CTA 按钮纵向排列，宽度 100%。
- 三步骤改成纵向列表。

## 欢迎页线框

```text
┌──────────────────────────────────────────────────────────────┐
│ 人事管理系统     升降级评分                         操作日志 │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  让升降级核算更 [清晰/快速/可追溯]                           │
│  上传月度 Excel 后，系统将并行计算入职评分与参培人数...        │
│                                                              │
│  [开始上传]  [查看操作日志]                                   │
│                                                              │
│  最近状态：尚未开始本次核算 / 计算进行中 / 最近一次已完成       │
│                                                              │
│  文件上传  →  智能计算  →  结果核对                            │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## 页面文案

主标题：

`让升降级核算更 清晰`

轮播词：

- `清晰`
- `快速`
- `可追溯`

副标题：

`上传月度 Excel 文件后，系统将并行计算入职评分与参培人数，并生成可核对、可下载、可追溯的结果。`

按钮：

- 主按钮：`开始上传`
- 次按钮：`查看操作日志`
- 有结果时额外按钮：`查看计算结果`

状态文案：

- 空状态：`尚未开始本次核算`
- 处理中：`AI 正在计算入职评分与参培人数`
- 完成：`最近一次升降级评分已完成`

## 组件拆分建议

```text
src/pages/Welcome/
  index.tsx
  index.module.css

src/components/RotatingText/
  index.tsx
  RotatingText.css
```

`Welcome` 页面读取现有 store：

- `scoringSession.processing.isProcessing`
- `scoringSession.uploading`
- `scoringResult`
- `monthCards`

用于决定状态摘要和 CTA：

- 没有结果、没有处理中：主 CTA 到 `/upload`。
- 处理中：主 CTA 到 `/upload`，文案为 `查看计算进度`。
- 已有结果：主 CTA 到 `/assessment` 或 `/scoring`，旁边保留 `重新上传`。

## 前端实现清单

1. 安装依赖：

```bash
pnpm add motion
```

如果项目不用 pnpm，按当前包管理器替换为 npm 或 yarn。

2. 新增 RotatingText 组件。

使用你贴的 ReactBits 代码即可，但建议：

- 补上 TypeScript 类型。
- `Intl.Segmenter('en')` 可以改为 `Intl.Segmenter('zh', { granularity: 'grapheme' })`，中文轮播更贴近。
- `texts` 为空时做兜底，避免数组越界。

3. 新增 Welcome 页面。

视觉结构：

- 外层 `.container` 使用现有 `#f5f7fb` 背景。
- 内层 `.shell` 最大宽度 1300px。
- `.hero` 做轻量背景层，不做独立大卡片嵌套。
- 下方流程步骤可用三个同级 `section` 或简单 `div`。

4. 修改路由。

`src/router/index.tsx`：

- import `Welcome`
- 新增 index route component
- 不再把 `/` redirect 到 `/upload`

5. 修改 MainLayout。

建议：

- 顶栏 logo 点击 `navigate({ to: '/' })`。
- `SCORING_PAGES` 保持 `['/upload', '/scoring', '/assessment']`。
- 欢迎页不显示左侧步骤栏，让首屏更干净。

## 验收标准

- 打开 `/staff/` 看到欢迎工作台，而不是直接进入上传页。
- 主标题中的动态词正常轮播，页面没有横向抖动。
- 点击 `开始上传` 进入 `/upload`。
- 点击 `查看操作日志` 进入 `/logs`。
- 已有计算结果时，欢迎页能显示结果入口。
- 移动端 375px 宽度下标题、按钮、步骤不重叠。
- 未安装 `motion` 时构建会失败，所以必须确认依赖已加入。

## 设计取舍

这次不建议把当前上传页本身改成大欢迎页。上传页是高频操作页面，应该保持明确、干净、少干扰。欢迎页负责建立产品感和任务导向，业务页负责高效完成上传、计算和核对。这样既能解决“太素”的问题，又不会牺牲工具型系统的效率。
