# 帖子页分页组件改造 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 NGA-MoFish 帖子详情页的平铺分页改为“页码窗口 + 省略号 + 输入跳转 + 刷新”的统一组件，并同时出现在回帖区上方与回复列表下方。

**Architecture:** 纯前端 webview 改动。两个 art-template 模板（`html/topic.html` 普通模式、`html/topic-spic.html` 表情小图模式）各渲染两份同一标记的分页组件（顶部 + 底部）；页码窗口在模板 `<% %>` 内计算；跳转与刷新复用已有的 `pageTurning` / `refresh` 消息。样式追加到 `html/topic-themes.css`（普通主题与 terminal 主题两段）。不修改任何 TypeScript 代码。

**Tech Stack:** art-template（模板内 `<% %>` / `<%= %>` / `<%- %>` 原生语法）、原生 HTML/CSS/JS（webview）、mocha + assert（模板渲染回归测试，直跑不依赖 VS Code）。

## Global Constraints

- 显示条件固定为 `{{if !topic.onlyAuthor && topic.pages > 1}}`；只看楼主与单页帖子不渲染分页。
- 页码窗口规则：总页数 ≤ 7 全部显示；否则显示 `1 … (pageNow-2..pageNow+2) … N`，空缺处用 `<span class="page-ellipsis">…</span>`。
- 上一页/下一页始终渲染；第 1 页时上一页加 `is-disabled`，末页时下一页加 `is-disabled`，禁用态不输出 onclick。
- 刷新按钮：`onclick="vsPostMessage('refresh', {page: <%- topic.pageNow %>});"`，标题 `刷新当前页面`。
- 跳转：输入框（class `page-jump-input`，`type="number"`，`min=1`，`max=topic.pages`，`value=topic.pageNow`）+ 跳转按钮（class `page-jump-btn`，`onclick="jumpToPage(this)"`），输入框支持回车。
- **模板沙箱内不可用全局对象（如 `Math`）**：窗口计算必须只用运算符与三元表达式，不要写 `Math.max` / `Math.min` / `parseInt`。
- 两处组件标记必须完全一致（同一段代码复制两份）。
- 沿用现有 `.pages` 容器与 `.pageUp/.pageDown/.pages a/.pages b` 样式；新增类名：`page-ellipsis`、`is-disabled`、`page-refresh`、`page-jump`、`page-jump-input`、`page-jump-btn`。
- 样式必须同时补到普通主题段与 `body[data-topic-theme="terminal"]` 段。
- 不新增依赖、不修改 TS 源码、不修改 `topic.less`。
- 测试直跑命令：`npx mocha --ui tdd out/test/suite/<测试文件>.js`（不需要 vscode-test / 下载 VS Code）。

---

### Task 1: topic.html 分页组件（测试 + 模板 + 样式 + 跳转逻辑）

**Files:**
- Create: `src/test/suite/topicPagination.test.ts`
- Modify: `html/topic.html`（顶部：第 114 行 `<hr />` 与第 116 行 `<section class="reply-composer">` 之间插入；底部：替换第 256-276 行旧分页块）
- Modify: `html/topic-themes.css`（第 404-432 行 `.topic-toolbar, .pages` 段落之后；第 863-868 行 terminal 段落之后）
- Modify: `html/topic.js`（第 112 行 `function onSubmit()` 之前插入 `jumpToPage`）

**Interfaces:**
- Produces: `jumpToPage(el)` 全局函数（从点击元素向上找到 `.pages` 容器并读取 `.page-jump-input`，夹取到 [1, max] 后发送 `pageTurning`）；渲染产物包含两处 `class="pages"`、两处 `page-refresh`、两处 `page-jump-input`、当前页 `<b>N</b>`、省略号 `<span class="page-ellipsis">`。
- Consumes: 模板数据 `topic.onlyAuthor`、`topic.pages`、`topic.pageNow`；消息 `pageTurning` / `refresh`（已在 `src/commands/topicItemClick.ts` 处理，本任务不改）。

- [ ] **Step 1: 创建测试文件**

创建 `src/test/suite/topicPagination.test.ts`，内容如下（覆盖：窗口/省略号/当前页/刷新/跳转出现次数、首页与末页禁用、少页无省略号、只看楼主与单页隐藏）：

