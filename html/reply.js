(function () {
  const composer = document.querySelector('#replyComposer');
  const editor = document.querySelector('#replyBox');
  if (!composer || !editor) {
    return;
  }

  const modeSelect = document.querySelector('#replyMode');
  const targetLabel = document.querySelector('#replyTargetLabel');
  const editPane = document.querySelector('#replyEditPane');
  const previewPane = document.querySelector('#replyPreviewPane');
  const editTab = document.querySelector('#replyEditTab');
  const previewTab = document.querySelector('#replyPreviewTab');
  const submitButton = document.querySelector('#replySubmit');
  const status = document.querySelector('#replyStatus');
  const smileButton = document.querySelector('#replySmileButton');
  const smilePanel = document.querySelector('#replySmilePanel');
  const smiles = typeof __smiles !== 'undefined' && Array.isArray(__smiles) ? __smiles : [];
  const state = { mode: 'reply', pid: '0' };

  function getTarget(pid) {
    return __replyTargets[String(pid)];
  }

  function targetDescription(target) {
    if (!target || String(target.pid) === '0') {
      return '主楼';
    }
    return `#${target.floor || '?'} ${target.user.userNmae || target.user.uid || ''}`;
  }

  function insertText(text) {
    const start = editor.selectionStart || 0;
    const end = editor.selectionEnd || start;
    editor.setRangeText(text, start, end, 'end');
    editor.focus();
  }

  function prependText(text) {
    editor.value = text + editor.value;
    editor.setSelectionRange(text.length, text.length);
    editor.focus();
  }

  function wrapSelection(open, close, placeholder) {
    const start = editor.selectionStart || 0;
    const end = editor.selectionEnd || start;
    const selected = editor.value.slice(start, end);
    const inner = selected || placeholder;
    editor.setRangeText(open + inner + close, start, end, 'select');
    editor.setSelectionRange(start + open.length, start + open.length + inner.length);
    editor.focus();
  }

  function setStatus(message, isError) {
    status.textContent = message || '';
    status.classList.toggle('is-error', Boolean(isError));
  }

  function updateModeLabel() {
    const target = getTarget(state.pid);
    const description = targetDescription(target);
    const labels = {
      reply: '普通回帖',
      quote: `引用回帖 · ${description}`,
      'reply-to': `回复回帖 · ${description}`,
      comment: `贴条回帖 · ${description}`,
    };
    targetLabel.textContent = labels[state.mode] || labels.reply;
    modeSelect.value = state.mode;
  }

  window.setReplyMode = function (mode, pid) {
    const nextMode = ['reply', 'quote', 'reply-to', 'comment'].includes(mode) ? mode : 'reply';
    const nextPid = nextMode === 'reply' ? '0' : String(pid || state.pid || '0');
    const target = getTarget(nextPid);
    if (!target) {
      setStatus('找不到目标楼层，请刷新帖子后重试', true);
      return;
    }
    state.mode = nextMode;
    state.pid = nextPid;
    if (nextMode === 'quote') {
      const quoteMarker = `[pid=${nextPid},${__topic.id},`;
      if (!editor.value.includes(quoteMarker)) {
        prependText(target.quoteContent);
      }
    } else if (nextMode === 'reply-to' || nextMode === 'comment') {
      const replyMarker = `[b]Reply to [pid=${nextPid},${__topic.id},`;
      if (!editor.value.includes(replyMarker)) {
        prependText(target.replyHeader);
      }
    }
    updateModeLabel();
    showEditor();
    composer.scrollIntoView({ behavior: 'smooth', block: 'center' });
    editor.focus();
  };

  function renderPreview(raw) {
    let html = escapeHTML(raw || '');
    const colorMap = {
      red: 'red', orange: 'orange', green: '#89d185', blue: '#4daafc',
      purple: '#c586c0', gray: '#808080', grey: '#808080',
    };
    html = html
      .replace(/&lt;br\s*\/?&gt;/gi, '<br>')
      .replace(/\[pid=[^\]]+\]Reply\[\/pid\]/gi, '')
      .replace(/\[uid=[^\]]+\]([\s\S]*?)\[\/uid\]/gi, '$1')
      .replace(/\[b\]/gi, '<strong>').replace(/\[\/b\]/gi, '</strong>')
      .replace(/\[del\]/gi, '<del>').replace(/\[\/del\]/gi, '</del>');
    let previous = '';
    while (previous !== html) {
      previous = html;
      html = html.replace(/\[color=([^\]]+)\]([\s\S]*?)\[\/color\]/gi, (_match, color, inner) => {
        const value = colorMap[String(color).toLowerCase()];
        return value ? `<span style="color:${value}">${inner}</span>` : inner;
      });
      html = html.replace(/\[size=(\d{2,3})%\]([\s\S]*?)\[\/size\]/gi, (_match, size, inner) => {
        const value = Math.min(250, Math.max(50, Number(size)));
        return `<span style="font-size:${value}%">${inner}</span>`;
      });
      html = html.replace(/\[collapse(?:=([^\]]+))?\]([\s\S]*?)\[\/collapse\]/gi, (_match, title, inner) => {
        return `<details class="nga-collapse"><summary>${title || '展开内容'}</summary><div class="nga-collapse-content">${inner}</div></details>`;
      });
      html = html.replace(/\[quote\]([\s\S]*?)\[\/quote\]/gi, '<blockquote>$1</blockquote>');
    }
    smiles.forEach((smile) => {
      const code = escapeRegExp(String(smile.code || ''));
      if (!code) {
        return;
      }
      const image = `<img class="reply-preview-smile" src="https://img4.nga.cn/ngabbs/post/smile/${encodeURIComponent(smile.file)}" alt="${escapeHTML(smile.name)}">`;
      html = html.replace(new RegExp(code, 'g'), image);
    });
    return html.replace(/\r?\n/g, '<br>');
  }

  function showEditor() {
    editPane.hidden = false;
    previewPane.hidden = true;
    editTab.classList.add('is-active');
    previewTab.classList.remove('is-active');
    editTab.setAttribute('aria-selected', 'true');
    previewTab.setAttribute('aria-selected', 'false');
  }

  function showPreview() {
    previewPane.innerHTML = renderPreview(editor.value) || '<span class="reply-preview-empty">暂无内容</span>';
    editPane.hidden = true;
    previewPane.hidden = false;
    editTab.classList.remove('is-active');
    previewTab.classList.add('is-active');
    editTab.setAttribute('aria-selected', 'false');
    previewTab.setAttribute('aria-selected', 'true');
  }

  function renderSmilePanel() {
    if (smilePanel.childElementCount) {
      return;
    }
    const search = document.createElement('input');
    search.type = 'search';
    search.className = 'reply-smile-search';
    search.placeholder = '搜索表情';
    const grid = document.createElement('div');
    grid.className = 'reply-smile-grid';
    smiles.forEach((smile) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.title = smile.name;
      button.dataset.name = String(smile.name || '').toLowerCase();
      const image = document.createElement('img');
      image.loading = 'lazy';
      image.src = `https://img4.nga.cn/ngabbs/post/smile/${encodeURIComponent(smile.file)}`;
      image.alt = smile.name;
      button.appendChild(image);
      button.addEventListener('click', () => {
        insertText(smile.code);
        smilePanel.hidden = true;
        smileButton.setAttribute('aria-expanded', 'false');
      });
      grid.appendChild(button);
    });
    search.addEventListener('input', () => {
      const keyword = search.value.trim().toLowerCase();
      grid.querySelectorAll('button').forEach((button) => {
        button.hidden = Boolean(keyword) && !button.dataset.name.includes(keyword);
      });
    });
    smilePanel.appendChild(search);
    smilePanel.appendChild(grid);
  }

  document.querySelectorAll('[data-bbcode]').forEach((button) => {
    button.addEventListener('click', () => {
      if (button.dataset.bbcode === 'bold') {
        wrapSelection('[b]', '[/b]', '加粗文字');
      } else if (button.dataset.bbcode === 'delete') {
        wrapSelection('[del]', '[/del]', '删除线文字');
      } else if (button.dataset.bbcode === 'collapse') {
        wrapSelection('[collapse=折叠内容]', '[/collapse]', '折叠内容');
      }
    });
  });

  document.querySelector('#replyColor').addEventListener('change', (event) => {
    const value = event.target.value;
    if (value) {
      wrapSelection(`[color=${value}]`, '[/color]', '彩色文字');
    }
    event.target.value = '';
  });
  document.querySelector('#replySize').addEventListener('change', (event) => {
    const value = event.target.value;
    if (value) {
      wrapSelection(`[size=${value}]`, '[/size]', '字号文字');
    }
    event.target.value = '';
  });
  modeSelect.addEventListener('change', () => window.setReplyMode(modeSelect.value, state.pid));
  editTab.addEventListener('click', showEditor);
  previewTab.addEventListener('click', showPreview);
  smileButton.addEventListener('click', () => {
    renderSmilePanel();
    smilePanel.hidden = !smilePanel.hidden;
    smileButton.setAttribute('aria-expanded', String(!smilePanel.hidden));
  });
  submitButton.addEventListener('click', () => {
    const content = editor.value.trim();
    if (!content) {
      setStatus('请输入回帖内容', true);
      editor.focus();
      return;
    }
    const action = state.mode === 'reply-to' ? 'reply' : state.mode;
    submitButton.disabled = true;
    setStatus('正在发送…', false);
    vsPostMessage('postReply', {
      action,
      pid: state.mode === 'reply' ? '0' : state.pid,
      content,
    });
  });

  window.addEventListener('message', (event) => {
    const message = event.data || {};
    if (message.command === 'replySending') {
      submitButton.disabled = true;
      setStatus('正在发送…', false);
    } else if (message.command === 'replyError') {
      submitButton.disabled = false;
      setStatus(message.message || '回帖失败', true);
    } else if (message.command === 'replySuccess') {
      editor.value = '';
      setStatus('回帖成功，正在刷新…', false);
    }
  });

  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function escapeHTML(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  updateModeLabel();
})();
