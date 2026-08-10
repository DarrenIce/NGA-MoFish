import Global from './global';
import http from './http';
import * as template from 'art-template';
import * as path from 'path';
import { TreeNode } from './providers/BaseProvider';
import topicItemClick from './commands/topicItemClick';
import {processSmile} from './process/smile';
import * as JSON5 from 'json5';
import { Glob } from 'glob';
import { Node } from './models/node';
import { Topic } from './models/topic';
import { Label, User } from './models/user';
import { TopicDetail } from './models/topicDetail';
import { Comment } from './models/comment';
import { TopicReply } from './models/topicReply';
import { SearchElement } from './models/searchElement';
import * as vscode from 'vscode';
import showStatusBar from './commands/showStatusBar';
import { NgaQuoteInfo, parseNgaReply, renderNgaMarkup } from './process/ngaMarkup';
import { createNgaUserMap, mergeNgaUserMetadata } from './process/ngaUsers';
import { buildNgaReplyParams, NgaReplyOperation } from './process/ngaReply';
import { LoginRequiredError } from './error';

/** 按 JSON 字符串转义规则删除字段，避免正则 .*? 在引号内误截断 */
function stripJsonStringFields(json: string, fieldNames: string[]): string {
    for (const fieldName of fieldNames) {
        const key = `"${fieldName}":`;
        let searchFrom = 0;
        while (searchFrom < json.length) {
            const idx = json.indexOf(key, searchFrom);
            if (idx === -1) {
                break;
            }
            let i = idx + key.length;
            while (i < json.length && /\s/.test(json[i])) {
                i++;
            }
            if (json[i] !== '"') {
                searchFrom = idx + key.length;
                continue;
            }
            i++;
            while (i < json.length) {
                if (json[i] === '\\') {
                    i += 2;
                    continue;
                }
                if (json[i] === '"') {
                    let end = i + 1;
                    if (json[end] === ',') {
                        end++;
                    }
                    json = json.slice(0, idx) + json.slice(end);
                    searchFrom = idx;
                    break;
                }
                i++;
            }
            if (i >= json.length) {
                break;
            }
        }
    }
    return json;
}

function prepareNgaLiteJsRaw(data: string): string {
    let r = data;
    const prefix = 'window.script_muti_get_var_store=';
    if (r.startsWith(prefix)) {
        r = r.slice(prefix.length);
    }
    // alterinfo 等字段中的字面制表符会导致 JSON 解析失败（NGA API 文档说明 https://github.com/AgMonk/nga-api-doc）
    r = r.replace(/\t/g, '');
    return stripJsonStringFields(r, ['signature', 'alterinfo']);
}

function tryParseJson5(s: string): any {
    try {
        return JSON5.parse(s);
    } catch (e) {
        return null;
    }
}

function getNgaErrorMessage(error: any): string {
    if (typeof error === 'string') {
        return error;
    }
    if (Array.isArray(error)) {
        return error.map((item) => getNgaErrorMessage(item)).find(Boolean) || 'NGA 回帖失败';
    }
    if (error && typeof error === 'object') {
        const preferred = error['0'] || error.message || error.info;
        if (preferred) {
            return getNgaErrorMessage(preferred);
        }
        const first = Object.keys(error).map((key) => getNgaErrorMessage(error[key])).find(Boolean);
        return first || 'NGA 回帖失败';
    }
    return 'NGA 回帖失败';
}

function renderTopicContent(content: string): string {
    const showImages = Global.getStickerMode() !== '0';
    let rendered = renderNgaMarkup(content, { showImages });
    if (showImages) {
        rendered = processSmile(rendered);
    }
    return rendered;
}

interface QuoteDisplay {
    quote: string;
    quotePid: string;
    quoteuid: string;
    quoteuname: string;
    quoteTime: string;
}

