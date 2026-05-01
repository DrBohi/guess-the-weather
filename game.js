const TOTAL_ROUNDS = 20;
const STORAGE_KEY = "guess-the-weather-state-v1";

const places = [
  ["Reykjavik", "Iceland", 64.1466, -21.9426],
  ["Marrakesh", "Morocco", 31.6295, -7.9811],
  ["Queenstown", "New Zealand", -45.0312, 168.6626],
  ["Kyoto", "Japan", 35.0116, 135.7681],
  ["Lima", "Peru", -12.0464, -77.0428],
  ["Cape Town", "South Africa", -33.9249, 18.4241],
  ["Tromso", "Norway", 69.6492, 18.9553],
  ["Hanoi", "Vietnam", 21.0278, 105.8342],
  ["Anchorage", "United States", 61.2176, -149.8997],
  ["Buenos Aires", "Argentina", -34.6037, -58.3816],
  ["Cairo", "Egypt", 30.0444, 31.2357],
  ["Dublin", "Ireland", 53.3498, -6.2603],
  ["Nairobi", "Kenya", -1.2921, 36.8219],
  ["Singapore", "Singapore", 1.3521, 103.8198],
  ["Vancouver", "Canada", 49.2827, -123.1207],
  ["Seoul", "South Korea", 37.5665, 126.978],
  ["Lisbon", "Portugal", 38.7223, -9.1393],
  ["Ushuaia", "Argentina", -54.8019, -68.303],
  ["Jaipur", "India", 26.9124, 75.7873],
  ["Hobart", "Australia", -42.8821, 147.3272],
  ["Bogota", "Colombia", 4.711, -74.0721],
  ["Stockholm", "Sweden", 59.3293, 18.0686],
  ["Honolulu", "United States", 21.3099, -157.8581],
  ["Edinburgh", "Scotland", 55.9533, -3.1883],
  ["Doha", "Qatar", 25.2854, 51.531],
  ["Auckland", "New Zealand", -36.8509, 174.7645],
  ["Santiago", "Chile", -33.4489, -70.6693],
  ["Helsinki", "Finland", 60.1699, 24.9384],
  ["Antananarivo", "Madagascar", -18.8792, 47.5079],
  ["Zurich", "Switzerland", 47.3769, 8.5417]
];

const questionTypes = [
  {
    id: "temp",
    label: "Temperature",
    text: "What is the temperature there right now?",
    unit: "°F",
    icon: "°",
    getValue: (w) => Math.round(cToF(w.temperature_2m)),
    ranges: [
      ["Frigid", -10, 24],
      ["Chilly", 25, 49],
      ["Mild", 50, 69],
      ["Warm", 70, 84],
      ["Hot", 85, 109]
    ],
    format: (range) => `${range[0]} · ${range[1]}-${range[2]}°F`
  },
  {
    id: "rain",
    label: "Precipitation",
    text: "How much rain or snow is falling there this hour?",
    unit: "mm",
    icon: "〽",
    getValue: (w) => Number(w.precipitation || 0),
    ranges: [
      ["Dry", 0, 0],
      ["Light sprinkle", 0.1, 1.9],
      ["Steady rain", 2, 5.9],
      ["Heavy burst", 6, 40]
    ],
    format: (range) => range[1] === range[2] ? `${range[0]} · 0 mm` : `${range[0]} · ${range[1]}-${range[2]} mm`
  },
  {
    id: "wind",
    label: "Wind",
    text: "How windy is it there right now?",
    unit: "mph",
    icon: "~",
    getValue: (w) => Math.round(kmhToMph(w.wind_speed_10m)),
    ranges: [
      ["Calm", 0, 5],
      ["Breezy", 6, 14],
      ["Windy", 15, 25],
      ["Blustery", 26, 60]
    ],
    format: (range) => `${range[0]} · ${range[1]}-${range[2]} mph`
  },
  {
    id: "cloud",
    label: "Cloud Cover",
    text: "How cloudy is the sky there?",
    unit: "%",
    icon: "%",
    getValue: (w) => Math.round(w.cloud_cover),
    ranges: [
      ["Clear", 0, 20],
      ["Partly cloudy", 21, 55],
      ["Mostly cloudy", 56, 84],
      ["Overcast", 85, 100]
    ],
    format: (range) => `${range[0]} · ${range[1]}-${range[2]}%`
  }
];

