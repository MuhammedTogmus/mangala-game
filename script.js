let board = Array(14).fill(0);
let currentPlayer = 1;
let isAnimating = false;
let gameActive = true;
let handStones = 0;
let expectedNextPit = -1;
let lastPitDropped = -1;

const handContainer = document.getElementById('hand-container');
const handCountText = document.getElementById('hand-count');
let audioCtx;
let currentDifficulty = 'medium';

// Menu Variables
const mainMenu = document.getElementById('main-menu');
const primaryButtons = document.getElementById('primary-buttons');
const diffSelection = document.getElementById('difficulty-selection');
const menuPlayBtn = document.getElementById('menu-play-btn');
const menuTutorialBtn = document.getElementById('menu-tutorial-btn');
const backToMenuBtn = document.getElementById('back-to-menu-btn');
const diffBtns = document.querySelectorAll('.diff-btn');

// Audio and BGM Variables
const bgmBtn = document.getElementById('bgm-btn');
const bgm = document.getElementById('bgm');
bgm.volume = 0.3; // keep it subtle

bgmBtn.onclick = () => {
    if (!bgm.paused) {
        bgm.pause();
        bgmBtn.innerText = "🔇";
        bgmBtn.classList.remove('playing');
    } else {
        bgm.play().catch(e => console.log("BGM play error", e));
        bgmBtn.innerText = "🎼";
        bgmBtn.classList.add('playing');
    }
};

menuPlayBtn.onclick = () => {
    primaryButtons.classList.add('hidden');
    diffSelection.classList.remove('hidden');
};

backToMenuBtn.onclick = () => {
    diffSelection.classList.add('hidden');
    primaryButtons.classList.remove('hidden');
};

diffBtns.forEach(btn => {
    btn.onclick = () => {
        currentDifficulty = btn.getAttribute('data-diff');
        mainMenu.classList.add('hidden');
        initBoard();
    };
});

menuTutorialBtn.onclick = () => {
    mainMenu.classList.add('hidden');
    startTutorial();
};

document.getElementById('restart-btn').onclick = () => {
    mainMenu.classList.remove('hidden');
    primaryButtons.classList.remove('hidden');
    diffSelection.classList.add('hidden');
    gameActive = false;
};

// Tutorial Variables
const tutorialOverlay = document.getElementById('tutorial-overlay');
const botText = document.getElementById('bot-text');
const nextBtn = document.getElementById('next-tutorial-btn');
const skipBtn = document.getElementById('skip-tutorial-btn');
const ttsBtn = document.getElementById('tts-btn');

function playTTS(text) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        let utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'tr-TR';
        let voices = window.speechSynthesis.getVoices();
        
        let femaleVoice = voices.find(v => v.lang.includes('tr') && (v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('kadın') || v.name.includes('Yelda') || v.name.includes('Google Türkçe')));
        
        if (!femaleVoice) femaleVoice = voices.find(v => v.lang.includes('tr') && !v.localService);
        
        if (femaleVoice) {
            utterance.voice = femaleVoice;
            utterance.pitch = 1.3;
        } else {
            let trVoice = voices.find(v => v.lang.includes('tr'));
            if (trVoice) utterance.voice = trVoice;
            utterance.pitch = 1.9; // Yüksek pitch vererek mecburi kadın sesi algısı yaratıyoruz
        }
        
        utterance.rate = 1.0;
        window.speechSynthesis.speak(utterance);
    }
}

ttsBtn.onclick = () => {
    let step = tutorialSteps[currentTutorialStep];
    let textToRead = isPostTyping ? step.post : step.text;
    playTTS(textToRead);
};

let tutorialShown = false;
let currentTutorialStep = 0;
let isTyping = false;
let isPostTyping = false;
let typeInterval;
let tutorialActive = false;
let tutorialTargetPit = -1;

function renderAll() {
    for (let i = 0; i < 14; i++) renderPit(i);
    updateCounts();
}

