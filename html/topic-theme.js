const topicThemes = ['editor', 'source', 'terminal'];

const topicThemeChrome = {
  editor: {
    icon: 'M',
    extension: 'md',
    status: 'main*',
    language: 'Markdown'
  },
  source: {
    icon: '{}',
    extension: 'ts',
    status: 'src/thread.ts',
    language: 'TypeScript'
  },
  terminal: {
    icon: '>_',
    tabName: 'PowerShell',
    status: 'pwsh',
    language: 'PowerShell'
  }
};

function updateTopicThemeChrome(theme) {
  const config = topicThemeChrome[theme];
  const threadId = document.body.dataset.threadId;
  const fileIcon = document.querySelector('.file-icon');
  const tabName = document.querySelector('.editor-tab-name');
  const breadcrumbParts = document.querySelectorAll('.breadcrumbs span:not(.breadcrumb-separator)');
  const statusContext = document.querySelector('.status-context');
  const statusLanguage = document.querySelector('.status-language');
  const fileName = config.tabName || `thread-${threadId}.${config.extension}`;

  if (fileIcon) {
    fileIcon.textContent = config.icon;
  }
  if (tabName) {
    tabName.textContent = fileName;
  }
  if (breadcrumbParts.length) {
    breadcrumbParts[breadcrumbParts.length - 1].textContent = fileName;
  }
  if (statusContext) {
    statusContext.textContent = config.status;
  }
  if (statusLanguage) {
    statusLanguage.textContent = config.language;
  }
}

function applyTopicTheme(theme, notifyExtension) {
  const normalizedTheme = topicThemes.includes(theme) ? theme : 'editor';
  document.body.dataset.topicTheme = normalizedTheme;
  const picker = document.querySelector('#topicTheme');
  if (picker) {
    picker.value = normalizedTheme;
  }
  updateTopicThemeChrome(normalizedTheme);
  vscode.setState({
    ...(vscode.getState() || {}),
    topicTheme: normalizedTheme
  });
  if (notifyExtension) {
    vsPostMessage('setTopicTheme', { theme: normalizedTheme });
  }
}

const themePicker = document.querySelector('#topicTheme');
if (themePicker) {
  themePicker.addEventListener('change', (event) => {
    applyTopicTheme(event.target.value, true);
  });
}

applyTopicTheme(document.body.dataset.topicTheme, false);
