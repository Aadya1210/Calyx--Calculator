// CALYX - State Variables
let currentInput = "0";
let isNewCalculation = false;
let angleMode = "DEG";
let memoryValue = 0;
let currentTheme = localStorage.getItem("calyx_theme") || "midnight";
let currentAccent = localStorage.getItem("calyx_accent") || "purple";
let soundEnabled = JSON.parse(localStorage.getItem("calyx_sound") || "true");
let highContrastEnabled = JSON.parse(localStorage.getItem("calyx_contrast") || "false");
let history = JSON.parse(localStorage.getItem("calyx_history") || "[]");
let activeMode = "basic";
let voiceActive = false;
let recognition = null;
let deferredPrompt = null;

// Graphing State
let graphFunc = "sin";
let graphZoom = 1;
let graphPanX = 0;
let graphPanY = 0;

// Web Audio API Synthesizer Context
let audioCtx = null;

// DOM Elements
const displayEl = document.getElementById("display");
const livePreviewEl = document.getElementById("livePreview");
const prevExpressionEl = document.getElementById("prevExpression");
const angleModeEl = document.getElementById("angleMode");
const memoryBadgeEl = document.getElementById("memoryBadge");
const toastEl = document.getElementById("toast");
const appContainer = document.getElementById("app");
const glassCard = document.getElementById("glassCard");
const tabPill = document.getElementById("tabPill");

// Tab Mode Indexes
const modeIndexes = {
  basic: 0,
  scientific: 1,
  graph: 2,
  converter: 3,
  currency: 4,
  ai: 5,
  history: 6,
  settings: 6
};

// Available Themes & Accents
const themes = ["midnight", "aurora", "ocean", "frost", "sunset", "amoled"];
const accents = ["purple", "blue", "pink", "green", "orange", "red"];

// Initialize Application
document.addEventListener("DOMContentLoaded", () => {
  setTheme(currentTheme);
  setAccent(currentAccent);
  renderHistory();
  updateConverterUnits();
  convertCurrency();
  setupKeyboardSupport();
  setupMouseParallax();
  setupPWA();

  // Settings Toggles Setup
  const soundToggle = document.getElementById("soundToggle");
  const contrastToggle = document.getElementById("contrastToggle");

  if (soundToggle) soundToggle.checked = soundEnabled;
  if (contrastToggle) contrastToggle.checked = highContrastEnabled;
  if (highContrastEnabled) document.body.classList.add("high-contrast");

  updateTabPill("basic");

  // Global Ctrl + K / Cmd + K listener
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      toggleCommandPalette();
    }
  });
});

// ==========================================================================
// 1. Audio Sound Feedback Engine (Web Audio API Synthesizer)
// ==========================================================================

function playKeySound() {
  if (!soundEnabled) return;
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(440, audioCtx.currentTime); // 440Hz click
    osc.frequency.exponentialRampToValueAtTime(110, audioCtx.currentTime + 0.04);

    gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.04);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.04);
  } catch (e) {}
}

function toggleSoundSetting(enabled) {
  soundEnabled = enabled;
  localStorage.setItem("calyx_sound", JSON.stringify(enabled));
  showToast(enabled ? "Audio clicks enabled" : "Audio clicks disabled");
}

function toggleContrastSetting(enabled) {
  highContrastEnabled = enabled;
  localStorage.setItem("calyx_contrast", JSON.stringify(enabled));
  if (enabled) {
    document.body.classList.add("high-contrast");
  } else {
    document.body.classList.remove("high-contrast");
  }
}

// ==========================================================================
// 2. Theme & Accent Color System
// ==========================================================================

function cycleTheme() {
  const currentIndex = themes.indexOf(currentTheme);
  const nextTheme = themes[(currentIndex + 1) % themes.length];
  setTheme(nextTheme);
  showToast("Theme: " + capitalize(nextTheme));
}

function setTheme(theme) {
  currentTheme = theme;
  document.body.setAttribute("data-theme", theme);
  localStorage.setItem("calyx_theme", theme);
}

