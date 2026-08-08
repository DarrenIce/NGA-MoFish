import Global from "../global";
import http from "../http";
import {
  MAX_HISTORY_CHARACTERS,
  parseUserHistoryPage,
} from "../process/userHistory";

const MAX_CRAWL_PAGES = 5;

export interface UserHistoryResult {
  content: string;
  pageCount: number;
  postCount: number;
  characterCount: number;
}

export type UserHistoryProgress = (page: number, maxPages: number) => void;

export async function fetchUserHistory(
  uid: string,
  onProgress?: UserHistoryProgress
): Promise<UserHistoryResult> {
  const contents: string[] = [];
  let totalLength = 0;
  let postCount = 0;
  let pageCount = 0;

  for (let page = 1; page <= MAX_CRAWL_PAGES; page++) {
    onProgress?.(page, MAX_CRAWL_PAGES);
    const url = `https://${Global.getNgaDomain()}/thread.php?searchpost=1&authorid=${encodeURIComponent(uid)}&page=${page}`;
    const response = await http.get<string>(url, { responseType: "arraybuffer" });
    const parsed = parseUserHistoryPage(response.data, totalLength);
    pageCount = page;

    if (parsed.content) {
      contents.push(parsed.content);
      postCount += parsed.postCount;
      totalLength += (contents.length > 1 ? 2 : 0) + parsed.content.length;
    }

    if (parsed.hitEnd || !parsed.content || totalLength >= MAX_HISTORY_CHARACTERS) {
      break;
    }
  }

  const content = contents.join("\n\n");
  return {
    content,
    pageCount,
    postCount,
    characterCount: content.length,
  };
}
