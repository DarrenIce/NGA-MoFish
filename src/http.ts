import axios from 'axios';
import Global from './global';
import * as iconv from 'iconv-lite';

const http = axios.create({
    baseURL: `https://${Global.ngaURL}`,
    headers: {
        // 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.141 Safari/537.36 Edg/87.0.664.75'
        // 临时解决网页端无法查看评论的问题，解决方案原帖：https://bbs.nga.cn/read.php?tid=33731366
        'User-Agent': 'NGA_WP_JW(;WINDOWS)'
    },
    timeout: 150000
});

http.interceptors.request.use((config) => {
    if (config.headers['Cookie'] === undefined) {
        config.headers['Cookie'] = Global.getCookie() || '';
    }
    return config;
});

http.interceptors.response.use(function (response) {
    response.data = iconv.decode(response.data, 'gbk');
    return response;
});

export default http;