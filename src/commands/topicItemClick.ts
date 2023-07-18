import { TreeNode } from "../providers/BaseProvider";
import { LoginRequiredError, AccountRestrictedError } from "./../error";
import { NGA } from "../nga";
import * as vscode from "vscode";
import Global from "../global";
import * as path from "path";
import * as cheerio from "cheerio";
import http from "../http";
import { TopicDetail } from "../models/topicDetail";
import { TopicReply } from "../models/topicReply";
import axios from "axios";
import { syncCollectPosts } from "./syncCollect";
const yaml = require("js-yaml");

/**
 * 存放话题页面的panels
 * key：话题的链接
 * value：panel
 */
const panels: { [key: string]: vscode.WebviewPanel } = {};

/**
 * 截取标题
 * @param title 标题
 */
function _getTitle(title: string) {
  return title.length <= 15 ? title : title.slice(0, 15) + "...";
}

/**
 * 创建webview面板
 * @param id 面板id
 * @param label 面板标题
 */
function _createPanel(id: string, label: string): vscode.WebviewPanel {
  const panel = vscode.window.createWebviewPanel(
    id,
    _getTitle(label),
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      enableFindWidget: true,
    }
  );
  panel.iconPath = vscode.Uri.file(
    path.join(Global.context!.extensionPath, "resources/favicon.png")
  );
  panels[id] = panel;

  panel.onDidDispose(() => {
    delete panels[id];
  });
  return panel;
}

/**
 * 点击子节点打开详情页面
 * @param item 话题的子节点
 */
export default function topicItemClick(item: TreeNode) {
  // 如果panel已经存在，则直接激活
  let panel = panels[item.link];
  if (panel) {
    panel.reveal();
    return;
  }

  panel = _createPanel(item.link, item.label as string);
  panel.webview.onDidReceiveMessage((message) => {
    const topic: TopicDetail = message.__topic;
    switch (message.command) {
      case "setTitle":
        panel.title = _getTitle(message.title);
        break;
      case "browseImage":
        _openLargeImage(message.src);
        break;
      // case 'openTopic':
      //   // label显示/t/xxx部分
      //   {
      //     const item = new TreeNode(message.link.split('.com')[1], false);
      //     item.link = message.link;
      //     topicItemClick(item);
      //   }
      //   break;
      case "login":
        vscode.commands.executeCommand("nga.login");
        break;
      case "refresh":
        loadTopicInPanel(panel, item.link, message.page);
        break;
      case "onlyAuthor":
        loadOnlyAuthor(panel, item.link);
        break;
      case "cancelOnlyAuthor":
        loadTopicInPanel(panel, item.link, 1);
        break;
      case "pageTurning":
        loadTopicInPanel(panel, item.link, message.page);
        break;
      case "like":
        loadReplyLikes(panel, message.reply, topic, item.link);
        break;
      case "addLabel":
        vscode.commands.executeCommand("nga.addLabel", panel, message.user);
        break;
      case "delLabel":
        NGA.delLabel(panel, message.user, message.label);
        break;
      case "collect":
        collectPost(panel, topic);
        break;
      default:
        break;
    }
  });
  console.log(item.link);
  loadTopicInPanel(panel, item.link, 1);
}

/**
 * 在Panel中加载只看楼主
 * @param panel panel
 * @param topicLink 话题链接
 */
function loadOnlyAuthor(panel: vscode.WebviewPanel, topicLink: string) {
  panel.webview.html = NGA.renderPage("loading.html", {
    contextPath: Global.getWebViewContextPath(panel.webview),
  });

  // 获取详情数据
  NGA.getTopicDetail(topicLink, true, 0)
    .then((detail) => {
      // try {
      // 在panel被关闭后设置html，会出现'Webview is disposed'异常，暂时简单粗暴地解决一下
      var onlyAuthorArr: TopicReply[] = [];
      detail.replies.forEach((reply: TopicReply) => {
        if (reply.user.userNmae == detail.user.userNmae) {
          onlyAuthorArr.push(reply);
        }
      });
      detail.replies = onlyAuthorArr;
      if (Global.context?.globalState.get("showSticker") === "1") {
        panel.webview.html = NGA.renderPage("topic-spic.html", {
          topic: detail,
          // topicYml: yaml.safeDump(detail),
          contextPath: Global.getWebViewContextPath(panel.webview),
        });
      } else {
        panel.webview.html = NGA.renderPage("topic.html", {
          topic: detail,
          // topicYml: yaml.safeDump(detail),
          contextPath: Global.getWebViewContextPath(panel.webview),
        });
      }

      // } catch (err) {
      //   console.log(err);
      // }
    })
    .catch((err: Error) => {
      console.error(err);
      if (err instanceof LoginRequiredError) {
        panel.webview.html = NGA.renderPage("error.html", {
          contextPath: Global.getWebViewContextPath(panel.webview),
          message: err.message,
          showLogin: true,
          showRefresh: true,
        });
      } else if (err instanceof AccountRestrictedError) {
        panel.webview.html = NGA.renderPage("error.html", {
          contextPath: Global.getWebViewContextPath(panel.webview),
          message: err.message,
          showRefresh: false,
        });
      } else {
        panel.webview.html = NGA.renderPage("error.html", {
          contextPath: Global.getWebViewContextPath(panel.webview),
          message: err.message,
          showRefresh: true,
        });
      }
    });
}

/**
 * 在Panel中加载话题
 * @param panel panel
 * @param topicLink 话题链接
 */
