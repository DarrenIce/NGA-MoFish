/**
 * 将 NGA 常用 BBCode 转换为帖子 Webview 可渲染的 HTML。
 * @author wwj
 */

const SAFE_COLORS: { [name: string]: string } = {
  red: "red",
  orange: "orange",
  yellow: "#d7ba7d",
  green: "#89d185",
  blue: "#4daafc",
  purple: "#c586c0",
  white: "#ffffff",
  black: "#000000",
  gray: "#808080",
  grey: "#808080",
};

const UNSAFE_HTML_CODE_POINTS = [34, 38, 39, 60, 62];

export interface NgaQuoteInfo {
  pid: string;
  uid: string;
  userName: string;
  time: string;
  content: string;
}

export interface ParsedNgaReply {
  content: string;
  quote?: NgaQuoteInfo;
}

function decodeNumericEntities(content: string): string {
  return content.replace(/&(amp;)?#(x[0-9a-f]+|\d+);/gi, (entity, _escapedAmp, value: string) => {
    const isHex = value[0].toLowerCase() === "x";
    const codePoint = parseInt(isHex ? value.slice(1) : value, isHex ? 16 : 10);
    if (
      !Number.isFinite(codePoint)
      || codePoint <= 0
      || codePoint > 0x10ffff
      || (codePoint >= 0xd800 && codePoint <= 0xdfff)
      || UNSAFE_HTML_CODE_POINTS.includes(codePoint)
    ) {
      return entity;
    }
    return String.fromCodePoint(codePoint);
  });
}

function sanitizeColor(value: string): string | undefined {
  const color = value.trim().toLowerCase();
  if (SAFE_COLORS[color]) {
    return SAFE_COLORS[color];
  }
  if (/^#[0-9a-f]{3,8}$/.test(color)) {
    return color;
  }
  const rgb = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(0|1|0?\.\d+))?\s*\)$/.exec(color);
  if (rgb && [rgb[1], rgb[2], rgb[3]].every((channel) => Number(channel) <= 255)) {
    return color;
  }
  return undefined;
}

function sanitizeSize(value: string): string | undefined {
  const match = /^(\d{2,3})%$/.exec(value.trim());
  if (!match) {
    return undefined;
  }
  const percentage = Math.min(250, Math.max(50, Number(match[1])));
  return `${percentage}%`;
}

function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeHtmlAttribute(value: string): string {
  return escapeHtmlText(value);
}

function sanitizeUrl(value: string): string | undefined {
  const url = value.trim().replace(/&amp;/gi, "&");
  if (/^https?:\/\/[^\s<>"']+$/i.test(url) || /^\/[^\s<>"']*$/.test(url)) {
    return url;
  }
  return undefined;
}

function renderLink(url: string, text: string): string {
  const safeUrl = sanitizeUrl(url);
  const safeText = escapeHtmlText(text.trim() || url.trim());
  if (!safeUrl) {
    return safeText;
  }
  return `<a class="nga-link" href="${escapeHtmlAttribute(safeUrl)}">${safeText}</a>`;
}

function renderLinks(content: string): string {
  return content
    .replace(/\[\[url\]([\s\S]*?)\[\/url\]\]/gi, (_match, url: string) => renderLink(url, url))
    .replace(/\[url=([^\]]+)\]([\s\S]*?)\[\/url\]/gi, (_match, url: string, text: string) => renderLink(url, text))
    .replace(/\[url\]([\s\S]*?)\[\/url\]/gi, (_match, url: string) => renderLink(url, url));
}

function renderInlineMarkup(content: string): string {
  let result = content
    .replace(/\[b\]/gi, "<strong>")
    .replace(/\[\/b\]/gi, "</strong>")
    .replace(/\[del\]/gi, "<del>")
    .replace(/\[\/del\]/gi, "</del>");
  let previous = "";
  while (result !== previous) {
    previous = result;
    result = result.replace(
      /\[(color|size)=([^\]]+)\]([\s\S]*?)\[\/\1\]/gi,
      (_match, type: string, value: string, inner: string) => {
        const safeValue = type.toLowerCase() === "color"
          ? sanitizeColor(value)
          : sanitizeSize(value);
        if (!safeValue) {
          return inner;
        }
        const property = type.toLowerCase() === "color" ? "color" : "font-size";
        return `<span style="${property}:${safeValue}">${inner}</span>`;
      }
    );
  }
  return result;
}

function collectMatches(content: string, pattern: RegExp): RegExpExecArray[] {
  const matches: RegExpExecArray[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content)) !== null) {
    matches.push(match);
  }
  return matches;
}