const tutorialSteps = [
    { text: "Selam! Ben Mangala Ustan. Bu gerçekçi kafe masasında sana Mangala'nın sırlarını öğreteceğim.", action: null },
    { text: "Oyunun amacı, kendi hazinende (sağdaki büyük oymalı yer) en çok taşı biriktirmektir.", action: null },
    { 
        text: "Kendi tarafındaki (Aşağıdaki) 6 kuyudan birini seçerek başlarsın. İçindeki tüm taşları saat yönünün tersine birer birer dağıtırsın. Hadi, parlayan kuyuya tıkla ve elindeki taş bitene kadar dağıt!",
        setup: () => {
            for(let i=0; i<14; i++) board[i] = i===6||i===13 ? 0 : 4;
            renderAll();
            tutorialTargetPit = 2;
            highlightPit(2);
        },
        post: "Gördüğün gibi taşlar sırayla dağıtıldı."
    },
    {
        text: "Eğer elindeki son taş kendi hazinene gelirse, ekstra bir tur kazanırsın! Şimdi parlayan kuyuya tıkla.",
        setup: () => {
            board.fill(0);
            board[5] = 1; // Last stone goes to treasury 6
            board[8] = 4;
            renderAll();
            tutorialTargetPit = 5;
            highlightPit(5);
        },
        post: "Harika! Son taşın kendi hazinene geldiği için tekrar oynama hakkı kazandın."
    },
    {
        text: "Eğer son taşın rakip taraftaki bir kuyuya gelir ve oradaki taş sayısını çift yaparsa (2, 4, 6 vb.), o kuyudaki tüm taşları hazinene alırsın. Hadi dene bakalım!",
        setup: () => {
            board.fill(0);
            board[4] = 5; // Will land in pit 8 (drops on 4, 5, 6, 7, 8)
            board[8] = 1; // Pit 8 becomes 2
            renderAll();
            tutorialTargetPit = 4;
            highlightPit(4);
        },
        post: "Mükemmel! Rakibin taşlarını çift yaptın ve kendi hazinene kattın."
    },
    {
        text: "Eğer son taşın kendi tarafındaki boş bir kuyuya gelirse ve tam karşısındaki rakip kuyuda taş varsa, iki tarafotakini de alırsın. Tıkla ve gör!",
        setup: () => {
            board.fill(0);
            board[2] = 1; // Lands in empty pit 3
            board[3] = 0; 
            board[9] = 5; // Opponent has 5
            renderAll();
            tutorialTargetPit = 2;
            highlightPit(2);
        },
        post: "İşte bu! Kendi boş kuyuna geldiği için rakibin taşlarını da hazinene aldın."
    },
    { text: "Artık tamamen hazırsın dostum! Ana menüden zorluk seçerek oynamaya başlayabilirsin. Bol şans!", action: null }
];

function startTutorial() {
    initBoard();
    tutorialActive = true;
    gameActive = false;
    tutorialOverlay.classList.remove('hidden');
    currentTutorialStep = 0;
    showTutorialStep();
}

function showTutorialStep() {
    clearInterval(typeInterval);
    botText.textContent = '';
    isTyping = true;
    isPostTyping = false;
    tutorialTargetPit = -1;
    nextBtn.classList.add('hidden');
    skipBtn.classList.remove('hidden');
    
    let step = tutorialSteps[currentTutorialStep];
    let i = 0;
    
    typeInterval = setInterval(() => {
        botText.textContent += step.text.charAt(i);
        i++;
        if (i >= step.text.length) {
            clearInterval(typeInterval);
            isTyping = false;
            if (step.setup) {
                step.setup();
                skipBtn.classList.add('hidden'); // Force interaction
            } else {
                nextBtn.innerText = currentTutorialStep < tutorialSteps.length - 1 ? "Devam" : "Ana Menüye Dön";
                nextBtn.classList.remove('hidden');
            }
        }
    }, 30);
}

function finishTutorialMove() {
    unhighlightAll();
    isTyping = true;
    isPostTyping = true;
    botText.textContent = '';
    let text = tutorialSteps[currentTutorialStep].post;
    let i = 0;
    typeInterval = setInterval(() => {
        botText.textContent += text.charAt(i);
        i++;
        if (i >= text.length) {
            clearInterval(typeInterval);
            isTyping = false;
            nextBtn.innerText = "Devam";
            nextBtn.classList.remove('hidden');
            skipBtn.classList.remove('hidden');
        }
    }, 30);
}

