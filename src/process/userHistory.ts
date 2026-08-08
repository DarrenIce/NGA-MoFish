import * as cheerio from "cheerio";

export const MAX_HISTORY_CHARACTERS = 16000;
export const MAX_HISTORY_POST_LENGTH = 2000;

export interface UserHistoryPage {
  content: string;
  postCount: number;
  hitEnd: boolean;
}

function decodeNumericEntity(match: string, code: string, radix: number): string {
  const value = parseInt(code, radix);
  return Number.isFinite(value) && value >= 0 && value <= 0x10ffff
    ? String.fromCodePoint(value)
    : match;
}

function normalizeText(value: string): string {
  return value
    .replace(/&#(\d+);/g, (match, code) => decodeNumericEntity(match, code, 10))
    .replace(/&#x([0-9a-f]+);/gi, (match, code) => decodeNumericEntity(match, code, 16))
    .replace(/\u00a0/g, " ")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function parseUserHistoryPage(
  html: string,
  currentTotalLength = 0
): UserHistoryPage {
  const $ = cheerio.load(html, { decodeEntities: true });
  const rows = $("tr.topicrow");
  if (!rows.length) {
    return { content: "", postCount: 0, hitEnd: true };
  }

  const entries: string[] = [];
  let accumulatedLength = 0;
  let hitEnd = false;

  rows.each((_index, row) => {
    if (hitEnd) {
      return;
    }

    const postContent = $(row).find("div.postcontent").first();
    if (!postContent.length) {
      return;
    }
    const clonedPostContent = postContent.clone();
    clonedPostContent.find("blockquote, .quote, .quoteurl, script, style").remove();
    clonedPostContent.find("br").replaceWith("\n");
    const postText = normalizeText(clonedPostContent.text());
    if (!postText) {
      return;
    }
    if (
      postText.includes("帖子发布或回复时间超过限制") ||
      postText.includes("未登录")
    ) {
      hitEnd = true;
      return;
    }

    const forum = normalizeText($(row).find("span.titleadd2 a").first().text()) || "未知板块";
    const title = normalizeText($(row).find("a.topic").first().text()) || "无标题";
    const prefix = `[板块]${forum}\n[帖子标题]${title}\n[用户回帖]`;
    const separatorLength = currentTotalLength + accumulatedLength > 0 ? 2 : 0;
    const remaining = MAX_HISTORY_CHARACTERS
      - currentTotalLength
      - accumulatedLength
      - separatorLength;

    if (remaining <= prefix.length) {
      hitEnd = true;
      return;
    }

    const maxPostLength = Math.min(
      MAX_HISTORY_POST_LENGTH,
      remaining - prefix.length
    );
    const body = postText.slice(0, maxPostLength);
    const entry = `${prefix}${body}`;
    entries.push(entry);
    accumulatedLength += separatorLength + entry.length;

    if (body.length < postText.length && maxPostLength < MAX_HISTORY_POST_LENGTH) {
      hitEnd = true;
    }
  });

  return {
    content: entries.join("\n\n"),
    postCount: entries.length,
    hitEnd,
  };
}
