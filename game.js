const TOTAL_ROUNDS = 20;
const STORAGE_KEY = "guess-the-weather-state-v2";
const TEMP_MIN = -20;
const TEMP_MAX = 120;
const RESULT_MAX_SCORE = 220;

const places = [
  ["Reykjavik", "Iceland", 64.1466, -21.9426, "Reykjavík"],
  ["Marrakesh", "Morocco", 31.6295, -7.9811, "Marrakesh"],
  ["Queenstown", "New Zealand", -45.0312, 168.6626, "Queenstown,_New_Zealand"],
  ["Kyoto", "Japan", 35.0116, 135.7681, "Kyoto"],
  ["Lima", "Peru", -12.0464, -77.0428, "Lima"],
  ["Cape Town", "South Africa", -33.9249, 18.4241, "Cape_Town"],
  ["Tromso", "Norway", 69.6492, 18.9553, "Tromsø"],
  ["Hanoi", "Vietnam", 21.0278, 105.8342, "Hanoi"],
  ["Anchorage", "United States", 61.2176, -149.8997, "Anchorage,_Alaska"],
  ["Buenos Aires", "Argentina", -34.6037, -58.3816, "Buenos_Aires"],
  ["Cairo", "Egypt", 30.0444, 31.2357, "Cairo"],
  ["Dublin", "Ireland", 53.3498, -6.2603, "Dublin"],
  ["Nairobi", "Kenya", -1.2921, 36.8219, "Nairobi"],
  ["Singapore", "Singapore", 1.3521, 103.8198, "Singapore"],
  ["Vancouver", "Canada", 49.2827, -123.1207, "Vancouver"],
  ["Seoul", "South Korea", 37.5665, 126.978, "Seoul"],
  ["Lisbon", "Portugal", 38.7223, -9.1393, "Lisbon"],
  ["Ushuaia", "Argentina", -54.8019, -68.303, "Ushuaia"],
  ["Jaipur", "India", 26.9124, 75.7873, "Jaipur"],
  ["Hobart", "Australia", -42.8821, 147.3272, "Hobart,_Tasmania"],
  ["Bogota", "Colombia", 4.711, -74.0721, "Bogotá"],
  ["Stockholm", "Sweden", 59.3293, 18.0686, "Stockholm"],
  ["Honolulu", "United States", 21.3099, -157.8581, "Honolulu"],
  ["Edinburgh", "Scotland", 55.9533, -3.1883, "Edinburgh"],
  ["Doha", "Qatar", 25.2854, 51.531, "Doha"],
  ["Auckland", "New Zealand", -36.8509, 174.7645, "Auckland"],
  ["Santiago", "Chile", -33.4489, -70.6693, "Santiago"],
  ["Helsinki", "Finland", 60.1699, 24.9384, "Helsinki"],
  ["Antananarivo", "Madagascar", -18.8792, 47.5079, "Antananarivo"],
  ["Zurich", "Switzerland", 47.3769, 8.5417, "Zürich"]
];

const el = {
  introScreen: document.querySelector("#introScreen"),
  beginButton: document.querySelector("#beginButton"),
  logoButton: document.querySelector("#logoButton"),
  placeCountry: document.querySelector("#placeCountry"),
  placeName: document.querySelector("#placeName"),
  placeChip: document.querySelector(".place-chip"),
  globe: document.querySelector("#globe"),
  scoreText: document.querySelector("#scoreText"),
  roundText: document.querySelector("#roundText"),
  streakText: document.querySelector("#streakText"),
  progressFill: document.querySelector("#progressFill"),
  questionCard: document.querySelector(".question-card"),
  questionContent: document.querySelector("#questionContent"),
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
let introStarted = false;
let resultsShowing = false;
let displayedScore = Number.parseInt(document.querySelector("#scoreText")?.textContent || "0", 10);
let logoTapCount = 0;
let logoTapTimer = null;

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
  el.beginButton.addEventListener("click", beginGame);
  el.logoButton.addEventListener("click", handleLogoTap);

  el.nextButton.addEventListener("click", () => {
    if (state.today.finished) {
      if (resultsShowing) {
        shareScore();
        return;
      }
      showResults();
      return;
    }

    if (currentRound && !currentRound.answered) {
      submitTemperatureGuess();
      return;
    }

    startRound();
  });

  el.statsButton.addEventListener("click", openStats);
  el.closeStats.addEventListener("click", () => el.statsDialog.close());
  el.shareButton.addEventListener("click", shareScore);
  el.debugButton.addEventListener("click", resetDebugDay);
}