function applyQuote(target: QuoteDisplay, quote: NgaQuoteInfo | undefined, referencedReply?: TopicReply) {
    if (!quote && !referencedReply) {
        return;
    }
    target.quotePid = quote?.pid || referencedReply?.pid || '';
    target.quoteuid = quote?.uid || referencedReply?.user.uid || '';
    target.quoteuname = quote?.userName || referencedReply?.user.userNmae || '';
    target.quoteTime = quote?.time || referencedReply?.time || '';
    target.quote = quote?.content
        ? renderTopicContent(quote.content)
        : referencedReply?.content || '';
}

function buildComment(rawComment: any, users: Map<any, any>): Comment {
    const comment = new Comment();
    comment.authorID = '' + rawComment.authorid;
    const author = users.get(comment.authorID);
    comment.authorName = author?.userNmae || comment.authorID;
    comment.time = rawComment.postdate || '';

    const parsedComment = parseNgaReply('' + (rawComment.content || ''));
    comment.content = renderTopicContent(parsedComment.content);
    return comment;
}

// 修复被截断的 JSON：回退到最后一个安全的结构边界，并补齐未闭合的 {} / []，
// 从而尽量恢复已经完整到达的部分（如主楼与前面的楼层），而不是整帖解析失败。
function repairTruncatedJson(s: string): string {
    let inStr = false;
    let esc = false;
    const stack: string[] = [];
    let lastSafe = -1;
    let lastSafeStack: string[] | null = null;
    for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (inStr) {
            if (esc) {
                esc = false;
            } else if (c === '\\') {
                esc = true;
            } else if (c === '"') {
                inStr = false;
            }
            continue;
        }
        if (c === '"') {
            inStr = true;
        } else if (c === '{' || c === '[') {
            stack.push(c);
        } else if (c === '}' || c === ']') {
            stack.pop();
            lastSafe = i + 1;
            lastSafeStack = stack.slice();
        } else if (c === ',') {
            lastSafe = i;
            lastSafeStack = stack.slice();
        }
    }
    if (lastSafe < 0 || !lastSafeStack) {
        return s;
    }
    let out = s.slice(0, lastSafe);
    for (let k = lastSafeStack.length - 1; k >= 0; k--) {
        out += lastSafeStack[k] === '{' ? '}' : ']';
    }
    return out;
}

export class NGA {

    static async checkCookie(cookie: string): Promise<boolean> {
        if (!cookie) {
            return false;
        }
        const res = await http.get(`https://${Global.getNgaDomain()}/thread.php?fid=479`, {
            headers: {
                Cookie: cookie
            },
            responseType: 'arraybuffer'
        });
        return res.request._redirectable._redirectCount <= 0;
    }

