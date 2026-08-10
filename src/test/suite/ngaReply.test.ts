import * as assert from 'assert';
import {
    buildNgaQuoteContent,
    buildNgaReplyHeader,
    buildNgaReplyParams,
    escapeNgaTextForSubmit,
} from '../../process/ngaReply';

suite('NGA reply request', () => {
    test('maps quote and comment operations to post.php parameters', () => {
        assert.deepStrictEqual(buildNgaReplyParams({
            tid: '123', pid: '456', operation: 'quote', content: '[b]hello[/b]',
        }), {
            action: 'quote', step: '2', post_content: '[b]hello[/b]',
            attachments: '', attachments_check: '', tid: '123', pid: '456',
        });
        assert.strictEqual(buildNgaReplyParams({
            tid: '123', pid: '456', operation: 'comment', content: '贴条',
        }).comment, '1');
        assert.strictEqual(buildNgaReplyParams({
            tid: '123', pid: '0', operation: 'reply', content: '普通回复',
        }).action, 'reply');
    });

    test('builds a standard NGA quote block', () => {
        const quote = buildNgaQuoteContent('123', '456', '7', '89', '小明', '2026-08-10 12:00', '原文');
        assert.ok(quote.startsWith('[quote][pid=456,123,7]Reply[/pid]'));
        assert.ok(quote.includes('[uid=89]小明[/uid]'));
        assert.ok(quote.endsWith('原文[/quote]\n\n'));
        assert.strictEqual(
            buildNgaReplyHeader('123', '456', '7', '89', '小明', '2026-08-10 12:00'),
            '[b]Reply to [pid=456,123,7]Reply[/pid] Post by [uid=89]小明[/uid] (2026-08-10 12:00)[/b]\n'
        );
    });

    test('escapes emoji with the UTF-16 entities expected by legacy NGA endpoints', () => {
        assert.strictEqual(
            escapeNgaTextForSubmit('A😂B❤️C'),
            'A&#55357;&#56834;B&#10084;&#65039;C'
        );
        assert.strictEqual(buildNgaReplyParams({
            tid: '123', pid: '0', operation: 'reply', content: '表情😂',
        }).post_content, '表情&#55357;&#56834;');
    });
});