nextBtn.onclick = () => {
    let step = tutorialSteps[currentTutorialStep];
    if (isTyping) {
        clearInterval(typeInterval);
        isTyping = false;
        
        if (isPostTyping) {
            botText.textContent = step.post;
            nextBtn.innerText = "Devam";
            nextBtn.classList.remove('hidden');
            skipBtn.classList.remove('hidden');
        } else {
            botText.textContent = step.text;
            if (step.setup) {
                step.setup();
                skipBtn.classList.add('hidden');
            } else {
                nextBtn.innerText = currentTutorialStep < tutorialSteps.length - 1 ? "Devam" : "Ana Menüye Dön";
                nextBtn.classList.remove('hidden');
            }
        }
        return;
    }
    
    currentTutorialStep++;
    if (currentTutorialStep >= tutorialSteps.length) {
        endTutorial();
    } else {
        showTutorialStep();
    }
};

skipBtn.onclick = () => endTutorial();

function endTutorial() {
    tutorialActive = false;
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    clearInterval(typeInterval);
    tutorialOverlay.classList.add('hidden');
    mainMenu.classList.remove('hidden');
    primaryButtons.classList.remove('hidden');
    diffSelection.classList.remove('hidden');
}

function initAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playDropSound() {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    let baseFreq = 400 + Math.random() * 200;
    osc.frequency.setValueAtTime(baseFreq, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, audioCtx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.8, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.08);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.08);
}

function playErrorSound() {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(300, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.2);
}

document.addEventListener('mousemove', (e) => {
    if (handStones > 0 && currentPlayer === 1 && !isAnimating) {
        handContainer.style.left = (e.clientX + 15) + 'px';
        handContainer.style.top = (e.clientY + 15) + 'px';
    }
});

document.addEventListener('click', initAudio, { once: true });

function initBoard() {
    for (let i = 0; i < 14; i++) board[i] = (i === 6 || i === 13) ? 0 : 4;
    currentPlayer = 1;
    gameActive = true;
    isAnimating = false;
    handStones = 0;
    expectedNextPit = -1;
    handContainer.style.display = 'none';
    unhighlightAll();
    
    for (let i = 0; i < 14; i++) {
        renderPit(i);
        document.getElementById(`pit-${i}`).onclick = (e) => handlePitClick(i, e);
    }
    updateCounts();
    document.getElementById('game-over-modal').classList.add('hidden');
    updateStatusText("Senin Sıran!");
}

function handlePitClick(i, e) {
    if (!audioCtx) initAudio();

    if (tutorialActive) {
        let req = (handStones === 0) ? tutorialTargetPit : expectedNextPit;
        if (i !== req || isAnimating) {
            playErrorSound();
            return;
        }
        let cachedGameActive = gameActive;
        gameActive = true;
        currentPlayer = 1; 
        
        if (handStones === 0) {
            if (board[i] > 0) pickUpStones(i, e);
        } else {
            if (i === expectedNextPit) dropStoneManually(i, e);
        }
        
        gameActive = cachedGameActive;
        return;
    }

    if (!gameActive || isAnimating || currentPlayer !== 1) return;
    
    if (handStones === 0) {
        if (i >= 0 && i <= 5 && board[i] > 0) pickUpStones(i, e);
        else if (i >= 0 && i <= 5) playErrorSound();
    } else {
        if (i === expectedNextPit) dropStoneManually(i, e);
        else playErrorSound();
    }
}

function pickUpStones(i, e) {
    handStones = board[i];
    board[i] = 0;
    renderPit(i);
    updateCounts();
    
    handContainer.style.display = 'flex';
    handContainer.style.left = (e.clientX + 15) + 'px';
    handContainer.style.top = (e.clientY + 15) + 'px';
    handCountText.innerText = handStones;
    
    expectedNextPit = (handStones > 1) ? i : (i + 1) % 14;
    if (expectedNextPit === 13) expectedNextPit = 0;
    
    highlightPit(expectedNextPit);
    playDropSound();
}

