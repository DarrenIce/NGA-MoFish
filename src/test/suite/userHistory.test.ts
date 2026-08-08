import * as assert from "assert";
import {
  MAX_HISTORY_CHARACTERS,
  parseUserHistoryPage,
} from "../../process/userHistory";

suite("NGA user history parsing", () => {
  test("extracts forum, topic and reply text", () => {
    const result = parseUserHistoryPage(`
      <table>
        <tr class="topicrow">
          <td>
            <span class="titleadd2"><a>PC软硬件</a></span>
            <a class="topic">处理器讨论</a>
            <div class="postcontent">第一段<br/>第二段 &amp;#8226; 测试</div>
          </td>
        </tr>
        <tr class="topicrow">
          <td>
            <span class="titleadd2"><a>艾泽拉斯国家地理</a></span>
            <a class="topic">另一个帖子</a>
            <div class="postcontent">另一条回复</div>
          </td>
        </tr>
      </table>
    `);

    assert.strictEqual(result.postCount, 2);
    assert.strictEqual(result.hitEnd, false);
    assert.ok(result.content.includes("[板块]PC软硬件"));
    assert.ok(result.content.includes("[帖子标题]处理器讨论"));
    assert.ok(result.content.includes("[用户回帖]第一段\n第二段 • 测试"));
    assert.ok(result.content.includes("[用户回帖]另一条回复"));
  });

  test("stops at access-limit rows", () => {
    const result = parseUserHistoryPage(`
      <table>
        <tr class="topicrow">
          <td><div class="postcontent">帖子发布或回复时间超过限制</div></td>
        </tr>
      </table>
    `);

    assert.strictEqual(result.content, "");
    assert.strictEqual(result.postCount, 0);
    assert.strictEqual(result.hitEnd, true);
  });

  test("does not attribute quoted text to the analyzed user", () => {
    const result = parseUserHistoryPage(`
      <table>
        <tr class="topicrow">
          <td>
            <span class="titleadd2"><a>测试板块</a></span>
            <a class="topic">引用测试</a>
            <div class="postcontent">
              <span class="quote">这是被引用人的观点</span>
              这是用户自己的回复
            </div>
          </td>
        </tr>
      </table>
    `);

    assert.ok(result.content.includes("这是用户自己的回复"));
    assert.strictEqual(result.content.includes("这是被引用人的观点"), false);
  });

  test("never exceeds the total history character limit", () => {
    const result = parseUserHistoryPage(`
      <table>
        <tr class="topicrow">
          <td>
            <span class="titleadd2"><a>测试板块</a></span>
            <a class="topic">测试帖子</a>
            <div class="postcontent">${"a".repeat(5000)}</div>
          </td>
        </tr>
      </table>
    `, MAX_HISTORY_CHARACTERS - 50);

    assert.ok(result.content.length <= 48);
    assert.strictEqual(result.hitEnd, true);
  });
});
