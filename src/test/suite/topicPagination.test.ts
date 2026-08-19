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
  assert.strictEqual((html.match(/page-ellipsis/g) || []).length, 4);
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
