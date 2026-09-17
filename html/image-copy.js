/**
 * 帖子图片右键复制支持（topic.html / topic-spic.html / browseImage.html 共用）
 *
 * 1. 给帖子图片打上 data-vscode-context（webviewSection == 'nga-image' + imageSrc），
 *    使 package.json 中 webview/context 菜单项仅在图片上出现，并把图片地址传给命令；
 * 2. 接收扩展侧下发的图片字节，用 navigator.clipboard.write 写入系统剪贴板。
 *    （外链图片在 webview 内受 CORS 限制，字节由扩展侧下载后回传）
 */
(function () {
  /** base64 转 Uint8Array */
  function base64ToBytes(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  /** 给单个图片元素补充右键菜单上下文 */
  function markImageElement(img) {
    const src = img.src;
    // 只标记 http(s) 的帖子图片，跳过表情资源等
    if (!src || !/^https?:\/\//i.test(src)) {
      return;
    }
    let context = {
      webviewSection: 'nga-image',
      imageSrc: src,
      preventDefaultContextMenuItems: false
    };
    const existing = img.getAttribute('data-vscode-context');
    if (existing) {
      try {
        context = Object.assign(JSON.parse(existing), context);
      } catch (e) {
        // 已有值不是合法 JSON 时忽略，直接覆盖
      }
    }
    img.setAttribute('data-vscode-context', JSON.stringify(context));
  }

  /** 标记当前文档中所有帖子图片（含无图模式点击加载后动态出现的图片） */
  function markAllImages() {
    document.querySelectorAll('img').forEach((img) => {
      // 只标记帖子正文与回复内容里的图片；大图页的图片在 HTML 中已带显式上下文
      if (img.closest('.topic-content')) {
        markImageElement(img);
      }
    });
  }

  /** 显示轻量复制结果提示浮层 */
  function showCopyResult(ok) {
    const tip = document.createElement('div');
    tip.textContent = ok ? '已复制图片到剪贴板' : '复制图片失败';
    tip.style.cssText = [
      'position:fixed',
      'top:16px',
      'right:16px',
      'z-index:2147483647',
      'padding:6px 12px',
      'border-radius:4px',
      'font-size:12px',
      'color:#fff',
      'background:' + (ok ? 'rgba(60,140,60,0.92)' : 'rgba(180,60,60,0.92)'),
      'box-shadow:0 2px 8px rgba(0,0,0,0.3)',
      'opacity:0',
      'transition:opacity .2s'
    ].join(';');
    document.body.appendChild(tip);
    requestAnimationFrame(() => { tip.style.opacity = '1'; });
    setTimeout(() => {
      tip.style.opacity = '0';
      setTimeout(() => tip.remove(), 300);
    }, 1500);
  }

  /**
   * 将图片字节写入系统剪贴板。
   * clipboard.write 要求 document 处于焦点状态（菜单关闭后焦点回到 webview），
   * 因此参照 VS Code 官方 Markdown 预览实现做短暂重试。
   */
  async function writeImageToClipboard(payloadBase64, mimeType, retries) {
    if (!document.hasFocus() && retries > 0) {
      await new Promise((resolve) => setTimeout(resolve, 20));
      return writeImageToClipboard(payloadBase64, mimeType, retries - 1);
    }

    const bytes = base64ToBytes(payloadBase64);
    const blob = new Blob([bytes], { type: mimeType });
    try {
      await navigator.clipboard.write([new ClipboardItem({ [mimeType]: blob })]);
      return true;
    } catch (e) {
      console.warn('按原始 MIME 写剪贴板失败，尝试转 PNG：', e);
    }

    // 退化：canvas 重绘为 PNG（GIF 会丢动画，但静态内容可复制）
    const objectUrl = URL.createObjectURL(blob);
    try {
      const image = await new Promise((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('图片解码失败'));
        el.src = objectUrl;
      });
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0);
      const pngBlob = await new Promise((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG 编码失败'))), 'image/png');
      });
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
      return true;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  // 处理扩展侧消息
  window.addEventListener('message', (event) => {
    const message = event.data;
    if (!message || message.command !== 'writeImageToClipboard') {
      return;
    }
    writeImageToClipboard(message.payloadBase64, message.mimeType, 5)
      .then(showCopyResult)
      .catch((error) => {
        console.error('写图片到剪贴板失败：', error);
        showCopyResult(false);
      });
  });

  // 初始标记 + 无图模式点击加载、翻页刷新后的动态标记
  markAllImages();
  const observer = new MutationObserver(() => {
    markAllImages();
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
