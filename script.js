// ===============================
// Utility helpers
// ===============================
const KEY = "wellness-quest-state-v2";
const todayISO = () => new Date().toISOString().slice(0, 10);
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

function showToast(message) {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    toastMessage.textContent = message;
    toast.style.opacity = 1;
    toast.style.transform = 'translate(-50%, 0) scale(1)';
    setTimeout(() => {
        toast.style.opacity = 0;
        toast.style.transform = 'translate(-50%, 0) scale(0.95)';
    }, 3000);
}

// ===============================
// Seed Data
// ===============================
const BASE_ACTIVITIES = [
    { id: "walk10", title: "Go for a 10‑minute walk", xp: 15, tag: "movement" },
    { id: "grat1", title: "Write one good thing", xp: 10, tag: "gratitude" },
    { id: "breathe", title: "Try a 3‑minute breathing", xp: 15, tag: "breathing", tagColor: 'text-blue-500' },
    { id: "text", title: "Text a friend hello", xp: 12, tag: "connection" },
    { id: "water", title: "Drink a tall glass of water", xp: 8, tag: "hydration" },
    { id: "sleep", title: "Lights out 30 min earlier", xp: 20, tag: "sleep" },
    { id: "focus5", title: "5‑minute focus sprint", xp: 10, tag: "focus" },
];

const AVATARS = [
    { id: "sprout", name: "Sprout", minLevel: 1, emoji: "🌱" },
    { id: "spark", name: "Spark", minLevel: 3, emoji: "✨" },
    { id: "ranger", name: "Ranger", minLevel: 5, emoji: "🏹" },
    { id: "guardian", name: "Guardian", minLevel: 8, emoji: "🛡️" },
    { id: "phoenix", name: "Phoenix", minLevel: 12, emoji: "🔥" },
];

const DEMO_LEADERBOARD = [
    { name: "Aria", xp: 620 },
    { name: "Jay", xp: 540 },
    { name: "Sam", xp: 480 },
    { name: "Mina", xp: 430 },
];

const DEFAULT_STATE = {
    xp: 0,
    completed: {},
    moodLog: [],
    selectedAvatar: "sprout",
    badges: [],
    weeklyProgress: 0,
    displayName: "You",
};

// ===============================
// State Management
// ===============================
let state = {};

function loadState() {
    try {
        const raw = localStorage.getItem(KEY);
        state = raw ? JSON.parse(raw) : DEFAULT_STATE;
        if (!state.displayName) {
            state.displayName = "You";
        }
    } catch (e) {
        console.error("Failed to load state from localStorage:", e);
        state = DEFAULT_STATE;
    }
}

function saveState() {
    try {
        localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
        console.error("Failed to save state to localStorage:", e);
    }
}

