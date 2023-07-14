class User {
    public uid: string = '';
    public userNmae: string = '';
    public regDate: string = '';
    public labels: Label[] = [];
}

class Label {
    public class: string = '';
    public content: string = '';
}

export {User, Label}