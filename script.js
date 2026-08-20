/* =========================================================
   CALCULATOR LOGIC
   Plain vanilla JS. No eval(), no frameworks — just a small
   state machine that mirrors how a physical calculator works:
   an operand, an operator, and a second operand.
   ========================================================= */

// Grab the bits of the DOM we need to read from / write to.
const resultEl = document.getElementById("result");
const historyEl = document.getElementById("history");
const calculator = document.getElementById("calculator");
const keys = document.querySelectorAll(".key");

// Calculator state lives in one plain object so it's easy to reason about.
const state = {
  currentValue: "0",   // what's currently on screen
  previousValue: null, // the operand captured before an operator was chosen
  operator: null,      // the pending operator, e.g. "+"
  overwrite: true,     // true = next digit press should replace the display
  errored: false        // true when we're showing an error message
};

const MAX_DISPLAY_LENGTH = 12; // keeps big numbers from overflowing the card

/* ---------------------------------------------------------
   RENDERING
   Reflect the current state onto the display.
   --------------------------------------------------------- */
function render() {
  resultEl.textContent = state.currentValue;
  resultEl.classList.toggle("is-error", state.errored);

  // Top line shows "12 +" style history once an operator is chosen
  historyEl.textContent =
    state.previousValue !== null && state.operator
      ? `${formatForHistory(state.previousValue)} ${state.operator}`
      : "";

  // Highlight whichever operator button is currently pending
  document.querySelectorAll(".key--op").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.value === state.operator);
  });
}

function formatForHistory(value) {
  return trimTrailingZeros(value);
}

/* ---------------------------------------------------------
   HELPERS
   --------------------------------------------------------- */

// Removes floating point noise like 0.1 + 0.2 = 0.30000000000000004
function cleanNumber(num) {
  if (!isFinite(num)) return num;
  return Math.round((num + Number.EPSILON) * 1e12) / 1e12;
}

function trimTrailingZeros(str) {
  if (typeof str !== "string") str = String(str);
  return str;
}

// Truncates very long numbers so they don't break the layout,
// switching to scientific notation as a last resort.
function formatForDisplay(numStr) {
  if (numStr === "Error") return numStr;
  if (numStr.replace(/[-.]/g, "").length <= MAX_DISPLAY_LENGTH) return numStr;

  const num = Number(numStr);
  if (!isFinite(num)) return "Error";
  return num.toExponential(6);
}

/* ---------------------------------------------------------
   CORE ACTIONS
   --------------------------------------------------------- */

function inputDigit(digit) {
  if (state.errored) resetAfterError();

  if (state.overwrite) {
    state.currentValue = digit === "." ? "0." : digit;
    state.overwrite = false;
  } else {
    // Avoid duplicate leading zeros ("00") and duplicate decimals
    if (digit === "." && state.currentValue.includes(".")) return;
    if (state.currentValue === "0" && digit !== ".") {
      state.currentValue = digit;
    } else {
      state.currentValue += digit;
    }
  }
  render();
}

function chooseOperator(op) {
  if (state.errored) resetAfterError();

  // Chain calculations: if an operator is already pending and the user
  // hasn't typed a new number yet, just swap the operator.
  if (state.operator && !state.overwrite) {
    state.currentValue = compute();
  }

  state.previousValue = state.currentValue;
  state.operator = op;
  state.overwrite = true;
  render();
}

function compute() {
  const prev = parseFloat(state.previousValue);
  const curr = parseFloat(state.currentValue);

  if (isNaN(prev) || isNaN(curr)) return state.currentValue;

  let result;
  switch (state.operator) {
    case "+":
      result = prev + curr;
      break;
    case "−":
      result = prev - curr;
      break;
    case "×":
      result = prev * curr;
      break;
    case "÷":
      if (curr === 0) {
        triggerError();
        return "Error";
      }
      result = prev / curr;
      break;
    default:
      return state.currentValue;
  }

  return String(cleanNumber(result));
}

