const vscode = acquireVsCodeApi();

const vsPostMessage = (command, messages) => {
  vscode.postMessage({
    command: command,
    __topic: __topic,
    ...(messages || {})
  });
};

// 设置标题
vsPostMessage('setTitle', {
  title: document.title
});

// 给图片添加查看图片的功能
document.querySelectorAll('img').forEach((img) => {
  img.onload = () => {
    console.log(img);
    AutoResizeImage(40, 40, img);
    img.style.cursor = 'zoom-in';
    img.onclick = () => {
      console.log(img.src);
      AutoResizeImage(10000, 10000, img);
      // vsPostMessage('browseImage', {
      //   src: img.src
      // });
    };
  };
  if (img.width > 40) {
    console.log(img);
    AutoResizeImage(40, 40, img);
    img.style.cursor = 'zoom-in';
    img.onclick = () => {
      console.log(img.src);
      AutoResizeImage(10000, 10000, img);
    };
  }
});

// 图片地址的a标签，点击打开图片
const supportImageTypes = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'];
supportImageTypes.forEach((type) => {
  document.querySelectorAll(`.topic-content a[href$=".${type}"]`).forEach((a) => {
    a.dataset['imageSrc'] = a.href;
    // vsc中 return false 不能阻止a标签跳转。曲线救国
    a.href = 'javascript:;';
    a.onclick = () => {
      console.log(a.dataset['imageSrc']);
      vsPostMessage('browseImage', {
        src: a.dataset['imageSrc']
      });
      return false;
    };
  });
});

/**
 * 指向站内地址的a标签，点击在插件内打开
 * 有几种：
 * 1. 完整地址：https://www.v2ex.com/t/123456，域名也可能是v2ex.com
 * 2. 相对地址：/t/123456
 */
document.querySelectorAll('.topic-content a[href*="/t/"]').forEach((a) => {
  // 取帖子链接
  let href = '';
  if (/(\/t\/\d+)/.test(a.href)) {
    href = 'https://www.v2ex.com' + RegExp.$1;
  } else {
    return;
  }

  a.dataset['href'] = href;
  a.href = 'javascript:;';
  a.onclick = () => {
    console.log(a.dataset['href']);
    vsPostMessage('openTopic', {
      link: a.dataset['href']
    });
    return false;
  };
});

// 评论
function onSubmit() {
  const content = (document.querySelector('#replyBox').value || '').trim();
  if (!content) {
    return;
  }

  vsPostMessage('postReply', {
    content: content
  });
}

function Resize(Ratio, objImg) {
  var img = new Image();
  img.src = objImg.src;
  var w = img.width;
  var h = img.height;
  w = w * Ratio;
  h = h * Ratio;
  console.log(Ratio, img.width, img.height, w, h);
  objImg.height = h;
  objImg.width = w;
}

function AutoResizeImage(maxWidth, maxHeight, objImg) {
  var img = new Image();
  img.src = objImg.src;
  var hRatio;
  var wRatio;
  var Ratio = 1;
  var w = img.width;
  var h = img.height;
  wRatio = maxWidth / w;
  hRatio = maxHeight / h;
  if (maxWidth == 0 && maxHeight == 0) {
    Ratio = 1;
  } else if (maxWidth == 0) {//
    if (hRatio < 1) Ratio = hRatio;
  } else if (maxHeight == 0) {
    if (wRatio < 1) Ratio = wRatio;
  } else if (wRatio < 1 || hRatio < 1) {
    Ratio = (wRatio <= hRatio ? wRatio : hRatio);
  }
  // if (Ratio < 1) {
    w = w * Ratio;
    h = h * Ratio;
  // }
  objImg.height = h;
  objImg.width = w;
}

window.addEventListener('message', event => {
  const message = event.data; // The JSON data our extension sent
  switch (message.command) {
      case 'updateLikes':
          console.log('js updateLikes: ', message.reply);
          document.querySelectorAll(`span[pid="${message.reply.pid}"]`).forEach((a) => {
            a.innerText = message.reply.likes;
          })
          break;
      case 'delLabel':
      case 'addLabel':
          console.log('js processLabel: ', message.reply);
          document.querySelectorAll(`span[replyuid="${message.reply.user.uid}"]`).forEach((a) => {
            console.log('processLabel innerText: ', a.innerText);
            console.log('processLabel innerHTML: ', a.innerHTML);
            let inner = '';
            for (let i in message.reply.user.labels) {
              inner += `<span class="label${message.reply.user.labels[i]['class']}" onclick="vsPostMessage('delLabel', {&quot;user&quot;:${escapeHTML(JSON.stringify(message.reply.user))}, &quot;label&quot;:${escapeHTML(JSON.stringify(message.reply.user.labels[i]['content']))}, &quot;__topic&quot;: ${escapeHTML(JSON.stringify(__topic))} });">${message.reply.user.labels[i]['content']}</span>`;
            }
            console.log('processLabel inner: ', inner);
            a.innerHTML = inner;
          })
          break;
  }
});

function HTMLEncode(html) {
  var temp = document.createElement("div");
  (temp.textContent != null) ? (temp.textContent = html) : (temp.innerText = html);
  var output = temp.innerHTML;
  temp = null;
  return output;
}

function HTMLDecode(text) { 
  var temp = document.createElement("div"); 
  temp.innerHTML = text; 
  var output = temp.innerText || temp.textContent; 
  temp = null; 
  return output; 
} 

function escapeHTML(text) {
  text = "" + text;
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");;
}