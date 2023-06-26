import { NGA } from "../nga";
import * as vscode from "vscode";
import Global from "../global";
import * as cheerio from "cheerio";
import http from "../http";
import addNode from "./addNode";
import * as iconv from "iconv-lite";

/**
 * 添加节点逻辑
 * @returns 返回是否成功添加
 */
export default async function syncCollect(): Promise<boolean> {
  const r = await http.get(`https://${Global.ngaURL}/nuke.php?__lib=forum_favor2&__act=forum_favor&__output=3&action=get`);
  console.log(r);
  // const $ = cheerio.load(r.data);
  // const t = $('script').text().substring($('script').text().indexOf('=') + 1);
  // let data: any;
  // try {
  //   data = JSON.parse(t).data[0];
  //   console.log(data);
  // }catch(err) {
  //   console.log(err);
  //   return false;
  // }

  // console.log('收藏的分区', Global.gbk2utf8(data));
  // Object.keys(data).forEach(async (key) => {
  //   // let {fid, title} = data[key];
  //   // Global.addCustomNode({
  //   //   name: fid,
  //   //   title
  //   // });
  // });
  vscode.window.showInformationMessage('同步完成');
  return true;
}