import { TreeNode } from './../providers/BaseProvider';
import { NGA, SearchElement } from './../nga';
import * as vscode from 'vscode';
import topicItemClick from './topicItemClick';

/**上次的搜索结果 */
var _lastSearchList: SearchElement[] | undefined = undefined;

/**
 * 登录逻辑
 * @returns 返回是否成功登录成功
 */
export default async function search() {
  // 如果已经搜索过，直接打开上次的搜索结果
  if (_lastSearchList) {
    showQuickPick(_lastSearchList);
    return;
  }

  showInoutBox();
}

async function showInoutBox() {
  // 输入搜索关键词
  let q = await vscode.window.showInputBox({
    placeHolder: '搜索帖子',
    prompt: '请输入查询的关键字'
  });
  // 如果用户撤销输入，如ESC，则为undefined
  if (q === undefined) {
    return;
  }
  q = (q || '').trim();
  if (!q.length) {
    return;
  }

  const searchList = await NGA.search(q, 0, 50);
  console.log(`<${q}>搜索到${searchList.length}条结果`);
  if (searchList.length <= 0) {
    await vscode.window.showInformationMessage('没有找到相关内容');
    return;
  }
  _lastSearchList = searchList;
  showQuickPick(searchList);
}

async function showQuickPick(searchList: SearchElement[]) {
  const items = searchList.map((s, i) => {
    return {
      topicId: s.id,
      title: s.title,
      label: `${i + 1}. ${s.title}`,
      description: `@${s.authorName} ${s.postdate}`,
    //   detail: s.content
    };
  });

  const select = await vscode.window.showQuickPick(items, {
    matchOnDescription: true,
    // matchOnDetail: true,
    placeHolder: '搜索结果'
  });

  // 在搜索结果弹框中取消
  if (select === undefined) {
    // showInoutBox();
    _lastSearchList = undefined;
    return;
  }
  const node = new TreeNode(select.title, false);
  node.link = `https://bbs.nga.cn/read.php?lite=js&noprefix&tid=${select.topicId}`;
  topicItemClick(node);
}