```ts
import * as assert from 'assert';
import * as path from 'path';
const template = require('art-template');

function buildTopic(overrides: any = {}): any {
  return {
    id: 47324782,
    title: '测试帖子',
    node: { title: '版块', name: 'fid' },
    user: { uid: '1', userNmae: '楼主', labels: [] },
    displayTime: '2026-08-18 00:00',
    content: '正文内容',
    likes: 0,
    replyCount: 100,
    replies: [],
    comments: [],
    onlyAuthor: false,
    pageNow: 6,
    needTurn: true,
    pages: 30,
    ...overrides
  };
}

function buildData(topic: any): any {
  return {
    topic,
    contextPath: '.',
    titleHeadingClass: 'topic-title-h1',
    topicTheme: 'editor',
    topicJson: JSON.stringify(topic),
    smilesJson: '{}',
    replyTargetsJson: '{}'
  };
}

function renderTemplate(templateName: string, topic: any): string {
  const templatePath = path.join(__dirname, '..', '..', '..', 'html', templateName);
  return template(templatePath, buildData(topic));
}

function assertPaginationRendered(html: string): void {
  assert.strictEqual((html.match(/class="pages"/g) || []).length, 2);
  assert.strictEqual((html.match(/page-ellipsis/g) || []).length, 2);
  assert.strictEqual((html.match(/<b>6<\/b>/g) || []).length, 2);
  assert.strictEqual((html.match(/page-refresh/g) || []).length, 2);
  assert.strictEqual((html.match(/page-jump-input/g) || []).length, 2);
  assert.strictEqual(html.includes('第30页'), false);
}

suite('帖子页分页组件 topic.html', () => {
  test('第6页/共30页渲染页码窗口、省略号、刷新与跳转', () => {
    const html = renderTemplate('topic.html', buildTopic());
    assertPaginationRendered(html);
  });

  test('首页禁用上一页、末页禁用下一页', () => {
    const first = renderTemplate('topic.html', buildTopic({ pageNow: 1 }));
    assert.strictEqual((first.match(/pageUp is-disabled/g) || []).length, 2);
    assert.strictEqual((first.match(/pageDown is-disabled/g) || []).length, 0);

    const last = renderTemplate('topic.html', buildTopic({ pageNow: 30 }));
    assert.strictEqual((last.match(/pageDown is-disabled/g) || []).length, 2);
    assert.strictEqual((last.match(/pageUp is-disabled/g) || []).length, 0);
  });

  test('页数少时无省略号且当前页高亮', () => {
    const html = renderTemplate('topic.html', buildTopic({ pageNow: 2, pages: 3 }));
    assert.strictEqual((html.match(/page-ellipsis/g) || []).length, 0);
    assert.strictEqual((html.match(/<b>2<\/b>/g) || []).length, 2);
  });

  test('只看楼主与单页帖子不渲染分页', () => {
    const onlyAuthor = renderTemplate('topic.html', buildTopic({ onlyAuthor: true }));
    assert.strictEqual((onlyAuthor.match(/class="pages"/g) || []).length, 0);

    const singlePage = renderTemplate('topic.html', buildTopic({ pageNow: 1, pages: 1 }));
    assert.strictEqual((singlePage.match(/class="pages"/g) || []).length, 0);
  });
});
```

- [ ] **Step 2: 编译并运行测试，确认失败**

Run:
```bash
npm run compile
npx mocha --ui tdd out/test/suite/topicPagination.test.js
```
Expected: FAIL。当前 `topic.html` 只有底部 1 个 `class="pages"`，且没有 `page-ellipsis` / `page-refresh` / `page-jump-input`，也没有 `<b>6</b>`（现为 `<b>第6页</b>`）。

- [ ] **Step 3: 在 topic.html 顶部插入分页组件**

在 `html/topic.html` 第 114 行 `<hr />` 与第 116 行 `<section class="reply-composer" id="replyComposer" ...>` 之间插入（保持两行缩进对齐）:

