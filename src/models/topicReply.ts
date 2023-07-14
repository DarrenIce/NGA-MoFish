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
    // 点赞数
    public likes: number = 0;
    public quote: string = '';
    public quoteuid: string = '';
    public quoteuname: string = '';
    public comments: Comment[] = [];
}