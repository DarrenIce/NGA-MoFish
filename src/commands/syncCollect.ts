import { NGA } from "../nga";
import * as vscode from "vscode";
import Global from "../global";
import * as cheerio from "cheerio";
import http from "../http";
import CustomProvider from "../providers/CustomProvider";
import { Topic } from "../models/topic";
import { Node } from "../models/node";

const customProvider = new CustomProvider();
/**
 * 添加节点逻辑
 * @returns 返回是否成功添加
 */
async function syncCollectNodes(): Promise<boolean> {
  const cookie = Global.getCookie();
  if (!cookie) {
    vscode.window.showErrorMessage("请先登录");
    return false;
  }
  const r = await http.get(`https://${Global.ngaURL}/nuke.php?__lib=forum_favor2&__act=forum_favor&__output=3&action=get`,{ responseType: "arraybuffer" });
  const $ = cheerio.load(r.data);
  const t = $("script").text().substring($("script").text().indexOf("=") + 1);
  const d = JSON.parse(t);
  console.log(t);
  if(d.error) {
    vscode.window.showErrorMessage(`获取数据失败, ${d.error[0]}`);
    return false;
  }
  let data: any;
  try {
    data = d.data[0];
  } catch (err) {
    console.log("error", err);
    vscode.window.showErrorMessage("同步失败");
    return false;
  }
  console.log("收藏的分区", data);
  Object.keys(data).forEach(async (key) => {
    let { fid, name = "" } = data[key];
    Global.addCustomNode({
      name: fid,
      title: name,
    });
  });
  customProvider.refreshNodeList();
  vscode.window.showInformationMessage("同步完成");
  return true;
}

async function syncCollectPosts(): Promise<Topic[]> {
  const cookie = Global.getCookie();
  if (!cookie) {
    vscode.window.showErrorMessage("请先登录");
    return [];
  }
  let list: Topic[] = [];
  for (let i = 1; i < 100; i++) {
    const r = await http.get(`https://${Global.ngaURL}/thread.php?favor=1&order_by=postdatedesc&lite=js&noprefix&page=${i}`,{ responseType: "arraybuffer" });
    const d = JSON.parse(r.data);
    console.log(d);
    if(d.error) {
      break;
    }
    for (let i in d.data.__T) {
      let topic = new Topic();
      let tmp = d.data.__T[i];
      topic.title = tmp.subject;
      topic.link = `https://${Global.ngaURL}${tmp.tpcurl}&lite=js&noprefix`;
      topic.node = new Node();
      topic.node.name = '0';
      topic.node.title = '收藏夹';
      list.push(topic);
    }
  }
  
  console.log("收藏的帖子", list);
  vscode.window.showInformationMessage("同步完成");
  return list;
}

export {syncCollectNodes, syncCollectPosts};