function cycleAccent() {
  const currentIndex = accents.indexOf(currentAccent);
  const nextAccent = accents[(currentIndex + 1) % accents.length];
  setAccent(nextAccent);
  showToast("Accent: " + capitalize(nextAccent));
}

function setAccent(accent) {
  currentAccent = accent;
  document.body.setAttribute("data-accent", accent);
  localStorage.setItem("calyx_accent", accent);
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ==========================================================================
// 3. 3D Mouse Parallax & Dynamic Light Source (40% Reduced Tilt ~2.5°)
// ==========================================================================

function setupMouseParallax() {
  document.addEventListener("mousemove", (e) => {
    if (!glassCard) return;

    const rect = glassCard.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const tiltX = ((y - centerY) / centerY) * -2.5; // Damped ~2.5° spatial tilt
    const tiltY = ((x - centerX) / centerX) * 2.5;

    document.documentElement.style.setProperty("--mouse-x", `${x}px`);
    document.documentElement.style.setProperty("--mouse-y", `${y}px`);
    document.documentElement.style.setProperty("--tilt-x", `${tiltX}deg`);
    document.documentElement.style.setProperty("--tilt-y", `${tiltY}deg`);
  });

  document.addEventListener("mouseleave", () => {
    document.documentElement.style.setProperty("--tilt-x", `0deg`);
    document.documentElement.style.setProperty("--tilt-y", `0deg`);
  });
}

// ==========================================================================
// 4. Memory Functions (MC, MR, M+, M-)
// ==========================================================================

function updateMemoryBadge() {
  if (memoryBadgeEl) {
    if (memoryValue !== 0) {
      memoryBadgeEl.classList.remove("hidden");
    } else {
      memoryBadgeEl.classList.add("hidden");
    }
  }
}

function memoryClear() {
  playKeySound();
  memoryValue = 0;
  updateMemoryBadge();
  showToast("Memory Cleared");
}

function memoryRecall() {
  playKeySound();
  currentInput = String(memoryValue);
  isNewCalculation = true;
  updateDisplay();
  showToast("Memory Recalled: " + memoryValue);
}

function memoryAdd() {
  playKeySound();
  try {
    const val = parseFloat(evaluateExpression(prepareExpression(currentInput)));
    if (!isNaN(val)) {
      memoryValue += val;
      updateMemoryBadge();
      showToast(`M+ (${memoryValue})`);
    }
  } catch (e) {}
}

function memorySubtract() {
  playKeySound();
  try {
    const val = parseFloat(evaluateExpression(prepareExpression(currentInput)));
    if (!isNaN(val)) {
      memoryValue -= val;
      updateMemoryBadge();
      showToast(`M- (${memoryValue})`);
    }
  } catch (e) {}
}

// ==========================================================================
// 5. Calculator Input & Evaluation Engine
// ==========================================================================

function press(val) {
  playKeySound();
  if (currentInput === "0" || isNewCalculation) {
    if (val === "." || isOperator(val)) {
      currentInput = isNewCalculation ? currentInput + val : "0" + val;
    } else {
      currentInput = val;
    }
    isNewCalculation = false;
  } else {
    currentInput += val;
  }
  updateDisplay();
}

function isOperator(char) {
  return ["+", "-", "*", "/", "^", "%"].includes(char);
}

function clearDisplay() {
  playKeySound();
  currentInput = "0";
  prevExpressionEl.innerText = "";
  livePreviewEl.innerText = "";
  isNewCalculation = false;
  updateDisplay();
}

function backspace() {
  playKeySound();
  if (isNewCalculation) {
    clearDisplay();
    return;
  }

  const funcTags = ["sin(", "cos(", "tan(", "sqrt(", "log(", "ln("];
  let removedTag = false;

  for (let tag of funcTags) {
    if (currentInput.endsWith(tag)) {
      currentInput = currentInput.slice(0, -tag.length);
      removedTag = true;
      break;
    }
  }

  if (!removedTag) {
    currentInput = currentInput.slice(0, -1);
  }

  if (currentInput === "" || currentInput === "-") {
    currentInput = "0";
  }

  updateDisplay();
}

function updateDisplay() {
  displayEl.value = currentInput;
  updateLivePreview();
}

function updateLivePreview() {
  if (!currentInput || currentInput === "0") {
    livePreviewEl.innerText = "";
    return;
  }

  try {
    const parsedExpr = prepareExpression(currentInput);
    const result = evaluateExpression(parsedExpr);

    if (result !== undefined && !isNaN(result) && isFinite(result) && String(result) !== currentInput) {
      livePreviewEl.innerText = "= " + formatNumber(result);
    } else {
      livePreviewEl.innerText = "";
    }
  } catch (e) {
    livePreviewEl.innerText = "";
  }
}

function prepareExpression(expr) {
  let parsed = expr;

  parsed = parsed.replace(/π/g, "Math.PI");
  parsed = parsed.replace(/e/g, "Math.E");
  parsed = parsed.replace(/\^2/g, "**2");
  parsed = parsed.replace(/\^/g, "**");
  parsed = parsed.replace(/%/g, "/100");

  if (angleMode === "DEG") {
    parsed = parsed.replace(/sin\(/g, "Math.sin((Math.PI/180)*");
    parsed = parsed.replace(/cos\(/g, "Math.cos((Math.PI/180)*");
    parsed = parsed.replace(/tan\(/g, "Math.tan((Math.PI/180)*");
  } else {
    parsed = parsed.replace(/sin\(/g, "Math.sin(");
    parsed = parsed.replace(/cos\(/g, "Math.cos(");
    parsed = parsed.replace(/tan\(/g, "Math.tan(");
  }

  parsed = parsed.replace(/sqrt\(/g, "Math.sqrt(");
  parsed = parsed.replace(/log\(/g, "Math.log10(");
  parsed = parsed.replace(/ln\(/g, "Math.log(");

  return parsed;
}

function evaluateExpression(expr) {
  let openParen = (expr.match(/\(/g) || []).length;
  let closeParen = (expr.match(/\)/g) || []).length;
  while (openParen > closeParen) {
    expr += ")";
    closeParen++;
  }
  return Function(`'use strict'; return (${expr})`)();
}

function calculate() {
  playKeySound();
  try {
    const rawExpr = currentInput;
    const parsedExpr = prepareExpression(rawExpr);
    const res = evaluateExpression(parsedExpr);

    if (res === undefined || isNaN(res) || !isFinite(res)) {
      displayEl.value = "Error";
      livePreviewEl.innerText = "";
      return;
    }

    const formattedRes = String(formatNumber(res));
    addHistoryEntry(rawExpr, formattedRes);

    prevExpressionEl.innerText = rawExpr + " =";
    currentInput = formattedRes;
    livePreviewEl.innerText = "";
    isNewCalculation = true;
    updateDisplay();
  } catch (err) {
    displayEl.value = "Error";
    livePreviewEl.innerText = "";
  }
}

function formatNumber(num) {
  if (Number.isInteger(num)) return num;
  return parseFloat(num.toFixed(8));
}

function toggleAngleMode() {
  playKeySound();
  angleMode = angleMode === "DEG" ? "RAD" : "DEG";
  angleModeEl.innerText = angleMode;
  showToast("Angle Mode: " + angleMode);
  updateLivePreview();
}

// ==========================================================================
// 6. Download Action & PWA Handler
// ==========================================================================

function handleDownloadAction() {
  playKeySound();
  if (deferredPrompt) {
    installPWA();
  } else {
    downloadCurrentResult();
  }
}

function downloadCurrentResult() {
  const val = displayEl.value;
  const expr = prevExpressionEl.innerText || "Calculation";

  if (!val || val === "Error") {
    showToast("No result to download");
    return;
  }

  const fileContent = `CALYX – Precision. Simplified.
Date: ${new Date().toLocaleString()}
Expression: ${expr}
Result: ${val}
`;

  downloadFile(fileContent, `calyx_result_${Date.now()}.txt`, "text/plain");
}

// ==========================================================================
// 7. Tab Mode Switching & Tab Pill Translate
// ==========================================================================

function updateTabPill(mode) {
  const index = modeIndexes[mode] !== undefined ? modeIndexes[mode] : 0;
  if (tabPill) {
    tabPill.style.transform = `translateX(${index * 100}%)`;
  }
}

function switchMode(mode) {
  playKeySound();
  activeMode = mode;

  // Hide all screens
  document.getElementById("basicMode").classList.add("hidden");
  document.getElementById("scientificMode").classList.add("hidden");
  document.getElementById("graphMode").classList.add("hidden");
  document.getElementById("converterMode").classList.add("hidden");
  document.getElementById("currencyMode").classList.add("hidden");
  document.getElementById("aiMode").classList.add("hidden");
  document.getElementById("historyMode").classList.add("hidden");
  document.getElementById("settingsMode").classList.add("hidden");

  document.querySelectorAll(".tab-btn").forEach(tab => tab.classList.remove("active"));
  const selectedTab = document.getElementById(`tab-${mode}`);
  if (selectedTab) selectedTab.classList.add("active");

  updateTabPill(mode);
  const displayArea = document.getElementById("displayArea");
  const memoryRow = document.getElementById("memoryRow");

  if (mode === "scientific") {
    document.getElementById("scientificMode").classList.remove("hidden");
    appContainer.classList.add("scientific-mode");
    appContainer.classList.remove("wide-mode");
    displayArea.classList.remove("hidden");
    memoryRow.classList.remove("hidden");
  } else if (mode === "graph") {
    document.getElementById("graphMode").classList.remove("hidden");
    appContainer.classList.add("wide-mode");
    appContainer.classList.remove("scientific-mode");
    displayArea.classList.add("hidden");
    memoryRow.classList.add("hidden");
    setTimeout(renderGraph, 50);
  } else if (mode === "converter") {
    document.getElementById("converterMode").classList.remove("hidden");
    appContainer.classList.remove("scientific-mode", "wide-mode");
    displayArea.classList.add("hidden");
    memoryRow.classList.add("hidden");
    performConversion();
  } else if (mode === "currency") {
    document.getElementById("currencyMode").classList.remove("hidden");
    appContainer.classList.remove("scientific-mode", "wide-mode");
    displayArea.classList.add("hidden");
    memoryRow.classList.add("hidden");
    convertCurrency();
  } else if (mode === "ai") {
    document.getElementById("aiMode").classList.remove("hidden");
    appContainer.classList.remove("scientific-mode", "wide-mode");
    displayArea.classList.add("hidden");
    memoryRow.classList.add("hidden");
  } else if (mode === "history") {
    document.getElementById("historyMode").classList.remove("hidden");
    appContainer.classList.remove("scientific-mode", "wide-mode");
    displayArea.classList.add("hidden");
    memoryRow.classList.add("hidden");
    renderHistory();
  } else if (mode === "settings") {
    document.getElementById("settingsMode").classList.remove("hidden");
    appContainer.classList.remove("scientific-mode", "wide-mode");
    displayArea.classList.add("hidden");
    memoryRow.classList.add("hidden");
  } else {
    document.getElementById("basicMode").classList.remove("hidden");
    appContainer.classList.remove("scientific-mode", "wide-mode");
    displayArea.classList.remove("hidden");
    memoryRow.classList.remove("hidden");
  }
}

// ==========================================================================
// 8. HTML5 Canvas Graphing Engine
// ==========================================================================

function renderGraph() {
  const canvas = document.getElementById("graphCanvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width * window.devicePixelRatio;
  canvas.height = rect.height * window.devicePixelRatio;

  const width = canvas.width;
  const height = canvas.height;
  const centerX = width / 2 + graphPanX;
  const centerY = height / 2 + graphPanY;
  const scale = 40 * graphZoom * window.devicePixelRatio;

  graphFunc = document.getElementById("graphFuncSelect").value;

  ctx.clearRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
  ctx.lineWidth = 1;

  for (let x = centerX % scale; x < width; x += scale) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
  }
  for (let y = centerY % scale; y < height; y += scale) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
  }

  ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, centerY); ctx.lineTo(width, centerY); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(centerX, 0); ctx.lineTo(centerX, height); ctx.stroke();

  ctx.strokeStyle = "#38bdf8";
  ctx.lineWidth = 3 * window.devicePixelRatio;
  ctx.beginPath();

  let firstPoint = true;

  for (let px = 0; px < width; px += 2) {
    const x = (px - centerX) / scale;
    let y = 0;

    if (graphFunc === "sin") y = Math.sin(x);
    else if (graphFunc === "cos") y = Math.cos(x);
    else if (graphFunc === "tan") y = Math.tan(x);
    else if (graphFunc === "x2") y = x * x;
    else if (graphFunc === "x3") y = x * x * x;
    else if (graphFunc === "poly") y = x * x * x - 3 * x;

    const py = centerY - y * scale;

    if (py >= -100 && py <= height + 100) {
      if (firstPoint) {
        ctx.moveTo(px, py);
        firstPoint = false;
      } else {
        ctx.lineTo(px, py);
      }
    } else {
      firstPoint = true;
    }
  }
  ctx.stroke();
}

function zoomGraph(factor) {
  playKeySound();
  graphZoom *= factor;
  renderGraph();
}

function resetGraph() {
  playKeySound();
  graphZoom = 1;
  graphPanX = 0;
  graphPanY = 0;
  renderGraph();
}

// ==========================================================================
// 9. AI Math Assistant Engine
// ==========================================================================

function askAi(promptText) {
  document.getElementById("aiPrompt").value = promptText;
  runAiSolver();
}

function runAiSolver() {
  playKeySound();
  const prompt = document.getElementById("aiPrompt").value.trim().toLowerCase();
  const qEl = document.getElementById("aiQuestion");
  const aEl = document.getElementById("aiAnswer");
  const expEl = document.getElementById("aiExplanation");

  if (!prompt) return;

  qEl.innerText = `Problem: "${prompt}"`;

  let match;

  if ((match = prompt.match(/(\d+\.?\d*)\s*(?:percent|%)\s*of\s*(\d+\.?\d*)/))) {
    const pct = parseFloat(match[1]);
    const num = parseFloat(match[2]);
    const res = (pct / 100) * num;
    aEl.innerText = res;
    expEl.innerText = `Step 1: Convert ${pct}% to decimal: ${pct / 100}\nStep 2: Multiply by ${num}: ${pct / 100} × ${num} = ${res}`;
    return;
  }

  if ((match = prompt.match(/(?:split|divide)\s*(\d+\.?\d*)\s*(?:among|by|for)\s*(\d+\.?\d*)/))) {
    const total = parseFloat(match[1]);
    const count = parseFloat(match[2]);
    const res = formatNumber(total / count);
    aEl.innerText = `$${res} / person`;
    expEl.innerText = `Step 1: Divide total ($${total}) by number of people (${count}).\nStep 2: $${total} ÷ ${count} = $${res} per person.`;
    return;
  }

  if ((match = prompt.match(/(\d+\.?\d*)\s*at\s*(\d+\.?\d*)%\s*for\s*(\d+\.?\d*)/))) {
    const P = parseFloat(match[1]);
    const r = parseFloat(match[2]) / 100;
    const t = parseFloat(match[3]);
    const A = P * Math.pow(1 + r, t);
    const ci = A - P;
    aEl.innerText = `$${formatNumber(ci)} (Total: $${formatNumber(A)})`;
    expEl.innerText = `Formula: A = P(1 + r)^t\nPrincipal P = $${P}, Rate r = ${r}, Time t = ${t} yrs\nTotal Amount = $${formatNumber(A)}, Interest = $${formatNumber(ci)}`;
    return;
  }

  try {
    const cleanMath = prompt.replace(/plus/g, "+").replace(/minus/g, "-").replace(/times|multiplied by/g, "*").replace(/divided by/g, "/");
    const evaluated = evaluateExpression(cleanMath);
    aEl.innerText = evaluated;
    expEl.innerText = `Evaluated mathematical expression: ${cleanMath} = ${evaluated}`;
  } catch (e) {
    aEl.innerText = "Could not parse query";
    expEl.innerText = "Try asking: '18% of 450', 'Split 250 among 7', or 'Compound interest on 5000 at 5% for 3 years'.";
  }
}

// ==========================================================================
// 10. Currency Converter Engine
// ==========================================================================

const fxRates = {
  USD: 1.0,
  EUR: 0.92,
  GBP: 0.78,
  INR: 83.5,
  JPY: 155.2,
  CAD: 1.36,
  AUD: 1.51
};

const fxSymbols = {
  USD: "$", EUR: "€", GBP: "£", INR: "₹", JPY: "¥", CAD: "CA$", AUD: "A$"
};

function convertCurrency() {
  const amount = parseFloat(document.getElementById("currencyAmount").value);
  const from = document.getElementById("currencyFrom").value;
  const to = document.getElementById("currencyTo").value;
  const outputEl = document.getElementById("currencyOutput");

  if (isNaN(amount)) {
    outputEl.innerText = "$0.00";
    return;
  }

  const baseUSD = amount / fxRates[from];
  const converted = baseUSD * fxRates[to];
  const symbol = fxSymbols[to] || "";

  outputEl.innerText = `${symbol}${formatNumber(converted)} ${to}`;
}

// ==========================================================================
// 11. Web Speech API Voice Recognition
// ==========================================================================

function toggleVoiceInput() {
  const btn = document.getElementById("voiceBtn");

  if (voiceActive) {
    if (recognition) recognition.stop();
    voiceActive = false;
    btn.classList.remove("listening");
    showToast("Voice input stopped");
    return;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    showToast("Speech Recognition not supported in this browser");
    return;
  }

  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = "en-US";

  recognition.onstart = () => {
    voiceActive = true;
    btn.classList.add("listening");
    showToast("Listening... speak calculation!");
  };

  recognition.onresult = (e) => {
    const transcript = e.results[0][0].transcript.toLowerCase();
    showToast(`Heard: "${transcript}"`);
    parseSpeechToMath(transcript);
  };

  recognition.onerror = () => {
    voiceActive = false;
    btn.classList.remove("listening");
    showToast("Voice recognition error");
  };

  recognition.onend = () => {
    voiceActive = false;
    btn.classList.remove("listening");
  };

  recognition.start();
}

function parseSpeechToMath(text) {
  let mathStr = text
    .replace(/plus/g, "+")
    .replace(/minus/g, "-")
    .replace(/times|multiplied by|x/g, "*")
    .replace(/divided by|over/g, "/")
    .replace(/percent/g, "%")
    .replace(/point/g, ".")
    .replace(/\s+/g, "");

  currentInput = mathStr;
  updateDisplay();
  calculate();
}

// ==========================================================================
// 12. Command Palette Modal Controller (Ctrl + K)
// ==========================================================================

const commandsList = [
  { name: "Switch Theme: Midnight", action: () => setTheme("midnight") },
  { name: "Switch Theme: Aurora", action: () => setTheme("aurora") },
  { name: "Switch Theme: Ocean Blue", action: () => setTheme("ocean") },
  { name: "Switch Theme: Frost White", action: () => setTheme("frost") },
  { name: "Switch Theme: Sunset", action: () => setTheme("sunset") },
  { name: "Switch Theme: AMOLED Black", action: () => setTheme("amoled") },
  { name: "Accent: Purple", action: () => setAccent("purple") },
  { name: "Accent: Blue", action: () => setAccent("blue") },
  { name: "Accent: Pink", action: () => setAccent("pink") },
  { name: "Accent: Green", action: () => setAccent("green") },
  { name: "Mode: Basic Calculator", action: () => switchMode("basic") },
  { name: "Mode: Scientific Calculator", action: () => switchMode("scientific") },
  { name: "Mode: Graphing Calculator", action: () => switchMode("graph") },
  { name: "Mode: Unit Converter", action: () => switchMode("converter") },
  { name: "Mode: Currency Converter", action: () => switchMode("currency") },
  { name: "Mode: AI Math Assistant", action: () => switchMode("ai") },
  { name: "Mode: History Log", action: () => switchMode("history") },
  { name: "Mode: CALYX Settings", action: () => switchMode("settings") },
  { name: "Download Current Result", action: () => handleDownloadAction() },
  { name: "Copy Current Result", action: () => copyResult() },
  { name: "Clear History", action: () => clearHistory() },
  { name: "Export History TXT", action: () => exportHistory("txt") },
  { name: "Export History CSV", action: () => exportHistory("csv") }
];

function toggleCommandPalette() {
  playKeySound();
  const overlay = document.getElementById("commandPalette");
  const input = document.getElementById("paletteSearch");

  overlay.classList.toggle("show");

  if (overlay.classList.contains("show")) {
    input.value = "";
    filterPaletteCommands();
    setTimeout(() => input.focus(), 50);
  }
}

function filterPaletteCommands() {
  const query = document.getElementById("paletteSearch").value.toLowerCase();
  const listEl = document.getElementById("paletteList");

  const filtered = commandsList.filter(cmd => cmd.name.toLowerCase().includes(query));

  listEl.innerHTML = filtered.map((cmd, idx) => `
    <div class="palette-item ${idx === 0 ? 'active' : ''}" onclick="execPaletteCommand(${commandsList.indexOf(cmd)})">
      <span>${cmd.name}</span>
      <span class="palette-item-shortcut">↵ Select</span>
    </div>
  `).join("");
}

function execPaletteCommand(idx) {
  if (commandsList[idx]) {
    commandsList[idx].action();
    toggleCommandPalette();
  }
}

// ==========================================================================
// 13. History Export Engine & PWA Setup
// ==========================================================================

function exportHistory(format) {
  playKeySound();
  if (history.length === 0) {
    showToast("No history to export");
    return;
  }

  if (format === "txt") {
    const textContent = history.map(item => `${item.time} | ${item.expr} = ${item.res}`).join("\n");
    downloadFile(textContent, "calyx_history.txt", "text/plain");
  } else if (format === "csv") {
    const csvContent = "Time,Expression,Result\n" + history.map(item => `"${item.time}","${item.expr}","${item.res}"`).join("\n");
    downloadFile(csvContent, "calyx_history.csv", "text/csv");
  } else if (format === "pdf") {
    window.print();
  }
}

function downloadFile(content, fileName, contentType) {
  const a = document.createElement("a");
  const file = new Blob([content], { type: contentType });
  a.href = URL.createObjectURL(file);
  a.download = fileName;
  a.click();
  showToast(`Exported ${fileName}`);
}

function setupPWA() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").then(() => {
      console.log("Service Worker Registered");
    }).catch(err => console.log("SW Fail", err));
  }

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
  });
}

function installPWA() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(() => {
      deferredPrompt = null;
    });
  }
}