function handleLogoTap() {
  logoTapCount += 1;
  clearTimeout(logoTapTimer);

  if (logoTapCount >= 3) {
    el.debugButton.hidden = false;
    logoTapCount = 0;
    return;
  }

  logoTapTimer = setTimeout(() => {
    logoTapCount = 0;
  }, 1200);
}

function beginGame() {
  if (introStarted) return;
  introStarted = true;
  el.beginButton.disabled = true;
  el.introScreen.classList.add("is-exiting");
  document.body.classList.remove("intro-active");

  setTimeout(() => {
    el.introScreen.hidden = true;
  }, 680);

  if (!state.today.finished) {
    setTimeout(startRound, 240);
  }
}

async function startRound() {
  if (awaitingNext || state.today.finished) return;

  awaitingNext = true;
  resultsShowing = false;
  setLoading(true);

  try {
    const roundIndex = state.today.round;
    const place = getDailyPlace(roundIndex);
    const weather = await getWeather(place, roundIndex);
    const value = Math.round(cToF(weather.data.temperature_2m));

    currentRound = {
      place,
      weather,
      value,
      guess: 65,
      answered: false
    };

    renderRound();
  } catch {
    el.feedback.textContent = "The sky got shy for a second. Try again.";
    el.nextButton.disabled = false;
    el.nextButton.textContent = "Try again";
  } finally {
    awaitingNext = false;
  }
}

function renderRound() {
  const { place } = currentRound;
  animatePlaceChange(place);
  el.questionContent.classList.add("is-entering");
  el.questionText.textContent = `What is the temperature in ${place[0]} right now?`;
  el.feedback.textContent = "";
  el.nextButton.disabled = false;
  el.nextButton.textContent = "Submit guess";
  el.options.replaceChildren();

  el.options.append(createTemperatureSlider());

  requestAnimationFrame(() => {
    holdQuestionCardHeight();
    el.questionContent.classList.remove("is-loading", "is-entering");
  });
}

function createTemperatureSlider() {
  const wrap = document.createElement("div");
  wrap.className = "temperature-game";
  wrap.innerHTML = `
    <div class="temperature-readout">
      <span class="temperature-value" id="temperatureGuess">65°F</span>
    </div>
    <div class="temperature-slider-wrap">
      <div class="temperature-track-wrap">
        <span class="guess-marker" id="guessMarker" aria-hidden="true"></span>
        <input class="temperature-slider" id="temperatureSlider" type="range" min="${TEMP_MIN}" max="${TEMP_MAX}" value="65" step="1" aria-label="Temperature guess in Fahrenheit" />
      </div>
      <div class="temperature-scale" aria-hidden="true">
        <span>${TEMP_MIN}°F</span>
        <span>50°F</span>
        <span>${TEMP_MAX}°F</span>
      </div>
    </div>
  `;

  const slider = wrap.querySelector("#temperatureSlider");
  const readout = wrap.querySelector("#temperatureGuess");
  slider.addEventListener("input", () => {
    currentRound.guess = Number(slider.value);
    readout.textContent = `${currentRound.guess}°F`;
  });

  return wrap;
}

