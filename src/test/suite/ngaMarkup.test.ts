import * as assert from 'assert';
import { parseNgaReply, renderNgaMarkup } from '../../process/ngaMarkup';

suite('NGA markup rendering', () => {
	test('renders plain and labelled URL tags', () => {
		const rendered = renderNgaMarkup(
			'[collapse=相关设置]'
			+ '我参考的这个降压：[[url]https://bbs.nga.cn/read.php?tid=35627625[/url]]<br/>'
			+ 'ring 有[url=https://bbs.nga.cn/read.php?tid=41113127]解释[/url]'
			+ '[/collapse]'
		);

		assert.ok(rendered.includes(
			'<a class="nga-link" href="https://bbs.nga.cn/read.php?tid=35627625">'
			+ 'https://bbs.nga.cn/read.php?tid=35627625</a>'
		));
		assert.ok(rendered.includes(
			'<a class="nga-link" href="https://bbs.nga.cn/read.php?tid=41113127">解释</a>'
		));
		assert.strictEqual(rendered.includes('[url'), false);
	});

	test('renders multiple embedded quotes and their author metadata', () => {
		const rendered = renderNgaMarkup(
			'引用一下89楼的第一次测试，做个备份。<br/>'
			+ '[quote][pid=877691284,47324782,5]Reply[/pid] '
			+ '[b]Post by [uid=42635616]zkbskcwi[/uid] (2026-08-07 12:52):[/b]'
			+ '<br/><br/>第一次引用[/quote]<br/>'
			+ '[quote]<br/>第二次引用[/quote]'
		);

		assert.strictEqual((rendered.match(/class="nga-inline-quote"/g) || []).length, 2);
		assert.ok(rendered.includes('zkbskcwi'));
		assert.ok(rendered.includes('UID: 42635616'));
		assert.ok(rendered.includes('2026-08-07 12:52'));
		assert.ok(rendered.includes('第一次引用'));
		assert.ok(rendered.includes('第二次引用'));
		assert.strictEqual(rendered.includes('[quote]'), false);
	});

	test('extracts the leading reply header metadata', () => {
		const parsed = parseNgaReply(
			'[b]Reply to [pid=877653778,47324782,3]Reply[/pid] '
			+ 'Post by [uid=11439449]rsfengzi[/uid] (2026-08-07 04:56)[/b]'
			+ '2026/8/7 P55e45ring48'
		);

		assert.deepStrictEqual(parsed.quote, {
			pid: '877653778',
			uid: '11439449',
			userName: 'rsfengzi',
			time: '2026-08-07 04:56',
			content: ''
		});
		assert.strictEqual(parsed.content, '2026/8/7 P55e45ring48');
	});

	test('extracts a pinned comment reply header without deleting its body', () => {
		const parsed = parseNgaReply(
			'[b]Reply to [pid=877763084,47331947,1]Reply[/pid] '
			+ 'Post by [uid=62010547]名字什么的不好取啊[/uid] (2026-08-08 02:08)[/b]'
			+ '<br/><br/>这算是合法合规情况下的明示了'
		);

		assert.deepStrictEqual(parsed.quote, {
			pid: '877763084',
			uid: '62010547',
			userName: '名字什么的不好取啊',
			time: '2026-08-08 02:08',
			content: ''
		});
		assert.strictEqual(parsed.content, '这算是合法合规情况下的明示了');
	});

	test('renders encoded entities, deletion and untitled collapse blocks', () => {
		const rendered = renderNgaMarkup('A&amp;#8226;B [del]删除[/del] [collapse]默认标题[/collapse]');

		assert.ok(rendered.includes('A•B'));
		assert.ok(rendered.includes('<del>删除</del>'));
		assert.ok(rendered.includes('<summary>展开内容</summary>'));
	});
});