function renderTables(content: string): string {
  return content.replace(/\[table\]([\s\S]*?)\[\/table\]/gi, (_match, tableContent: string) => {
    const rows = collectMatches(tableContent, /\[tr\]([\s\S]*?)\[\/tr\]/gi);
    if (!rows.length) {
      return tableContent;
    }
    const renderedRows = rows.map((row) => {
      const cells = collectMatches(row[1], /\[(td|th)\]([\s\S]*?)\[\/\1\]/gi);
      const renderedCells = cells.map((cell) => `<${cell[1].toLowerCase()}>${cell[2].trim()}</${cell[1].toLowerCase()}>`).join("");
      return `<tr>${renderedCells}</tr>`;
    }).join("");
    return `<table class="nga-table"><tbody>${renderedRows}</tbody></table>`;
  });
}

function renderCollapses(content: string): string {
  let result = content;
  let previous = "";
  while (result !== previous) {
    previous = result;
    result = result.replace(
      /\[collapse(?:=([^\]]+))?\]([\s\S]*?)\[\/collapse\]/gi,
      (_match, title: string | undefined, inner: string) => {
        const summary = title?.trim() || "展开内容";
        return `<details class="nga-collapse"><summary>${escapeHtmlText(summary)}</summary><div class="nga-collapse-content">${inner}</div></details>`;
      }
    );
  }
  return result;
}

function parseQuoteHeader(content: string): { quote: NgaQuoteInfo; content: string } | undefined {
  const header = /^\s*\[pid=([^,\]]+)(?:,[^\]]*)?\]Reply\[\/pid\]\s*(?:\[b\])?\s*Post by \[uid=([^\]]+)\]([\s\S]*?)\[\/uid\]\s*\(([^)]+)\)\s*:?\s*(?:\[\/b\])?\s*(?:<br\s*\/?>(?:\s|&nbsp;)*)*/i.exec(content);
  if (!header) {
    return undefined;
  }
  return {
    quote: {
      pid: header[1].trim(),
      uid: header[2].trim(),
      userName: decodeNumericEntities(header[3].trim()),
      time: header[4].trim(),
      content: "",
    },
    content: content.slice(header[0].length),
  };
}

function renderQuoteMetadata(quote: NgaQuoteInfo): string {
  if (!quote.uid && !quote.userName && !quote.time) {
    return "";
  }
  const uid = escapeHtmlText(quote.uid);
  const userName = escapeHtmlText(quote.userName || quote.uid);
  const user = /^\d+$/.test(quote.uid)
    ? `<a href="/nuke.php?func=ucp&amp;uid=${uid}">${userName}</a><span class="quote-uid">UID: ${uid}</span>`
    : `<span>${userName}</span>`;
  const time = quote.time ? `<span class="quote-time">${escapeHtmlText(quote.time)}</span>` : "";
  return `<div class="quote-url nga-inline-quote-meta"><span class="quote-marker">引用</span>${user}${time}</div>`;
}

function renderEmbeddedQuotes(content: string): string {
  return content.replace(/\[quote\]([\s\S]*?)\[\/quote\]/gi, (_match, inner: string) => {
    const parsedHeader = parseQuoteHeader(inner);
    const quote = parsedHeader?.quote;
    const body = (parsedHeader ? parsedHeader.content : inner)
      .replace(/^\s*(?:<br\s*\/?>(?:\s|&nbsp;)*)+/i, "");
    return `<div class="nga-inline-quote">${quote ? renderQuoteMetadata(quote) : ""}<blockquote>${body}</blockquote></div>`;
  });
}

export function parseNgaReply(content: string): ParsedNgaReply {
  let remaining = content || "";
  const quoteBlock = /^\s*\[quote\]([\s\S]*?)\[\/quote\]\s*/i.exec(remaining);
  if (quoteBlock) {
    const parsedHeader = parseQuoteHeader(quoteBlock[1]);
    const quote = parsedHeader?.quote || {
      pid: "",
      uid: "",
      userName: "",
      time: "",
      content: "",
    };
    quote.content = parsedHeader ? parsedHeader.content : quoteBlock[1];
    remaining = remaining.slice(quoteBlock[0].length);
    return { content: remaining, quote };
  }

  const replyHeader = /^\s*\[b\]\s*Reply to\s+([\s\S]*?)\[\/b\]\s*(?:<br\s*\/?>(?:\s|&nbsp;)*)*/i.exec(remaining);
  if (!replyHeader) {
    return { content: remaining };
  }
  const parsedHeader = parseQuoteHeader(replyHeader[1]);
  if (!parsedHeader) {
    return { content: remaining };
  }
  remaining = remaining.slice(replyHeader[0].length);
  return { content: remaining, quote: parsedHeader.quote };
}

export function renderNgaMarkup(content: string): string {
  const decoded = decodeNumericEntities(content || "");
  const quotes = renderEmbeddedQuotes(decoded);
  const links = renderLinks(quotes);
  return renderCollapses(renderTables(renderInlineMarkup(links)));
}
