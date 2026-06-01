const app = document.querySelector(".app");
const temperature = document.querySelector("#temperature");
const modeLabel = document.querySelector("#modeLabel");
const year = document.querySelector("#year");
const coldButton = document.querySelector("#coldButton");
const hotButton = document.querySelector("#hotButton");
const powerButton = document.querySelector("#powerButton");
const plusButton = document.querySelector("#plusButton");
const minusButton = document.querySelector("#minusButton");

const state = {
  isOn: false,
  mode: "cold",
  temperature: 20
};

function render() {
  app.classList.toggle("is-on", state.isOn);
  app.classList.toggle("is-hot", state.mode === "hot");
  temperature.textContent = state.temperature;
  modeLabel.textContent = state.mode === "cold" ? "COLD" : "HOT";
  coldButton.classList.toggle("active", state.mode === "cold");
  hotButton.classList.toggle("active", state.mode === "hot");
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

year.textContent = new Date().getFullYear();
render();