function dropStoneManually(i, e) {
    isAnimating = true;
    handStones--;
    handCountText.innerText = handStones;
    playDropSound();
    
    if (handStones === 0) handContainer.style.display = 'none';
    
    animateStoneDrop(e.clientX, e.clientY, i, async () => {
        board[i]++;
        renderPit(i);
        updateCounts();
        lastPitDropped = i;
        unhighlightAll();
        
        if (handStones === 0) {
            await processRules(i);
        } else {
            expectedNextPit = (i + 1) % 14;
            if (expectedNextPit === 13) expectedNextPit = 0;
            highlightPit(expectedNextPit);
            isAnimating = false;
        }
    });
}

function animateStoneDrop(startX, startY, targetPitIndex, callback) {
    const targetPit = document.getElementById(`pit-${targetPitIndex}`);
    const r = targetPit.getBoundingClientRect();
    const tempStone = document.createElement('div');
    tempStone.className = 'stone stone-unified';
    tempStone.style.position = 'fixed';
    tempStone.style.left = startX + 'px';
    tempStone.style.top = startY + 'px';
    tempStone.style.zIndex = 10000;
    tempStone.style.transition = 'all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)';
    document.body.appendChild(tempStone);
    
    tempStone.getBoundingClientRect(); // reflow
    tempStone.style.left = (r.left + r.width / 2) + 'px';
    tempStone.style.top = (r.top + r.height / 2) + 'px';
    
    setTimeout(() => { tempStone.remove(); callback(); }, 250);
}

function renderPit(pitIndex) {
    const container = document.getElementById(`pit-${pitIndex}`).querySelector('.stones-container');
    container.innerHTML = '';
    const count = board[pitIndex];
    if (count === 0) return;
    
    const phi = (Math.sqrt(5) + 1) / 2;
    const maxOffset = pitIndex === 6 || pitIndex === 13 ? 35 : 22;
    
    for (let i = 0; i < count; i++) {
        const stone = document.createElement('div');
        stone.className = 'stone stone-unified';
        let radius = Math.sqrt(i + 0.5) * 6; 
        if (radius > maxOffset) radius = maxOffset - Math.random() * 2; 
        const theta = i * 2 * Math.PI / phi;
        stone.style.left = `calc(50% + ${Math.cos(theta) * radius}px - 9px)`;
        stone.style.top = `calc(50% + ${Math.sin(theta) * radius}px - 9px)`;
        container.appendChild(stone);
    }
}

function highlightPit(i) {
    unhighlightAll();
    const p = document.getElementById(`pit-${i}`);
    if(p) p.classList.add('highlight');
}
function unhighlightAll() {
    document.querySelectorAll('.pit, .treasury').forEach(p => {
        p.classList.remove('highlight');
        p.classList.remove('hint-active');
    });
}
function updateCounts() {
    for (let i = 0; i < 14; i++) document.getElementById(`pit-${i}`).querySelector('.stone-count').innerText = board[i];
}
function updateStatusText(t) { document.getElementById('status-text').innerText = t; }

async function processRules(last) {
    isAnimating = true;
    let extraTurn = false;
    
    if ((currentPlayer === 1 && last === 6) || (currentPlayer === 2 && last === 13)) extraTurn = true;
    else {
        let isOppSide = currentPlayer === 1 ? (last >= 7 && last <= 12) : (last >= 0 && last <= 5);
        if (isOppSide && board[last] % 2 === 0 && board[last] !== 0) {
            let tr = currentPlayer === 1 ? 6 : 13;
            await captureAnimation(last, tr);
        } else if (!isOppSide && board[last] === 1) {
            let opp = 12 - last;
            if (board[opp] > 0) {
                let tr = currentPlayer === 1 ? 6 : 13;
                await captureAnimation(last, tr);
                await captureAnimation(opp, tr);
            }
        }
    }
    
    if (tutorialActive) {
        isAnimating = false;
        tutorialTargetPit = -1;
        finishTutorialMove();
        return;
    }
    
    if (checkEndGame()) { isAnimating = false; return; }
    
    if (extraTurn) {
        updateStatusText(currentPlayer === 1 ? "Hazineye geldi! Bir el daha." : "Bot hızınızı kesiyor! (Ekstra el)");
        if (currentPlayer === 2) setTimeout(botTurnRoot, 1000);
        else isAnimating = false;
    } else {
        currentPlayer = currentPlayer === 1 ? 2 : 1;
        updateStatusText(currentPlayer === 1 ? "Senin Sıran!" : "Bot Düşünüyor...");
        if (currentPlayer === 2) setTimeout(botTurnRoot, 1000);
        else isAnimating = false;
    }
}