```html
    <!-- 分页（顶部） -->
    {{if !topic.onlyAuthor && topic.pages > 1}}
    <div class="pages">
      <% if (topic.pageNow > 1) { %>
      <a class="pageUp" href="javascript:;" onclick="vsPostMessage('pageTurning', {page: <%= topic.pageNow - 1 %>});" title="上一页">上一页</a>
      <% } else { %>
      <a class="pageUp is-disabled" href="javascript:;" title="上一页">上一页</a>
      <% } %>
      <%
        var pageList = [];
        if (topic.pages <= 7) {
          for (var i = 1; i <= topic.pages; i++) pageList.push(i);
        } else {
          pageList.push(1);
          var start = (topic.pageNow - 2 > 2) ? topic.pageNow - 2 : 2;
          var end = (topic.pageNow + 2 < topic.pages - 1) ? topic.pageNow + 2 : topic.pages - 1;
          if (start > 2) pageList.push(0);
          for (var i = start; i <= end; i++) pageList.push(i);
          if (end < topic.pages - 1) pageList.push(0);
          pageList.push(topic.pages);
        }
      %>
      <% for (var j = 0; j < pageList.length; j++) {
        var p = pageList[j];
        if (p === 0) { %>
          <span class="page-ellipsis">…</span>
        <% } else if (p === topic.pageNow) { %>
          <b><%- p %></b>
        <% } else { %>
          <a href="javascript:;" onclick="vsPostMessage('pageTurning', {page: <%- p %>});"><%- p %></a>
        <% } %>
      <% } %>
      <% if (topic.pageNow < topic.pages) { %>
      <a class="pageDown" href="javascript:;" onclick="vsPostMessage('pageTurning', {page: <%= topic.pageNow + 1 %>});" title="下一页">下一页</a>
      <% } else { %>
      <a class="pageDown is-disabled" href="javascript:;" title="下一页">下一页</a>
      <% } %>
      <a class="page-refresh" href="javascript:;" onclick="vsPostMessage('refresh', {page: <%= topic.pageNow %>});" title="刷新当前页面">刷新</a>
      <span class="page-jump">跳至 <input class="page-jump-input" type="number" min="1" max="<%= topic.pages %>" value="<%= topic.pageNow %>" onkeydown="if (event.key === 'Enter') jumpToPage(this);" /> 页 <button type="button" class="page-jump-btn" onclick="jumpToPage(this)">跳转</button></span>
    </div>
    {{/if}}
```

- [ ] **Step 4: 替换 topic.html 底部旧分页块**

把 `html/topic.html` 第 256-276 行整块（`{{if !topic.onlyAuthor && topic.needTurn}}` 到第二个 `{{/if}}`，含 `.pageUp/.pageDown` 链接与平铺 `.pages`）替换为与 Step 3 完全相同的组件块（注释改为 `<!-- 分页（底部） -->`，其余逐字一致）。注意：旧块中的 `<hr />`（第 263 行）一并删除，不要保留。

- [ ] **Step 5: 追加样式到 topic-themes.css**

在 `html/topic-themes.css` 第 432 行 `.topic-toolbar a:hover, .pageUp:hover, .pageDown:hover, .pages a:hover { background: var(--mofish-hover); }` 之后追加：

```css
.pages .page-ellipsis {
  padding: 2px 4px;
  color: var(--mofish-muted);
}

.pages .is-disabled {
  opacity: 0.45;
  pointer-events: none;
}

.pages .page-refresh,
.pages .page-jump button {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 2px 7px;
  border: 1px solid var(--mofish-border);
  border-radius: 2px;
  color: var(--mofish-editor-fg);
  background: var(--mofish-panel-bg);
  font-size: 12px;
  font-weight: 400;
  cursor: pointer;
}

.pages .page-jump {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--mofish-muted);
  font-size: 12px;
}

.pages .page-jump input {
  width: 56px;
  height: 24px;
  padding: 2px 6px;
  border: 1px solid var(--mofish-border);
  border-radius: 2px;
  box-sizing: border-box;
  background: var(--mofish-panel-bg);
  color: var(--mofish-editor-fg);
  font-size: 12px;
}

.pages .page-jump input:focus {
  outline: none;
  border-color: var(--vscode-focusBorder);
}
```

再在 terminal 主题段（第 868 行 `.pages b { border-style: dashed; ... }` 之后）追加：

```css
body[data-topic-theme="terminal"] .pages .page-refresh,
body[data-topic-theme="terminal"] .pages .page-jump button,
body[data-topic-theme="terminal"] .pages .page-jump input {
  border-style: dashed;
  background: transparent;
  font-family: var(--mofish-mono);
}
```

- [ ] **Step 6: 在 topic.js 添加 jumpToPage**