const el = {
  placeCountry: document.querySelector("#placeCountry"),
  placeName: document.querySelector("#placeName"),
  placeChip: document.querySelector(".place-chip"),
  globe: document.querySelector("#globe"),
  scoreText: document.querySelector("#scoreText"),
  roundText: document.querySelector("#roundText"),
  streakText: document.querySelector("#streakText"),
  progressFill: document.querySelector("#progressFill"),
  questionType: document.querySelector("#questionType"),
  sourceState: document.querySelector("#sourceState"),
  questionText: document.querySelector("#questionText"),
  options: document.querySelector("#options"),
  feedback: document.querySelector("#feedback"),
  nextButton: document.querySelector("#nextButton"),
  statsButton: document.querySelector("#statsButton"),
  shareButton: document.querySelector("#shareButton"),
  debugButton: document.querySelector("#debugButton"),
  statsDialog: document.querySelector("#statsDialog"),
  closeStats: document.querySelector("#closeStats"),
  modalToday: document.querySelector("#modalToday"),
  modalBest: document.querySelector("#modalBest"),
  modalPlayed: document.querySelector("#modalPlayed"),
  modalWins: document.querySelector("#modalWins"),
  lockoutText: document.querySelector("#lockoutText")
};

const todayKey = new Intl.DateTimeFormat("en-CA", {
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
}).format(new Date());

let state = loadState();
let currentRound = null;
let awaitingNext = false;

init();

function init() {
  resetIfNewDay();
  updateHud();
  bindEvents();

  if (state.today.finished) {
    showLockedOut();
  } else {
    el.nextButton.disabled = false;
    el.nextButton.textContent = state.today.round === 0 ? "Start" : "Continue";
    el.feedback.textContent = "Twenty places are waiting today. Guess carefully: your streak likes confidence.";
  }
}

function bindEvents() {
  el.nextButton.addEventListener("click", () => {
    if (state.today.finished) {
      openStats();
      return;
    }
    startRound();
  });

  el.statsButton.addEventListener("click", openStats);
  el.closeStats.addEventListener("click", () => el.statsDialog.close());
  el.shareButton.addEventListener("click", shareScore);
  el.debugButton.addEventListener("click", resetDebugDay);
}

async function startRound() {
  if (awaitingNext || state.today.finished) return;

  awaitingNext = true;
  setLoading(true);

  const roundIndex = state.today.round;
  const place = getDailyPlace(roundIndex);
  const question = getDailyQuestion(roundIndex);
  const weather = await getWeather(place, roundIndex);
  const value = question.getValue(weather.data);
  const answer = rangeForValue(question, value);

  currentRound = {
    place,
    question,
    weather,
    value,
    answer,
    options: buildOptions(question, answer, roundIndex)
  };

  renderRound();
  awaitingNext = false;
}

function renderRound() {
  const { place, question, weather, options } = currentRound;
  animatePlaceChange(place);
  el.questionType.textContent = question.label;
  el.sourceState.textContent = weather.live ? "Live weather" : "Offline estimate";
  el.questionText.textContent = question.text;
  el.feedback.textContent = "";
  el.nextButton.disabled = true;
  el.nextButton.textContent = "Next";
  el.options.replaceChildren();

  options.forEach((range, index) => {
    const button = document.createElement("button");
    button.className = "option-button";
    button.type = "button";
    button.innerHTML = `
      <span class="option-icon" aria-hidden="true">${question.icon}</span>
      <span class="option-label">${question.format(range)}</span>
    `;
    button.addEventListener("click", () => answerQuestion(button, range));
    el.options.append(button);
  });
}