async function captureAnimation(from, to) {
    let amt = board[from];
    if (amt === 0) return;
    board[from] = 0;
    renderPit(from);
    updateCounts();
    
    const r = document.getElementById(`pit-${from}`).getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    
    for(let k=0; k<amt; k++) {
        animateStoneDrop(cx, cy, to, () => {
            board[to]++;
            renderPit(to);
            updateCounts();
        });
        await sleep(50);
    }
    playDropSound(); 
    await sleep(300);
}

function checkEndGame() {
    let p1 = 0, p2 = 0;
    for (let i = 0; i < 6; i++) p1 += board[i];
    for (let i = 7; i < 13; i++) p2 += board[i];
    
    if (p1 === 0 || p2 === 0) {
        gameActive = false;
        if (p1 === 0 && p2 > 0) { moveRemainingToTreasury(7, 12, 6); board[6] += p2; for(let i=7; i<13; i++) board[i]=0; } 
        else if (p2 === 0 && p1 > 0) { moveRemainingToTreasury(0, 5, 13); board[13] += p1; for(let i=0; i<6; i++) board[i]=0; }
        updateCounts();
        
        setTimeout(() => {
            document.getElementById('final-score-player').innerText = board[6];
            document.getElementById('final-score-bot').innerText = board[13];
            document.getElementById('winner-text').innerText = board[6] > board[13] ? "Kazandın!" : (board[13] > board[6] ? "Bot Kazandı!" : "Berabere!");
            document.getElementById('game-over-modal').classList.remove('hidden');
        }, 1500);
        return true;
    }
    return false;
}

function moveRemainingToTreasury(start, end, target) {
    for(let i=start; i<=end; i++) captureAnimation(i, target);
}
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function botTurnRoot() {
    if (!gameActive) return;
    const diff = currentDifficulty;
    let v = [];
    for(let i=7; i<=12; i++) if(board[i] > 0) v.push(i);
    if (v.length === 0) return;
    
    let best = -1;
    if (diff === 'easy') best = v[Math.floor(Math.random() * v.length)];
    else if (diff === 'medium') best = getGreedyMove(v);
    else best = getMinimaxMove(v);
    
    if (best !== -1) await executeBotTurn(best);
}

async function executeBotTurn(i) {
    isAnimating = true;
    let hand = board[i];
    board[i] = 0;
    renderPit(i);
    updateCounts();
    
    const r = document.getElementById(`pit-${i}`).getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let nxt = (hand > 1) ? i : (i + 1) % 14;
    if (nxt === 6) nxt = 7;

    while (hand > 0) {
        highlightPit(nxt);
        await sleep(350); 
        playDropSound();
        hand--;
        await new Promise(resolve => {
            animateStoneDrop(cx, cy, nxt, () => {
                board[nxt]++; renderPit(nxt); updateCounts(); lastPitDropped = nxt; unhighlightAll(); resolve();
            });
        });
        if (hand > 0) { nxt = (nxt + 1) % 14; if (nxt === 6) nxt = 7; }
    }
    await processRules(lastPitDropped);
}