在 `html/topic.js` 第 112 行 `function onSubmit() {` 之前插入：

```js
// 分页跳转：读取当前组件输入框页码并夹取到合法范围
function jumpToPage(el) {
  const container = el.closest('.pages');
  if (!container) {
    return;
  }
  const input = container.querySelector('.page-jump-input');
  if (!input || !input.value.trim()) {
    return;
  }
  const page = parseInt(input.value, 10);
  if (isNaN(page)) {
    return;
  }
  const max = parseInt(input.max, 10) || 1;
  const clamped = Math.min(Math.max(page, 1), max);
  input.value = clamped;
  vsPostMessage('pageTurning', { page: clamped });
}
```

- [ ] **Step 7: 重新编译并运行测试，确认通过**

Run:
```bash
npm run compile
npx mocha --ui tdd out/test/suite/topicPagination.test.js
```
Expected: 4 tests PASS。

- [ ] **Step 8: 运行 lint**

Run:
```bash
npm run lint
```
Expected: 无错误。

- [ ] **Step 9: 手动验证（VSCode 扩展开发宿主 F5）**

逐项检查：
1. 打开一个总页数 > 7 的帖子：顶部（回帖编辑框上方）与底部各出现一组完整分页。
2. 第 6 页左右显示 `1 … 4 5 6 7 8 … N`，当前页加粗高亮，无平铺的“第1页…第N页”。
3. 第 1 页时“上一页”置灰不可点；末页时“下一页”置灰。
4. 输入页码点“跳转”或按回车正确翻页；输入 999 跳到末页，输入 0 / 负数跳到第 1 页。
5. 点“刷新”重新加载当前页。
6. 点“只看楼主”后分页隐藏。
7. editor / source / terminal 三套主题下组件样式正常（无错位、输入框可聚焦）。

- [ ] **Step 10: 提交**

```bash
git add html/topic.html html/topic-themes.css html/topic.js src/test/suite/topicPagination.test.ts
git commit -m "feat: 帖子页分页改为页码窗口+跳转+刷新 (topic.html)"
```

---

### Task 2: topic-spic.html 同步分页组件

**Files:**
- Modify: `src/test/suite/topicPagination.test.ts`（追加 spic 模板测试）
- Modify: `html/topic-spic.html`（顶部：第 108 行 `<hr />` 与第 110 行 `<section class="reply-composer">` 之间插入；底部：替换第 250-270 行旧分页块）
- Modify: `html/topic-spic.js`（第 121 行 `function onSubmit()` 之前插入 `jumpToPage`）

**Interfaces:**
- Consumes: Task 1 已加入的 `buildTopic()` / `buildData()` / `renderTemplate()` / `assertPaginationRendered()` 辅助函数（在同一测试文件中）。
- Produces: `topic-spic.html` 渲染产物与 `topic.html` 一致（两处 `class="pages"` 等）；`topic-spic.js` 提供同名 `jumpToPage(el)`。

- [ ] **Step 1: 追加 spic 模板测试**

在 `src/test/suite/topicPagination.test.ts` 末尾（现有 suite 闭合后）追加：

```ts
suite('帖子页分页组件 topic-spic.html', () => {
  test('与 topic.html 渲染一致', () => {
    const html = renderTemplate('topic-spic.html', buildTopic());
    assertPaginationRendered(html);
  });

  test('只看楼主不渲染分页', () => {
    const onlyAuthor = renderTemplate('topic-spic.html', buildTopic({ onlyAuthor: true }));
    assert.strictEqual((onlyAuthor.match(/class="pages"/g) || []).length, 0);
  });
});
```

- [ ] **Step 2: 编译并运行测试，确认失败**

Run:
```bash
npm run compile
npx mocha --ui tdd out/test/suite/topicPagination.test.js
```
Expected: 新增的 2 个 spic 测试 FAIL（`topic-spic.html` 仍是旧平铺分页），原有 4 个 topic.html 测试仍 PASS。

- [ ] **Step 3: 在 topic-spic.html 顶部插入分页组件**

在 `html/topic-spic.html` 第 108 行 `<hr />` 与第 110 行 `<section class="reply-composer" id="replyComposer" ...>` 之间插入：

