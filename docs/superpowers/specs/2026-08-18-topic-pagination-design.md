# 帖子页分页组件改造设计

日期：2026-08-18
状态：待用户复核

## 背景与目标

NGA-MoFish 扩展的帖子详情页（webview）目前把分页拆成两部分展示：底部一组“上一页/下一页”链接，以及一段把所有页码平铺渲染的 `.pages`（第1页…第N页）。当帖子页数多时，平铺页码很长、很占空间；且顶部没有分页，浏览回复需要滚到底部才能翻页。

本次改造目标：

1. 分页改为“页码窗口 + 省略号 + 输入跳转”的紧凑形态。
2. 在回帖区域上方（编辑框之前）增加同一组分页。
3. 在上一页/下一页按钮右侧增加刷新页面按钮。

## 现状

- 模板：`html/topic.html`、`html/topic-spic.html`（表情小图模式）都包含：
  - `{{if !topic.onlyAuthor && topic.needTurn}}` 下的 `.pageUp` / `.pageDown` 链接（第1页只显示下一页，末页只显示上一页）。
  - `{{if !topic.onlyAuthor}}` 下的 `.pages` 平铺循环：`<% for(var i = 1; i <= topic.pages; i++){ %>`。
- 样式：`.pages`、`.pageUp`、`.pageDown`、`.pages a`、`.pages b` 在 `html/topic-themes.css` 中定义，普通主题与 terminal 主题两段都有；`html/topic.less` 中的 `.page` 类未被模板使用。
- 消息：`pageTurning`（切页）与 `refresh`（刷新当前页）在 `src/commands/topicItemClick.ts` 已有处理，可直接复用。
- 数据：`TopicDetail` 提供 `pages`（总页数）、`pageNow`（当前页）、`onlyAuthor`（只看楼主）、`needTurn`（是否还需翻页）。

## 设计

### 组件结构（顶部/底部同一份标记）

```
<div class="pages">
  <a class="pageUp">上一页</a>
  <a>1</a><span class="page-ellipsis">…</span><a>4</a><a>5</a><b>6</b><a>7</a><a>8</a><span class="page-ellipsis">…</span><a>30</a>
  <a class="pageDown">下一页</a>
  <a class="page-refresh" title="刷新当前页面">刷新</a>
  <span class="page-jump">跳至 <input type="number" min="1" max="30" /> 页 <button>跳转</button></span>
</div>
```

- 页码窗口算法（在 art-template `<% %>` 内计算，生成 `pageList` 数组供 `{{each}}` 渲染）：
  - 总页数 ≤ 7：显示 1..pages 全部。
  - 否则：显示 1、(pageNow-2..pageNow+2)、pages；中间空缺用省略号占位。
  - 当前页渲染为 `<b>`，其余为 `<a>`。
- 上一页/下一页始终渲染；第 1 页时上一页置灰禁用，末页时下一页置灰禁用（`is-disabled` 类，无点击行为）。原“边界隐藏”行为废除，保证按钮与刷新位置稳定。
- 刷新：`vsPostMessage('refresh', { page: topic.pageNow })`，复用现有 `refresh` 消息。
- 跳转：输入框支持回车与“跳转”按钮，读取页码并夹取到 1..pages 后发送 `pageTurning`。

### 放置位置

- 顶部：`topic-toolbar` 后的 `<hr />` 与 `<section class="reply-composer">` 之间。
- 底部：替换现有的 `.pageUp/.pageDown` 块与 `.pages` 平铺块，位于回复列表之后。
- 显示条件：`{{if !topic.onlyAuthor && topic.pages > 1}}`。只看楼主隐藏；单页帖子不再渲染分页（含“第1页”）。

### 样式

- 沿用 `.pages` 容器（flex、gap 8px）与 `.pageUp/.pageDown/.pages a/.pages b` 现有主题样式。
- `html/topic-themes.css` 新增：
  - `.page-ellipsis`：省略号占位样式。
  - `.is-disabled`：置灰、`pointer-events: none`、无 hover 效果。
  - `.page-refresh`、`.page-jump input`、`.page-jump button`：与现有分页按钮视觉一致（border、padding、字号 12px、主题变量）。
- 普通主题段与 `body[data-topic-theme="terminal"]` 段同步补充。

### JavaScript

- `html/topic.js` 与 `html/topic-spic.js` 各新增 `jumpToPage()`：读取分页输入框值 → 数值校验并夹取到 [1, pages] → `vsPostMessage('pageTurning', { page })`。
- 模板中跳转按钮与输入框通过 `onclick="jumpToPage(this)"`、回车键触发；页面中同时存在顶部/底部两个组件，函数内通过事件元素向上定位到所在 `.pages` 容器再取输入框，避免重复 ID 冲突。

### 错误处理

- 跳转输入非数字或越界：夹取到合法范围；输入为空时不发送。
- 网络/加载失败：沿用现有 `loadTopicInPanel` 的错误页逻辑，不新增处理。

## 改动文件

- `html/topic.html`
- `html/topic-spic.html`
- `html/topic-themes.css`
- `html/topic.js`
- `html/topic-spic.js`

不涉及 TypeScript / 后端逻辑改动。

## 验证

1. `npm run compile`（确认扩展编译通过；本方案不改 TS，但作为回归检查）。
2. VSCode 扩展开发宿主（F5）手动验证：
   - 多页帖子：顶部/底部均出现分页组件；页码窗口与省略号正确；当前页高亮。
   - 第 1 页：上一页禁用；末页：下一页禁用。
   - 输入跳转（按钮与回车）正确切页；越界值被夹取。
   - 刷新按钮重新加载当前页。
   - 只看楼主：分页隐藏。
   - `topic.html` 与 `topic-spic.html`（设置里切换表情模式）行为一致。
   - editor / source / terminal 三套主题下样式正常。

## 非目标（Out of scope）

- 不改变 NGA 数据获取、翻页消息或缓存逻辑。
- 不调整顶部工具栏已有的“刷新页面”链接。
- 不引入新的依赖或构建步骤。
