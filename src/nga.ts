import Global from './global'
import http from './http'
import * as cheerio from 'cheerio'
import { AxiosResponse } from 'axios'
import * as template from 'art-template'
import * as path from 'path'

export class NGA {

    static async checkCookie(cookie: string): Promise<boolean> {
        if (!cookie) {
            return false
        }
        const res = await http.get('https://bbs.nga.cn/thread.php?fid=-7', {
            headers: {
                Cookie: cookie
            },
            responseType: 'arraybuffer'
        })
        return res.request._redirectable._redirectCount <= 0
    }

    static async getTopicListByNode(node: Node): Promise<Topic[]> {
        console.log(`https://bbs.nga.cn/thread.php?fid=${node.name}&page=1&lite=js`)
        const res = await http.get(`https://bbs.nga.cn/thread.php?fid=${node.name}&page=1&lite=js`, { responseType: 'arraybuffer' });
        let j = res.data.replace('window.script_muti_get_var_store=','')
        console.log(j)
        let js = JSON.parse(j).data
        console.log(js)
        const list: Topic[] = [];
        for (let val in js.__T) {
            const topic = new Topic();
            const t = js.__T[val]
            console.log(t)
            topic.title = t.subject
            topic.link = 'https://bbs.nga.cn' + t.tpcurl + '&lite=js'
            topic.node = node
            list.push(topic)
        }
        return list;
    }

    static async getTopicDetail(topicLink: string): Promise<TopicDetail> {

        const res = await http.get<string>(topicLink + '&page=1', { responseType: 'arraybuffer' });
        // const $ = cheerio.load(res.data);

        const topic = new TopicDetail();
        let j = res.data.replace('window.script_muti_get_var_store=','').replace(/"alterinfo":".*?",/g, '').replace(/\[img\]\./g, '<img src=\\"https://img.nga.178.com/attachments').replace(/\[\/img\]/g, '\\">').replace(/\[img\]/g, '<img src=\\"').replace(/\[url\]/g, '<a href=\\"').replace(/\[\/url\]/g, '\\">url</a>').replace(/"signature":".*?",/g, '')
        let js = JSON.parse(j).data
        console.log(js)
        topic.id = parseInt(js.__T.tid);
        topic.link = topicLink.replace('&lite=js','');
        topic.title = js.__T.subject;
        topic.node = {
            name: js.__R['0'].fid,
            title: js.__F.name || ''
        };
        topic.authorName = js.__T.author
        topic.authorID = js.__T.authorid
        topic.displayTime = js.__R['0'].postdate || '';
        topic.content = js.__R['0'].content || '';
        topic.replyCount = js.__T.replies;
        topic.likes = js.__R['0'].score

        const _getTopicReplies = async (link: string): Promise<TopicReply[]> => {
            const replies: TopicReply[] = [];
            for (let i=1; i<=1000; i++) {
                console.log(topicLink + '&page=' + i)
                const rs =await http.get<string>(topicLink + '&page=' + i, { responseType: 'arraybuffer' });
                let j = rs.data.replace('window.script_muti_get_var_store=','').replace(/"alterinfo":".*?",/g, '').replace(/\[img\]\./g, '<img src=\\"https://img.nga.178.com/attachments').replace(/\[\/img\]/g, '\\">').replace(/\[img\]/g, '<img src=\\"').replace(/\[url\]/g, '<a href=\\"').replace(/\[\/url\]/g, '\\">url</a>').replace(/"signature":".*?",/g, '')
                console.log(j)
                let js = JSON.parse(j).data
                if (js.__PAGE != i) {
                    break;
                }

                let users = new Map()
                for (let val in js.__U) {
                    let u = new User()
                    u.uid = '' + js.__U[val]?.uid
                    u.userNmae = js.__U[val]?.username
                    u.regDate = js.__U[val]?.regdate
                    users.set(val, u)
                }
                for (let j=1; j<js.__R__ROWS; j++) {
                    let rep = new TopicReply();
                    rep.uid = '' + js.__R[j].authorid;
                    rep.userName = users.has(rep.uid) ? users.get(rep.uid).userNmae : rep.uid;
                    rep.time = js.__R[j].postdate;
                    rep.floor = js.__R[j].lou;
                    rep.content = js.__R[j].content;
                    if (rep.content.startsWith('[quote]')) {
                        rep.quote = rep.content.match(/\[quote\].*\[\/quote\]/g)[0];
                        rep.quoteuid = rep.quote.match(/\[uid=(\d+?)\]/g)[0].replace(/\[uid=/g, '').replace(/\]/g, '')
                        rep.quoteuname = rep.quote.match(/\[uid=\d+\](.*?)\[\/uid\]/g)[0].replace(/\[uid=\d+\]/g, '').replace(/\[\/uid\]/g, '')
                        rep.quote = rep.quote.replace(/\[quote\].*?\[\/b\]/g, '').replace(/\[\/quote\]/g, '').replace('<br/><br/>', '').replace(/<br\/>/g, '\n')
                        rep.content = rep.content.replace(/\[quote\].*\[\/quote\]/g, '');
                    } else if (rep.content.startsWith('[b]')) {
                        let rdate = rep.content.match(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}/g)[0]
                        rep.quoteuname = rep.content.match(/\[uid=\d+\](.*?)\[\/uid\]/g)[0].replace(/\[uid=\d+\]/g, '').replace(/\[\/uid\]/g, '')
                        for (let k=0; k < replies.length; k++) {
                            if (replies[k].userName == rep.quoteuname && replies[k].time == rdate) {
                                rep.quote = replies[k].content;
                                rep.quoteuid = replies[k].uid
                                break
                            }
                        }
                        rep.content = rep.content.replace(/\[b\].*\[\/b\]/g, '');
                    }
                    rep.likes = js.__R[j].score;
                    replies.push(rep)
                }
            }
            return replies;
        };

        topic.replies = await _getTopicReplies(topicLink)
        console.log(topic.replies)
        console.log(topic)
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
}

export class TopicReply {
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
}

export class User {
    public uid: string = '';
    public userNmae: string = '';
    public regDate: string = '';
}