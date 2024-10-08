import { ExtensionContext, Webview, Uri } from "vscode";
import * as iconvlite from "iconv-lite";
import { Node } from "./models/node";
import { ProxySetting } from "./models/proxySetting";
import { NodePage } from "./models/nodePage";

export default class Global {
  static ngaURL = "bbs.nga.cn";

  static context: ExtensionContext | undefined;

  static gbk2utf8(src: string): any {
    console.log(iconvlite.encodingExists("utf8"));
    console.log(iconvlite.encodingExists("gbk"));
    return iconvlite.decode(iconvlite.encode(src, "gbk"), "utf-8");
  }

  static getWebViewContextPath(webview: Webview): string {
    return webview
      .asWebviewUri(Uri.file(this.context!.extensionPath))
      .toString();
  }

  static async setCookie(cookie: string) {
    await this.context?.globalState.update("cookie", cookie);
  }

  static getCookie(): string | undefined {
    return this.context?.globalState.get("cookie");
  }

  static getCustomNodes(): Node[] {
    return this.context?.globalState.get<Node[]>("nodes") || [];
  }

  static setCustomNodes(newNodes: Node[]) {
    this.context?.globalState.update("nodes", newNodes);
  }

  static addCustomNode(node: Node): boolean {
    const nodes = this.getCustomNodes();
    // 如果节点已经有了，则忽略
    // 如果节点fid相同但是名称不同，则更新名称
    let _node = nodes.find((n) => n.name === node.name);
    if (_node && _node.title === node.title) {
      return false;
    } else if (_node) {
      _node.title = node.title;
    } else {
      nodes.push(node);
      this.addNodePage(node.name, 1);
    }
    this.setCustomNodes(nodes);
    return true;
  }

  static removeCustomNode(nodeName: string) {
    const nodes = this.getCustomNodes();
    const i = nodes.findIndex((n) => n.name === nodeName);
    if (i >= 0) {
      nodes.splice(i, 1);
    }
    this.setCustomNodes(nodes);
  }

  static getReadList(): number[] {
    return this.context?.globalState.get<number[]>("readList") || [];
  }

  static setReadList(newList: number[]) {
    this.context?.globalState.update("readList", Array.from(new Set(newList)));
  }

  static addReadTid(tid: number): boolean {
    const list = this.getReadList();
    if (list.indexOf(tid) !== -1) {
      return false;
    }
    if (list.length === 1000) {
      list.pop();
    }
    list.unshift(tid);
    this.setReadList(list);
    return true;
  }

  static getPostNum(): number {
    return this.context?.globalState.get<number>("postNum") || 25;
  }

  static setPostNum(num: number) {
    this.context?.globalState.update("postNum", num);
  }

  static getStickerMode(): string {
    return this.context?.globalState.get<string>("showSticker") || "0";
  }

  static setStickerMode(mode: string) {
    this.context?.globalState.update("showSticker", mode);
  }

  static getFilterRead(): boolean {
    return this.context?.globalState.get<boolean>("filterRead") || true;
  }

  static setFilterRead(mode: boolean) {
    this.context?.globalState.update("filterRead", mode);
  }

  static updateUserLabel(users: any[]) {
    this.context?.globalState.update("users1", users);
  }

  static getUserLabel(): any[] {
    return this.context?.globalState.get<any[]>("users1") || [];
  }

  /**
   * 获取代理设置
   */
  static getProxySetting(): ProxySetting | undefined {
    return this.context?.globalState.get<ProxySetting>("proxy");
  }

  /**
   * 保存代理设置
   * @param proxy 代理设置
   */
  static async setProxySetting(proxy?: ProxySetting) {
    await this.context?.globalState.update("proxy", proxy);
  }

  static getNgaDomain(): string {
    return this.context?.globalState.get<string>("domain") || Global.ngaURL;
  }

  static setNgaDomain(domain: string) {
    this.context?.globalState.update("domain", domain);
  }

  static initNodePage() {
    const nodes = this.getCustomNodes();
    let nps: NodePage[] = [];
    for (let n in nodes) {
      let np: NodePage = new NodePage();
      np.fid = nodes[n].name;
      np.page = 1;
      nps.push(np);
    }
    this.setNodePage(nps);
  }

  static setNodePage(newNodePage: NodePage[]) {
    this.context?.globalState.update("nodePage", newNodePage);
  }

  static getNodePage(): NodePage[] {
    return this.context?.globalState.get<NodePage[]>("nodePage") || [];
  }

  static getCertainPage(fid: string): number {
    let nps = this.getNodePage();
    for (let n in nps) {
      if (nps[n].fid === fid) {
        return nps[n].page;
      }
    }
    return -1;
  }

  static addNodePage(fid: string, page: number): boolean {
    let nps = this.getNodePage();
    for (let n in nps) {
      if (nps[n].fid === fid) {
        return false;
      }
    }
    let np: NodePage = new NodePage();
    np.fid = fid;
    np.page = page;
    nps.push(np);
    this.setNodePage(nps);
    return true;
  }

  static updateNodePage(fid: string, page: number) {
    let nps = this.getNodePage();
    for (let n in nps) {
      if (nps[n].fid === fid) {
        nps[n].page = page;
      }
    }
    this.setNodePage(nps);
  }
}