    static async getTopicListByNode(node: Node): Promise<Topic[]> {
        console.log(Global.getNgaDomain());
        let page = Global.getCertainPage(node.name);
        showStatusBar(node.title, page);
        console.log(`https://${Global.getNgaDomain()}/thread.php?${node.name}&lite=js&page=${page}&noprefix`);
        const list: Topic[] = [];
        let tids: number[] = [];
        const res = await http.get(`https://${Global.getNgaDomain()}/thread.php?${node.name}&lite=js&page=${page}&noprefix`, { responseType: 'arraybuffer' });
        let js = JSON.parse(res.data).data;
        // console.log(js);
        let fid2name = new Map();
        for (let f in js.__F.sub_forums) {
            fid2name.set(f, js.__F.sub_forums[f]['1']);
        }
        fid2name.set(node.name, node.title);
        
        for (let val in js.__T) {
            const topic = new Topic();
            const t = js.__T[val];
            if (`fid=${t.fid}` != node.name && node.name.indexOf("fid") != -1) {
                continue;
            }
            topic.title = t.subject;
            let tid = parseInt(t.tid);
            if (tids.indexOf(tid) !== -1) {
                continue;
            }
            let readList = Global.getReadList();
            if (readList.indexOf(tid) !== -1) {
                if (Global.context?.globalState.get('filterRead')) {
                    continue;
                } else {
                    topic.title = `(已读)` + topic.title;
                }
            }
            topic.link = `https://${Global.getNgaDomain()}${t.tpcurl}&lite=js&noprefix`;
            topic.node = node;
            list.push(topic);
            tids.push(tid);
        }
        return list;
        // let maxnum = Global.getPostNum();
        // let nownum = 0;
        // for (let i=1; i <=10; i++) {
        //     const res = await http.get(`https://${Global.getNgaDomain()}/thread.php?${node.name}&lite=js&page=${i}&noprefix`, { responseType: 'arraybuffer' });
        //     try {
        //         let js = JSON.parse(res.data).data;
        //         console.log(js);
        //         let fid2name = new Map();
        //         for (let f in js.__F.sub_forums) {
        //             fid2name.set(f, js.__F.sub_forums[f]['1']);
        //         }
        //         fid2name.set(node.name, node.title);
                
        //         for (let val in js.__T) {
        //             const topic = new Topic();
        //             const t = js.__T[val];
        //             if (`fid=${t.fid}` != node.name && node.name.indexOf("fid") != -1) {
        //                 continue;
        //             }
        //             topic.title = t.subject;
        //             let tid = parseInt(t.tid);
        //             if (tids.indexOf(tid) !== -1) {
        //                 continue;
        //             }
        //             let readList = Global.getReadList();
        //             if (readList.indexOf(tid) !== -1) {
        //                 if (Global.context?.globalState.get('filterRead')) {
        //                     continue;
        //                 } else {
        //                     topic.title = `(已读)` + topic.title;
        //                 }
        //             }
        //             topic.link = `https://${Global.getNgaDomain()}${t.tpcurl}&lite=js&noprefix`;
        //             topic.node = node;
        //             list.push(topic);
        //             tids.push(tid);
        //             nownum = nownum + 1;
        //             if (nownum >= maxnum) {
        //                 return list;
        //             }
        //         }
        //     } catch {
        //         continue;
        //     }
        // }
        
        // return list;
    }