```html
    <!-- 分页（顶部） -->
    {{if !topic.onlyAuthor && topic.pages > 1}}
    <div class="pages">
      <% if (topic.pageNow > 1) { %>
      <a class="pageUp" href="javascript:;" onclick="vsPostMessage('pageTurning', {page: <%= topic.pageNow - 1 %>});" title="上一页">上一页</a>
      <% } else { %>
      <a class="pageUp is-disabled" href="javascript:;" title="上一页">上一页</a>
      <% } %>
      <%
        var pageList = [];
        if (topic.pages <= 7) {
          for (var i = 1; i <= topic.pages; i++) pageList.push(i);
        } else {
          pageList.push(1);
          var start = (topic.pageNow - 2 > 2) ? topic.pageNow - 2 : 2;
          var end = (topic.pageNow + 2 < topic.pages - 1) ? topic.pageNow + 2 : topic.pages - 1;
          if (start > 2) pageList.push(0);
          for (var i = start; i <= end; i++) pageList.push(i);
          if (end < topic.pages - 1) pageList.push(0);
          pageList.push(topic.pages);
        }
      %>
      <% for (var j = 0; j < pageList.length; j++) {
        var p = pageList[j];
        if (p === 0) { %>
          <span class="page-ellipsis">…</span>
        <% } else if (p === topic.pageNow) { %>
          <b><%- p %></b>
        <% } else { %>
          <a href="javascript:;" onclick="vsPostMessage('pageTurning', {page: <%- p %>});"><%- p %></a>
        <% } %>
      <% } %>
      <% if (topic.pageNow < topic.pages) { %>
      <a class="pageDown" href="javascript:;" onclick="vsPostMessage('pageTurning', {page: <%= topic.pageNow + 1 %>});" title="下一页">下一页</a>
      <% } else { %>
      <a class="pageDown is-disabled" href="javascript:;" title="下一页">下一页</a>
      <% } %>
      <a class="page-refresh" href="javascript:;" onclick="vsPostMessage('refresh', {page: <%= topic.pageNow %>});" title="刷新当前页面">刷新</a>
      <span class="page-jump">跳至 <input class="page-jump-input" type="number" min="1" max="<%= topic.pages %>" value="<%= topic.pageNow %>" onkeydown="if (event.key === 'Enter') jumpToPage(this);" /> 页 <button type="button" class="page-jump-btn" onclick="jumpToPage(this)">跳转</button></span>
    </div>
    {{/if}}
```

- [ ] **Step 4: 替换 topic-spic.html 底部旧分页块**

把 `html/topic-spic.html` 第 250-270 行整块替换为与顶部相同的组件块（注释 `<!-- 分页（底部） -->`）。旧块中的 `<hr />`（第 257 行）一并删除。

- [ ] **Step 5: 在 topic-spic.js 添加 jumpToPage**

在 `html/topic-spic.js` 第 121 行 `function onSubmit() {` 之前插入（该文件顶部已有 `vsPostMessage` 定义，直接可用）：

```js
// 分页跳转：读取当前组件输入框页码并夹取到合法范围
function jumpToPage(el) {
  const container = el.closest('.pages');
  if (!container) {
    return;
  }
  const input = container.querySelector('.page-jump-input');
  if (!input || !input.value.trim()) {
    return;
  }
  const page = parseInt(input.value, 10);
  if (isNaN(page)) {
    return;
  }
  const max = parseInt(input.max, 10) || 1;
  const clamped = Math.min(Math.max(page, 1), max);
  input.value = clamped;
  vsPostMessage('pageTurning', { page: clamped });
}
```

- [ ] **Step 6: 重新编译并运行测试，确认全部通过**

Run:
```bash
npm run compile
npx mocha --ui tdd out/test/suite/topicPagination.test.js
```
Expected: 6 tests 全部 PASS。

- [ ] **Step 7: 运行 lint**

Run:
```bash
npm run lint
```
Expected: 无错误。

- [ ] **Step 8: 手动验证**

在扩展设置里打开“表情模式/小图模式”（对应 `Global.getStickerMode()` 开关），重复 Task 1 Step 9 的检查清单 1-7，确认 `topic-spic.html` 表现一致。

- [ ] **Step 9: 提交**

```bash
git add html/topic-spic.html html/topic-spic.js src/test/suite/topicPagination.test.ts
git commit -m "feat: 表情模式帖子页同步分页组件 (topic-spic.html)"
```
