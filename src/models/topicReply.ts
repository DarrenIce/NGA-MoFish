import { User } from "./user";
import { Comment } from "./comment";

export class TopicReply {
    public pid: string = '';
    public user: User = new User();
    // 回复时间
    public time: string = '';
    // 楼层
    public floor: string = '';
    // 回复内容
    public content: string = '';
    // 原始 BBCode 内容，用于引用回帖时保留 NGA 标记
    public rawContent: string = '';
    // 点赞数
    public likes: number = 0;
    public quote: string = '';
    public quotePid: string = '';
    public quoteuid: string = '';
    public quoteuname: string = '';
    public quoteTime: string = '';
    public comments: Comment[] = [];
}
