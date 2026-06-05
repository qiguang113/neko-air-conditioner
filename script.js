const app = document.querySelector(".app");
const temperature = document.querySelector("#temperature");
const modeLabel = document.querySelector("#modeLabel");
const year = document.querySelector("#year");
const coldButton = document.querySelector("#coldButton");
const hotButton = document.querySelector("#hotButton");
const powerButton = document.querySelector("#powerButton");
const plusButton = document.querySelector("#plusButton");
const minusButton = document.querySelector("#minusButton");
const airFeatureState = document.querySelector("#airFeatureState");
const wifiFeatureState = document.querySelector("#wifiFeatureState");
const wifiNetworkList = document.querySelector("#wifiNetworkList");
const wifiPassword = document.querySelector("#wifiPassword");
const wifiPasswordMenu = document.querySelector("#wifiPasswordMenu");
const wifiConnectButton = document.querySelector("#wifiConnectButton");
const wifiCrackButton = document.querySelector("#wifiCrackButton");
const wifiScanButton = document.querySelector("#wifiScanButton");
const wifiRealScanButton = document.querySelector("#wifiRealScanButton");
const wifiShuffleButton = document.querySelector("#wifiShuffleButton");
const wifiPuzzleList = document.querySelector("#wifiPuzzleList");
const wifiCurrentName = document.querySelector("#wifiCurrentName");
const wifiStatusText = document.querySelector("#wifiStatusText");
const wifiCurrentSignal = document.querySelector("#wifiCurrentSignal");
const wifiReadout = document.querySelector("#wifiReadout");
const wifiStatusbar = document.querySelector(".wifi-statusbar");
const featureButtons = document.querySelectorAll("[data-feature]");
const featurePanels = document.querySelectorAll(".feature-panel");

const PASSWORD_SEPARATOR = "-";
const WIFI_SEED_KEY = "nekoWifiSeed";
const CRACK_GAMES = [
  { id: "tune", label: "信号调频" },
  { id: "wire", label: "信号接线" },
  { id: "dodge", label: "信号躲避" }
];
const DODGE_COLUMNS = ["左", "中左", "中右", "右"];
const DODGE_CLEAR_Y = 112;
const DODGE_COLLISION_START = 75;
const DODGE_GOAL = 12;
const DODGE_SPAWN_TICKS = 7;
const DODGE_SPEED = 4.6;
const TUNE_HITS_REQUIRED = 3;
const TUNE_SPEED_STEP = .75;
const WIRE_MAX = 92;
const WIRE_MIN = 8;
const WIRE_SPEED = 1.55;
const WIRE_SPEED_STEP = .48;
const WIRE_WINDOW = 7;

const state = {
  isOn: false,
  mode: "cold",
  temperature: 20
};

const wifiState = {
  connectedId: null,
  crackGameId: null,
  crackedIds: [],
  crackNetworkId: null,
  dodgeColumn: 1,
  dodgeObstacles: [],
  dodgeScore: 0,
  dodgeSpawnIndex: 0,
  dodgeTicks: 0,
  gameTimer: null,
  networks: [],
  seed: getStoredWifiSeed(),
  selectedId: null,
  timer: null,
  tuneDirection: 1,
  tuneHits: 0,
  tuneValue: 50,
  wireDirection: 1,
  wirePulse: WIRE_MIN,
  wireTimeLeft: 100,
  wireStep: 0
};

function render() {
  app.classList.toggle("is-on", state.isOn);
  app.classList.toggle("is-hot", state.mode === "hot");
  temperature.textContent = state.temperature;
  modeLabel.textContent = state.mode === "cold" ? "COLD" : "HOT";
  coldButton.classList.toggle("active", state.mode === "cold");
  hotButton.classList.toggle("active", state.mode === "hot");
  airFeatureState.textContent = state.isOn ? "运行中" : "待机";
}

function selectFeature(featureName) {
  app.classList.add("is-detail-open");

  featureButtons.forEach((button) => {
    const isActive = button.dataset.feature === featureName;
    button.classList.toggle("active", isActive);
    if (isActive) {
      button.setAttribute("aria-current", "true");
    } else {
      button.removeAttribute("aria-current");
    }
  });

  featurePanels.forEach((panel) => {
    const isActive = panel.id === `${featureName}Feature`;
    panel.classList.toggle("active", isActive);
  });
}

function hashSeed(value) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function createFreshSeed() {
  return hashSeed(`${Date.now()}-${Math.random()}`);
}