function simulateMove(b, p, turn) {
    let cp = [...b], h = cp[p];
    cp[p] = 0; let curr = p;
    if (h > 1) { cp[curr]++; h--; }
    while(h > 0) {
        curr = (curr + 1) % 14;
        if (turn === 1 && curr === 13) continue;
        if (turn === 2 && curr === 6) continue;
        cp[curr]++; h--;
    }
    let xtra = ((turn === 1 && curr === 6) || (turn === 2 && curr === 13));
    if (!xtra) {
         let isOpp = turn === 1 ? (curr >= 7 && curr <= 12) : (curr >= 0 && curr <= 5);
         if (isOpp && cp[curr] % 2 === 0 && cp[curr] !== 0) {
             let tr = turn === 1 ? 6 : 13; cp[tr] += cp[curr]; cp[curr] = 0;
         } else if (!isOpp && cp[curr] === 1) {
             let opp = 12 - curr;
             if (cp[opp] > 0) { let tr = turn === 1 ? 6 : 13; cp[tr] += cp[opp] + cp[curr]; cp[opp] = 0; cp[curr] = 0; }
         }
    }
    return { boardResult: cp, extraTurn: xtra };
}

function getGreedyMove(v) {
    let bs = -Infinity, best = v[0];
    for (let m of v) {
        let r = simulateMove(board, m, 2), s = r.boardResult[13] - board[13];
        if (r.extraTurn) s += 3; 
        if (s > bs) { bs = s; best = m; }
    }
    return best;
}

function getMinimaxMove(v) {
    let bs = -Infinity, best = v[0];
    for (let m of v) {
        let r = simulateMove(board, m, 2);
        let s = minimax(r.boardResult, 5, -Infinity, Infinity, r.extraTurn ? 2 : 1);
        if (s > bs) { bs = s; best = m; }
    }
    return best;
}

function minimax(b, d, a, bt, p) {
    if (d === 0) return b[13] - b[6];
    let s1 = 0, s2 = 0;
    for(let i=0; i<6; i++) s1+=b[i];
    for(let i=7; i<13; i++) s2+=b[i];
    if (s1 === 0 || s2 === 0) {
        let b2 = [...b];
        if (s1 === 0) b2[6] += s2;
        if (s2 === 0) b2[13] += s1;
        return b2[13] - b2[6];
    }
    if (p === 2) {
        let maxE = -Infinity;
        for (let i = 7; i <= 12; i++) {
            if (b[i] === 0) continue;
            let r = simulateMove(b, i, 2);
            let ev = minimax(r.boardResult, d - 1, a, bt, r.extraTurn ? 2 : 1);
            maxE = Math.max(maxE, ev); a = Math.max(a, ev);
            if (bt <= a) break;
        }
        return maxE;
    } else {
        let minE = Infinity;
        for (let i = 0; i <= 5; i++) {
            if (b[i] === 0) continue;
            let r = simulateMove(b, i, 1);
            let ev = minimax(r.boardResult, d - 1, a, bt, r.extraTurn ? 1 : 2);
            minE = Math.min(minE, ev); bt = Math.min(bt, ev);
            if (bt <= a) break;
        }
        return minE;
    }
}

document.getElementById('play-again-btn').onclick = () => {
    document.getElementById('game-over-modal').classList.add('hidden');
    mainMenu.classList.remove('hidden');
    primaryButtons.classList.remove('hidden');
    diffSelection.classList.add('hidden');
};

const hintBtn = document.getElementById('hint-btn');
hintBtn.onclick = () => {
    if (!gameActive || isAnimating || currentPlayer !== 1 || handStones > 0 || tutorialActive) return;
    
    hintBtn.innerText = "Düşünüyor...";
    hintBtn.disabled = true;
    
    setTimeout(() => {
        let bestMove = getPlayerHint();
        if (bestMove !== -1) {
            unhighlightAll(); 
            document.getElementById(`pit-${bestMove}`).classList.add('hint-active');
            updateStatusText("İpucu: " + (bestMove + 1) + ". Kuyu!");
        }
        hintBtn.innerText = "İpucu 💡";
        hintBtn.disabled = false;
    }, 50);
};

function getPlayerHint() {
    let v = [];
    for(let i=0; i<=5; i++) if(board[i] > 0) v.push(i);
    if (v.length === 0) return -1;
    
    let bestScore = Infinity; 
    let bestMove = v[0];
    
    for (let m of v) {
        let r = simulateMove(board, m, 1);
        let s = minimax(r.boardResult, 5, -Infinity, Infinity, r.extraTurn ? 1 : 2);
        if (s < bestScore) { 
            bestScore = s; 
            bestMove = m; 
        }
    }
    return bestMove;
}