// Global Helpers
function copyResult() {
  playKeySound();
  const valToCopy = displayEl.value;
  if (!valToCopy || valToCopy === "Error") return;

  navigator.clipboard.writeText(valToCopy).then(() => {
    showToast("Copied to clipboard!");
  }).catch(() => {
    showToast("Copied: " + valToCopy);
  });
}

function showToast(message) {
  toastEl.innerText = message;
  toastEl.classList.add("show");
  setTimeout(() => {
    toastEl.classList.remove("show");
  }, 2200);
}

function addHistoryEntry(expr, res) {
  history.unshift({ expr, res, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
  if (history.length > 30) history.pop();
  localStorage.setItem("calyx_history", JSON.stringify(history));
}

function renderHistory() {
  const historyListEl = document.getElementById("historyList");
  if (!historyListEl) return;

  if (history.length === 0) {
    historyListEl.innerHTML = `<div class="empty-history">No history calculations yet</div>`;
    return;
  }

  historyListEl.innerHTML = history.map((item, index) => `
    <div class="history-item" onclick="useHistoryItem(${index})">
      <div class="history-item-expr">${item.expr} =</div>
      <div class="history-item-res">${item.res}</div>
    </div>
  `).join("");
}

function useHistoryItem(index) {
  playKeySound();
  const item = history[index];
  if (item) {
    currentInput = item.res;
    prevExpressionEl.innerText = item.expr + " =";
    isNewCalculation = true;
    switchMode("basic");
    updateDisplay();
  }
}

function clearHistory() {
  playKeySound();
  history = [];
  localStorage.removeItem("calyx_history");
  renderHistory();
  showToast("History cleared");
}

// Unit Converter Logic
const unitData = {
  length: {
    units: {
      m: { name: "Meters (m)", factor: 1 },
      km: { name: "Kilometers (km)", factor: 1000 },
      cm: { name: "Centimeters (cm)", factor: 0.01 },
      mm: { name: "Millimeters (mm)", factor: 0.001 },
      mile: { name: "Miles (mi)", factor: 1609.344 },
      yard: { name: "Yards (yd)", factor: 0.9144 },
      ft: { name: "Feet (ft)", factor: 0.3048 },
      in: { name: "Inches (in)", factor: 0.0254 }
    }
  },
  mass: {
    units: {
      kg: { name: "Kilograms (kg)", factor: 1 },
      g: { name: "Grams (g)", factor: 0.001 },
      mg: { name: "Milligrams (mg)", factor: 0.000001 },
      lb: { name: "Pounds (lbs)", factor: 0.45359237 },
      oz: { name: "Ounces (oz)", factor: 0.0283495231 }
    }
  },
  temperature: {
    units: {
      c: { name: "Celsius (°C)" },
      f: { name: "Fahrenheit (°F)" },
      k: { name: "Kelvin (K)" }
    }
  },
  volume: {
    units: {
      l: { name: "Liters (L)", factor: 1 },
      ml: { name: "Milliliters (mL)", factor: 0.001 },
      gal: { name: "Gallons (gal)", factor: 3.78541 },
      cup: { name: "Cups", factor: 0.236588 }
    }
  }
};

function updateConverterUnits() {
  const catEl = document.getElementById("convertCategory");
  if (!catEl) return;
  const cat = catEl.value;

  const fromSelect = document.getElementById("convertFrom");
  const toSelect = document.getElementById("convertTo");

  const units = unitData[cat].units;
  const optionsHtml = Object.keys(units).map(key => `<option value="${key}">${units[key].name}</option>`).join("");

  fromSelect.innerHTML = optionsHtml;
  toSelect.innerHTML = optionsHtml;

  const keys = Object.keys(units);
  if (keys.length > 1) {
    toSelect.selectedIndex = 1;
  }

  performConversion();
}

function performConversion() {
  const catEl = document.getElementById("convertCategory");
  if (!catEl) return;
  const cat = catEl.value;

  const val = parseFloat(document.getElementById("convertInput").value);
  const fromUnit = document.getElementById("convertFrom").value;
  const toUnit = document.getElementById("convertTo").value;
  const outputEl = document.getElementById("converterOutput");

  if (isNaN(val)) {
    outputEl.innerText = "0";
    return;
  }

  let result = 0;

  if (cat === "temperature") {
    result = convertTemperature(val, fromUnit, toUnit);
  } else {
    const fromFactor = unitData[cat].units[fromUnit].factor;
    const toFactor = unitData[cat].units[toUnit].factor;
    const baseValue = val * fromFactor;
    result = baseValue / toFactor;
  }

  outputEl.innerText = formatNumber(result) + " " + toUnit.toUpperCase();
}

function convertTemperature(val, from, to) {
  if (from === to) return val;
  let celsius = val;
  if (from === "f") celsius = (val - 32) * (5 / 9);
  if (from === "k") celsius = val - 273.15;
  if (to === "c") return celsius;
  if (to === "f") return celsius * (9 / 5) + 32;
  if (to === "k") return celsius + 273.15;
}

function setupKeyboardSupport() {
  document.addEventListener("keydown", (e) => {
    if (document.activeElement.tagName === "INPUT") return;

    const key = e.key;

    if (key >= "0" && key <= "9") press(key);
    else if (key === ".") press(".");
    else if (key === "+") press("+");
    else if (key === "-") press("-");
    else if (key === "*") press("*");
    else if (key === "/") { e.preventDefault(); press("/"); }
    else if (key === "%") press("%");
    else if (key === "^") press("^");
    else if (key === "(") press("(");
    else if (key === ")") press(")");
    else if (key === "Enter" || key === "=") { e.preventDefault(); calculate(); }
    else if (key === "Backspace") { e.preventDefault(); backspace(); }
    else if (key === "Escape" || key.toLowerCase() === "c") clearDisplay();
  });
}