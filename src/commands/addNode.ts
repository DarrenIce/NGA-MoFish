import { NGA } from './../nga';
import * as vscode from 'vscode';
import Global from '../global';
import * as cheerio from 'cheerio';
import http from '../http';
import * as iconv from 'iconv-lite';

/**
 * 添加节点逻辑
 * @returns 返回是否成功添加
 */
export default async function addNode(): Promise<boolean> {
  let fid = await vscode.window.showInputBox({
    placeHolder: 'NGA fid',
    prompt: '在此输入分区对应的fid，在url中可以看到，比如水区是-7'
  });
  if (fid === undefined) {
    return false;
  }
  console.log('添加的分区fid', fid);
  console.log(`https://nga.178.com/thread.php?fid=${fid}`);
  const r = await http.get(`https://nga.178.com/thread.php?fid=${fid}`, { responseType: 'arraybuffer' });
  const $ = cheerio.load(r.data);
  const t = $('head title').text().replace(' NGA玩家社区', '');
  console.log('添加的分区title', t);
  const isAdd = Global.addCustomNode({
    name: fid,
    title: t
  });
  if (!isAdd) {
    vscode.window.showInformationMessage('节点已经存在，无需再添加');
  }
  return isAdd;
}
