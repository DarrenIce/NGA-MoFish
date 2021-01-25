import { ExtensionContext, Webview, Uri } from 'vscode'
import { Node } from './nga'
let Iconv  = require('iconv').Iconv;
import * as iconvlite from 'iconv-lite'

export default class Global {
    static context: ExtensionContext | undefined

    static gbk2utf8(src: string): any {
        console.log(iconvlite.encodingExists('utf8'))
        console.log(iconvlite.encodingExists('gbk'))
        return iconvlite.decode(iconvlite.encode(src, 'gbk'), 'utf-8')
    }

    static getWebViewContextPath(webview: Webview): string {
        return webview.asWebviewUri(Uri.file(this.context!.extensionPath)).toString();
    }

    static async setCookie(cookie: string) {
        await this.context?.globalState.update('cookie', cookie)
    }

    static getCookie(): string | undefined {
        return this.context?.globalState.get('cookie')
    }

    static getCustomNodes(): Node[] {
        return this.context?.globalState.get<Node[]>('nodes') || [];
    }

    static setCustomNodes(newNodes: Node[]) {
        this.context?.globalState.update('nodes', newNodes);
    }

    static addCustomNode(node: Node): boolean {
        const nodes = this.getCustomNodes();
        // 如果节点已经有了，则忽略
        if (nodes.find((n) => n.name === node.name)) {
            return false;
        }
        nodes.push(node);
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
}
