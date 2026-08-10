export type NgaReplyOperation = 'reply' | 'quote' | 'comment';

export interface NgaReplyRequest {
    tid: string;
    pid: string;
    operation: NgaReplyOperation;
    content: string;
}

/** 将 NGA 旧接口容易误解码的 Unicode 字符转成 UTF-16 数字实体。 */
export function escapeNgaTextForSubmit(text: string): string {
    let escaped = '';
    for (const character of text) {
        const codePoint = character.codePointAt(0) || 0;
        const needsEscape = codePoint > 0xffff
            || codePoint === 0x200d
            || (codePoint >= 0xfe00 && codePoint <= 0xfe0f)
            || (codePoint >= 0x2600 && codePoint <= 0x27bf);
        if (!needsEscape) {
            escaped += character;
            continue;
        }
        for (let index = 0; index < character.length; index++) {
            escaped += `&#${character.charCodeAt(index)};`;
        }
    }
    return escaped;
}

/** 构造 post.php 的参数，和 MNGA 的 post_reply 契约保持一致。 */
export function buildNgaReplyParams(request: NgaReplyRequest): { [key: string]: string } {
    const operation = request.operation === 'comment' ? 'reply' : request.operation;
    const params: { [key: string]: string } = {
        action: operation,
        step: '2',
        post_content: escapeNgaTextForSubmit(request.content),
        attachments: '',
        attachments_check: '',
        tid: request.tid,
        pid: request.pid,
    };
    if (request.operation === 'comment') {
        params.comment = '1';
    }
    return params;
}

/** 生成 NGA 的标准引用块。正文仍是 BBCode，服务端会按原格式渲染。 */
export function buildNgaQuoteContent(
    tid: string,
    pid: string,
    floor: string,
    uid: string,
    userName: string,
    time: string,
    content: string,
): string {
    const safeName = userName || uid;
    const header = `[pid=${pid},${tid},${floor || '0'}]Reply[/pid] [b]Post by [uid=${uid}]${safeName}[/uid] (${time}):[/b]`;
    return `[quote]${header}<br/>${content || ''}[/quote]\n\n`;
}

export function buildNgaReplyHeader(
    tid: string,
    pid: string,
    floor: string,
    uid: string,
    userName: string,
    time: string,
): string {
    const safeName = userName || uid;
    return `[b]Reply to [pid=${pid},${tid},${floor || '0'}]Reply[/pid] Post by [uid=${uid}]${safeName}[/uid] (${time})[/b]\n`;
}
