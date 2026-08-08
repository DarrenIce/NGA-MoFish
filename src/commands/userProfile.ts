import * as path from "path";
import * as vscode from "vscode";
import Global from "../global";
import { User } from "../models/user";
import { NGA } from "../nga";
import { modelSetting } from "./setting";
import {
  generateUserProfile,
  ModelConfigurationError,
} from "../services/userProfile";

const profilePanels = new Map<string, vscode.WebviewPanel>();

export function openUserProfile(user: User) {
  const existing = profilePanels.get(user.uid);
  if (existing) {
    existing.reveal();
    return;
  }

  const panel = vscode.window.createWebviewPanel(
    "nga.userProfile",
    `用户画像 · ${user.userNmae}`,
    vscode.ViewColumn.Active,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
    }
  );
  panel.iconPath = vscode.Uri.file(
    path.join(Global.context!.extensionPath, "resources/favicon.png")
  );
  profilePanels.set(user.uid, panel);

  let disposed = false;
  let running = false;
  let currentReport = "";
  const postMessage = (message: unknown) => {
    if (!disposed) {
      panel.webview.postMessage(message);
    }
  };

  const runAnalysis = async () => {
    if (running) {
      return;
    }
    running = true;
    currentReport = "";
    postMessage({ command: "analysisStarted" });

    try {
      const result = await generateUserProfile(user, (message) => {
        postMessage({ command: "progress", message });
      });
      currentReport = result.report;
      postMessage({
        command: "analysisCompleted",
        report: result.report,
        stats: {
          pageCount: result.history.pageCount,
          postCount: result.history.postCount,
          characterCount: result.history.characterCount,
          modelName: result.modelName,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      postMessage({
        command: "analysisFailed",
        message,
        canConfigure: error instanceof ModelConfigurationError,
      });
    } finally {
      running = false;
    }
  };

  panel.webview.onDidReceiveMessage(async (message) => {
    switch (message.command) {
      case "ready":
      case "retry":
        await runAnalysis();
        break;
      case "copyReport":
        if (currentReport) {
          await vscode.env.clipboard.writeText(currentReport);
          postMessage({ command: "reportCopied" });
        }
        break;
      case "openModelSettings":
        await modelSetting();
        break;
      default:
        break;
    }
  });

  panel.onDidDispose(() => {
    disposed = true;
    profilePanels.delete(user.uid);
  });

  panel.webview.html = NGA.renderPage("user-profile.html", {
    contextPath: Global.getWebViewContextPath(panel.webview),
    user,
  });
}