function answerQuestion(button, selected) {
  if (!currentRound || el.nextButton.disabled === false) return;

  const isCorrect = selected === currentRound.answer;
  const buttons = Array.from(document.querySelectorAll(".option-button"));
  buttons.forEach((optionButton, index) => {
    optionButton.disabled = true;
    if (currentRound.options[index] === currentRound.answer) optionButton.classList.add("correct");
  });

  if (!isCorrect) button.classList.add("incorrect");

  state.today.round += 1;
  if (isCorrect) {
    state.today.score += 1;
    state.today.streak += 1;
    state.stats.best = Math.max(state.stats.best, state.today.score);
  } else {
    state.today.streak = 0;
  }

  const detail = answerDetail();
  el.feedback.textContent = isCorrect
    ? `Correct. ${detail}`
    : `Not quite. ${currentRound.place[0]} is ${detail}`;

  if (state.today.round >= TOTAL_ROUNDS) {
    state.today.finished = true;
    state.stats.played += 1;
    if (state.today.score >= 14) state.stats.wins += 1;
    el.nextButton.textContent = "Done for today";
  } else {
    el.nextButton.textContent = "Next place";
  }

  saveState();
  updateHud();
  el.nextButton.disabled = false;
}

function answerDetail() {
  const { question, value, answer } = currentRound;
  const valueText = question.id === "rain"
    ? `${Number(value).toFixed(value > 0 && value < 1 ? 1 : 0)} ${question.unit}`
    : `${Math.round(value)}${question.unit}`;
  return `${answer[0].toLowerCase()} right now (${valueText}).`;
}

function showLockedOut() {
  animatePlaceChange(["Daily complete", "Come back tomorrow"]);
  el.questionType.textContent = "Locked";
  el.sourceState.textContent = "20/20 played";
  el.questionText.textContent = "You finished today's Guess The Weather.";
  el.options.replaceChildren();
  el.feedback.textContent = `Final score: ${state.today.score}/${TOTAL_ROUNDS}. A fresh set unlocks at midnight.`;
  el.nextButton.disabled = false;
  el.nextButton.textContent = "View stats";
  updateHud();
}

function spinGlobe() {
  el.globe.classList.remove("place-spin");
  void el.globe.offsetWidth;
  el.globe.classList.add("place-spin");
}

function animatePlaceChange(place) {
  const [name, country] = place;
  el.placeChip.classList.remove("place-reveal");
  el.placeChip.classList.add("is-changing");
  spinGlobe();

  setTimeout(() => {
    el.placeCountry.textContent = country;
    el.placeName.textContent = name;
    el.placeChip.classList.remove("is-changing");
    el.placeChip.classList.add("place-reveal");
  }, 420);
}

function resetDebugDay() {
  state.today = { round: 0, score: 0, streak: 0, finished: false };
  currentRound = null;
  saveState();
  updateHud();
  animatePlaceChange(["Fresh daily run", "Debug reset"]);
  el.questionType.textContent = "Ready";
  el.sourceState.textContent = "Testing mode";
  el.questionText.textContent = "Today is unlocked again.";
  el.options.replaceChildren();
  el.feedback.textContent = "Debug reset complete. Start a new 20-question run whenever you like.";
  el.nextButton.disabled = false;
  el.nextButton.textContent = "Start";
}

function setLoading(isLoading) {
  el.nextButton.disabled = isLoading;
  el.nextButton.textContent = isLoading ? "Loading..." : "Next";
  if (isLoading) {
    el.options.replaceChildren();
    el.feedback.textContent = "Checking the sky...";
  }
}

async function getWeather(place, roundIndex) {
  const [, , lat, lon] = place;
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.search = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    current: "temperature_2m,precipitation,cloud_cover,wind_speed_10m",
    timezone: "auto"
  }).toString();

  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error("Weather request failed");
    const json = await response.json();
    return { live: true, data: json.current };
  } catch {
    return { live: false, data: estimatedWeather(place, roundIndex) };
  }
}

