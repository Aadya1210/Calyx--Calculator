// State variables
let currentInput = "0";
let isNewCalculation = false;
let angleMode = "DEG"; // DEG or RAD
let currentTheme = localStorage.getItem("calculator_theme") || "dark";
let history = JSON.parse(localStorage.getItem("calculator_history") || "[]");

// DOM Elements
const displayEl = document.getElementById("display");
const livePreviewEl = document.getElementById("livePreview");
const prevExpressionEl = document.getElementById("prevExpression");
const angleModeEl = document.getElementById("angleMode");
const toastEl = document.getElementById("toast");
const appContainer = document.getElementById("app");

// Initialize application on load
document.addEventListener("DOMContentLoaded", () => {
  setTheme(currentTheme);
  renderHistory();
  updateConverterUnits();
  setupKeyboardSupport();
});

// Append pressed value/operator to display
function press(val) {
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

// Clear display
function clearDisplay() {
  currentInput = "0";
  prevExpressionEl.innerText = "";
  livePreviewEl.innerText = "";
  isNewCalculation = false;
  updateDisplay();
}

// Backspace single or group character
function backspace() {
  if (isNewCalculation) {
    clearDisplay();
    return;
  }
  
  // Check for multi-char function tags
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

// Update Screen UI
function updateDisplay() {
  displayEl.value = currentInput;
  updateLivePreview();
}

// Live calculation preview
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

// Safe expression transformer
function prepareExpression(expr) {
  let parsed = expr;

  // Replace mathematical constants
  parsed = parsed.replace(/π/g, "Math.PI");
  parsed = parsed.replace(/e/g, "Math.E");
  parsed = parsed.replace(/\^2/g, "**2");
  parsed = parsed.replace(/\^/g, "**");
  parsed = parsed.replace(/%/g, "/100");

  // Handle Trig Functions according to DEG/RAD mode
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

// Execute calculation safely
function evaluateExpression(expr) {
  // Balance parentheses dynamically for live preview/eval
  let openParen = (expr.match(/\(/g) || []).length;
  let closeParen = (expr.match(/\)/g) || []).length;
  while (openParen > closeParen) {
    expr += ")";
    closeParen++;
  }

  // Safe Function evaluation
  return Function(`'use strict'; return (${expr})`)();
}

// Main Calculate Function
function calculate() {
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

    // Save to history log
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

// Format numbers nicely
function formatNumber(num) {
  if (Number.isInteger(num)) return num;
  return parseFloat(num.toFixed(8));
}

// Toggle DEG / RAD
function toggleAngleMode() {
  angleMode = angleMode === "DEG" ? "RAD" : "DEG";
  angleModeEl.innerText = angleMode;
  showToast("Angle Mode: " + angleMode);
  updateLivePreview();
}

// Mode Switching (Basic, Scientific, Converter, History)
function switchMode(mode) {
  // Hide all screens
  document.getElementById("basicMode").classList.add("hidden");
  document.getElementById("scientificMode").classList.add("hidden");
  document.getElementById("converterMode").classList.add("hidden");
  document.getElementById("historyMode").classList.add("hidden");

  // Remove active class from all tabs
  document.querySelectorAll(".tab-btn").forEach(tab => tab.classList.remove("active"));
  document.getElementById(`tab-${mode}`).classList.add("active");

  const displayArea = document.getElementById("displayArea");

  if (mode === "scientific") {
    document.getElementById("scientificMode").classList.remove("hidden");
    appContainer.classList.add("wide-mode");
    displayArea.classList.remove("hidden");
  } else if (mode === "converter") {
    document.getElementById("converterMode").classList.remove("hidden");
    appContainer.classList.remove("wide-mode");
    displayArea.classList.add("hidden");
    performConversion();
  } else if (mode === "history") {
    document.getElementById("historyMode").classList.remove("hidden");
    appContainer.classList.remove("wide-mode");
    displayArea.classList.add("hidden");
    renderHistory();
  } else {
    document.getElementById("basicMode").classList.remove("hidden");
    appContainer.classList.remove("wide-mode");
    displayArea.classList.remove("hidden");
  }
}

// Theme Management
function toggleTheme() {
  currentTheme = currentTheme === "dark" ? "light" : "dark";
  setTheme(currentTheme);
}

function setTheme(theme) {
  if (theme === "light") {
    document.body.setAttribute("data-theme", "light");
  } else {
    document.body.removeAttribute("data-theme");
  }
  localStorage.setItem("calculator_theme", theme);
}

// Copy to Clipboard
function copyResult() {
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
  }, 2000);
}

// History Management
function addHistoryEntry(expr, res) {
  history.unshift({ expr, res, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
  if (history.length > 30) history.pop();
  localStorage.setItem("calculator_history", JSON.stringify(history));
}

function renderHistory() {
  const historyListEl = document.getElementById("historyList");
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
  history = [];
  localStorage.removeItem("calculator_history");
  renderHistory();
  showToast("History cleared");
}

// Unit Converter Data & Logic
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
  const cat = document.getElementById("convertCategory").value;
  const fromSelect = document.getElementById("convertFrom");
  const toSelect = document.getElementById("convertTo");

  const units = unitData[cat].units;
  const optionsHtml = Object.keys(units).map(key => `<option value="${key}">${units[key].name}</option>`).join("");

  fromSelect.innerHTML = optionsHtml;
  toSelect.innerHTML = optionsHtml;

  // Set default secondary option
  const keys = Object.keys(units);
  if (keys.length > 1) {
    toSelect.selectedIndex = 1;
  }

  performConversion();
}

function performConversion() {
  const cat = document.getElementById("convertCategory").value;
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

  // Convert from origin to Celsius
  let celsius = val;
  if (from === "f") celsius = (val - 32) * (5 / 9);
  if (from === "k") celsius = val - 273.15;

  // Convert Celsius to target
  if (to === "c") return celsius;
  if (to === "f") return celsius * (9 / 5) + 32;
  if (to === "k") return celsius + 273.15;
}

// Physical Keyboard Event Handling
function setupKeyboardSupport() {
  document.addEventListener("keydown", (e) => {
    // Ignore if focus is inside input elements
    if (document.activeElement.tagName === "INPUT" && document.activeElement.type === "number") {
      return;
    }

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