function submitTemperatureGuess() {
  if (!currentRound || currentRound.answered) return;

  currentRound.answered = true;
  const slider = el.options.querySelector("#temperatureSlider");
  const readout = el.options.querySelector("#temperatureGuess");
  const sliderWrap = el.options.querySelector(".temperature-slider-wrap");
  const marker = el.options.querySelector("#guessMarker");
  const miss = Math.abs(currentRound.guess - currentRound.value);
  const previousScore = state.today.score;
  state.today.round += 1;
  state.today.score += miss;

  if (miss <= 3) {
    state.today.streak += 1;
  } else {
    state.today.streak = 0;
  }

  if (slider && marker && sliderWrap && readout) {
    marker.style.left = `${temperaturePercent(currentRound.guess)}%`;
    sliderWrap.classList.add("is-revealed");
    animateSliderToValue(slider, readout, currentRound.guess, currentRound.value);
  }

  const praise = miss === 0
    ? "Perfect."
    : miss <= 3
      ? "Very close."
      : miss <= 8
        ? "Nice read."
        : "That one drifted.";
  el.feedback.textContent = `${praise} You guessed ${currentRound.guess}°F. ${currentRound.place[0]} is ${currentRound.value}°F, so that adds ${miss} point${miss === 1 ? "" : "s"}. Lower is better.`;

  if (state.today.round >= TOTAL_ROUNDS) {
    state.today.finished = true;
    state.stats.played += 1;
    if (state.stats.best == null || state.today.score < state.stats.best) state.stats.best = state.today.score;
    el.nextButton.textContent = "See results";
  } else {
    el.nextButton.textContent = "Next place";
  }

  saveState();
  updateHud(previousScore);
  el.nextButton.disabled = false;
}

function answerDetail() {
  return `${Math.round(currentRound.value)}°F right now.`;
}

function showLockedOut() {
  resultsShowing = false;
  el.placeChip.classList.add("is-changing");
  setTimeout(() => {
    el.placeCountry.textContent = "Come back tomorrow";
    el.placeName.textContent = "Daily complete";
    el.placeChip.classList.remove("is-changing");
  }, 420);
  el.questionText.textContent = "You finished today's Guess The Weather.";
  el.options.replaceChildren();
  el.feedback.textContent = `Final score: ${state.today.score} points. Lower is better.`;
  el.nextButton.disabled = false;
  el.nextButton.textContent = "See results";
  updateHud();
}

function showResults() {
  resultsShowing = true;
  const score = state.today.score;
  const rating = resultRating(score);
  const marker = clamp((score / RESULT_MAX_SCORE) * 100, 4, 96);

  releaseQuestionCardHeight();
  el.questionContent.classList.add("is-entering");
  el.questionText.textContent = "Today's results";
  el.options.replaceChildren();
  el.options.innerHTML = `
    <section class="results-card" aria-label="Daily score results">
      <div class="results-score">
        <span>Your score</span>
        <strong>${score}</strong>
        <em>${rating.label}</em>
      </div>
      <p class="curve-rating" id="exploreRatingPreview">${rating.label}</p>
      <div class="bell-curve" style="--score-position: ${marker}%">
        <svg viewBox="0 0 320 130" role="img" aria-label="Score distribution bell curve">
          <defs>
            <linearGradient id="curveStroke" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stop-color="#35c7b7" />
              <stop offset="48%" stop-color="#ffcb66" />
              <stop offset="100%" stop-color="#e34e6f" />
            </linearGradient>
          </defs>
          <path class="bell-fill" d="M18 112 C52 112 62 95 82 66 C104 34 128 18 160 18 C192 18 216 34 238 66 C258 95 268 112 302 112 Z" />
          <path class="bell-line" d="M18 112 C52 112 62 95 82 66 C104 34 128 18 160 18 C192 18 216 34 238 66 C258 95 268 112 302 112" />
        </svg>
        <span class="score-marker">
          <span class="score-pin"></span>
          <span class="score-bubble" id="resultBubble">${score}</span>
        </span>
      </div>
      <div class="curve-labels" aria-hidden="true">
        <span>Elite</span>
        <span>Most players</span>
        <span>Spicy</span>
      </div>
      <input class="curve-slider" id="curveSlider" type="range" min="0" max="${RESULT_MAX_SCORE}" value="${score}" step="1" aria-label="Explore score distribution" />
      <p id="resultCopyPreview">${rating.copy}</p>
    </section>
  `;
  el.feedback.textContent = "Lower scores land farther left. A fresh set unlocks at midnight.";
  el.nextButton.disabled = false;
  el.nextButton.textContent = "Share score";
  bindResultExplorer();
  requestAnimationFrame(() => {
    el.questionContent.classList.remove("is-entering");
  });
}

