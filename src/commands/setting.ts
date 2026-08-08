import * as vscode from "vscode";
import { ProxySetting } from "../models/proxySetting";
import Global from "../global";
import {
  normalizeChatCompletionsUrl,
  testChatCompletions,
} from "../services/modelClient";

export default async function setting() {
  const sel = await vscode.window.showQuickPick(
    // ["代理设置", "图片模式", "帖子显示数量", "是否过滤已读帖子", "NGA域名配置"],
    // {
    //   placeHolder: "设置",
    // }
    ["模型配置", "代理设置", "图片模式", "帖子主题", "标题字体大小", "是否过滤已读帖子", "NGA域名配置"],
    {
      placeHolder: "设置",
    }
  );

  switch (sel) {
    case "模型配置":
      await modelSetting();
      break;
    case "代理设置":
      proxySetting();
      break;
    case "图片模式":
      pictureSetting();
      break;
    case "帖子主题":
      topicThemeSetting();
      break;
    case "标题字体大小":
      titleHeadingSetting();
      break;
    // case "帖子显示数量":
    //   postSetting();
    //   break;
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

async function titleHeadingSetting() {
  let heading = await vscode.window.showInputBox({
    placeHolder: "h1",
    prompt: "输入标题级别：h1、h2、h3 或 h4",
    value: Global.getTopicTitleHeading(),
  });
  if (heading === undefined) {
    return;
  }

  heading = heading.trim().toLowerCase();
  if (heading === "h1" || heading === "h2" || heading === "h3" || heading === "h4") {
    Global.setTopicTitleHeading(heading);
  }
}

export async function modelSetting() {
  while (true) {
    const config = Global.getModelConfig();
    const hasApiKey = Boolean(await Global.getModelApiKey());
    const selected = await vscode.window.showQuickPick(
      [
        {
          label: "编辑 Base URL",
          description: config.baseUrl || "未配置",
          action: "baseUrl",
        },
        {
          label: "编辑 Model Name",
          description: config.modelName || "未配置",
          action: "modelName",
        },
        {
          label: "设置 API Key",
          description: hasApiKey ? "已安全存储" : "未配置；本地免鉴权服务可留空",
          action: "apiKey",
        },
        {
          label: "清除 API Key",
          description: hasApiKey ? "删除已存储的密钥" : "当前没有已存储的密钥",
          action: "clearApiKey",
        },
        {
          label: "测试 /chat/completions",
          description: "真实请求并验证 choices[0].message.content",
          action: "test",
        },
      ],
      {
        placeHolder: "OpenAI-compatible 模型配置",
      }
    );

    if (!selected) {
      return;
    }

    switch (selected.action) {
      case "baseUrl":
        await editModelBaseUrl();
        break;
      case "modelName":
        await editModelName();
        break;
      case "apiKey":
        await editModelApiKey();
        break;
      case "clearApiKey":
        await Global.clearModelApiKey();
        vscode.window.showInformationMessage("模型 API Key 已清除");
        break;
      case "test":
        await testModelConnection();
        break;
      default:
        return;
    }
  }
}

async function editModelBaseUrl() {
  const input = await vscode.window.showInputBox({
    placeHolder: "https://api.example.com/v1",
    prompt: "可填写 API 根地址，也可直接填写完整的 /chat/completions 地址",
    value: Global.getModelConfig().baseUrl,
    ignoreFocusOut: true,
  });
  if (input === undefined) {
    return;
  }

  const value = input.trim();
  if (value) {
    try {
      normalizeChatCompletionsUrl(value);
    } catch (error) {
      vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error));
      return;
    }
  }
  await Global.setModelBaseUrl(value);
}

async function editModelName() {
  const input = await vscode.window.showInputBox({
    placeHolder: "例如 gpt-4.1-mini、deepseek-chat 或本地模型名",
    prompt: "填写服务端 /chat/completions 接受的 model 字段",
    value: Global.getModelConfig().modelName,
    ignoreFocusOut: true,
  });
  if (input !== undefined) {
    await Global.setModelName(input.trim());
  }
}

async function editModelApiKey() {
  const input = await vscode.window.showInputBox({
    placeHolder: "API Key",
    prompt: "密钥将存入 VS Code SecretStorage，不会传入帖子 Webview",
    password: true,
    ignoreFocusOut: true,
  });
  if (input === undefined) {
    return;
  }

  const value = input.trim();
  if (!value) {
    vscode.window.showWarningMessage("API Key 为空；如需免鉴权访问，请使用“清除 API Key”");
    return;
  }
  await Global.setModelApiKey(value);
  vscode.window.showInformationMessage("模型 API Key 已安全保存");
}

async function testModelConnection() {
  const config = Global.getModelConfig();
  const apiKey = await Global.getModelApiKey();
  try {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `正在测试 ${config.modelName || "模型"} 的 /chat/completions 接口`,
        cancellable: false,
      },
      () => testChatCompletions(config, apiKey, Global.getProxySetting())
    );
    vscode.window.showInformationMessage(
      `模型连接测试成功：${config.modelName} 支持 /chat/completions`
    );
  } catch (error) {
    vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error));
  }
}

async function topicThemeSetting() {
  const themes = [
    { label: "Markdown 编辑器", description: "文档结构、折叠标记与行号", value: "editor" },
    { label: "TypeScript 源码", description: "对象字面量、数组项与缩进参考线", value: "source" },
    { label: "PowerShell 终端", description: "连续命令与日志输出", value: "terminal" },
  ];
  const selected = await vscode.window.showQuickPick(themes, {
    placeHolder: "选择帖子页面主题",
  });
  if (selected) {
    Global.setTopicTheme(selected.value);
  }
}

// async function postSetting() {
//   let snum = await vscode.window.showInputBox({
//     placeHolder: "25",
//     prompt: "输入帖子显示的数量",
//     value: Global.getPostNum().toString(),
//   });
//   if (!snum) {
//     snum = "";
//   }
//   let num = parseInt(snum);
//   Global.setPostNum(num);
// }

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