    static async getTopicByTid(tid: string) {
        const js = await NGA.getReadJson(`https://${Global.getNgaDomain()}/read.php?lite=js&noprefix&page=1&tid=${tid}`);
        let node = new TreeNode(js.__T?.subject || '', false);
        node.link = `https://${Global.getNgaDomain()}/read.php?lite=js&noprefix&tid=${tid}`;
        // 修改为打开到当前选定的选项卡
        try {
            vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup').then(() => {
                topicItemClick(node);
            });
        } catch (error) {
            topicItemClick(node);
        }
    }    
    static buildLiteInput(data: string): string {
        return prepareNgaLiteJsRaw(data);
    }

    static parseJson(data: string): any {
        const r = NGA.buildLiteInput(data);
        const parsed = tryParseJson5(r);
        if (parsed) {
            return parsed.data;
        }
        // 响应被截断/损坏时，尽量修复以恢复已到达的内容，而不是直接失败
        const repaired = tryParseJson5(repairTruncatedJson(r));
        if (repaired) {
            return repaired.data;
        }
        throw new Error('帖子数据解析失败：NGA 返回的数据被截断，无法恢复');
    }

    // 带匿名兜底的健壮取帖：NGA 登录态的 lite=js 缓存有时会返回被截断的响应
    // （JSON 不完整，导致 JSON5 报 invalid end of input；而浏览器走的是普通 HTML
    // 页面所以正常）。匿名请求命中的是另一份完整缓存，检测到截断时用匿名请求兜底重取。
    static async getReadJson(url: string): Promise<any> {
        const res = await http.get<string>(url, { responseType: 'arraybuffer' });
        const cleaned = NGA.buildLiteInput(res.data);
        const parsed = tryParseJson5(cleaned);
        if (parsed) {
            return parsed.data;
        }
        const recoveredAuthenticated = tryParseJson5(repairTruncatedJson(cleaned));
        try {
            // headers.Cookie = '' 可绕过请求拦截器注入的登录 Cookie，走匿名缓存
            const anon = await http.get<string>(url, { responseType: 'arraybuffer', headers: { Cookie: '' } });
            const anonCleaned = NGA.buildLiteInput(anon.data);
            const anonParsed = tryParseJson5(anonCleaned);
            if (anonParsed) {
                return mergeNgaUserMetadata(anonParsed.data, recoveredAuthenticated?.data);
            }
            // 两份缓存都被截断：取更长的那份修复，尽量多恢复楼层
            const best = ('' + anon.data).length > ('' + res.data).length ? anonCleaned : cleaned;
            const repairedBest = tryParseJson5(repairTruncatedJson(best));
            if (repairedBest) {
                return mergeNgaUserMetadata(repairedBest.data, recoveredAuthenticated?.data);
            }
        } catch (e) {
            // 匿名兜底失败（如网络异常或需要登录），继续走本地修复
        }
        if (recoveredAuthenticated) {
            return recoveredAuthenticated.data;
        }
        throw new Error('帖子数据解析失败：NGA 返回的数据被截断，匿名重取仍失败');
    }

    static async getTopicDetail(topicLink: string, onlyAuthor: boolean, page: number): Promise<TopicDetail> {
        const topic = new TopicDetail();
        let range = 5;

        const _getUserMap = (jsUsers: any): Map<any, any> => {
            return createNgaUserMap(jsUsers, Global.getUserLabel());
        };

        topic.onlyAuthor = onlyAuthor;
        topic.pageNow = page;
        let js = await NGA.getReadJson(topicLink + '&page=1');
        topic.id = parseInt(js.__T?.tid || 0);
        Global.addReadTid(topic.id);
        topic.link = topicLink.replace('&lite=js', '');
        topic.title = js.__T?.subject || '';
        topic.node = {
            name: js.__R?.['0'] ? js.__R['0'].fid : '',
            title: js.__F?.name || ''
        };

        const firstPageUsers = _getUserMap(js.__U);
        topic.user.uid = '' + js.__R['0'].authorid;
        topic.user.userNmae = firstPageUsers.get(topic.user.uid)?.userNmae || topic.user.uid;
        topic.user.labels = firstPageUsers.get(topic.user.uid)?.labels || [];
        topic.displayTime = js.__R['0'].postdate || '';
        topic.rawContent = '' + (js.__R['0'].content || '');
        topic.content = renderTopicContent(topic.rawContent);
        topic.replyCount = js.__T?.replies || (js.__R ? Object.keys(js.__R).length : 0);
        topic.pages = Math.ceil(topic.replyCount / (range * 20));
        topic.likes = js.__R['0'].score;
        if (js.__R['0'].hasOwnProperty('comment')) {
            for (let c in js.__R['0'].comment) {
                topic.comments.push(buildComment(js.__R['0'].comment[c], firstPageUsers));
            }
        }
        let pid2reply = new Map<string, TopicReply>();

        const _getTopicReplies = async (link: string, onlyAuthor: boolean, page: number): Promise<TopicReply[]> => {
            const replies: TopicReply[] = [];
            if (onlyAuthor) {
                page = 1000;
            }
            for (let i = onlyAuthor? 1 : (page-1)*range +1; i <= page*range; i++) {
                topic.needTurn = true;
                // console.log(topicLink + '&page=' + i);
                let js = await NGA.getReadJson(topicLink + '&page=' + i);
                if (js.__PAGE !== i) {
                    topic.needTurn = false;
                    break;
                }

                let users =_getUserMap(js.__U);
                for (let j = i === 1 ? 1 : 0; j < js.__R__ROWS; j++) {
                    let rep = new TopicReply();
                    rep.pid = '' + js.__R[j].pid;
                    rep.user.uid = '' + js.__R[j].authorid;
                    rep.user.userNmae = users.has(rep.user.uid) ? users.get(rep.user.uid).userNmae : rep.user.uid;
                    rep.user.labels = users.has(rep.user.uid) ? users.get(rep.user.uid).labels : [];
                    rep.time = js.__R[j].postdate;
                    rep.floor = js.__R[j].lou;
                    rep.rawContent = js.__R[j].hasOwnProperty('content') ? ""+js.__R[j].content : ""+js.__R[j].subject;
                    rep.content = rep.rawContent;
                    if (js.__R[j].hasOwnProperty('content')) {
                        js.__R[j].content = ""+js.__R[j].content;
                        const parsedReply = parseNgaReply(rep.content);
                        const replyToPid = parsedReply.quote?.pid
                            || (js.__R[j].hasOwnProperty('reply_to') ? '' + js.__R[j].reply_to : '');
                        const referencedReply = replyToPid ? pid2reply.get(replyToPid) : undefined;
                        applyQuote(rep, parsedReply.quote, referencedReply);
                        rep.content = parsedReply.content;
                        rep.likes = js.__R[j].score;
                        rep.content = renderTopicContent(rep.content);
                        pid2reply.set(rep.pid, rep);
                    }

                    if (js.__R[j].hasOwnProperty('comment')) {
                        for (let c in js.__R[j].comment) {
                            rep.comments.push(buildComment(js.__R[j].comment[c], users));
                        }
                    }

                    replies.push(rep);
                }
            }
            return replies;
        };

        topic.replies = await _getTopicReplies(topicLink, onlyAuthor, page);
        if (page == topic.pages) {
            topic.needTurn = false;
        }
        console.log('getTopicDetail topic: ', topic);
        return topic;
    }

    static renderPage(page: string, data: any = {}): string {
        const templatePath = path.join(Global.context!.extensionPath, 'html', page);
        const html = template(templatePath, data);
        return html;
    }

    static async postReply(request: {
        tid: string;
        pid: string;
        operation: NgaReplyOperation;
        content: string;
    }): Promise<void> {
        if (!Global.getCookie()) {
            throw new LoginRequiredError('请先登录 NGA 后再回帖');
        }
        const params = buildNgaReplyParams(request);
        const qs = require('qs');
        const queryParams: { [key: string]: string } = {
            ...params,
            __inchst: 'UTF8',
            lite: 'js',
            __output: '8',
        };
        Object.keys(queryParams).forEach((key) => {
            if (queryParams[key] === '') {
                delete queryParams[key];
            }
        });
        const query = qs.stringify(queryParams);
        const baseUrl = `https://${Global.getNgaDomain()}`;
        const response = await http.post(
            `${baseUrl}/post.php?${query}`,
            '',
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    Referer: `${baseUrl}/read.php?tid=${request.tid}`,
                },
                responseType: 'arraybuffer',
            },
        );
        const raw = '' + response.data;
        const body = raw.replace(/^window\.script_muti_get_var_store=/, '').trim();
        let parsed: any = null;
        try {
            parsed = JSON5.parse(body);
        } catch (_error) {
            // post.php 也可能返回 HTML/XML，交给下面的文本错误检测。
        }
        if (parsed) {
            const error = parsed?.error;
            if (error) {
                throw new Error(getNgaErrorMessage(error));
            }
            if (parsed?.data?.error) {
                throw new Error(getNgaErrorMessage(parsed.data.error));
            }
            return;
        }
        // HTML/XML 响应没有统一结构，服务端失败时通常会直接返回中文提示。
        const failure = /(帐号权限不足|账号权限不足|发帖或回复时间超过限制|回复时间超过限制|操作失败|权限不足|请先登录)/i.exec(body);
        if (failure) {
            throw new Error(failure[1]);
        }
    }

    /**
     *
     * @param q 查询关键词
     * @param from 与第一个结果的偏移量（默认 0），比如 0, 10, 20
     * @param size 结果数量（默认 10）
     */
    static async search(q: string, from = 0, size = 20): Promise<SearchElement[]> {
        const se: SearchElement[] = [];
        let pass = 0;
        let count = 0;
        for (let i =1; i <= 1000; i++) {
            console.log(`https://${Global.getNgaDomain()}/thread.php?key=${q}&page=${i}&lite=js&noprefix`)
            const res = await http.get<string>(encodeURI(`https://${Global.getNgaDomain()}/thread.php?key=${q}&page=${i}&lite=js&noprefix`), {
                headers: {
                    Cookie: Global.getCookie()
                },
                responseType: 'arraybuffer'
            });
            // let j = res.data.replace('window.script_muti_get_var_store=', '');
            let js = JSON.parse(res.data).data;
            for (let val in js.__T) {
                const t = js.__T[val];
                if (t.subject === "帐号权限不足") {
                     continue;
                }
                if (t.subject === "帖子发布或回复时间超过限制") {
                    continue;
                }
                if (pass < from) {
                    pass++;
                    continue;
                }
                let s = new SearchElement();
                s.id = parseInt(t.tid);
                s.authorID = t.authorid;
                s.authorName = t.author;
                s.title = t.subject;
                s.replies = parseInt(t.replies);
                let date = new Date(parseInt(t.postdate) * 1000);
                s.postdate = `${date.getFullYear()}-${NGA.stillTwo(date.getMonth() + 1)}-${NGA.stillTwo(date.getDate())} ${NGA.stillTwo(date.getHours())}:${NGA.stillTwo(date.getMinutes())}:${NGA.stillTwo(date.getSeconds())}`;
                se.push(s);
                count++;
                if (count >= size) {
                    return se;
                }
            }
        }
        return se;
    }

    static addLabel(panel: vscode.WebviewPanel, user: User, label: string) {
        let globalUsers = Global.getUserLabel();
        console.log('globalUsers: ', globalUsers);
        console.log('typeof globalUsers: ', typeof globalUsers);
        let userMap = NGA.userArray2Map(globalUsers);
        user = userMap.has(user.uid) ? userMap.get(user.uid) : user;
        let newLabel = new Label();
        newLabel.class = (user.labels.length % 5 + 1).toString();
        newLabel.content = label;
        user.labels.push(newLabel);
        console.log('user: ', user);
        userMap.set(user.uid, user);
        console.log('userMap: ', Array.from(userMap.values()));
        Global.updateUserLabel(Array.from(userMap.values()));
        panel.webview.postMessage({command: 'addLabel', reply: {
            user,
          }});
    }

    static delLabel(panel: vscode.WebviewPanel, user: User, label: string) {
        let globalUsers = Global.getUserLabel();
        console.log('globalUsers: ', globalUsers);
        console.log('typeof globalUsers: ', typeof globalUsers);
        let userMap = NGA.userArray2Map(globalUsers);
        user = userMap.has(user.uid) ? userMap.get(user.uid) : user;
        let index = -1;
        for (let i in user.labels) {
            if (user.labels[i].content === label) {
                index = parseInt(i, 10);
                break;
            }
        }
        if (index !== -1) {
            user.labels.splice(index, 1);
        }
        for (let i in user.labels) {
            user.labels[i].class = (parseInt(i) % 5 + 1).toString();
        }
        console.log('user: ', user);
        userMap.set(user.uid, user);
        console.log('userMap: ', Array.from(userMap.values()));
        Global.updateUserLabel(Array.from(userMap.values()));
        panel.webview.postMessage({command: 'addLabel', reply: {
            user,
          }});
    }

    static stillTwo(num: number): string {
        return ("0" + num).substr(-2);
    }

    static userArray2Map(users: any[]): Map<any, any> {
        console.log('userArray2Map users: ', users);
        let userMap = new Map();
        for (let user in users) {
            userMap.set(users[user]['uid'], users[user]);
        }
        return userMap;
    }

    static pageTurning(fid: string, turn: number): boolean {
        let page = Global.getCertainPage(fid);
        page = page + turn;
        if (page <= 0) {
            return false;
        }
        Global.updateNodePage(fid, page);
        return true;
    }

    static backFirstPage(fid: string): boolean {
        let page = Global.getCertainPage(fid);
        if (page === 1) {
            return false;
        }
        Global.updateNodePage(fid, 1);
        return true;
    }
}