function bindResultExplorer() {
  const slider = el.options.querySelector("#curveSlider");
  if (!slider) return;
  slider.addEventListener("input", () => updateResultPreview(Number(slider.value)));
}

function updateResultPreview(score) {
  const rating = resultRating(score);
  const marker = clamp((score / RESULT_MAX_SCORE) * 100, 4, 96);
  const curve = el.options.querySelector(".bell-curve");
  const ratingText = el.options.querySelector("#exploreRatingPreview");
  const bubble = el.options.querySelector("#resultBubble");
  const copy = el.options.querySelector("#resultCopyPreview");

  if (curve) curve.style.setProperty("--score-position", `${marker}%`);
  if (ratingText) ratingText.textContent = rating.label;
  if (bubble) bubble.textContent = score;
  if (copy) copy.textContent = rating.copy;
}

function resultRating(score) {
  if (score <= 45) {
    return {
      label: "Forecast savant",
      copy: "That is an absurdly sharp day: barely more than two degrees off per city."
    };
  }
  if (score <= 75) {
    return {
      label: "Excellent read",
      copy: "You were consistently close across twenty places. That is a genuinely strong run."
    };
  }
  if (score <= 115) {
    return {
      label: "Solid instincts",
      copy: "A comfortable score: a few surprises, but your temperature sense held together."
    };
  }
  if (score <= 160) {
    return {
      label: "Weather curious",
      copy: "Some climates threw you off today. Tomorrow is a clean slate."
    };
  }
  return {
    label: "Bold guesses",
    copy: "You played with confidence. The atmosphere did not always agree."
  };
}

