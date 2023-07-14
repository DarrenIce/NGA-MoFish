import { Node } from "./node";
import { Comment } from "./comment";
import { User } from "./user";
import { TopicReply } from "./topicReply";

export class TopicDetail {
    // id
    public id: number = 0;
    // 链接
    public link: string = '';
    // 标题
    public title: string = '';
    // 节点
    public node: Node = { title: '', name: '' };
    public user: User = new User();
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
    // 传递页码
    public pageNow: number = 0;
    // 是否需要翻页
    public needTurn: boolean = false;
    // 页码数
    public pages: number = 0;
}