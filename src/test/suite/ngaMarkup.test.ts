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

	test('renders underline, horizontal rules and nested attachment images', () => {
		const rendered = renderNgaMarkup(
			'[b][u]原文链接[/u][/b]<br/>[h][/h]<br/>'
			+ '[table][tr][td]'
			+ '[url=./mon_202608/07/axtzQ69-41fuK1fT3cSz8-jo.webp]'
			+ '[img]./mon_202608/07/axtzQ69-41fuK1fT3cSz8-jo.webp[/img]'
			+ '[/url][/td][/tr][/table]'
		);

		assert.ok(rendered.includes('<strong><u>原文链接</u></strong>'));
		assert.ok(rendered.includes('<hr class="nga-horizontal-rule">'));
		assert.ok(rendered.includes('<table class="nga-table">'));
		assert.ok(rendered.includes(
			'<img class="nga-image" style="background-color: #FFFAFA" '
			+ 'src="https://img.nga.cn/attachments/mon_202608/07/axtzQ69-41fuK1fT3cSz8-jo.webp" alt="帖子图片">'
		));
		assert.strictEqual(rendered.includes('&lt;img'), false);
		assert.strictEqual(rendered.includes('[img]'), false);
	});

	test('renders attachment placeholders when images are disabled', () => {
		const rendered = renderNgaMarkup(
			'[img]./mon_202608/07/axtzQ69-abddK16T3cSxn-ix.webp[/img]',
			{ showImages: false }
		);

		assert.strictEqual(
			rendered,
			'<span class="nga-img-placeholder" '
			+ 'data-src="https://img.nga.cn/attachments/mon_202608/07/axtzQ69-abddK16T3cSxn-ix.webp">'
			+ '[图片] 点击加载</span>'
		);
	});
});
