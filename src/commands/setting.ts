import * as vscode from "vscode";
import { ProxySetting } from "../models/proxySetting";
import Global from "../global";

export default async function setting() {
  const sel = await vscode.window.showQuickPick(
    ["代理设置", "图片模式", "帖子显示数量", "是否过滤已读帖子", "NGA域名配置"],
    {
      placeHolder: "设置",
    }
  );

  switch (sel) {
    case "代理设置":
      proxySetting();
      break;
    case "图片模式":
      pictureSetting();
      break;
    case "帖子显示数量":
      postSetting();
      break;
    case "是否过滤已读帖子":
      filterSetting();
      break;
    case "NGA域名配置":
      domainSetting();
      break;
  }
}

async function proxySetting() {
  let proxy = Global.getProxySetting();

  let input = await vscode.window.showInputBox({
    placeHolder: "填写代理url",
    prompt:
      "例如：http://127.0.0.1:7890（支持http、https、socks5，不填则不使用代理）",
    value: proxy ? `${proxy.protocol}://${proxy.host}:${proxy.port}` : "",
  });
  if (input === undefined) {
    return;
  }

  input = input.trim();
  if (!input.length) {
    Global.setProxySetting(undefined);
    return;
  }

  const regex = /^(http|https|socks5):\/\/(.+):(\d+)$/gm;
  const match = regex.exec(input);
  if (!match) {
    vscode.window.showErrorMessage("代理url格式不正确");
    return;
  }

  const [, protocol, host, port] = match;
  const newProxy: ProxySetting = {
    protocol,
    host,
    port: Number(port),
  };
  Global.setProxySetting(newProxy);
}

async function pictureSetting() {
  let bool = await vscode.window.showInputBox({
    placeHolder: "0",
    prompt: "0: 无图模式, 1: 小图模式, 2: 正常模式（请输入0/1/2）",
    value: Global.getStickerMode(),
  });
  if (bool === "0" || bool === "1" || bool === "2") {
    Global.setStickerMode(bool);
  }
}

async function postSetting() {
  let snum = await vscode.window.showInputBox({
    placeHolder: "25",
    prompt: "输入帖子显示的数量",
    value: Global.getPostNum().toString(),
  });
  if (!snum) {
    snum = "";
  }
  let num = parseInt(snum);
  Global.setPostNum(num);
}

async function filterSetting() {
  let bool = await vscode.window.showInputBox({
    placeHolder: "true",
    prompt: "输入true或者false(注意大小写)",
    value: String(Global.getFilterRead()),
  });
  if (bool === "false") {
    Global.setFilterRead(false);
  } else if (bool === "true") {
    Global.setFilterRead(true);
  }
}

async function domainSetting() {
  let domain = await vscode.window.showInputBox({
    placeHolder: Global.getNgaDomain().toString(),
    prompt: "输入想访问的NGA域名,bbs.nga.cn或者nga.178.com",
    value: Global.getNgaDomain().toString(),
  });
  if (domain != undefined) {
    Global.setNgaDomain(domain);
  }
}
