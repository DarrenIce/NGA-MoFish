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


export class NGA {

    static async checkCookie(cookie: string): Promise<boolean> {
        if (!cookie) {
            return false;
        }
        const res = await http.get(`https://${Global.ngaURL}/thread.php?fid=479`, {
            headers: {
                Cookie: cookie
            },
            responseType: 'arraybuffer'
        });
        return res.request._redirectable._redirectCount <= 0;
    }

    static async getTopicListByNode(node: Node): Promise<Topic[]> {
        console.log(Global.ngaURL);
        let maxnum = Global.getPostNum();
        // console.log(`https://bbs.nga.cn/thread.php?fid=${node.name}&lite=js&noprefix`);
        const list: Topic[] = [];
        let tids: number[] = [];
        let nownum = 0;
        for (let i=1; i <=10; i++) {
            const res = await http.get(`https://${Global.ngaURL}/thread.php?fid=${node.name}&lite=js&page=${i}&noprefix`, { responseType: 'arraybuffer' });
            try {
                let js = JSON.parse(res.data).data;
                console.log(js);
                let fid2name = new Map();
                for (let f in js.__F.sub_forums) {
                    fid2name.set(f, js.__F.sub_forums[f]['1']);
                }
                fid2name.set(node.name, node.title);
                
                for (let val in js.__T) {
                    const topic = new Topic();
                    const t = js.__T[val];
                    if (t.fid != node.name) {
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
                    topic.link = `https://${Global.ngaURL}${t.tpcurl}&lite=js&noprefix`;
                    topic.node = node;
                    list.push(topic);
                    tids.push(tid);
                    nownum = nownum + 1;
                    if (nownum >= maxnum) {
                        return list;
                    }
                }
            } catch {
                continue;
            }
        }
        
        return list;
    }

    static async getTopicByTid(tid: string) {
        const res = await http.get(`https://${Global.ngaURL}/read.php?lite=js&noprefix&page=1&tid=${tid}`, { responseType: 'arraybuffer' });
        let j = res.data.replace(/"alterinfo":".*?",/g, '').replace(/\[img\]\./g, '<img src=\\"https://img.nga.178.com/attachments').replace(/\[\/img\]/g, '\\">').replace(/\[img\]/g, '<img src=\\"').replace(/\[url\]/g, '<a href=\\"').replace(/\[\/url\]/g, '\\">url</a>').replace(/"signature":".*?",/g, '');
        // console.log(j);
        let js = JSON.parse(j).data;
        let node = new TreeNode(js.__T.subject, false);
        node.link = `https://${Global.ngaURL}/read.php?lite=js&noprefix&tid=${tid}`;
        topicItemClick(node);
    }

    static parseJson(data: string): any {
        let r = data.replace(/\[img\]\./g, '<img style=\\"background-color: #FFFAFA\\" src=\\"https://img.nga.178.com/attachments')
                    .replace(/\[\/img\]/g, '\\">')
                    .replace(/\[img\]/g, '<img style=\\"background-color: #FFFAFA\\" src=\\"')
                    .replace(/\[url\]/g, '<a href=\\"')
                    .replace(/\[\/url\]/g, '\\">url</a>')
                    .replace(/"signature":".*?",/g, '')
                    .replace(/"alterinfo":".*?",/g, '');
        if (Global.getStickerMode() === '0') {
            r = r.replace(/<img.*?>/g, '[img]');
        }
        let js = JSON5.parse(r).data;
        return js;
    }

    static async getTopicDetail(topicLink: string, onlyAuthor: boolean, page: number): Promise<TopicDetail> {
        const res = await http.get<string>(topicLink + '&page=1', { responseType: 'arraybuffer' });
        const topic = new TopicDetail();
        let range = 5;

        const _getUserMap = (jsUsers: any): Map<any, any> => {
            let globalUsers = Global.getUserLabel();
            let userMap = NGA.userArray2Map(globalUsers);
            console.log('before userMap.values(): ', Array.from(userMap.values()));
            for (let val in jsUsers) {
                if (userMap.has(val)) {
                    continue;
                }
                let u = new User();
                u.uid = '' + jsUsers[val]?.uid;
                u.userNmae = jsUsers[val]?.username;
                u.regDate = jsUsers[val]?.regdate;
                u.labels = [];
                userMap.set(val, u);
            }
            console.log('after userMap.values(): ', Array.from(userMap.values()));
            return userMap;
        };

        topic.onlyAuthor = onlyAuthor;
        topic.pageNow = page;
        let js = NGA.parseJson(res.data);
        topic.id = parseInt(js.__T.tid);
        Global.addReadTid(topic.id);
        topic.link = topicLink.replace('&lite=js', '');
        topic.title = js.__T.subject;
        topic.node = {
            name: js.__R['0'].fid,
            title: js.__F.name || ''
        };

        topic.user.uid = '' + js.__R['0'].authorid;
        topic.user.userNmae = js.__U[topic.user.uid].username;
        topic.displayTime = js.__R['0'].postdate || '';
        topic.content = js.__R['0'].content || '';
        topic.content = topic.content.replace('[b]', '<b>').replace('[/b]', '</b>');
        if (Global.getStickerMode() !== '0') {
            topic.content = processSmile(topic.content);
        }
        topic.replyCount = js.__T.replies;
        topic.pages = Math.ceil(topic.replyCount / (range * 20));
        topic.likes = js.__R['0'].score;
        if (js.__R['0'].hasOwnProperty('comment')) {
            let users = _getUserMap(js.__U);
            for (let c in js.__R['0'].comment) {
                let com = new Comment();
                com.authorID = js.__R['0'].comment[c].authorid;
                com.authorName = users.has(com.authorID) ? users.get(com.authorID).userName : com.authorID;
                com.content = js.__R['0'].comment[c].content.replace(/\[quote\].*\[\/quote\]/g, '').replace(/\[b\].*\[\/b\]/g, '');
                com.time = js.__R['0'].comment[c].postdate;
                topic.comments.push(com);
            }
        }
        let pid2reply = new Map();

        const _getTopicReplies = async (link: string, onlyAuthor: boolean, page: number): Promise<TopicReply[]> => {
            const replies: TopicReply[] = [];
            if (onlyAuthor) {
                page = 1000;
            }
            for (let i = onlyAuthor? 1 : (page-1)*range +1; i <= page*range; i++) {
                topic.needTurn = true;
                // console.log(topicLink + '&page=' + i);
                const rs = await http.get<string>(topicLink + '&page=' + i, { responseType: 'arraybuffer' });
                let js = NGA.parseJson(rs.data);
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
                    rep.content = js.__R[j].hasOwnProperty('content') ? ""+js.__R[j].content : ""+js.__R[j].subject;
                    if (js.__R[j].hasOwnProperty('content')) {
                        js.__R[j].content = ""+js.__R[j].content;
                        if (js.__R[j].hasOwnProperty('reply_to')) {
                            let rtpid = '' + js.__R[j].reply_to;
                            if (pid2reply.has(rtpid)) {
                                rep.quote = pid2reply.get(rtpid).content;
                                rep.quoteuid = pid2reply.get(rtpid).uid;
                                rep.quoteuname = pid2reply.get(rtpid).userName;
                            }
                            rep.content = rep.content.replace(/\[quote\].*\[\/quote\]/g, '').replace(/\[b\].*\[\/b\]/g, '').replace(/\[quote\].*\[\/b\]/g, '');
                        } else if (js.__R[j].content.startsWith('[quote]')) {
                            if (js.__R[j].content.indexOf('[pid=') !== -1) {
                                let rtpid = js.__R[j].content.match(/pid=\d+/g)![0].replace('pid=', '');
                                if (pid2reply.has(rtpid)) {
                                    rep.quote = pid2reply.get(rtpid).content;
                                    rep.quoteuid = pid2reply.get(rtpid).uid;
                                    rep.quoteuname = pid2reply.get(rtpid).userName;
                                }
                            } else if (js.__R[j].content.indexOf('[tid=') !== -1) {
                                rep.quote = '引用主题';
                            }
                            
                            rep.content = rep.content.replace(/\[quote\].*\[\/quote\]/g, '').replace(/\[b\].*\[\/b\]/g, '').replace(/\[quote\].*\[\/b\]/g, ''); 
                        }
                        rep.likes = js.__R[j].score;
                        // 如果既有回复又有加粗，那是啥情况呢，等一个具体案例
                        rep.content = rep.content.replace('[b]', '<b>').replace('[/b]', '</b>');
                        if (Global.getStickerMode() !== '0') {
                            rep.content = processSmile(rep.content);
                        }
                        pid2reply.set(rep.pid, rep);
                    }

                    if (js.__R[j].hasOwnProperty('comment')) {
                        for (let c in js.__R[j].comment) {
                            let com = new Comment();
                            com.authorID = js.__R[j].comment[c].authorid;
                            com.authorName = users.has(com.authorID) ? users.get(com.authorID).userName : com.authorID;
                            com.content = js.__R[j].comment[c].content.replace(/\[quote\].*\[\/quote\]/g, '').replace(/\[b\].*\[\/b\]/g, '');
                            com.time = js.__R[j].comment[c].postdate;
                            rep.comments.push(com);
                            // console.log(com);
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
            console.log(`https://${Global.ngaURL}/thread.php?key=${q}&page=${i}&lite=js&noprefix`)
            const res = await http.get<string>(encodeURI(`https://${Global.ngaURL}/thread.php?key=${q}&page=${i}&lite=js&noprefix`), {
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
}