function estimatedWeather(place, roundIndex) {
  const seed = hash(`${todayKey}-${place[0]}-${roundIndex}`);
  const lat = place[2];
  const seasonal = Math.cos(((new Date().getMonth() + 1) / 12) * Math.PI * 2) * (lat > 0 ? -1 : 1);
  const baseC = 23 - Math.abs(lat) * 0.35 + seasonal * 8;
  return {
    temperature_2m: clamp(baseC + seeded(seed, -8, 8), -25, 42),
    precipitation: Math.max(0, seeded(seed + 9, -1.2, 7.5)),
    cloud_cover: clamp(seeded(seed + 17, 8, 98), 0, 100),
    wind_speed_10m: clamp(seeded(seed + 31, 2, 42), 0, 75)
  };
}

function buildOptions(question, answer, roundIndex) {
  const wrong = question.ranges.filter((range) => range !== answer);
  const shuffledWrong = shuffle(wrong, hash(`${todayKey}-wrong-${roundIndex}`)).slice(0, 2);
  return shuffle([answer, ...shuffledWrong], hash(`${todayKey}-options-${roundIndex}`));
}

function rangeForValue(question, value) {
  return question.ranges.find((range) => value >= range[1] && value <= range[2]) || question.ranges.at(-1);
}

function getDailyPlace(roundIndex) {
  return shuffle(places, hash(`${todayKey}-places`))[roundIndex % places.length];
}

function getDailyQuestion(roundIndex) {
  const index = hash(`${todayKey}-question-${roundIndex}`) % questionTypes.length;
  return questionTypes[index];
}

function updateHud() {
  el.scoreText.textContent = state.today.score;
  el.roundText.textContent = Math.min(state.today.round + 1, TOTAL_ROUNDS);
  el.streakText.textContent = state.today.streak;
  el.progressFill.style.width = `${(state.today.round / TOTAL_ROUNDS) * 100}%`;
}

function openStats() {
  el.modalToday.textContent = `${state.today.score}/${TOTAL_ROUNDS}`;
  el.modalBest.textContent = state.stats.best;
  el.modalPlayed.textContent = state.stats.played;
  el.modalWins.textContent = state.stats.wins;
  el.lockoutText.textContent = state.today.finished
    ? "You are locked out until the next local midnight, just like a daily puzzle should be."
    : `${TOTAL_ROUNDS - state.today.round} guesses remain today.`;
  el.statsDialog.showModal();
}

async function shareScore() {
  const text = `Guess The Weather ${todayKey}: ${state.today.score}/${TOTAL_ROUNDS}`;
  try {
    if (navigator.share) {
      await navigator.share({ text });
    } else {
      await navigator.clipboard.writeText(text);
      el.feedback.textContent = "Score copied.";
    }
  } catch {
    el.feedback.textContent = text;
  }
}

function loadState() {
  const fallback = freshState();
  try {
    return { ...fallback, ...JSON.parse(localStorage.getItem(STORAGE_KEY)) };
  } catch {
    return fallback;
  }
}

function freshState() {
  return {
    day: todayKey,
    today: { round: 0, score: 0, streak: 0, finished: false },
    stats: { best: 0, played: 0, wins: 0 }
  };
}

function resetIfNewDay() {
  if (state.day === todayKey) return;
  const stats = state.stats || { best: 0, played: 0, wins: 0 };
  state = freshState();
  state.stats = stats;
  saveState();
}

function saveState() {
  state.day = todayKey;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function shuffle(items, seed) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = hash(`${seed}-${i}`) % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function hash(value) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h >>> 0);
}

function seeded(seed, min, max) {
  const x = Math.sin(seed) * 10000;
  return min + (x - Math.floor(x)) * (max - min);
}

function cToF(celsius) {
  return celsius * 9 / 5 + 32;
}

function kmhToMph(kmh) {
  return kmh * 0.621371;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