// ===============================
// UI Update Functions
// ===============================
function renderUI() {
    const level = levelFromXP(state.xp);
    const next = xpToNextLevel(state.xp);
    const today = todayISO();
    const doneToday = new Set(state.completed[today] || []);
    const unlockedAvatars = AVATARS.filter(a => a.minLevel <= level);
    const leaderboard = [...DEMO_LEADERBOARD, { name: state.displayName, xp: state.xp }]
                        .sort((a, b) => b.xp - a.xp).slice(0, 5);
    const suggestedQuests = suggestQuests(state);

    // Update stats cards
    document.getElementById('level').textContent = level;
    document.getElementById('xpToNext').textContent = `${next} XP to next`;
    document.getElementById('levelProgress').style.width = `${(state.xp % 100)}%`;
    document.getElementById('totalXp').textContent = state.xp;
    document.getElementById('weeklyProgress').style.width = `${state.weeklyProgress}%`;
    document.getElementById('weeklyProgressText').textContent = `${state.weeklyProgress}% of 100`;

    // Render avatars
    document.getElementById('avatarEmoji').textContent = AVATARS.find(a => a.id === state.selectedAvatar)?.emoji;
    const avatarButtonsContainer = document.getElementById('avatarButtons');
    avatarButtonsContainer.innerHTML = '';
    unlockedAvatars.forEach(a => {
        const button = document.createElement('button');
        button.className = `inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors h-8 px-3 transform hover:scale-110 ${a.id === state.selectedAvatar ? 'bg-blue-500 text-white shadow hover:bg-blue-600' : 'bg-slate-100 text-slate-700 shadow-sm hover:bg-slate-200'}`;
        button.textContent = a.emoji;
        button.onclick = () => {
            state.selectedAvatar = a.id;
            saveState();
            renderUI();
        };
        avatarButtonsContainer.appendChild(button);
    });

    // Render quests
    const dailyQuestsContainer = document.getElementById('dailyQuests');
    dailyQuestsContainer.innerHTML = '';
    const renderQuest = (q, isSuggested = false) => {
        const button = document.createElement('button');
        button.className = `w-full text-left p-3 rounded-2xl border transition-all duration-300 transform hover:scale-[1.02] hover:shadow-md ${isSuggested ? 'bg-indigo-50/60' : 'bg-white'} ${doneToday.has(q.id) ? 'bg-emerald-50 border-emerald-200' : ''}`;
        button.disabled = doneToday.has(q.id);
        button.onclick = () => {
            if (q.tag === "mini-game") {
                document.getElementById('miniGameModal').classList.remove('hidden');
                startMiniGame();
            } else {
                completeQuest(q);
            }
        };

        const titleBadge = `
            <div class="flex items-center justify-between">
                <div class="font-semibold">${q.title}</div>
                ${isSuggested ? `<div class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors bg-blue-600 text-white">AI</div>` :
                               `<div class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors bg-slate-200 text-slate-700"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3 h-3"><path d="M12.5 12.5h-1v-2h1v2z"/></svg>${q.xp}</div>`}
            </div>
        `;
        const tag = `<div class="text-xs text-slate-500 mt-1 capitalize">#${q.tag}</div>`;
        const completedText = doneToday.has(q.id) ? `<div class="text-xs mt-2 text-emerald-700 font-semibold">Completed ✓</div>` : '';

        button.innerHTML = titleBadge + tag + completedText;
        dailyQuestsContainer.appendChild(button);
    };

    BASE_ACTIVITIES.forEach(a => renderQuest(a));
    suggestedQuests.forEach(q => renderQuest(q, true));

    // Render mood buttons
    const moodButtonsContainer = document.getElementById('moodButtons');
    moodButtonsContainer.innerHTML = '';
    for (let i = 1; i <= 5; i++) {
        const moodButton = document.createElement('button');
        moodButton.className = `inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors h-9 px-4 py-2 transform hover:scale-110 ${i === state.moodToday ? 'bg-blue-500 text-white shadow hover:bg-blue-600' : 'border border-slate-200 bg-white shadow-sm hover:bg-slate-100'}`;
        moodButton.textContent = i;
        moodButton.onclick = () => {
            state.moodToday = i;
            renderUI();
        };
        moodButtonsContainer.appendChild(moodButton);
    }

    // Render badges
    const badgesContainer = document.getElementById('badgesContainer');
    badgesContainer.innerHTML = '';
    if (state.badges.length === 0) {
        badgesContainer.innerHTML = '<div class="text-sm text-slate-500">Complete quests to earn your first badge!</div>';
    } else {
        state.badges.forEach(b => {
            const badge = document.createElement('div');
            badge.className = "inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold transition-colors bg-blue-500 text-white";
            badge.textContent = b;
            badgesContainer.appendChild(badge);
        });
    }

    // Render leaderboard
    const leaderboardContainer = document.getElementById('leaderboard');
    leaderboardContainer.innerHTML = '';
    leaderboard.forEach((row, idx) => {
        const rowDiv = document.createElement('div');
        rowDiv.className = `flex items-center justify-between p-2 rounded-xl border bg-white/60 transform transition-all hover:scale-[1.02] ${row.name === state.displayName ? 'border-2 border-blue-500 bg-blue-50' : ''}`;
        rowDiv.innerHTML = `
            <div class="flex items-center gap-2">
                <div class="w-6 text-right font-bold">${idx + 1}</div>
                <div class="font-semibold">${row.name}</div>
            </div>
            <div class="text-sm flex items-center gap-1 text-slate-500">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3 h-3 text-yellow-500">
                    <path d="M12.5 12.5h-1v-2h1v2z"/>
                </svg>
                ${row.xp}
            </div>
        `;
        leaderboardContainer.appendChild(rowDiv);
    });
    document.getElementById('displayNameInput').value = state.displayName;
}

// ===============================
// Game Logic
// ===============================
function levelFromXP(xp) {
    return Math.floor(xp / 100) + 1;
}

function xpToNextLevel(xp) {
    return 100 - (xp % 100);
}

