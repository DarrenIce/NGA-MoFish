import { ExtensionContext, Webview, Uri } from 'vscode';
import { Node } from './nga';
import * as iconvlite from 'iconv-lite';

export default class Global {
    static ngaURL = 'bbs.nga.cn';

    static context: ExtensionContext | undefined;

    static gbk2utf8(src: string): any {
        console.log(iconvlite.encodingExists('utf8'));
        console.log(iconvlite.encodingExists('gbk'));
        return iconvlite.decode(iconvlite.encode(src, 'gbk'), 'utf-8');
    }

    static getWebViewContextPath(webview: Webview): string {
        return webview.asWebviewUri(Uri.file(this.context!.extensionPath)).toString();
    }

    static async setCookie(cookie: string) {
        await this.context?.globalState.update('cookie', cookie);
    }

    static getCookie(): string | undefined {
        return this.context?.globalState.get('cookie');
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

    static getReadList(): number[] {
        return this.context?.globalState.get<number[]>('readList') || [];
    }

    static setReadList(newList: number[]) {
        this.context?.globalState.update('readList', Array.from(new Set(newList)));
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
        return this.context?.globalState.get<number>('postNum') || 25;
    }

    static setPostNum(num: number) {
        this.context?.globalState.update('postNum', num);
    }

    static getStickerMode(): string {
        return this.context?.globalState.get<string>('showSticker') || '0';
    }

    static setStickerMode(mode: string) {
        this.context?.globalState.update('showSticker', mode);
    }

    static getFilterRead(): boolean {
        return this.context?.globalState.get<boolean>('filterRead') || true;
    }

    static setFilterRead(mode: boolean) {
        this.context?.globalState.update('filterRead', mode);
    }
}