async function fetchCityImage(wikiSlug) {
  if (!wikiSlug) return null;
  try {
    const res = await Promise.race([
      fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiSlug)}`),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 4000))
    ]);
    if (!res.ok) return null;
    const data = await res.json();
    return data.originalimage?.source || data.thumbnail?.source || null;
  } catch {
    return null;
  }
}

function setCityPhoto(src, altText) {
  const img = el.globe.querySelector(".earth-image");
  if (!src) {
    img.classList.remove("photo-fade-out");
    return;
  }
  const next = new Image();
  next.onload = () => {
    img.classList.add("photo-fade-out");
    setTimeout(() => {
      img.src = src;
      img.alt = altText;
      img.classList.remove("photo-fade-out");
      img.classList.add("photo-fade-in");
      setTimeout(() => img.classList.remove("photo-fade-in"), 500);
    }, 220);
  };
  next.onerror = () => img.classList.remove("photo-fade-out");
  next.src = src;
}

function animatePlaceChange(place) {
  const [name, country, , , wikiSlug] = place;
  el.placeChip.classList.add("is-changing");

  // Fade out the current photo
  const img = el.globe.querySelector(".earth-image");
  img.classList.add("photo-fade-out");

  // Fetch city photo in parallel — don't block place chip update
  if (wikiSlug) {
    fetchCityImage(wikiSlug).then(src => setCityPhoto(src, name));
  }

  setTimeout(() => {
    el.placeCountry.textContent = country;
    el.placeName.textContent = name;
    el.placeChip.classList.remove("is-changing");
  }, 420);
}

function resetDebugDay() {
  state.today = { round: 0, score: 0, streak: 0, finished: false };
  currentRound = null;
  resultsShowing = false;
  saveState();
  updateHud();
  el.placeChip.classList.add("is-changing");
  setTimeout(() => {
    el.placeCountry.textContent = "Debug reset";
    el.placeName.textContent = "Fresh daily run";
    el.placeChip.classList.remove("is-changing");
  }, 420);
  releaseQuestionCardHeight();
  el.questionContent.classList.remove("is-loading", "is-entering");
  el.questionText.textContent = "Today is unlocked again.";
  el.options.replaceChildren();
  el.feedback.textContent = "Debug reset complete. Start a new 20-question run whenever you like.";
  el.nextButton.disabled = false;
  el.nextButton.textContent = "Start";
}

function setLoading(isLoading) {
  el.nextButton.disabled = isLoading;
  if (isLoading) {
    holdQuestionCardHeight();
    el.questionContent.classList.add("is-loading");
    el.questionText.textContent = "";
    el.options.replaceChildren();
    el.feedback.textContent = "";
  }
}

function holdQuestionCardHeight() {
  const height = Math.ceil(el.questionCard.getBoundingClientRect().height);
  el.questionCard.style.minHeight = `${height}px`;
}

function releaseQuestionCardHeight() {
  el.questionCard.style.minHeight = "";
}

async function getWeather(place, roundIndex) {
  const [, , lat, lon] = place;
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.search = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    current: "temperature_2m",
    timezone: "auto"
  }).toString();

  try {
    const response = await fetchWithTimeout(url, 3200);
    if (!response.ok) throw new Error("Weather request failed");
    const json = await response.json();
    return { live: true, data: json.current };
  } catch {
    return { live: false, data: estimatedWeather(place, roundIndex) };
  }
}

function fetchWithTimeout(url, timeoutMs) {
  return Promise.race([
    fetch(url, { cache: "no-store" }),
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Weather request timed out")), timeoutMs);
    })
  ]);
}

function estimatedWeather(place, roundIndex) {
  const seed = hash(`${todayKey}-${place[0]}-${roundIndex}`);
  const lat = place[2];
  const seasonal = Math.cos(((new Date().getMonth() + 1) / 12) * Math.PI * 2) * (lat > 0 ? -1 : 1);
  const baseC = 23 - Math.abs(lat) * 0.35 + seasonal * 8;
  return {
    temperature_2m: clamp(baseC + seeded(seed, -8, 8), -25, 42)
  };
}

function getDailyPlace(roundIndex) {
  return shuffle(places, hash(`${todayKey}-places`))[roundIndex % places.length];
}

function updateHud(previousScore = displayedScore) {
  animateScore(previousScore, state.today.score);
  el.roundText.textContent = Math.min(state.today.round + 1, TOTAL_ROUNDS);
  el.streakText.textContent = state.today.streak;
  el.progressFill.style.width = `${(state.today.round / TOTAL_ROUNDS) * 100}%`;
}

function animateScore(from, to) {
  const start = Number.isFinite(from) ? from : displayedScore;
  const end = Number.isFinite(to) ? to : state.today.score;
  displayedScore = end;

  if (start === end) {
    el.scoreText.textContent = end;
    return;
  }

  const duration = 520;
  const started = performance.now();
  const tick = (now) => {
    const progress = clamp((now - started) / duration, 0, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.scoreText.textContent = Math.round(start + (end - start) * eased);
    if (progress < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function animateSliderToValue(slider, readout, from, to) {
  slider.disabled = true;
  const duration = 620;
  const started = performance.now();
  const tick = (now) => {
    const progress = clamp((now - started) / duration, 0, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = Math.round(from + (to - from) * eased);
    slider.value = value;
    readout.textContent = `${value}°F`;
    if (progress < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function temperaturePercent(value) {
  return clamp(((value - TEMP_MIN) / (TEMP_MAX - TEMP_MIN)) * 100, 0, 100);
}

function openStats() {
  el.modalToday.textContent = `${state.today.score} pts`;
  el.modalBest.textContent = state.stats.best == null ? "—" : `${state.stats.best} pts`;
  el.modalPlayed.textContent = state.stats.played;
  el.lockoutText.textContent = state.today.finished
    ? "You are locked out until the next local midnight, just like a daily puzzle should be."
    : `${TOTAL_ROUNDS - state.today.round} guesses remain today.`;
  el.statsDialog.showModal();
}

async function shareScore() {
  const text = `Guess The Weather ${todayKey}: ${state.today.score} points. Lower is better.`;
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
    stats: { best: null, played: 0 }
  };
}

function resetIfNewDay() {
  if (state.day === todayKey) return;
  const stats = state.stats || { best: null, played: 0 };
  state = freshState();
  state.stats = { best: stats.best ?? null, played: stats.played ?? 0 };
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

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