function suggestQuests(state) {
    const last7 = state.moodLog.slice(-7);
    const avg = last7.length ? last7.reduce((a, b) => a + b.mood, 0) / last7.length : 3;
    const todayDone = new Set(state.completed[todayISO()] || []);

    const pool = [];
    if (avg < 3) {
        pool.push(
            { id: "dance", title: "2‑song dance break", description: "Pick two upbeat songs and move!", tag: "movement", xp: 15 },
            { id: "mini-arcade", title: "Play the bubble‑breath mini‑game", description: "Tap to pace your breath with bubbles.", tag: "mini-game", xp: 20 },
            { id: "grat3", title: "3 tiny wins list", description: "Write three small wins from today.", tag: "gratitude", xp: 18 },
        );
    } else if (avg >= 3.5) {
        pool.push(
            { id: "focus10", title: "10‑minute pomodoro", description: "Push a focused mini sprint.", tag: "focus", xp: 12 },
            { id: "walk-view", title: "Scenery walk pic", description: "Walk 10 minutes and snap a sky/plant pic.", tag: "movement", xp: 15 },
            { id: "kindness", title: "Send a kind text", description: "Cheer someone on today.", tag: "connection", xp: 10 },
        );
    } else {
        pool.push(
            { id: "box-breath", title: "Box breathing 4x4", description: "Inhale‑hold‑exhale‑hold, 4 counts each.", tag: "breathing", xp: 15 },
            { id: "hydrate2", title: "Two glasses of water", description: "Hydrate and log it.", tag: "hydration", xp: 10 },
            { id: "grat-snap", title: "Photo gratitude", description: "Capture one thing you appreciate.", tag: "gratitude", xp: 12 },
        );
    }
    return pool.filter(q => !todayDone.has(q.id)).slice(0, 3);
}

function completeQuest(item) {
    const today = todayISO();
    const doneToday = new Set(state.completed[today] || []);
    if (doneToday.has(item.id)) return;

    const completed = { ...state.completed };
    completed[today] = [...(completed[today] || []), item.id];
    const gained = item.xp ?? 12;
    const newXP = state.xp + gained;
    const newLevel = levelFromXP(newXP);
    const badges = new Set(state.badges);
    if (newLevel >= 3) badges.add("Level 3 Achiever");
    if ((completed[today] || []).length + 1 >= 3) badges.add("Daily Trio");
    if (item.tag === "hydration") badges.add("Hydration Hero");

    state.completed = completed;
    state.xp = newXP;
    state.badges = Array.from(badges);
    state.weeklyProgress = clamp(state.weeklyProgress + 5, 0, 100);

    saveState();
    renderUI();
    showToast(`+${gained} XP! Quest completed: ${item.title}`);
}

function logMood() {
    const today = todayISO();
    const note = document.getElementById('moodNote').value;
    const mood = state.moodToday || 3;
    const existing = state.moodLog.filter(m => m.date !== today);
    state.moodLog = [...existing, { date: today, mood: mood, notes: note }];
    document.getElementById('moodNote').value = '';
    showToast(`Logged mood as ${mood}.`);
    saveState();
    renderUI();
}

let miniGameInterval;
function startMiniGame() {
    const phaseText = document.getElementById('phaseText');
    const countText = document.getElementById('countText');
    const bubble = document.getElementById('bubble');
    let phase = "inhale";
    let count = 4;

    const updateDisplay = () => {
        phaseText.textContent = phase;
        countText.textContent = `Count: ${count}`;
        if (phase === "inhale") {
            bubble.style.transform = "scale(1.2)";
            bubble.classList.remove('animate-pulse-slow');
        } else if (phase === "exhale") {
            bubble.style.transform = "scale(0.8)";
            bubble.classList.remove('animate-pulse-slow');
        } else {
            bubble.style.transform = "scale(1)";
            bubble.classList.add('animate-pulse-slow');
        }
    };

    // Set initial state for the bubble animation
    bubble.classList.add('animate-pulse-slow');

    updateDisplay();

    miniGameInterval = setInterval(() => {
        count--;
        if (count < 1) {
            count = 4;
            if (phase === "inhale") phase = "hold";
            else if (phase === "hold") phase = "exhale";
            else phase = "inhale";
        }
        updateDisplay();
    }, 1000);
}

function stopMiniGame() {
    clearInterval(miniGameInterval);
    document.getElementById('miniGameModal').classList.add('hidden');
    completeQuest({ id: 'mini-arcade', xp: 20, title: 'Bubble-Breath' });
}


// ===============================
// Initialisation
// ===============================
window.onload = function() {
    loadState();
    state.moodToday = state.moodLog.find(m => m.date === todayISO())?.mood || 3;
    renderUI();

    // Event Listeners
    document.getElementById('logMoodBtn').addEventListener('click', logMood);
    document.getElementById('closeMiniGameBtn').addEventListener('click', stopMiniGame);
    document.getElementById('displayNameInput').addEventListener('input', (e) => {
        state.displayName = e.target.value || "You";
        saveState();
        renderUI();
    });
};