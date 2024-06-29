
function extractGameInfo(gameElement) {
    const storeLink = gameElement.querySelector('a[href^="https://store.steampowered.com/app/"]');
    const storeUrl = storeLink.href;
    const appId = storeUrl.match(/\/app\/(\d+)/)[1];
    const title = gameElement.querySelector('span > a').textContent;
    const headerImageUrl = gameElement.querySelector('img').src;
  
    const infoDiv = gameElement.querySelector('div > span:nth-child(1)');
    const playTime = infoDiv ? infoDiv.textContent.split('合計プレイ時間')[1]?.trim() : 'N/A';
  
    const lastPlayedDiv = gameElement.querySelector('div > span:nth-child(2)');
    const lastPlayed = lastPlayedDiv ? lastPlayedDiv.textContent.split('最後にプレイ')[1]?.trim() : 'N/A';
  
    const achievementDiv = gameElement.querySelector('div[class*="_3L-qRrHSjklL-XerpCawLU"]');
    let achievements = 'N/A';
    let achievementProgress = 0;
    if (achievementDiv) {
      const achievementSpan = achievementDiv.querySelector('span');
      achievements = achievementSpan ? achievementSpan.textContent : 'N/A';
      const progressDiv = achievementDiv.querySelector('div[style*="--percent"]');
      if (progressDiv) {
        achievementProgress = parseFloat(progressDiv.style.getPropertyValue('--percent') || '0');
      }
    }
  
    const sizeSpan = gameElement.querySelector('span[class*="_2zfId9cfT2zTYc0lGKOhrr"]');
    const size = sizeSpan ? sizeSpan.textContent : 'N/A';
  
    return {
      title,
      appId,
      storeUrl,
      headerImageUrl,
      playTime,
      lastPlayed,
      achievements,
      achievementProgress,
      size
    };
}
  
function getOwnedGames() {
    const gameElements = document.evaluate(
      "//div[@data-featuretarget='gameslist-root']//div[contains(@class,'Panel') and contains(@class,'Focusable') and child::a[contains(@href,'/app/')]]",
      document,
      null,
      XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE,
      null
    );
  
    const games = [];
    for (let i = 0; i < gameElements.snapshotLength; i++) {
      const gameElement = gameElements.snapshotItem(i);
      games.push(extractGameInfo(gameElement));
    }
  
    return games;
}
  
function waitForGamesListAndProcess() {
    const targetNode = document.querySelector('div[data-featuretarget="gameslist-root"]');
    if (!targetNode) {
      console.error("Games list root not found");
      return;
    }
  
    const config = { childList: true, subtree: true };
    let timeout;
  
    const callback = function(mutationsList, observer) {
      // 最後の変更から0.5秒後に処理を実行
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        observer.disconnect();
        processGamesList();
      }, 500);
    };
  
    const observer = new MutationObserver(callback);
    observer.observe(targetNode, config);
}

let games = [];
function processGamesList() {
    const gameElements = document.evaluate(
      "//div[@data-featuretarget='gameslist-root']//div[contains(@class,'Panel') and contains(@class,'Focusable') and child::a[contains(@href,'/app/')]]",
      document,
      null,
      XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE,
      null
    );
  
    for (let i = 0; i < gameElements.snapshotLength; i++) {
      const gameElement = gameElements.snapshotItem(i);
      games.push(extractGameInfo(gameElement));
    }
  
    //console.log('Owned Games:', games);
  
    showGameStartButton();
}

let difficulty = 'normal'; // デフォルトの難易度

function showGameStartButton() {
  const button = document.createElement('button');
  button.textContent = 'Game Start';
  button.style.cssText = 'position: fixed; top: 10px; right: 10px; z-index: 1000;';
  button.addEventListener('click', selectDifficulty);
  document.body.appendChild(button);
}