function getStoredWifiSeed() {
  try {
    const storedSeed = window.localStorage.getItem(WIFI_SEED_KEY);

    if (storedSeed) {
      return Number(storedSeed);
    }

    const nextSeed = createFreshSeed();
    window.localStorage.setItem(WIFI_SEED_KEY, String(nextSeed));
    return nextSeed;
  } catch {
    return createFreshSeed();
  }
}

function storeWifiSeed(seed) {
  try {
    window.localStorage.setItem(WIFI_SEED_KEY, String(seed));
  } catch {
    return;
  }
}

function createRng(seed) {
  let value = seed >>> 0;

  return () => {
    value += 0x6D2B79F5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function pickRandom(rng, options) {
  return options[Math.floor(rng() * options.length)];
}

function shuffle(rng, options) {
  const result = [...options];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(rng() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }

  return result;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function createWirePuzzle(rng) {
  const path = Array.from({ length: 4 }, () => Math.floor(rng() * 3));
  const columns = path.map((correctRow) => (
    Array.from({ length: 3 }, (_, row) => (
      row === correctRow
        ? Math.floor(rng() * 13) + 86
        : Math.floor(rng() * 35) + 40
    ))
  ));

  return {
    columns,
    path
  };
}

function createWireTargets(rng) {
  return Array.from({ length: 4 }, () => Math.floor(rng() * 64) + 18);
}

function createDodgePattern(rng) {
  const pattern = [];
  let previous = -1;

  while (pattern.length < DODGE_GOAL + 10) {
    let next = Math.floor(rng() * DODGE_COLUMNS.length);

    if (next === previous && rng() > .45) {
      next = (next + 1 + Math.floor(rng() * (DODGE_COLUMNS.length - 1))) % DODGE_COLUMNS.length;
    }

    pattern.push(next);
    previous = next;
  }

  return pattern;
}

function createTuneStartValue(target, windowSize) {
  const offset = windowSize + 18 + Math.floor(Math.random() * 24);
  const direction = Math.random() > .5 ? 1 : -1;
  const value = clamp(target + (offset * direction), 0, 100);

  if (Math.abs(value - target) <= windowSize) {
    return clamp(target + (direction > 0 ? -offset : offset), 0, 100);
  }

  return value;
}

function getTuneTarget(selected, hits = wifiState.tuneHits) {
  const offsets = [0, 22, -19];

  return clamp(selected.tuneTarget + offsets[hits % offsets.length], 16, 84);
}

function getTuneWindow(selected, hits = wifiState.tuneHits) {
  return Math.max(5, selected.tuneWindow - hits);
}

function getTuneBounds(selected, hits = wifiState.tuneHits) {
  const target = getTuneTarget(selected, hits);
  const windowSize = getTuneWindow(selected, hits);

  return {
    max: clamp(target + windowSize, 0, 100),
    min: clamp(target - windowSize, 0, 100)
  };
}

function isTuneInGreen(selected) {
  const bounds = getTuneBounds(selected);

  return wifiState.tuneValue >= bounds.min && wifiState.tuneValue <= bounds.max;
}

function getTuneSpeed(selected) {
  const baseSpeed = selected.signal >= 4 ? 2.2 : selected.signal >= 3 ? 2.6 : 3;

  return baseSpeed + (wifiState.tuneHits * TUNE_SPEED_STEP);
}

function getWireTarget(selected, step = wifiState.wireStep) {
  return selected.wireTargets[step] ?? 50;
}

function isWireAligned(selected) {
  return Math.abs(wifiState.wirePulse - getWireTarget(selected)) <= WIRE_WINDOW;
}

function getWireSpeed() {
  return WIRE_SPEED + (wifiState.wireStep * WIRE_SPEED_STEP);
}

function createWifiProfile(seed) {
  const rng = createRng(seed);
  const prefixes = ["N.E.K.O", "猫娘", "糖心", "甜风", "夜班", "小窝", "云端", "奶盖"];
  const suffixes = ["玄关", "窗边", "厨房", "电波", "5G", "小站", "热乎", "满格"];
  const bands = ["2.4GHz", "5GHz", "6GHz"];
  const names = new Set();
  const usedPasswords = new Set();

  while (names.size < 5) {
    const number = Math.floor(rng() * 90) + 10;
    names.add(`${pickRandom(rng, prefixes)}-${pickRandom(rng, suffixes)}-${number}`);
  }

  const words = ["NEKO", "NYA", "MINT", "STAR", "YUN", "MOON", "AIR", "BYTE"];
  const endings = ["LINK", "ROOM", "HUB", "POD", "WAVE", "KEY"];
  const networks = [...names].map((name, index) => {
    let passwordSegments = [];
    let password = "";

    do {
      passwordSegments = [
        pickRandom(rng, words),
        String(Math.floor(rng() * 90) + 10),
        pickRandom(rng, endings)
      ];
      password = passwordSegments.join(PASSWORD_SEPARATOR);
    } while (usedPasswords.has(password));

    usedPasswords.add(password);

    const signal = Math.floor(rng() * 4) + 1;
    const tuneTarget = (Math.floor(rng() * 13) + 4) * 5;
    const tuneWindow = signal >= 4 ? 9 : signal >= 3 ? 8 : signal >= 2 ? 7 : 6;
    const wirePuzzle = createWirePuzzle(rng);
    const wireTargets = createWireTargets(rng);

    return {
      band: pickRandom(rng, bands),
      dodgePattern: createDodgePattern(rng),
      id: `wifi-${seed}-${index}`,
      latency: Math.floor(rng() * 32) + 14,
      name,
      password,
      passwordSegments,
      signal,
      tuneTarget,
      tuneWindow,
      wireColumns: wirePuzzle.columns,
      wirePath: wirePuzzle.path,
      wireTargets
    };
  });

  return {
    networks
  };
}

function getSelectedWifi() {
  return wifiState.networks.find((network) => network.id === wifiState.selectedId) || wifiState.networks[0];
}

function getConnectedWifi() {
  return wifiState.networks.find((network) => network.id === wifiState.connectedId);
}

function renderWifiBars(container, signal) {
  container.replaceChildren();

  for (let index = 1; index <= 4; index += 1) {
    const bar = document.createElement("i");
    bar.classList.toggle("on", index <= signal);
    container.append(bar);
  }
}

function createWifiBars(signal) {
  const bars = document.createElement("span");
  bars.className = "wifi-bars";
  renderWifiBars(bars, signal);
  return bars;
}

function setWifiReadout(message, tone = "") {
  wifiReadout.className = tone ? `wifi-readout ${tone}` : "wifi-readout";
  wifiReadout.textContent = message;
}

function clearCrackTimer() {
  window.clearInterval(wifiState.gameTimer);
  wifiState.gameTimer = null;
}

function resetDodgeRun() {
  wifiState.dodgeColumn = 1;
  wifiState.dodgeObstacles = [];
  wifiState.dodgeScore = 0;
  wifiState.dodgeSpawnIndex = 0;
  wifiState.dodgeTicks = 0;
}

function startCrackTimer() {
  clearCrackTimer();

  if (wifiState.crackGameId === "tune") {
    wifiState.gameTimer = window.setInterval(tickTuneGame, 55);
    return;
  }

  if (wifiState.crackGameId === "wire") {
    wifiState.gameTimer = window.setInterval(tickWireGame, 70);
    return;
  }

  if (wifiState.crackGameId === "dodge") {
    wifiState.gameTimer = window.setInterval(tickDodgeGame, 70);
  }
}

function tickTuneGame() {
  const selected = getActiveCrackWifi("tune");

  if (!selected) {
    clearCrackTimer();
    return;
  }

  wifiState.tuneValue = (wifiState.tuneValue + (wifiState.tuneDirection * getTuneSpeed(selected)) + 100) % 100;

  renderWifiPuzzles();
}

function tickWireGame() {
  const selected = getActiveCrackWifi("wire");

  if (!selected) {
    clearCrackTimer();
    return;
  }

  wifiState.wirePulse += wifiState.wireDirection * getWireSpeed();

  if (wifiState.wirePulse >= WIRE_MAX || wifiState.wirePulse <= WIRE_MIN) {
    wifiState.wireDirection *= -1;
    wifiState.wirePulse = clamp(wifiState.wirePulse, WIRE_MIN, WIRE_MAX);
  }

  renderWifiPuzzles();
}

function tickDodgeGame() {
  const selected = getActiveCrackWifi("dodge");

  if (!selected) {
    clearCrackTimer();
    return;
  }

  wifiState.dodgeTicks += 1;
  wifiState.dodgeObstacles = wifiState.dodgeObstacles
    .map((obstacle) => ({ ...obstacle, y: obstacle.y + DODGE_SPEED }));

  if (wifiState.dodgeTicks % DODGE_SPAWN_TICKS === 1 && wifiState.dodgeSpawnIndex < selected.dodgePattern.length) {
    wifiState.dodgeObstacles.push({
      column: selected.dodgePattern[wifiState.dodgeSpawnIndex],
      y: -10
    });
    wifiState.dodgeSpawnIndex += 1;
  }

  if (wifiState.dodgeObstacles.some((obstacle) => (
    obstacle.column === wifiState.dodgeColumn
      && obstacle.y >= DODGE_COLLISION_START
      && obstacle.y <= DODGE_CLEAR_Y
  ))) {
    resetDodgeRun();
    renderWifiPuzzles();
    setWifiReadout("撞上干扰块，躲避重来。", "bad");
    beep("hot");
    return;
  }

  const escaped = wifiState.dodgeObstacles.filter((obstacle) => obstacle.y > DODGE_CLEAR_Y).length;
  wifiState.dodgeScore += escaped;
  wifiState.dodgeObstacles = wifiState.dodgeObstacles.filter((obstacle) => obstacle.y <= DODGE_CLEAR_Y);

  if (wifiState.dodgeScore >= DODGE_GOAL) {
    completeWifiCrack(selected);
    return;
  }

  renderWifiPuzzles();
}

function renderWifiNetworks() {
  wifiNetworkList.replaceChildren();

  wifiState.networks.forEach((network) => {
    const button = document.createElement("button");
    const copy = document.createElement("span");
    const name = document.createElement("span");
    const meta = document.createElement("span");
    const selected = network.id === wifiState.selectedId;
    const connected = network.id === wifiState.connectedId;

    button.className = "wifi-network";
    button.type = "button";
    button.classList.toggle("active", selected);
    button.setAttribute("aria-pressed", String(selected));
    name.className = "wifi-network-name";
    name.textContent = connected ? `${network.name} · 已连接` : network.name;
    meta.className = "wifi-network-meta";
    meta.textContent = `${network.band} · 加密 · 信号 ${network.signal}/4`;
    copy.append(name, meta);
    button.append(copy, createWifiBars(network.signal));
    button.addEventListener("click", () => {
      if (wifiState.selectedId !== network.id) {
        clearCrackTimer();
        wifiState.crackGameId = null;
        wifiState.crackNetworkId = null;
        resetDodgeRun();
        wifiState.tuneHits = 0;
        wifiState.wireDirection = 1;
        wifiState.wirePulse = WIRE_MIN;
        wifiState.wireStep = 0;
      }

      wifiState.selectedId = network.id;
      renderWifi();
      setWifiReadout(`已选中 ${network.name}。`);
    });
    wifiNetworkList.append(button);
  });
}

function isWifiCracked(network = getSelectedWifi()) {
  return Boolean(network && wifiState.crackedIds.includes(network.id));
}

function renderPasswordMenu() {
  const selected = getSelectedWifi();
  const cracked = isWifiCracked(selected);

  wifiPasswordMenu.className = cracked ? "crack-fragments" : "crack-fragments is-locked";
  wifiPasswordMenu.replaceChildren();

  if (!selected) return;

  if (!cracked) {
    const locked = document.createElement("span");

    locked.className = "crack-fragment locked";
    locked.textContent = "密钥锁定";
    wifiPasswordMenu.append(locked);
    wifiPassword.value = "";
    wifiPassword.placeholder = "通关后自动填入";
    return;
  }

  selected.passwordSegments.forEach((segment) => {
    const fragment = document.createElement("span");

    fragment.className = "crack-fragment";
    fragment.classList.add("revealed");
    fragment.textContent = segment;
    wifiPasswordMenu.append(fragment);
  });

  wifiPassword.value = selected.password;
  wifiPassword.placeholder = "密钥已填入";
}

function appendCrackGameHead(game, titleText, progressText) {
  const head = document.createElement("div");
  const title = document.createElement("strong");
  const progress = document.createElement("span");

  head.className = "crack-game-head";
  title.textContent = titleText;
  progress.textContent = progressText;
  head.append(title, progress);
  game.append(head);
}

function createGameButton(label, className = "crack-game-button") {
  const button = document.createElement("button");

  button.className = className;
  button.type = "button";
  button.textContent = label;
  return button;
}

function renderTuneGame(selected) {
  const game = document.createElement("section");
  const dial = document.createElement("div");
  const sweep = document.createElement("span");
  const core = document.createElement("span");
  const hits = document.createElement("div");
  const readout = document.createElement("div");
  const controls = document.createElement("div");
  const tuneBounds = getTuneBounds(selected);

  game.className = "crack-game tune-game";
  appendCrackGameHead(game, "信号调频", `${wifiState.tuneHits}/${TUNE_HITS_REQUIRED}`);

  dial.className = "tune-dial";
  dial.style.setProperty("--target-start", `${tuneBounds.min * 3.6}deg`);
  dial.style.setProperty("--target-end", `${tuneBounds.max * 3.6}deg`);
  sweep.className = "tune-sweep";
  sweep.style.transform = `rotate(${wifiState.tuneValue * 3.6}deg) translateY(-82px)`;
  core.className = "tune-core";
  dial.append(sweep, core);

  hits.className = "tune-hits";
  for (let index = 0; index < TUNE_HITS_REQUIRED; index += 1) {
    const hit = document.createElement("i");

    hit.classList.toggle("on", index < wifiState.tuneHits);
    hits.append(hit);
  }

  readout.className = "tune-readout";
  readout.textContent = "小粉点进入绿色弧形时校准，连续锁定三次。";

  controls.className = "crack-game-controls";
  const button = createGameButton("校准");
  button.dataset.tuneAction = "lock";
  controls.append(button);

  game.append(dial, hits, readout, controls);
  wifiPuzzleList.append(game);
}

function renderWireGame(selected) {
  const game = document.createElement("section");
  const board = document.createElement("div");
  const fixedLine = document.createElement("span");
  const movingLine = document.createElement("span");
  const target = document.createElement("span");
  const mover = document.createElement("span");
  const bridge = document.createElement("span");
  const caption = document.createElement("div");
  const controls = document.createElement("div");
  const targetPosition = getWireTarget(selected);
  const aligned = isWireAligned(selected);

  game.className = "crack-game wire-game";
  appendCrackGameHead(game, "信号接线", `${wifiState.wireStep}/${selected.wireTargets.length}`);

  board.className = "wire-align-board";
  board.classList.toggle("aligned", aligned);
  fixedLine.className = "wire-fixed-line";
  movingLine.className = "wire-moving-line";
  target.className = "wire-target-point";
  target.style.left = `${targetPosition}%`;
  mover.className = "wire-moving-point";
  mover.style.left = `${wifiState.wirePulse}%`;
  bridge.className = "wire-bridge";
  bridge.style.left = `${targetPosition}%`;
  board.append(fixedLine, movingLine, target, mover, bridge);

  caption.className = "wire-caption";
  caption.textContent = aligned
    ? "对齐了，按接上。"
    : "让下面粉线对准上面绿接口。";

  controls.className = "crack-game-controls";
  const button = createGameButton("接上", "crack-game-button wire-connect-button");
  button.dataset.wireAction = "connect";
  controls.append(button);

  game.append(board, caption, controls);
  wifiPuzzleList.append(game);
}

function renderDodgeGame(selected) {
  const game = document.createElement("section");
  const field = document.createElement("div");
  const caption = document.createElement("div");
  const controls = document.createElement("div");
  const danger = document.createElement("span");
  const player = document.createElement("span");

  game.className = "crack-game dodge-game";
  appendCrackGameHead(game, "信号躲避", `${wifiState.dodgeScore}/${DODGE_GOAL}`);

  field.className = "dodge-field";
  field.setAttribute("aria-label", "下坠干扰轨道");
  DODGE_COLUMNS.forEach((label, columnIndex) => {
    const lane = document.createElement("span");

    lane.className = "dodge-lane";
    lane.style.left = `${columnIndex * 25}%`;
    lane.setAttribute("aria-hidden", "true");
    field.append(lane);
  });

  danger.className = "dodge-danger";
  field.append(danger);

  wifiState.dodgeObstacles.forEach((obstacle) => {
    const block = document.createElement("span");

    block.className = "dodge-obstacle";
    block.style.left = `calc(${(obstacle.column + .5) * 25}% - 15px)`;
    block.style.top = `${obstacle.y}%`;
    block.setAttribute("aria-label", `${DODGE_COLUMNS[obstacle.column]}列干扰`);
    field.append(block);
  });

  player.className = "dodge-player";
  player.style.left = `calc(${(wifiState.dodgeColumn + .5) * 25}% - 18px)`;
  player.textContent = "信号";
  field.append(player);

  caption.className = "dodge-caption";
  caption.textContent = "干扰块实时下坠，切换轨道躲到空位。";

  controls.className = "dodge-lane-controls";
  DODGE_COLUMNS.forEach((label, columnIndex) => {
    const button = createGameButton(label, "dodge-lane-button");

    button.dataset.dodgeAction = "lane";
    button.dataset.dodgeColumn = String(columnIndex);
    button.classList.toggle("active", columnIndex === wifiState.dodgeColumn);
    controls.append(button);
  });

  game.append(field, caption, controls);
  wifiPuzzleList.append(game);
}

function renderWifiPuzzles() {
  const selected = getSelectedWifi();
  const cracked = isWifiCracked(selected);
  const active = selected && wifiState.crackNetworkId === selected.id;

  wifiPuzzleList.replaceChildren();

  if (!selected) return;

  if (cracked) {
    const complete = document.createElement("div");
    complete.className = "crack-complete";
    complete.textContent = `${selected.name} 已破解，随机密码已填入。`;
    wifiPuzzleList.append(complete);
    return;
  }

  if (!active || !wifiState.crackGameId) {
    const standby = document.createElement("div");
    standby.className = "crack-standby";
    standby.textContent = "随机小游戏待机中。";
    wifiPuzzleList.append(standby);
    return;
  }

  if (wifiState.crackGameId === "tune") {
    renderTuneGame(selected);
    return;
  }

  if (wifiState.crackGameId === "wire") {
    renderWireGame(selected);
    return;
  }

  renderDodgeGame(selected);
}

function renderWifi() {
  const selected = getSelectedWifi();
  const connected = getConnectedWifi();
  const displayNetwork = connected || selected;

  wifiFeatureState.textContent = connected ? "已连接" : "待连接";
  wifiCurrentName.textContent = connected ? connected.name : "未连接";
  wifiStatusText.textContent = connected
    ? `${connected.band} · 密钥已通过`
    : selected
      ? `${isWifiCracked(selected) ? "已破解" : "未破解"} · 已选 ${selected.name}`
      : "等待选择热点";
  renderWifiBars(wifiCurrentSignal, displayNetwork ? displayNetwork.signal : 0);
  renderWifiNetworks();
  renderPasswordMenu();
  renderWifiPuzzles();
}

function resetWifiProfile(seed = wifiState.seed) {
  const profile = createWifiProfile(seed);

  clearCrackTimer();
  wifiState.connectedId = null;
  wifiState.crackedIds = [];
  wifiState.crackGameId = null;
  wifiState.crackNetworkId = null;
  resetDodgeRun();
  wifiState.networks = profile.networks;
  wifiState.seed = seed;
  wifiState.selectedId = profile.networks[0].id;
  wifiState.tuneDirection = 1;
  wifiState.tuneHits = 0;
  wifiState.tuneValue = 50;
  wifiState.wireDirection = 1;
  wifiState.wirePulse = WIRE_MIN;
  wifiState.wireTimeLeft = 100;
  wifiState.wireStep = 0;
  wifiPassword.value = "";
  renderWifi();
}

function connectWifi() {
  const selected = getSelectedWifi();
  const password = wifiPassword.value.trim();

  if (!selected) {
    setWifiReadout("还没有可连接的 Wi-Fi。", "warn");
    return;
  }

  if (!isWifiCracked(selected)) {
    setWifiReadout("这个 Wi-Fi 还没破解。先点破解 Wi-Fi。", "warn");
    return;
  }

  if (password !== selected.password) {
    wifiState.connectedId = null;
    renderWifi();
    setWifiReadout("密码不对。重新破解这个 Wi-Fi。", "bad");
    return;
  }

  wifiState.connectedId = selected.id;
  renderWifi();
  setWifiReadout(`${selected.name} 已连接 · ${selected.band} · 信号 ${selected.signal}/4。`, "good");
  beep("hot");
}

function scanWifi() {
  const selected = getSelectedWifi();

  if (!selected) {
    setWifiReadout("没有发现可检测的 Wi-Fi。", "warn");
    return;
  }

  window.clearTimeout(wifiState.timer);
  wifiStatusbar.classList.add("scanning");
  setWifiReadout(`正在检测 ${selected.name}...`);
  wifiState.timer = window.setTimeout(() => {
    const quality = selected.signal >= 4 ? "很稳" : selected.signal >= 3 ? "可用" : "偏弱";
    const latency = selected.latency + Math.floor(Math.random() * 12);
    const tone = selected.signal >= 3 ? "good" : "warn";

    wifiStatusbar.classList.remove("scanning");
    setWifiReadout(`信号检测完成：${selected.name} · ${selected.band} · ${quality} · 延迟 ${latency} ms。`, tone);
  }, 520);
}

function checkRealNetwork() {
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const details = [navigator.onLine ? "当前浏览器在线" : "当前浏览器离线"];

  if (connection) {
    if (connection.effectiveType) details.push(`类型 ${connection.effectiveType.toUpperCase()}`);
    if (typeof connection.downlink === "number") details.push(`下行约 ${connection.downlink} Mbps`);
    if (typeof connection.rtt === "number") details.push(`延迟约 ${connection.rtt} ms`);
    if (connection.saveData) details.push("省流量模式开启");
  } else {
    details.push("浏览器没有开放更多网络细节");
  }

  details.push("网页不能读取真实 Wi-Fi 名称和密码");
  setWifiReadout(details.join(" · "), navigator.onLine ? "good" : "bad");
}

function startWifiCrack() {
  const selected = getSelectedWifi();

  if (!selected) {
    setWifiReadout("还没有可破解的 Wi-Fi。", "warn");
    return;
  }

  if (isWifiCracked(selected)) {
    setWifiReadout(`${selected.name} 已经破解过了，可以直接连接。`, "good");
    return;
  }

  const game = pickRandom(Math.random, CRACK_GAMES);

  clearCrackTimer();
  wifiState.crackGameId = game.id;
  wifiState.crackNetworkId = selected.id;
  resetDodgeRun();
  wifiState.tuneDirection = Math.random() > 0.5 ? 1 : -1;
  wifiState.tuneHits = 0;
  wifiState.tuneValue = createTuneStartValue(getTuneTarget(selected, 0), getTuneWindow(selected, 0));
  wifiState.wireDirection = Math.random() > 0.5 ? 1 : -1;
  wifiState.wirePulse = wifiState.wireDirection > 0 ? WIRE_MIN : WIRE_MAX;
  wifiState.wireTimeLeft = 100;
  wifiState.wireStep = 0;
  renderWifi();
  setWifiReadout(`破解 ${selected.name}：${game.label} 已启动。`);
  startCrackTimer();
}

function completeWifiCrack(selected) {
  clearCrackTimer();

  if (!wifiState.crackedIds.includes(selected.id)) {
    wifiState.crackedIds.push(selected.id);
  }

  wifiState.crackGameId = null;
  wifiState.crackNetworkId = null;
  resetDodgeRun();
  wifiState.tuneHits = 0;
  wifiState.tuneValue = 50;
  wifiState.wireDirection = 1;
  wifiState.wirePulse = WIRE_MIN;
  wifiState.wireTimeLeft = 100;
  wifiState.wireStep = 0;
  renderWifi();
  setWifiReadout(`${selected.name} 破解完成，专属随机密码已填入。`, "good");
  beep("cold");
}

function getActiveCrackWifi(gameId) {
  const selected = getSelectedWifi();

  if (!selected || wifiState.crackNetworkId !== selected.id || wifiState.crackGameId !== gameId) {
    return null;
  }

  return selected;
}

function handleTuneAction(action) {
  const selected = getActiveCrackWifi("tune");

  if (!selected) return;

  if (action !== "lock") return;

  if (isTuneInGreen(selected)) {
    wifiState.tuneHits += 1;

    if (wifiState.tuneHits < TUNE_HITS_REQUIRED) {
      wifiState.tuneValue = createTuneStartValue(getTuneTarget(selected), getTuneWindow(selected));
      renderWifiPuzzles();
      setWifiReadout(`调频锁定 ${wifiState.tuneHits}/${TUNE_HITS_REQUIRED}，下一段加速。`, "good");
      beep("cold");
      return;
    }

    completeWifiCrack(selected);
    return;
  }

  wifiState.tuneHits = Math.max(0, wifiState.tuneHits - 1);
  renderWifiPuzzles();
  setWifiReadout("校准偏了，连击退一格。", "bad");
  beep("hot");
}

function handleWireAction(action) {
  const selected = getActiveCrackWifi("wire");

  if (!selected) return;

  if (action !== "connect") return;

  if (!isWireAligned(selected)) {
    renderWifiPuzzles();
    setWifiReadout("还没对齐，等下面粉线贴到绿色接口下方。", "warn");
    beep("hot");
    return;
  }

  wifiState.wireStep += 1;

  if (wifiState.wireStep >= selected.wireTargets.length) {
    completeWifiCrack(selected);
    return;
  }

  renderWifiPuzzles();
  setWifiReadout(`接线进度 ${wifiState.wireStep}/${selected.wireTargets.length}，下一段加速。`, "good");
  beep("cold");
}

function handleDodgeAction(action, column = null) {
  const selected = getActiveCrackWifi("dodge");

  if (!selected) return;

  const nextColumn = action === "lane" && Number.isFinite(column)
    ? column
    : wifiState.dodgeColumn + (action === "left" ? -1 : 1);

  wifiState.dodgeColumn = clamp(nextColumn, 0, DODGE_COLUMNS.length - 1);
  renderWifiPuzzles();
  setWifiReadout(`信号移动到${DODGE_COLUMNS[wifiState.dodgeColumn]}列。`);
}

function beep(type = "tap") {
  if (!window.AudioContext && !window.webkitAudioContext) return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  const context = new AudioContext();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const frequency = type === "power" ? 420 : type === "hot" ? 520 : 680;

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, context.currentTime);
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.06, context.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.12);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.14);
}