function loadTopicInPanel(
  panel: vscode.WebviewPanel,
  topicLink: string,
  page: number
) {
  panel.webview.html = NGA.renderPage("loading.html", {
    contextPath: Global.getWebViewContextPath(panel.webview),
  });

  // 获取详情数据
  NGA.getTopicDetail(topicLink, false, page)
    .then((detail) => {
      if (Global.context?.globalState.get("showSticker") === "1") {
        panel.webview.html = NGA.renderPage("topic-spic.html", {
          topic: detail,
          contextPath: Global.getWebViewContextPath(panel.webview),
        });
      } else {
        panel.webview.html = NGA.renderPage("topic.html", {
          topic: detail,
          contextPath: Global.getWebViewContextPath(panel.webview),
        });
      }
    })
    .catch((err: Error) => {
      console.error(err);
      if (err instanceof LoginRequiredError) {
        panel.webview.html = NGA.renderPage("error.html", {
          contextPath: Global.getWebViewContextPath(panel.webview),
          message: err.message,
          showLogin: true,
          showRefresh: true,
        });
      } else if (err instanceof AccountRestrictedError) {
        panel.webview.html = NGA.renderPage("error.html", {
          contextPath: Global.getWebViewContextPath(panel.webview),
          message: err.message,
          showRefresh: false,
        });
      } else {
        panel.webview.html = NGA.renderPage("error.html", {
          contextPath: Global.getWebViewContextPath(panel.webview),
          message: err.message,
          showRefresh: true,
        });
      }
    });
}

/**
 * 打开大图
 * @param imageSrc 图片地址
 */
function _openLargeImage(imageSrc: string) {
  // 如果panel已经存在，则直接激活
  let panel = panels[imageSrc];
  if (panel) {
    panel.reveal();
    return;
  }

  console.log("打开大图：", imageSrc);
  panel = _createPanel(imageSrc, "查看图片");
  panel.webview.html = NGA.renderPage("browseImage.html", {
    imageSrc: imageSrc,
  });
}

/**
 * 点赞 or 取消点赞
 */
async function loadReplyLikes(
  panel: vscode.WebviewPanel,
  detail: any,
  topic: TopicDetail,
  topicLink: string
) {
  const cookie = Global.getCookie();
  if (!cookie) {
    vscode.window.showErrorMessage("请先登录");
    return false;
  }
  const pid = detail;
  const tid = topic.id;
  const r = await http.post(
    `https://${Global.ngaURL}/nuke.php?__lib=topic_recommend&__act=add&tid=${tid}&pid=${pid}&value=1&raw=3&lite=js`,
    { responseType: "arraybuffer" }
  );
  const t = r.data.replace("window.script_muti_get_var_store=", "");
  const d = JSON.parse(t);
  if (d.error) {
    vscode.window.showErrorMessage(d.error[0]);
    return false;
  }
  console.log(topic);
  let c = d.data[1] || 0;
  c = c > 0 ? c : 0;
  const { replies } = topic;
  const reply = replies.find((reply: TopicReply) => reply.pid === pid);
  let likes = 0;
  if (reply) {
    likes = reply.likes + c;
    panel.webview.postMessage({
      command: "updateLikes",
      reply: {
        pid,
        likes,
      },
    });
    // 闪烁
    // loadTopicInPanel(panel, topicLink, page);
  } else {
    likes = topic.likes + c;
    panel.webview.postMessage({
      command: "updateLikes",
      reply: {
        pid,
        likes,
      },
    });
  }
}

async function collectPost(panel: vscode.WebviewPanel, topic: TopicDetail,) {
  const qs = require("qs");

  let collectors: any[] = [];
  await axios
    .post(
      `https://${Global.ngaURL}/nuke.php?__lib=topic_favor_v2&__act=list_folder`,
      qs.stringify({
        __output: "1",
        __inchst: "UTF8",
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=utf-8'",
          "Cookie": Global.getCookie() || "",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36 Edg/114.0.1823.82",
        },
      }
    )
    .then(function (response: any) {
      console.log(response);
      const t = response.data.replace("window.script_muti_get_var_store=", "");
      const d = JSON.parse(t);
      console.log(d["data"]);
      const asciiBuffer = Buffer.from(d["data"]["0"]["0"]["name"], "ascii");
      for (let i in d["data"]) {
        if (d["data"][i]["0"] !== undefined) {
          let item = {
            topicId: d["data"][i]["0"]["id"],
            title: `收藏夹${i}`,
            label: `${i}. 收藏夹${i}`,
            description: "",
          };
          collectors.push(item);
        }
      }
    });
  const select = await vscode.window.showQuickPick(collectors, {
    placeHolder: "选择收藏的收藏夹",
  });

  if (select === undefined) {
    return;
  }
  console.log(select);
  console.log(topic);
  await axios
    .post(
      `https://${Global.ngaURL}/nuke.php?__lib=topic_favor_v2&__act=add&__output=3&lite=js`,
      qs.stringify({
        __output: "1",
        __inchst: "UTF8",
        folder: select.label.split(".")[0],
        tid: topic.id,
        pid: '0'
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=utf-8'",
          "Cookie": Global.getCookie() || "",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36 Edg/114.0.1823.82",
        },
      }
    )
    .then(function (response: any) {
      console.log(response);
      const t = response.data.replace("window.script_muti_get_var_store=", "");
      const d = JSON.parse(t);
      console.log(d["data"]);
      vscode.window.showInformationMessage('收藏成功!');
    });
}
