const vscode = acquireVsCodeApi();

const loadingState = document.querySelector('#loadingState');
const errorState = document.querySelector('#errorState');
const resultState = document.querySelector('#resultState');
const progressMessage = document.querySelector('#progressMessage');
const errorMessage = document.querySelector('#errorMessage');
const profileReport = document.querySelector('#profileReport');
const retryButton = document.querySelector('#retryButton');
const copyButton = document.querySelector('#copyButton');
const settingsButton = document.querySelector('#settingsButton');

function showOnly(target) {
  [loadingState, errorState, resultState].forEach((element) => {
    element.classList.toggle('is-hidden', element !== target);
  });
}

function setRunning(running) {
  retryButton.disabled = running;
  copyButton.disabled = running || !profileReport.textContent;
}

retryButton.addEventListener('click', () => {
  vscode.postMessage({ command: 'retry' });
});

copyButton.addEventListener('click', () => {
  vscode.postMessage({ command: 'copyReport' });
});

settingsButton.addEventListener('click', () => {
  vscode.postMessage({ command: 'openModelSettings' });
});

window.addEventListener('message', (event) => {
  const message = event.data;
  switch (message.command) {
    case 'analysisStarted':
      profileReport.textContent = '';
      progressMessage.textContent = '正在准备分析...';
      showOnly(loadingState);
      setRunning(true);
      break;
    case 'progress':
      progressMessage.textContent = message.message;
      break;
    case 'analysisCompleted':
      profileReport.textContent = message.report;
      document.querySelector('#modelStat').textContent = `model: ${message.stats.modelName}`;
      document.querySelector('#pageStat').textContent = `pages: ${message.stats.pageCount}`;
      document.querySelector('#postStat').textContent = `posts: ${message.stats.postCount}`;
      document.querySelector('#characterStat').textContent = `chars: ${message.stats.characterCount}`;
      showOnly(resultState);
      setRunning(false);
      break;
    case 'analysisFailed':
      errorMessage.textContent = message.message;
      showOnly(errorState);
      setRunning(false);
      if (message.canConfigure) {
        settingsButton.focus();
      }
      break;
    case 'reportCopied':
      copyButton.textContent = '已复制';
      window.setTimeout(() => {
        copyButton.textContent = '复制报告';
      }, 1500);
      break;
  }
});

setRunning(true);
vscode.postMessage({ command: 'ready' });