coldButton.addEventListener("click", () => {
  state.mode = "cold";
  state.temperature = Math.min(state.temperature, 24);
  beep("cold");
  render();
});

hotButton.addEventListener("click", () => {
  state.mode = "hot";
  state.temperature = Math.max(state.temperature, 26);
  beep("hot");
  render();
});

powerButton.addEventListener("click", () => {
  state.isOn = !state.isOn;
  beep("power");
  render();
});

plusButton.addEventListener("click", () => {
  state.temperature = Math.min(30, state.temperature + 1);
  beep();
  render();
});

minusButton.addEventListener("click", () => {
  state.temperature = Math.max(16, state.temperature - 1);
  beep();
  render();
});

featureButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (button.disabled) return;
    selectFeature(button.dataset.feature);
  });
});

wifiConnectButton.addEventListener("click", connectWifi);
wifiCrackButton.addEventListener("click", startWifiCrack);
wifiScanButton.addEventListener("click", scanWifi);
wifiRealScanButton.addEventListener("click", checkRealNetwork);
wifiShuffleButton.addEventListener("click", () => {
  const nextSeed = createFreshSeed();
  storeWifiSeed(nextSeed);
  resetWifiProfile(nextSeed);
  setWifiReadout("已换一份新的 Wi-Fi 名字、密码和破解小游戏。", "good");
});
wifiPuzzleList.addEventListener("pointerdown", (event) => {
  const tuneButton = event.target.closest("[data-tune-action]");
  const wireAction = event.target.closest("[data-wire-action]");
  const dodgeButton = event.target.closest("[data-dodge-action]");

  if (tuneButton) {
    event.preventDefault();
    handleTuneAction(tuneButton.dataset.tuneAction);
    return;
  }

  if (wireAction) {
    event.preventDefault();
    handleWireAction(wireAction.dataset.wireAction);
    return;
  }

  if (dodgeButton) {
    event.preventDefault();
    handleDodgeAction(dodgeButton.dataset.dodgeAction, Number(dodgeButton.dataset.dodgeColumn));
  }
});

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  const target = event.target;

  if (target instanceof Element && target.matches("input, textarea")) return;

  if (getActiveCrackWifi("tune") && (key === " " || key === "enter")) {
    event.preventDefault();
    handleTuneAction("lock");
    return;
  }

  if (getActiveCrackWifi("wire") && (key === " " || key === "enter")) {
    event.preventDefault();
    handleWireAction("connect");
    return;
  }

  if (!getActiveCrackWifi("dodge")) return;

  if (key === "arrowleft" || key === "a") {
    event.preventDefault();
    handleDodgeAction("left");
    return;
  }

  if (key === "arrowright" || key === "d") {
    event.preventDefault();
    handleDodgeAction("right");
    return;
  }

  if (["1", "2", "3", "4"].includes(key)) {
    event.preventDefault();
    handleDodgeAction("lane", Number(key) - 1);
  }
});

year.textContent = new Date().getFullYear();
resetWifiProfile();
render();
