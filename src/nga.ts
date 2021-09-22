import Global from './global';
import http from './http';
import * as cheerio from 'cheerio';
import { AxiosResponse } from 'axios';
import * as template from 'art-template';
import * as path from 'path';
import { report } from 'process';
import { TreeNode } from './providers/BaseProvider';
import topicItemClick from './commands/topicItemClick';
import {processSmile} from './process/smile';
import { readlink } from 'fs';

export class NGA {

    static async checkCookie(cookie: string): Promise<boolean> {
        if (!cookie) {
            return false;
        }
        const res = await http.get('https://bbs.nga.cn/thread.php?fid=-7', {
            headers: {
                Cookie: cookie
            },
            responseType: 'arraybuffer'
        });
        return res.request._redirectable._redirectCount <= 0;
    }

    static async getTopicListByNode(node: Node): Promise<Topic[]> {
        let maxnum = Global.getPostNum();
        console.log(`https://bbs.nga.cn/thread.php?fid=${node.name}&lite=js`);
        const list: Topic[] = [];
        let nownum = 0;
        for (let i=1; i <=10; i++) {
            const res = await http.get(`https://bbs.nga.cn/thread.php?fid=${node.name}&lite=js&page=${i}`, { responseType: 'arraybuffer' });
            let j = res.data.replace('window.script_muti_get_var_store=', '');
            // console.log(j)
            try {
                let js = JSON.parse(j).data;
                let fid2name = new Map();
                for (let f in js.__F.sub_forums) {
                    fid2name.set(f, js.__F.sub_forums[f]['1']);
                }
                fid2name.set(node.name, node.title);
                // console.log(js)
                
                for (let val in js.__T) {
                    const topic = new Topic();
                    const t = js.__T[val];
                    // console.log(t)
                    if (t.fid != node.name) {
                        continue;
                    }
                    let sub = fid2name.has('' + t.fid) ? fid2name.get('' + t.fid) : '';
                    sub = sub.length <= 5 ? sub : sub.slice(0,5) + '...';
                    topic.title = `[${sub}]` + t.subject;
                    let tid = parseInt(t.tid);
                    let readList = Global.getReadList();
                    if (readList.indexOf(tid) !== -1) {
                        if (Global.context?.globalState.get('filterRead')) {
                            continue;
                        } else {
                            topic.title = `(已读)` + topic.title;
                        }
                    }
                    topic.link = 'https://bbs.nga.cn' + t.tpcurl + '&lite=js';
                    topic.node = node;
                    list.push(topic);
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
        const res = await http.get(`https://bbs.nga.cn/read.php?lite=js&page=1&tid=${tid}`, { responseType: 'arraybuffer' });
        let j = res.data.replace('window.script_muti_get_var_store=', '').replace(/"alterinfo":".*?",/g, '').replace(/\[img\]\./g, '<img src=\\"https://img.nga.178.com/attachments').replace(/\[\/img\]/g, '\\">').replace(/\[img\]/g, '<img src=\\"').replace(/\[url\]/g, '<a href=\\"').replace(/\[\/url\]/g, '\\">url</a>').replace(/"signature":".*?",/g, '');
        // console.log(j);
        let js = JSON.parse(j).data;
        let node = new TreeNode(js.__T.subject, false);
        node.link = `https://bbs.nga.cn/read.php?lite=js&tid=${tid}`;
        topicItemClick(node);
    }

    static async getTopicDetail(topicLink: string, onlyAuthor: boolean): Promise<TopicDetail> {

        const res = await http.get<string>(topicLink + '&page=1', { responseType: 'arraybuffer' });
        // const $ = cheerio.load(res.data);

        const topic = new TopicDetail();

        topic.onlyAuthor = onlyAuthor;
        let j = res.data.replace('window.script_muti_get_var_store=', '').replace(/"alterinfo":".*?",/g, '').replace(/\[img\]\./g, '<img style=\\"background-color: #FFFAFA\\" src=\\"https://img.nga.178.com/attachments').replace(/\[\/img\]/g, '\\">').replace(/\[img\]/g, '<img style=\\"background-color: #FFFAFA\\" src=\\"').replace(/\[url\]/g, '<a href=\\"').replace(/\[\/url\]/g, '\\">url</a>').replace(/"signature":".*?",/g, '');
        // console.log(j);
        let js = JSON.parse(j).data;
        // console.log(js);
        topic.id = parseInt(js.__T.tid);
        Global.addReadTid(topic.id);
        topic.link = topicLink.replace('&lite=js', '');
        topic.title = js.__T.subject;
        topic.node = {
            name: js.__R['0'].fid,
            title: js.__F.name || ''
        };
        // topic.authorName = js.__T.author;
        // topic.authorID = js.__T.authorid;
        topic.authorID = js.__R['0'].authorid;
        topic.authorName = js.__U[topic.authorID].username;
        topic.displayTime = js.__R['0'].postdate || '';
        topic.content = js.__R['0'].content || '';
        topic.content = topic.content.replace('[b]', '<b>').replace('[/b]', '</b>');
        topic.content = processSmile(topic.content)
        topic.replyCount = js.__T.replies;
        topic.likes = js.__R['0'].score;
        if (js.__R['0'].hasOwnProperty('comment')) {
            let users = new Map();
            for (let val in js.__U) {
                let u = new User();
                u.uid = '' + js.__U[val]?.uid;
                u.userNmae = js.__U[val]?.username;
                u.regDate = js.__U[val]?.regdate;
                users.set(val, u);
            }
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

        const _getTopicReplies = async (link: string): Promise<TopicReply[]> => {
            const replies: TopicReply[] = [];
            for (let i = 1; i <= 1000; i++) {
                console.log(topicLink + '&page=' + i);
                const rs = await http.get<string>(topicLink + '&page=' + i, { responseType: 'arraybuffer' });
                let j = rs.data.replace('window.script_muti_get_var_store=', '').replace(/"alterinfo":".*?",/g, '').replace(/\[img\]\./g, '<img style=\\"background-color: #FFFAFA\\" src=\\"https://img.nga.178.com/attachments').replace(/\[\/img\]/g, '\\">').replace(/\[img\]/g, '<img style=\\"background-color: #FFFAFA\\" src=\\"').replace(/\[url\]/g, '<a href=\\"').replace(/\[\/url\]/g, '\\">url</a>').replace(/"signature":".*?",/g, '');
                // console.log(j);
                let js = JSON.parse(j).data;
                if (js.__PAGE !== i) {
                    break;
                }

                let users = new Map();
                for (let val in js.__U) {
                    let u = new User();
                    u.uid = '' + js.__U[val]?.uid;
                    u.userNmae = js.__U[val]?.username;
                    u.regDate = js.__U[val]?.regdate;
                    users.set(val, u);
                }
                for (let j = 1; j < js.__R__ROWS; j++) {
                    let rep = new TopicReply();
                    rep.pid = '' + js.__R[j].pid;
                    rep.uid = '' + js.__R[j].authorid;
                    rep.userName = users.has(rep.uid) ? users.get(rep.uid).userNmae : rep.uid;
                    rep.time = js.__R[j].postdate;
                    rep.floor = js.__R[j].lou;
                    rep.content = js.__R[j].hasOwnProperty('content') ? ""+js.__R[j].content : ""+js.__R[j].subject;
                    if (js.__R[j].hasOwnProperty('content')) {
                        // if (rep.content.startsWith('[quote]')) {
                        //     rep.quote = rep.content.match(/\[quote\].*\[\/quote\]/g) ? rep.content.match(/\[quote\].*\[\/quote\]/g)![0] : rep.content.match(/\[quote\].*\[\/b\]/g)![0];
                        //     rep.quoteuid = rep.quote.indexOf('[uid]') === -1 ? rep.quote.match(/\[uid=(\d+?)\]/g)![0].replace(/\[uid=/g, '').replace(/\]/g, '') : '-1';
                        //     rep.quoteuname = rep.quote.indexOf('[uid]') === -1 ? rep.quote.match(/\[uid=\d+\](.*?)\[\/uid\]/g)![0].replace(/\[uid=\d+\]/g, '').replace(/\[\/uid\]/g, '') : rep.quote.match(/\[uid\](.*?)\[\/uid\]/g)![0].replace(/\[uid\]/g, '').replace(/\[\/uid\]/g, '');
                        //     rep.quote = rep.quote.replace(/\[quote\].*?\[\/b\]/g, '').replace(/\[\/quote\]/g, '').replace('<br/><br/>', '').replace(/<br\/>/g, '\n');
                        //     rep.content = rep.content.replace(/\[quote\].*\[\/quote\]/g, '');
                        // } else if (rep.content.startsWith('[b]') && rep.content.indexOf('Post') !== -1) {
                        //     let rdate = rep.content.match(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}/g)![0];
                        //     rep.quoteuname = rep.content.indexOf('[uid]') === -1 ? rep.content.match(/\[uid=\d+\](.*?)\[\/uid\]/g)![0].replace(/\[uid=\d+\]/g, '').replace(/\[\/uid\]/g, '') : rep.content.match(/\[uid\](.*?)\[\/uid\]/g)![0].replace(/\[uid\]/g, '').replace(/\[\/uid\]/g, '');
                        //     for (let k=0; k < replies.length; k++) {
                        //         if (replies[k].userName === rep.quoteuname && replies[k].time === rdate) {
                        //             rep.quote = replies[k].content;
                        //             rep.quoteuid = replies[k].uid;
                        //             break;
                        //         }
                        //     }
                        //     rep.content = rep.content.replace(/\[b\].*\[\/b\]/g, '');
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
                        // }
                        rep.likes = js.__R[j].score;
                        // 如果既有回复又有加粗，那是啥情况呢，等一个具体案例
                        rep.content = rep.content.replace('[b]', '<b>').replace('[/b]', '</b>');
                        rep.content = processSmile(rep.content);
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

        topic.replies = await _getTopicReplies(topicLink);
        // console.log(topic.replies)
        // console.log(topic);
        return topic;
    }

    static renderPage(page: string, data: any = {}): string {
        const templatePath = path.join(Global.context!.extensionPath, 'html', page);
        const html = template(templatePath, data);
        return html;
    }
}

export class Node {
    // 节点fid
    public name: string = '';
    // 节点标题（显示的名称）
    public title: string = '';
}

export class Topic {
    // 标题
    public title: string = '';
    // 链接
    public link: string = '';
    // 节点
    public node: Node = { title: '', name: '' };
}

export class TopicDetail {
    // id
    public id: number = 0;
    // 链接
    public link: string = '';
    // 标题
    public title: string = '';
    // 节点
    public node: Node = { title: '', name: '' };
    public authorID: string = '';
    // 作者名字
    public authorName: string = '';
    // 时间
    public displayTime: string = '';
    // 内容
    public content: string = '';
    // 点赞数
    public likes: number = 0;
    // 回复总条数
    public replyCount: number = 0;
    // 回复
    public replies: TopicReply[] = [];
    public comments: Comment[] = [];
    // 只看楼主
    public onlyAuthor: boolean = false;
}

export class TopicReply {
    public pid: string = '';
    public uid: string = '';
    // 用户名
    public userName: string = '';
    // 回复时间
    public time: string = '';
    // 楼层
    public floor: string = '';
    // 回复内容
    public content: string = '';
    // 点赞数
    public likes: number = 0;
    public quote: string = '';
    public quoteuid: string = '';
    public quoteuname: string = '';
    public comments: Comment[] = [];
}

export class User {
    public uid: string = '';
    public userNmae: string = '';
    public regDate: string = '';
}

export class Comment {
    public authorID: string = '';
    public authorName: string = '';
    public time: string = '';
    public content: string = '';
}