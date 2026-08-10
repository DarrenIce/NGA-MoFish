import { TreeNode } from './../providers/BaseProvider';
import { NGA } from './../nga';
import * as vscode from 'vscode';
import topicItemClick from './topicItemClick';
import Global from '../global';
import { SearchElement } from '../models/searchElement';
import { getSearchPageOffset, splitSearchPage } from '../process/searchPaging';

const SEARCH_PAGE_SIZE = 50;

interface SearchState {
  query: string;
  page: number;
  results: SearchElement[];
  hasNext: boolean;
}

interface SearchQuickPickItem extends vscode.QuickPickItem {
  action: 'topic' | 'previous' | 'next';
  topic?: SearchElement;
}

/** 上次打开的搜索结果页。 */
let lastSearchState: SearchState | undefined;

export default async function search() {
  if (lastSearchState) {
    await showQuickPick(lastSearchState);
    return;
  }

  await showInputBox();
}

async function showInputBox() {
  let query = await vscode.window.showInputBox({
    placeHolder: '搜索帖子',
    prompt: '请输入查询的关键字'
  });
  if (query === undefined) {
    return;
  }
  query = query.trim();
  if (!query.length) {
    return;
  }

  await loadSearchPage(query, 1);
}

async function loadSearchPage(query: string, page: number) {
  const previousState = lastSearchState;
  try {
    const fetched = await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: `正在搜索“${query}”（第 ${page} 页）`,
      cancellable: false,
    }, () => NGA.search(
      query,
      getSearchPageOffset(page, SEARCH_PAGE_SIZE),
      SEARCH_PAGE_SIZE + 1,
    ));
    const currentPage = splitSearchPage(fetched, SEARCH_PAGE_SIZE);
    console.log(`<${query}>第${page}页搜索到${currentPage.results.length}条结果`);

    if (!currentPage.results.length) {
      if (page === 1) {
        lastSearchState = undefined;
        await vscode.window.showInformationMessage('没有找到相关内容');
      } else {
        await vscode.window.showInformationMessage('没有更多搜索结果');
        if (previousState) {
          await showQuickPick(previousState);
        }
      }
      return;
    }

    const state: SearchState = {
      query,
      page,
      results: currentPage.results,
      hasNext: currentPage.hasNext,
    };
    lastSearchState = state;
    await showQuickPick(state);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await vscode.window.showErrorMessage(`搜索失败：${message}`);
    if (previousState) {
      await showQuickPick(previousState);
    }
  }
}

async function showQuickPick(state: SearchState) {
  const startIndex = getSearchPageOffset(state.page, SEARCH_PAGE_SIZE);
  const topicItems: SearchQuickPickItem[] = state.results.map((topic, index) => ({
    action: 'topic',
    topic,
    label: `${startIndex + index + 1}. ${topic.title}`,
    description: `@${topic.authorName} ${topic.postdate}`,
  }));
  const navigationItems: SearchQuickPickItem[] = [];

  if (state.page > 1) {
    navigationItems.push({
      action: 'previous',
      label: '$(arrow-left) 上一页',
      description: `返回第 ${state.page - 1} 页`,
      alwaysShow: true,
    });
  }
  if (state.hasNext) {
    navigationItems.push({
      action: 'next',
      label: '$(arrow-right) 下一页',
      description: `查看第 ${state.page + 1} 页`,
      alwaysShow: true,
    });
  }
  const items = navigationItems.concat(topicItems);

  const selected = await vscode.window.showQuickPick(items, {
    matchOnDescription: true,
    placeHolder: `“${state.query}”的搜索结果 · 第 ${state.page} 页`,
  });
  if (!selected) {
    lastSearchState = undefined;
    return;
  }
  if (selected.action === 'previous') {
    await loadSearchPage(state.query, state.page - 1);
    return;
  }
  if (selected.action === 'next') {
    await loadSearchPage(state.query, state.page + 1);
    return;
  }
  if (!selected.topic) {
    return;
  }

  const node = new TreeNode(selected.topic.title, false);
  node.link = `https://${Global.getNgaDomain()}/read.php?lite=js&noprefix&tid=${selected.topic.id}`;
  topicItemClick(node);
}