function equals() {
  if (state.errored) return;
  if (state.operator === null || state.previousValue === null) return;

  const result = compute();
  if (state.errored) return;

  state.currentValue = formatForDisplay(result);
  state.previousValue = null;
  state.operator = null;
  state.overwrite = true;
  render();
}

function percent() {
  if (state.errored) resetAfterError();

  const curr = parseFloat(state.currentValue);
  if (isNaN(curr)) return;

  // If there's a pending operator, treat % as "percentage of the previous value"
  // (e.g. 200 + 10% -> 10% of 200 = 20). Otherwise just divide by 100.
  let result;
  if (state.operator && state.previousValue !== null) {
    const prev = parseFloat(state.previousValue);
    result = (prev * curr) / 100;
  } else {
    result = curr / 100;
  }

  state.currentValue = String(cleanNumber(result));
  state.overwrite = true;
  render();
}

function clearAll() {
  state.currentValue = "0";
  state.previousValue = null;
  state.operator = null;
  state.overwrite = true;
  state.errored = false;
  render();
}

function deleteLast() {
  if (state.errored) {
    clearAll();
    return;
  }
  if (state.overwrite) return; // nothing typed yet for this operand

  state.currentValue = state.currentValue.slice(0, -1);
  if (state.currentValue === "" || state.currentValue === "-") {
    state.currentValue = "0";
    state.overwrite = true;
  }
  render();
}

function triggerError() {
  state.currentValue = "Error";
  state.previousValue = null;
  state.operator = null;
  state.overwrite = true;
  state.errored = true;
  render();
}

function resetAfterError() {
  state.errored = false;
  state.currentValue = "0";
}

/* ---------------------------------------------------------
   BUTTON PRESS ANIMATION
   A tiny helper to add/remove the .is-pressed class so keyboard
   presses get the exact same "press" feedback as a mouse click.
   --------------------------------------------------------- */
function pulseKey(button) {
  if (!button) return;
  button.classList.add("is-pressed");
  setTimeout(() => button.classList.remove("is-pressed"), 120);
}

/* ---------------------------------------------------------
   EVENT WIRING — mouse / touch
   --------------------------------------------------------- */
keys.forEach((button) => {
  button.addEventListener("click", () => {
    handleKeyPress(button);
  });
});

function handleKeyPress(button) {
  const { action, value } = button.dataset;

  if (action === "clear") clearAll();
  else if (action === "delete") deleteLast();
  else if (action === "percent") percent();
  else if (action === "operator") chooseOperator(value);
  else if (action === "equals") equals();
  else if (value !== undefined) inputDigit(value);
}

/* ---------------------------------------------------------
   EVENT WIRING — keyboard
   Maps physical keys to the same actions the buttons trigger,
   including a matching visual "press" on the right button.
   --------------------------------------------------------- */
const keyMap = {
  "0": '[data-value="0"]',
  "1": '[data-value="1"]',
  "2": '[data-value="2"]',
  "3": '[data-value="3"]',
  "4": '[data-value="4"]',
  "5": '[data-value="5"]',
  "6": '[data-value="6"]',
  "7": '[data-value="7"]',
  "8": '[data-value="8"]',
  "9": '[data-value="9"]',
  ".": '[data-value="."]',
  "+": '[data-value="+"]',
  "-": '[data-value="−"]',
  "*": '[data-value="×"]',
  "/": '[data-value="÷"]',
  "%": '[data-action="percent"]',
  "Enter": '[data-action="equals"]',
  "=": '[data-action="equals"]',
  "Backspace": '[data-action="delete"]',
  "Escape": '[data-action="clear"]',
  "Delete": '[data-action="clear"]'
};

window.addEventListener("keydown", (e) => {
  const selector = keyMap[e.key];
  if (!selector) return;

  e.preventDefault();
  const button = calculator.querySelector(selector);
  pulseKey(button);
  handleKeyPress(button);
});

/* ---------------------------------------------------------
   INIT
   --------------------------------------------------------- */
render();