function selectDifficulty() {
  const difficultySelector = document.createElement('div');
  difficultySelector.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    padding: 20px;
    border-radius: 10px;
    z-index: 1001;
  `;
  
  const options = ['Easy', 'Normal', 'Hard'];
  options.forEach(option => {
    const button = document.createElement('button');
    button.textContent = option;
    button.style.margin = '5px';
    button.addEventListener('click', () => {
      difficulty = option.toLowerCase();
      document.body.removeChild(difficultySelector);
      startGame();
    });
    difficultySelector.appendChild(button);
  });

  document.body.appendChild(difficultySelector);
}

function cleanTitle(title) {
    // キーボードから入力しづらい文字を除去するための正規表現
    return title.replace(/[™©®†‡§¶]/g, '').trim();
}

// 音声ファイルの準備（実際のURLに置き換えてください）
// ここから持ってきています
// https://taira-komori.jpn.org/game01.html
const successSound = new Audio(chrome.runtime.getURL('sounds/powerup10.mp3'));
const failSound = new Audio(chrome.runtime.getURL('sounds/powerdown04.mp3'));
  
function startGame() {
    // オーバーレイを作成
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 1001;';
    document.body.appendChild(overlay);
  
    // スコア表示
    const scoreDisplay = document.createElement('div');
    scoreDisplay.id = 'score';
    scoreDisplay.style.cssText = 'position: fixed; top: 10px; left: 10px; color: white; font-size: 24px; z-index: 1002;';
    overlay.appendChild(scoreDisplay);
  
    // 入力フィールド
    const input = document.createElement('input');
    input.style.cssText = 'position: fixed; bottom: 10px; left: 50%; transform: translateX(-50%); width: 300px; z-index: 1002;';
    overlay.appendChild(input);
    input.focus();
  
    let score = 0;
    let currentGame = null;
  
    function updateScore() {
      scoreDisplay.textContent = `Score: ${score}`;
    }
  
    function spawnGame() {
        if (currentGame) return;
        currentGame = games[Math.floor(Math.random() * games.length)];
        const gameElement = document.createElement('div');

        // タイトルをクリーンアップ
        currentGame.cleanTitle = cleanTitle(currentGame.title);
        
        // タイトルの長さに基づいて落下時間を計算
        const baseTime = 10; // 基本の落下時間（秒）
        const titleLength = currentGame.title.length;
        let fallTime;
        
        switch(difficulty) {
          case 'easy':
            fallTime = baseTime + titleLength * 0.5;
            break;
          case 'normal':
            fallTime = baseTime + titleLength * 0.3;
            break;
          case 'hard':
            fallTime = baseTime + titleLength * 0.1;
            break;
          default:
            fallTime = baseTime;
        }
        
        const startPosition = -0; // 画像の高さに応じて調整
        gameElement.style.cssText = `
          position: absolute;
          top: ${startPosition}px;
          left: ${Math.random() * (window.innerWidth - 150)}px;
          transition: top ${fallTime}s linear;
          text-align: center;
        `;
        
        // 画像の追加
        const img = document.createElement('img');
        img.src = currentGame.headerImageUrl;
        img.style.width = '150px';
        gameElement.appendChild(img);
        
        // タイトルの追加
        const titleElement = document.createElement('div');
        titleElement.textContent = currentGame.cleanTitle;
        titleElement.style.cssText = `
            color: white;
            background-color: rgba(0, 0, 0, 0.7);
            padding: 5px;
            margin-top: 5px;
            font-size: 14px;
            word-wrap: break-word;
            max-width: 150px;
        `;
        gameElement.appendChild(titleElement);
  
        overlay.appendChild(gameElement);
    
        setTimeout(() => {
          gameElement.style.top = `${window.innerHeight}px`;
        }, 50);
    
        setTimeout(() => {
          if (currentGame) {
            overlay.removeChild(gameElement);
            currentGame = null;
            failSound.play(); // 失敗時の音を再生
            spawnGame();
          }
        }, fallTime * 1000);
    }

    input.addEventListener('input', () => {
      if (currentGame && input.value.toLowerCase() === currentGame.title.toLowerCase()) {
        score++;
        updateScore();
        successSound.play(); // 成功時の音を再生
        overlay.removeChild(overlay.querySelector('div:not(#score)'));
        currentGame = null;
        input.value = '';
        spawnGame();
      }
    });
  
    updateScore();
    spawnGame();
}

// ページ読み込み完了時にMutationObserverを開始
window.addEventListener('load', waitForGamesListAndProcess);