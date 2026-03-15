/* ═══════════════════════════════════════════════════
   INDONESIA FLOOD EXPLORER — App v2
   Sidebar layout · Timeline slider · Chart.js theming
   ═══════════════════════════════════════════════════ */

const state = {
  language: "id",
  manifest: null,
  coverageReport: null,
  methodology: null,
  searchIndex: [],
  adminByCode: new Map(),
  currentLevel: "province",
  currentMetric: "unique_event_count",
  currentDateFrom: "",
  currentDateTo: "",
  currentBasemapMode: "map",
  imageryFallbackState: null,
  selectedCode: null,
  selectedFeature: null,
  boundaryCache: new Map(),
  metricCache: new Map(),
  summaryCache: new Map(),
  monthCache: new Map(),
  trendCache: new Map(),
  translations: new Map(),
  map: null,
  popup: null,
  mapStyleReady: false,
  mapInteractionsBound: false,
  currentGeojsonData: null,
  currentLookup: new Map(),
  currentLookupMode: "summary_all_time",
  currentRenderedCount: 0,
  currentUnitsWithData: 0,
  trendChart: null,
  pendingFit: "level",
  handlers: {},
  sidebarCollapsed: false,
  sidebarTouched: false,
  allMonths: [],
  renderVersion: 0,
};

/* ─── Choropleth colour ramp (YlOrRd inspired, warm palette) ─── */
const COLOR_STEPS = ["#fef9c3", "#fde68a", "#f59e0b", "#b45309", "#78350f", "#451a03"];
const APP_ASSET_VERSION = "20260316d";

/* ─── DOM refs ─── */
const levelSelect = document.querySelector("#level-select");
const metricSelect = document.querySelector("#metric-select");
const metricHelp = document.querySelector("#metric-help");
const dateFromInput = document.querySelector("#date-from");
const dateToInput = document.querySelector("#date-to");
const searchInput = document.querySelector("#search-input");
const searchResults = document.querySelector("#search-results");
const basemapToggle = document.querySelector("#basemap-toggle");
const resetButton = document.querySelector("#reset-button");
const sidebarToggle = document.querySelector("#sidebar-toggle");
const coverageBanner = document.querySelector("#coverage-banner");
const coverageChip = document.querySelector("#coverage-chip");
const coverageWarning = document.querySelector("#coverage-warning");
const groundsourceStatus = document.querySelector("#groundsource-status");
const methodologyList = document.querySelector("#methodology-list");
const methodologyStatus = document.querySelector("#methodology-status");
const selectionEmpty = document.querySelector("#selection-empty");
const selectionDetails = document.querySelector("#selection-details");
const selectionName = document.querySelector("#selection-name");
const selectionCode = document.querySelector("#selection-code");
const selectionParent = document.querySelector("#selection-parent");
const selectionBoundarySource = document.querySelector("#selection-boundary-source");
const selectionMetricValue = document.querySelector("#selection-metric-value");
const selectionCoverage = document.querySelector("#selection-coverage");
const selectionPeriod = document.querySelector("#selection-period");
const selectionLevelBadge = document.querySelector("#selection-level-badge");
const trendEmpty = document.querySelector("#trend-empty");
const trendPeriod = document.querySelector("#trend-period");
const mapLegend = document.querySelector("#map-legend");
const mapTitle = document.querySelector("#map-title");
const mapNote = document.querySelector("#map-note");
const heroGroundsourceStatus = document.querySelector("#hero-groundsource-status");
const heroDefaultLevel = document.querySelector("#hero-default-level");
const heroDefaultMetric = document.querySelector("#hero-default-metric");
const heroTotalEvents = document.querySelector("#hero-total-events");
const statsLevelPill = document.querySelector("#stats-level-pill");
const statTotalEvents = document.querySelector("#stat-total-events");
const statUnitsWithData = document.querySelector("#stat-units-with-data");
const statRenderedUnits = document.querySelector("#stat-rendered-units");
const statDateWindow = document.querySelector("#stat-date-window");
const timelineFromLabel = document.querySelector("#timeline-from-label");
const timelineToLabel = document.querySelector("#timeline-to-label");
const timelineFill = document.querySelector("#timeline-fill");
const mobileViewport = window.matchMedia("(max-width: 768px)");
const statAnimationFrames = new WeakMap();
const customSelectControls = new Map();
const BOUNDARY_PAINT_PROFILES = {
  map: {
    fillOpacity: 0.72,
    selectedFillOpacity: 0.85,
    lineColor: "rgba(60, 50, 30, 0.22)",
    lineWidth: 0.8,
  },
  imagery: {
    fillOpacity: 0.20,
    selectedFillOpacity: 0.35,
    lineColor: "rgba(60, 50, 30, 0.10)",
    lineWidth: 0.75,
  },
  hybrid: {
    fillOpacity: 0.20,
    selectedFillOpacity: 0.35,
    lineColor: "rgba(60, 50, 30, 0.10)",
    lineWidth: 0.75,
  },
};
const SIDEBAR_TRANSITION_MS = 170;
let sidebarResizeTimer = null;

/* ─── Utilities ─── */
async function loadJson(path) {
  const versionedPath = (() => {
    try {
      const url = new URL(path, window.location.href);
      if (url.origin === window.location.origin) {
        url.searchParams.set("v", APP_ASSET_VERSION);
      }
      return url.toString();
    } catch {
      return path;
    }
  })();
  if (path.includes("undefined")) {
    console.error("CRITICAL ERROR: fetching undefined path:", path);
    // Print stack trace
    console.trace();
  }
  const response = await fetch(versionedPath);
  if (!response.ok) throw new Error(`Failed to load ${path}`);
  return response.json();
}

function t(key) {
  return state.translations.get(state.language)?.[key] || key;
}

/* ─── Boot ─── */
async function boot() {
  await loadTranslations();
  await loadManifest();
  initControls();
  initSidebar();
  initTimeline();
  initPlayButton();
  applyTranslations();
  initMap();
}

async function loadTranslations() {
  const [id, en] = await Promise.all([
    loadJson("./translations/id.json"),
    loadJson("./translations/en.json"),
  ]);
  state.translations.set("id", id);
  state.translations.set("en", en);
}

async function loadManifest() {
  state.manifest = await loadJson("./data/latest/build_manifest.json");
  state.coverageReport = await loadJson(`./data/latest/${state.manifest.coverage_report}`);
  state.methodology = await loadJson(`./data/latest/${state.manifest.methodology}`);
  state.searchIndex = await loadJson(`./data/latest/${state.manifest.search_index}`);
  const publishedLevels = (state.manifest.available_levels || Object.keys(state.manifest.metric_assets || {})).filter(
    (level) => state.manifest.metric_assets?.[level]
  );
  if (publishedLevels.length) {
    state.manifest.available_levels = publishedLevels;
  }
  if (!state.manifest.available_levels?.includes(state.manifest.default_level)) {
    state.manifest.default_level = state.manifest.available_levels?.[0] || "province";
  }
  state.currentLevel = state.manifest.default_level || "province";
  state.currentMetric = state.manifest.default_metric;
  state.currentBasemapMode = state.manifest.default_basemap_mode || "map";
  state.adminByCode = new Map(state.searchIndex.map((row) => [row.code, row]));
}

// Timeline Play logic
let timelinePlayInterval = null;

function initPlayButton() {
  const playBtn = document.getElementById("timeline-play");
  if (!playBtn) return;
  if (playBtn.dataset.bound === "true") return;

  playBtn.dataset.bound = "true";
  playBtn.addEventListener("click", () => {
    if (timelinePlayInterval) {
      pauseTimeline();
    } else {
      playTimeline();
    }
  });
}

function playTimeline() {
  const playBtn = document.getElementById("timeline-play");
  if (!state.allMonths.length) {
    syncDateRangeDefaults();
    syncTimelineSliders();
  }

  const dates = state.allMonths;
  if (!dates || dates.length <= 1) return;

  if (playBtn) {
    playBtn.classList.add("is-playing");
    playBtn.setAttribute("aria-label", "Pause timeline");
    playBtn.innerHTML = '<svg viewBox="0 0 16 16"><rect x="4" y="3" width="3" height="10"/><rect x="9" y="3" width="3" height="10"/></svg>';
  }

  timelinePlayInterval = setInterval(() => {
    if (!state.allMonths.length) {
      syncDateRangeDefaults();
      syncTimelineSliders();
    }
    const availableDates = state.allMonths;
    if (!availableDates || availableDates.length <= 1) {
      pauseTimeline();
      return;
    }

    // Auto-advance the "to" slider, keeping "from" fixed.
    let fromIdx = parseInt(dateFromInput.value, 10);
    let toIdx = parseInt(dateToInput.value, 10);

    if (toIdx >= availableDates.length - 1) {
      toIdx = fromIdx;
    } else {
      toIdx++;
    }

    dateToInput.value = toIdx;
    state.currentDateTo = availableDates[toIdx];
    if (timelineToLabel) timelineToLabel.textContent = formatMonthLabel(availableDates[toIdx]);

    updateTimelineFill();
    void renderExplorer();
  }, 800);
}

function pauseTimeline() {
  if (timelinePlayInterval) {
    clearInterval(timelinePlayInterval);
    timelinePlayInterval = null;
  }
  
  const playBtn = document.getElementById("timeline-play");
  if (playBtn) {
    playBtn.classList.remove("is-playing");
    playBtn.setAttribute("aria-label", "Play timeline");
    playBtn.innerHTML = '<svg viewBox="0 0 16 16"><polygon points="4,2 14,8 4,14"/></svg>';
  }
}

/* ─── Sidebar ─── */
function initSidebar() {
  // Create expand button dynamically
  const expandBtn = document.createElement("button");
  expandBtn.className = "sidebar-expand";
  expandBtn.type = "button";
  expandBtn.setAttribute("aria-label", "Expand sidebar");
  expandBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M7 3l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  document.body.appendChild(expandBtn);

  sidebarToggle.addEventListener("click", () => toggleSidebar());
  expandBtn.addEventListener("click", () => toggleSidebar());
  applyResponsiveSidebarMode({ force: true });
  window.addEventListener("resize", handleResponsiveSidebarResize, { passive: true });
}

function toggleSidebar() {
  state.sidebarTouched = true;
  setSidebarCollapsed(!state.sidebarCollapsed);
}

function setSidebarCollapsed(nextCollapsed) {
  if (state.sidebarCollapsed === nextCollapsed) return;

  state.sidebarCollapsed = nextCollapsed;
  document.body.classList.toggle("sidebar-collapsed", nextCollapsed);
  sidebarToggle?.setAttribute("aria-expanded", String(!nextCollapsed));

  if (!state.map) return;

  if (sidebarResizeTimer) {
    clearTimeout(sidebarResizeTimer);
  }

  requestAnimationFrame(() => {
    state.map?.resize();
  });

  sidebarResizeTimer = window.setTimeout(() => {
    state.map?.resize();
    sidebarResizeTimer = null;
  }, SIDEBAR_TRANSITION_MS + 30);
}

function applyResponsiveSidebarMode({ force = false } = {}) {
  if (!mobileViewport.matches) {
    if (force || !state.sidebarTouched) setSidebarCollapsed(false);
    return;
  }
  if (force || !state.sidebarTouched) setSidebarCollapsed(true);
}

function handleResponsiveSidebarResize() {
  const shouldCollapse = mobileViewport.matches;
  if (!state.sidebarTouched) {
    setSidebarCollapsed(shouldCollapse);
    return;
  }
  if (!shouldCollapse && state.sidebarCollapsed) {
    setSidebarCollapsed(false);
  }
}

/* ─── Timeline ─── */
function initTimeline() {
  dateFromInput.addEventListener("input", () => {
    const monthIndex = parseInt(dateFromInput.value, 10);
    if (isNaN(monthIndex) || !state.allMonths.length) return;
    const month = state.allMonths[monthIndex];
    if (month) {
      state.currentDateFrom = month;
      if (timelineFromLabel) timelineFromLabel.textContent = formatMonthLabel(month);
      // Ensure from <= to
      if (parseInt(dateToInput.value, 10) < monthIndex) {
        dateToInput.value = monthIndex;
        state.currentDateTo = month;
        if (timelineToLabel) timelineToLabel.textContent = formatMonthLabel(month);
      }
      updateTimelineFill();
    }
  });

  dateFromInput.addEventListener("change", async () => {
    await renderExplorer();
  });

  dateToInput.addEventListener("input", () => {
    const monthIndex = parseInt(dateToInput.value, 10);
    if (isNaN(monthIndex) || !state.allMonths.length) return;
    const month = state.allMonths[monthIndex];
    if (month) {
      state.currentDateTo = month;
      if (timelineToLabel) timelineToLabel.textContent = formatMonthLabel(month);
      // Ensure to >= from
      if (parseInt(dateFromInput.value, 10) > monthIndex) {
        dateFromInput.value = monthIndex;
        state.currentDateFrom = month;
        if (timelineFromLabel) timelineFromLabel.textContent = formatMonthLabel(month);
      }
      updateTimelineFill();
    }
  });

  dateToInput.addEventListener("change", async () => {
    await renderExplorer();
  });
}

function formatMonthLabel(month) {
  if (!month) return "—";
  const parts = month.split("-");
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${monthNames[parseInt(parts[1], 10) - 1]} ${parts[0]}`;
}

function syncTimelineSliders() {
  const levelAssets = state.manifest.metric_assets[state.currentLevel];
  if (!levelAssets?.months?.length) {
    state.allMonths = [];
    dateFromInput.style.display = "none";
    dateToInput.style.display = "none";
    if (timelineFromLabel) timelineFromLabel.textContent = "";
    if (timelineToLabel) timelineToLabel.textContent = "";
    return;
  }

  state.allMonths = levelAssets.months;
  dateFromInput.style.display = "";
  dateToInput.style.display = "";
  dateFromInput.min = 0;
  dateFromInput.max = state.allMonths.length - 1;
  dateToInput.min = 0;
  dateToInput.max = state.allMonths.length - 1;

  // Set initial positions
  let fromIdx = 0;
  let toIdx = state.allMonths.length - 1;

  if (state.currentDateFrom && state.allMonths.includes(state.currentDateFrom)) {
    fromIdx = state.allMonths.indexOf(state.currentDateFrom);
  }
  if (state.currentDateTo && state.allMonths.includes(state.currentDateTo)) {
    toIdx = state.allMonths.indexOf(state.currentDateTo);
  }

  dateFromInput.value = fromIdx;
  dateToInput.value = toIdx;
  state.currentDateFrom = state.allMonths[fromIdx];
  state.currentDateTo = state.allMonths[toIdx];

  if (timelineFromLabel) timelineFromLabel.textContent = formatMonthLabel(state.allMonths[fromIdx]);
  if (timelineToLabel) timelineToLabel.textContent = formatMonthLabel(state.allMonths[toIdx]);
  updateTimelineFill();
}

function updateTimelineFill() {
  if (!timelineFill || !dateFromInput || !dateToInput) return;
  const min = parseFloat(dateFromInput.min) || 0;
  const max = parseFloat(dateFromInput.max) || 1;
  const range = max - min;
  if (range <= 0) { timelineFill.style.display = "none"; return; }
  const fromVal = parseFloat(dateFromInput.value) || 0;
  const toVal = parseFloat(dateToInput.value) || max;
  const leftPct = ((fromVal - min) / range) * 100;
  const rightPct = ((max - toVal) / range) * 100;
  timelineFill.style.display = "";
  timelineFill.style.left = leftPct + "%";
  timelineFill.style.right = rightPct + "%";
}

/* ─── Controls ─── */
function initCustomSelects() {
  document.querySelectorAll(".filter-group select").forEach((select) => {
    if (!select || customSelectControls.has(select)) return;

    const filterGroup = select.closest(".filter-group");
    if (!filterGroup) return;

    const label = filterGroup.querySelector("label");
    if (label && select.id && !label.id) {
      label.id = `${select.id}-label`;
    }

    select.classList.add("select-native");

    const shell = document.createElement("div");
    shell.className = "select-shell";

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "select-trigger";
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");

    const menuId = `${select.id || "select"}-menu`;
    trigger.setAttribute("aria-controls", menuId);
    if (label?.id) {
      trigger.setAttribute("aria-labelledby", label.id);
    }

    const triggerLabel = document.createElement("span");
    triggerLabel.className = "select-trigger-label";
    trigger.append(triggerLabel);

    const menu = document.createElement("div");
    menu.className = "select-menu";
    menu.id = menuId;
    menu.setAttribute("role", "listbox");
    menu.hidden = true;

    shell.append(trigger, menu);
    filterGroup.append(shell);

    const control = { select, shell, trigger, triggerLabel, menu, optionButtons: [] };
    customSelectControls.set(select, control);

    syncCustomSelect(select);

    if (label) {
      label.addEventListener("click", (event) => {
        event.preventDefault();
        toggleCustomSelect(select);
      });
    }

    trigger.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleCustomSelect(select);
    });

    trigger.addEventListener("keydown", (event) => {
      handleCustomSelectTriggerKeydown(select, event);
    });

    menu.addEventListener("keydown", (event) => {
      handleCustomSelectMenuKeydown(select, event);
    });

    select.addEventListener("change", () => {
      syncCustomSelect(select);
    });
  });

  document.addEventListener("click", (event) => {
    const insideCustomSelect = [...customSelectControls.values()].some(({ shell }) =>
      shell.contains(event.target)
    );
    if (!insideCustomSelect) {
      closeAllCustomSelects();
    }
  });

  window.addEventListener("resize", () => {
    closeAllCustomSelects();
  });
}

function syncCustomSelect(select) {
  const control = customSelectControls.get(select);
  if (!control) return;

  const { trigger, triggerLabel, menu } = control;
  const selectedOption =
    [...select.options].find((option) => option.value === select.value) ||
    select.options[select.selectedIndex] ||
    select.options[0];

  triggerLabel.textContent = selectedOption?.textContent || "";
  trigger.title = triggerLabel.textContent;

  menu.innerHTML = "";
  control.optionButtons = [];

  [...select.options].forEach((option) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "select-option";
    button.dataset.value = option.value;
    button.textContent = option.textContent;
    button.disabled = option.disabled;
    button.setAttribute("role", "option");

    const isSelected = option.value === select.value;
    button.setAttribute("aria-selected", String(isSelected));
    button.classList.toggle("is-selected", isSelected);

    button.addEventListener("click", (event) => {
      event.stopPropagation();
      chooseCustomSelectOption(select, option.value);
    });

    menu.append(button);
    control.optionButtons.push(button);
  });
}

function toggleCustomSelect(select) {
  const control = customSelectControls.get(select);
  if (!control) return;
  if (control.shell.classList.contains("is-open")) {
    closeCustomSelect(select);
  } else {
    openCustomSelect(select);
  }
}

function openCustomSelect(select) {
  const control = customSelectControls.get(select);
  if (!control) return;

  closeAllCustomSelects(select);
  control.shell.classList.add("is-open");
  control.trigger.setAttribute("aria-expanded", "true");
  control.menu.hidden = false;

  const selectedButton =
    control.optionButtons.find((button) => button.dataset.value === select.value && !button.disabled) ||
    control.optionButtons.find((button) => !button.disabled);

  requestAnimationFrame(() => {
    selectedButton?.focus();
  });
}

function closeCustomSelect(select) {
  const control = customSelectControls.get(select);
  if (!control) return;
  control.shell.classList.remove("is-open");
  control.trigger.setAttribute("aria-expanded", "false");
  control.menu.hidden = true;
}

function closeAllCustomSelects(exceptSelect = null) {
  customSelectControls.forEach((_, select) => {
    if (select !== exceptSelect) {
      closeCustomSelect(select);
    }
  });
}

function chooseCustomSelectOption(select, value) {
  if (select.value !== value) {
    select.value = value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }
  closeCustomSelect(select);
  customSelectControls.get(select)?.trigger.focus();
}

function focusCustomSelectOption(select, nextIndex) {
  const control = customSelectControls.get(select);
  if (!control) return;

  const enabledButtons = control.optionButtons.filter((button) => !button.disabled);
  if (!enabledButtons.length) return;

  const boundedIndex = Math.max(0, Math.min(nextIndex, enabledButtons.length - 1));
  enabledButtons[boundedIndex].focus();
}

function moveCustomSelectFocus(select, step) {
  const control = customSelectControls.get(select);
  if (!control) return;

  const enabledButtons = control.optionButtons.filter((button) => !button.disabled);
  if (!enabledButtons.length) return;

  const currentIndex = enabledButtons.indexOf(document.activeElement);
  const startIndex = Math.max(
    0,
    enabledButtons.findIndex((button) => button.dataset.value === select.value)
  );
  const nextIndex =
    currentIndex === -1 ? startIndex : (currentIndex + step + enabledButtons.length) % enabledButtons.length;

  enabledButtons[nextIndex].focus();
}

function handleCustomSelectTriggerKeydown(select, event) {
  const control = customSelectControls.get(select);
  if (!control) return;

  switch (event.key) {
    case "ArrowDown":
      event.preventDefault();
      if (!control.shell.classList.contains("is-open")) {
        openCustomSelect(select);
      } else {
        moveCustomSelectFocus(select, 1);
      }
      break;
    case "ArrowUp":
      event.preventDefault();
      if (!control.shell.classList.contains("is-open")) {
        openCustomSelect(select);
      } else {
        moveCustomSelectFocus(select, -1);
      }
      break;
    case "Enter":
    case " ":
      event.preventDefault();
      toggleCustomSelect(select);
      break;
    case "Escape":
      closeCustomSelect(select);
      break;
    default:
      break;
  }
}

function handleCustomSelectMenuKeydown(select, event) {
  const control = customSelectControls.get(select);
  if (!control) return;

  switch (event.key) {
    case "ArrowDown":
      event.preventDefault();
      moveCustomSelectFocus(select, 1);
      break;
    case "ArrowUp":
      event.preventDefault();
      moveCustomSelectFocus(select, -1);
      break;
    case "Home":
      event.preventDefault();
      focusCustomSelectOption(select, 0);
      break;
    case "End":
      event.preventDefault();
      focusCustomSelectOption(select, control.optionButtons.filter((button) => !button.disabled).length - 1);
      break;
    case "Enter":
    case " ":
      if (document.activeElement?.dataset?.value) {
        event.preventDefault();
        chooseCustomSelectOption(select, document.activeElement.dataset.value);
      }
      break;
    case "Escape":
      event.preventDefault();
      closeCustomSelect(select);
      control.trigger.focus();
      break;
    case "Tab":
      closeCustomSelect(select);
      break;
    default:
      break;
  }
}

function syncCustomSelectValues() {
  syncCustomSelect(levelSelect);
  syncCustomSelect(metricSelect);
}

function initControls() {
  for (const level of state.manifest.available_levels) {
    const option = document.createElement("option");
    option.value = level;
    levelSelect.append(option);
  }
  levelSelect.value = state.currentLevel;

  for (const metric of state.manifest.metrics) {
    const option = document.createElement("option");
    option.value = metric;
    metricSelect.append(option);
  }
  metricSelect.value = state.currentMetric;

  initCustomSelects();
  renderBasemapToggle();
  refreshControlLabels();

  document.querySelectorAll(".lang-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      state.language = button.dataset.language;
      document.querySelectorAll(".lang-btn").forEach((item) =>
        item.classList.toggle("is-active", item === button)
      );
      applyTranslations();
      await renderExplorer();
    });
  });

  levelSelect.addEventListener("change", async () => {
    state.currentLevel = levelSelect.value;
    state.selectedCode = null;
    state.selectedFeature = null;
    state.pendingFit = "level";
    syncTimelineSliders();
    await renderExplorer();
  });

  metricSelect.addEventListener("change", async () => {
    state.currentMetric = metricSelect.value;
    refreshControlLabels();
    await renderExplorer();
  });

  resetButton.addEventListener("click", async () => {
    closeAllCustomSelects();
    state.selectedCode = null;
    state.selectedFeature = null;
    state.imageryFallbackState = null;
    const prevBasemap = state.currentBasemapMode;
    state.currentLevel = state.manifest.default_level || "province";
    state.currentMetric = state.manifest.default_metric;
    state.currentBasemapMode = state.manifest.default_basemap_mode || "map";
    state.currentDateFrom = "";
    state.currentDateTo = "";
    levelSelect.value = state.currentLevel;
    metricSelect.value = state.currentMetric;
    syncCustomSelectValues();
    renderBasemapToggle();
    syncTimelineSliders();
    state.pendingFit = "level";
    if (prevBasemap !== state.currentBasemapMode) {
      await applyBasemapMode(state.currentBasemapMode);
    } else {
      await renderExplorer();
    }
  });

  searchInput.addEventListener("input", handleSearch);

  // Close search on click outside
  document.addEventListener("click", (e) => {
    if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
      searchResults.innerHTML = "";
    }
  });
}

function renderBasemapToggle() {
  basemapToggle.innerHTML = "";
  for (const [mode, config] of Object.entries(state.manifest.basemap_modes || {})) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `segmented-btn ${state.currentBasemapMode === mode ? "is-active" : ""}`;
    button.dataset.mode = mode;
    button.textContent = t(config.label_key);
    button.addEventListener("click", async () => {
      if (state.currentBasemapMode === mode) return;
      state.currentBasemapMode = mode;
      state.imageryFallbackState = null;
      renderBasemapToggle();
      await applyBasemapMode(mode);
    });
    basemapToggle.append(button);
  }
}

function refreshControlLabels() {
  [...levelSelect.options].forEach((option) => {
    option.textContent = t(`level.${option.value}`);
  });
  [...metricSelect.options].forEach((option) => {
    option.textContent = t(`metric.${option.value}`);
  });
  if (metricHelp) {
    metricHelp.textContent = t(`metric.help.${state.currentMetric}`);
  }
  syncCustomSelectValues();
}

function applyTranslations() {
  document.documentElement.lang = state.language;
  document.title = t("app.title");
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
  searchInput.placeholder = t("controls.search_placeholder");
  refreshControlLabels();
  renderBasemapToggle();
  if (heroDefaultLevel) heroDefaultLevel.textContent = t(`level.${state.currentLevel}`);
  if (heroDefaultMetric) heroDefaultMetric.textContent = t(`metric.${state.currentMetric}`);
  statsLevelPill.textContent = t(`level.${state.currentLevel}`);
  selectionLevelBadge.textContent = t(`level.${state.currentLevel}`);
}

/* ─── Map ─── */
function getBasemapConfig(mode) {
  return state.manifest.basemap_modes?.[mode] || state.manifest.basemap_modes?.map;
}

function buildStyleDefinition(mode) {
  const config = getBasemapConfig(mode);
  if (!config) return "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";
  if (config.kind === "style_object") return JSON.parse(JSON.stringify(config.style));
  return config.style_url;
}

function initMap() {
  state.popup = new maplibregl.Popup({
    closeButton: false,
    closeOnClick: false,
    offset: 14,
  });

  state.map = new maplibregl.Map({
    container: "map",
    style: buildStyleDefinition(state.currentBasemapMode),
    center: [118, -2.4],
    zoom: 4.7,
    minZoom: 3.5,
    attributionControl: false,
    pitch: 0,
  });

  state.map.addControl(
    new maplibregl.NavigationControl({ visualizePitch: true }),
    "bottom-right"
  );

  state.map.on("error", async (event) => {
    const config = getBasemapConfig(state.currentBasemapMode);
    if (!config?.best_effort || state.currentBasemapMode === (state.manifest.default_basemap_mode || "map")) return;
    if (!state.mapStyleReady && !event?.error) return;
    state.imageryFallbackState = config.fallback_message_key || "status.imagery_fallback";
    state.currentBasemapMode = state.manifest.default_basemap_mode || "map";
    renderBasemapToggle();
    await applyBasemapMode(state.currentBasemapMode);
  });

  state.map.on("load", async () => {
    state.mapStyleReady = true;
    if (state.manifest) {
      await renderExplorer();
    }
    updateMapNotice();
  });
}

async function waitForMapStyleReady(timeoutMs = 8000) {
  if (!state.map) return false;

  return await new Promise((resolve) => {
    let settled = false;
    let timeoutId = null;

    const finish = (ready) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(ready);
    };

    const handleIdle = () => {
      finish(state.map?.isStyleLoaded() || false);
    };

    const handleError = () => {
      finish(state.map?.isStyleLoaded() || false);
    };

    const cleanup = () => {
      if (timeoutId) window.clearTimeout(timeoutId);
      state.map?.off("idle", handleIdle);
      state.map?.off("error", handleError);
    };

    timeoutId = window.setTimeout(() => finish(state.map?.isStyleLoaded() || false), timeoutMs);
    state.map.on("idle", handleIdle);
    state.map.on("error", handleError);
  });
}

async function applyBasemapMode(mode) {
  if (!state.map) return;
  state.mapStyleReady = false;
  state.mapInteractionsBound = false;
  state.map.setStyle(buildStyleDefinition(mode));
  updateMapNotice();
  const ready = await waitForMapStyleReady();
  state.mapStyleReady = ready;
  if (ready) {
    await renderExplorer();
  }
}

/* ─── Data Layer (unchanged core) ─── */
async function getBoundaryData(level) {
  if (!state.boundaryCache.has(level)) {
    const path = `./data/latest/${state.manifest.boundary_assets[level]}`;
    state.boundaryCache.set(level, await loadJson(path));
  }
  return state.boundaryCache.get(level);
}

async function getSummaryData(level) {
  const cacheKey = `summary:${level}`;
  if (!state.summaryCache.has(cacheKey)) {
    const asset = state.manifest.metric_assets[level]?.summary_all_time;
    state.summaryCache.set(cacheKey, asset ? await loadJson(`./data/latest/${asset}`) : []);
  }
  return state.summaryCache.get(cacheKey);
}

function syncDateRangeDefaults() {
  const levelAssets = state.manifest.metric_assets[state.currentLevel];
  if (!levelAssets?.months?.length) {
    state.currentDateFrom = "";
    state.currentDateTo = "";
    return;
  }
  if (!state.currentDateFrom || !levelAssets.months.includes(state.currentDateFrom)) {
    state.currentDateFrom = levelAssets.months[0];
  }
  if (!state.currentDateTo || !levelAssets.months.includes(state.currentDateTo)) {
    state.currentDateTo = levelAssets.months[levelAssets.months.length - 1];
  }
}

function availableMonthsInRange(levelAssets) {
  if (!levelAssets?.months?.length) return [];
  return levelAssets.months.filter((month) => {
    if (state.currentDateFrom && month < state.currentDateFrom) return false;
    if (state.currentDateTo && month > state.currentDateTo) return false;
    return true;
  });
}

function usesFullRange(levelAssets) {
  if (!levelAssets?.months?.length) return true;
  return (
    (!state.currentDateFrom || state.currentDateFrom === levelAssets.months[0]) &&
    (!state.currentDateTo || state.currentDateTo === levelAssets.months[levelAssets.months.length - 1])
  );
}

async function loadMonthRows(level) {
  const levelAssets = state.manifest.metric_assets[level];
  if (!levelAssets?.months?.length) return [];
  const requestedMonths = availableMonthsInRange(levelAssets);
  const rows = [];
  for (const month of requestedMonths) {
    const cacheKey = `${level}:${month}`;
    if (!state.monthCache.has(cacheKey)) {
      try {
        state.monthCache.set(cacheKey, await loadJson(`./data/latest/${levelAssets.month_dir}/${month}.json`));
      } catch (error) {
        state.monthCache.set(cacheKey, []);
      }
    }
    rows.push(...state.monthCache.get(cacheKey));
  }
  return rows;
}

function filterRowsByDateRange(rows) {
  return rows.filter((row) => {
    const month = row.month_start?.slice(0, 7);
    if (!month) return false;
    if (state.currentDateFrom && month < state.currentDateFrom) return false;
    if (state.currentDateTo && month > state.currentDateTo) return false;
    return true;
  });
}

async function loadTrendRows(level, code) {
  if (!code) return [];
  const levelAssets = state.manifest.metric_assets[level];
  if (levelAssets?.trend_dir) {
    const bundleSegments = levelAssets.trend_bundle_segments || 0;
    const assetKey = bundleSegments
      ? code.split(".").slice(0, bundleSegments).join(".")
      : code;
    const cacheKey = bundleSegments
      ? `${level}:bundle:${assetKey}`
      : `${level}:code:${assetKey}`;
    if (!state.trendCache.has(cacheKey)) {
      let rows = [];
      try {
        rows = await loadJson(`./data/latest/${levelAssets.trend_dir}/${assetKey}.json`);
      } catch {
        rows = [];
      }
      rows.sort((left, right) => {
        if (left.code !== right.code) return left.code.localeCompare(right.code);
        return left.month_start.localeCompare(right.month_start);
      });
      state.trendCache.set(cacheKey, rows);
    }
    return filterRowsByDateRange(state.trendCache.get(cacheKey).filter((row) => row.code === code));
  }

  const fallbackCacheKey = `${level}:monthscan:${code}`;
  if (!state.trendCache.has(fallbackCacheKey)) {
    const rows = (await loadMonthRows(level))
      .filter((row) => row.code === code)
      .sort((left, right) => left.month_start.localeCompare(right.month_start));
    state.trendCache.set(fallbackCacheKey, rows);
  }
  return filterRowsByDateRange(state.trendCache.get(fallbackCacheKey));
}

async function buildMetricLookup(level) {
  const levelAssets = state.manifest.metric_assets[level];
  if (usesFullRange(levelAssets)) {
    const summaryRows = await getSummaryData(level);
    return {
      lookup: new Map(summaryRows.map((row) => [row.code, row])),
      mode: "summary_all_time",
    };
  }

  const rows = await loadMonthRows(level);
  if (!rows.length) {
    const summaryRows = await getSummaryData(level);
    return {
      lookup: new Map(summaryRows.map((row) => [row.code, row])),
      mode: "summary_all_time",
    };
  }

  const lookup = new Map();
  for (const row of rows) {
    const bucket = lookup.get(row.code) || {
      code: row.code,
      unique_event_count: 0,
      flood_days: 0,
      sum_intersection_area_km2: 0,
      max_coverage_ratio: 0,
    };
    bucket.unique_event_count += row.unique_event_count;
    bucket.flood_days += row.flood_days;
    bucket.sum_intersection_area_km2 += row.sum_intersection_area_km2;
    bucket.max_coverage_ratio = Math.max(bucket.max_coverage_ratio, row.max_coverage_ratio);
    lookup.set(row.code, bucket);
  }
  return { lookup, mode: "date_window" };
}

/* ─── Choropleth rendering ─── */
function colorForValue(value, maxValue) {
  if (!maxValue || value <= 0) return COLOR_STEPS[0];
  const ratio = value / maxValue;
  const index = Math.min(COLOR_STEPS.length - 1, Math.floor(ratio * (COLOR_STEPS.length - 1)) + 1);
  return COLOR_STEPS[index];
}

function renderLegend(maxValue) {
  mapLegend.innerHTML = "";
  COLOR_STEPS.forEach((color, index) => {
    const swatch = document.createElement("span");
    swatch.className = "legend-swatch";
    swatch.style.background = color;
    swatch.title = index === 0 ? "0" : `${Math.round((index / (COLOR_STEPS.length - 1)) * maxValue)}`;
    mapLegend.append(swatch);
  });
}

function cloneFeature(feature, lookup, maxValue) {
  const metricRow = lookup.get(feature.properties.code);
  const metricValue = metricRow?.[state.currentMetric] || 0;
  return {
    ...feature,
    properties: {
      ...feature.properties,
      metric_value: metricValue,
      max_coverage_ratio: metricRow?.max_coverage_ratio || 0,
      fill_color: colorForValue(metricValue, maxValue),
      is_selected: feature.properties.code === state.selectedCode,
      metric_label: t(`metric.${state.currentMetric}`),
      metric_display: formatMetric(metricValue),
      parent_name: parentLabel(feature.properties),
    },
  };
}

function buildDisplayGeojson(geojson, lookup) {
  const values = [...lookup.values()].map((row) => row[state.currentMetric] || 0);
  const maxValue = Math.max(...values, 0);
  renderLegend(maxValue);
  return {
    type: "FeatureCollection",
    features: geojson.features.map((feature) => cloneFeature(feature, lookup, maxValue)),
  };
}

/* ─── Map layers ─── */
function currentBoundaryPaintProfile() {
  return BOUNDARY_PAINT_PROFILES[state.currentBasemapMode] || BOUNDARY_PAINT_PROFILES.map;
}

function ensureBoundaryLayers() {
  if (state.map.getSource("boundaries")) return;
  const profile = currentBoundaryPaintProfile();
  state.map.addSource("boundaries", {
    type: "geojson",
    data: state.currentGeojsonData || { type: "FeatureCollection", features: [] },
  });

  state.map.addLayer({
    id: "boundary-fill",
    type: "fill",
    source: "boundaries",
    paint: {
      "fill-color": ["get", "fill_color"],
      "fill-opacity": [
        "case",
        ["==", ["get", "is_selected"], true],
        profile.selectedFillOpacity,
        ["interpolate", ["linear"], ["get", "metric_value"],
          0, 0.08,
          1, profile.fillOpacity * 0.6,
          10, profile.fillOpacity
        ],
      ],
    },
  });

  state.map.addLayer({
    id: "boundary-line",
    type: "line",
    source: "boundaries",
    paint: {
      "line-color": profile.lineColor,
      "line-width": profile.lineWidth,
    },
  });

  state.map.addLayer({
    id: "boundary-selected",
    type: "line",
    source: "boundaries",
    filter: ["==", ["get", "is_selected"], true],
    paint: {
      "line-color": "#b45309",
      "line-width": 2.5,
    },
  });
}

function updateBoundarySource() {
  const source = state.map.getSource("boundaries");
  if (!source) return;
  source.setData(state.currentGeojsonData);
}

function bindMapInteractions() {
  if (state.mapInteractionsBound) return;

  state.handlers.mousemove = (event) => {
    const feature = event.features?.[0];
    if (!feature) return;
    state.map.getCanvas().style.cursor = "pointer";
    state.popup
      .setLngLat(event.lngLat)
      .setHTML(
        `<strong>${feature.properties.name}</strong><br>${feature.properties.metric_label}: ${feature.properties.metric_display}`
      )
      .addTo(state.map);
  };

  state.handlers.mouseleave = () => {
    state.map.getCanvas().style.cursor = "";
    state.popup.remove();
  };

  state.handlers.click = async (event) => {
    const feature = event.features?.[0];
    if (!feature) return;
    state.selectedCode = feature.properties.code;
    state.selectedFeature = feature;
    state.pendingFit = "selection";
    await renderExplorer();
  };

  state.map.on("mousemove", "boundary-fill", state.handlers.mousemove);
  state.map.on("mouseleave", "boundary-fill", state.handlers.mouseleave);
  state.map.on("click", "boundary-fill", state.handlers.click);
  state.mapInteractionsBound = true;
}

function unbindMapInteractions() {
  if (!state.map || !state.mapInteractionsBound) return;
  state.map.off("mousemove", "boundary-fill", state.handlers.mousemove);
  state.map.off("mouseleave", "boundary-fill", state.handlers.mouseleave);
  state.map.off("click", "boundary-fill", state.handlers.click);
  state.mapInteractionsBound = false;
}

function boundsFromFeature(feature) {
  const bounds = new maplibregl.LngLatBounds();
  const appendCoordinates = (coords) => {
    if (!Array.isArray(coords)) return;
    if (coords.length === 2 && typeof coords[0] === "number" && typeof coords[1] === "number") {
      bounds.extend(coords);
      return;
    }
    coords.forEach(appendCoordinates);
  };
  appendCoordinates(feature.geometry.coordinates);
  return bounds;
}

function fitCurrentMapView() {
  if (!state.map || !state.currentGeojsonData?.features?.length) return;
  if (state.pendingFit === "selection" && state.selectedCode) {
    const feature = state.currentGeojsonData.features.find(
      (item) => item.properties.code === state.selectedCode
    );
    if (feature) {
      const bounds = boundsFromFeature(feature);
      if (!bounds.isEmpty()) {
        state.map.fitBounds(bounds, { padding: 80, duration: 1000 });
      }
    }
  } else if (state.pendingFit === "level") {
    const bounds = new maplibregl.LngLatBounds();
    state.currentGeojsonData.features.forEach((feature) => {
      const featureBounds = boundsFromFeature(feature);
      if (!featureBounds.isEmpty()) {
        bounds.extend(featureBounds.getSouthWest());
        bounds.extend(featureBounds.getNorthEast());
      }
    });
    if (!bounds.isEmpty()) {
      state.map.fitBounds(bounds, { padding: 80, duration: 1000 });
    }
  }
  state.pendingFit = null;
}

async function renderMap(renderVersion) {
  if (!state.map || !state.mapStyleReady) return;

  const geojson = await getBoundaryData(state.currentLevel);
  if (renderVersion !== state.renderVersion) return;
  const { lookup, mode } = await buildMetricLookup(state.currentLevel);
  if (renderVersion !== state.renderVersion) return;
  state.currentLookup = lookup;
  state.currentLookupMode = mode;
  state.currentUnitsWithData = [...lookup.values()].filter(
    (row) => (row[state.currentMetric] || 0) > 0
  ).length;
  state.currentRenderedCount = geojson.features.length;
  state.currentGeojsonData = buildDisplayGeojson(geojson, lookup);

  unbindMapInteractions();
  ensureBoundaryLayers();
  updateBoundarySource();
  bindMapInteractions();

  mapTitle.textContent = t(`level.${state.currentLevel}`);
  fitCurrentMapView();
}

/* ─── Status and Stats ─── */
function updateStatusPanels() {
  const ready = state.coverageReport.release_gate.district_release_ready;
  const coverageText = ready ? t("panel.coverage_ready") : t("panel.coverage_blocked");
  if (coverageBanner) coverageBanner.textContent = coverageText;
  if (coverageChip) coverageChip.textContent = coverageText;
  if (coverageWarning) {
    coverageWarning.textContent = state.coverageReport.release_gate.warning_code
      ? t(`warning.${state.coverageReport.release_gate.warning_code}`)
      : t("panel.coverage_reason");
  }

  const groundsourceText =
    state.manifest.groundsource_status === "ok"
      ? t("status.groundsource_ready")
      : t("status.no_groundsource");
  if (groundsourceStatus) groundsourceStatus.textContent = groundsourceText;
  if (heroGroundsourceStatus) {
    heroGroundsourceStatus.textContent =
      state.manifest.groundsource_status === "ok" ? t("status.ready_short") : t("status.pending_short");
  }
}

function updateStatsPanel() {
  // Compute filtered total from the current lookup (reflects level + date range)
  let filteredTotalEvents = 0;
  if (state.currentLookup && state.currentLookup.size > 0) {
    for (const row of state.currentLookup.values()) {
      filteredTotalEvents += row.unique_event_count || 0;
    }
  } else {
    filteredTotalEvents = state.manifest.groundsource_summary?.intersecting_events || 0;
  }
  const dateWindow =
    state.currentLookupMode === "date_window" && state.currentDateFrom && state.currentDateTo
      ? `${formatMonthLabel(state.currentDateFrom)} – ${formatMonthLabel(state.currentDateTo)}`
      : t("selection.all_time");

  if (heroDefaultLevel) heroDefaultLevel.textContent = t(`level.${state.currentLevel}`);
  if (heroDefaultMetric) heroDefaultMetric.textContent = t(`metric.${state.currentMetric}`);
  if (heroTotalEvents) heroTotalEvents.textContent = formatMetric(filteredTotalEvents);
  statsLevelPill.textContent = t(`level.${state.currentLevel}`);

  // Animate stat values
  animateValue(statTotalEvents, filteredTotalEvents);
  animateValue(statUnitsWithData, state.currentUnitsWithData);
  animateValue(statRenderedUnits, state.currentRenderedCount);
  statDateWindow.textContent = dateWindow;
  selectionPeriod.textContent = dateWindow;
  trendPeriod.textContent = dateWindow;
  if (methodologyStatus) {
    methodologyStatus.textContent = state.manifest.imagery_available
      ? t("method.summary_status")
      : t("status.map_only");
  }
}

function animateValue(el, targetValue) {
  if (!el || typeof targetValue !== "number") {
    if (el) el.textContent = formatMetric(targetValue);
    return;
  }

  const existingAnimation = statAnimationFrames.get(el);
  if (existingAnimation) {
    cancelAnimationFrame(existingAnimation);
    statAnimationFrames.delete(el);
  }

  const duration = 600;
  const start = performance.now();
  const startValue = parseInt(el.textContent.replace(/\D/g, ""), 10) || 0;

  function step(timestamp) {
    const progress = Math.min((timestamp - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    const current = Math.round(startValue + (targetValue - startValue) * eased);
    el.textContent = formatMetric(current);
    if (progress < 1) {
      const frameId = requestAnimationFrame(step);
      statAnimationFrames.set(el, frameId);
      return;
    }
    el.textContent = formatMetric(targetValue);
    statAnimationFrames.delete(el);
  }

  const frameId = requestAnimationFrame(step);
  statAnimationFrames.set(el, frameId);
}

function updateMapNotice() {
  if (state.imageryFallbackState) {
    mapNote.textContent = t(state.imageryFallbackState);
    return;
  }
  const config = getBasemapConfig(state.currentBasemapMode);
  if (config?.best_effort) {
    mapNote.textContent = t("status.imagery_best_effort");
    return;
  }
  mapNote.textContent = "";
}

function formatMetric(value) {
  return new Intl.NumberFormat(state.language === "id" ? "id-ID" : "en-US", {
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function parentLabel(properties) {
  if (state.currentLevel === "province") return t("selection.root_country");

  let parentCode = null;
  if (state.currentLevel === "regency") parentCode = properties.province_code;
  else if (state.currentLevel === "district") parentCode = properties.regency_code;
  else if (state.currentLevel === "village") parentCode = properties.district_code;
  return state.adminByCode.get(parentCode)?.name || parentCode || t("selection.no_parent");
}

/* ─── Selection + Trend ─── */
async function renderSelection(renderVersion) {
  const boundaryData = await getBoundaryData(state.currentLevel);
  if (renderVersion !== state.renderVersion) return;
  const feature =
    state.selectedFeature ||
    boundaryData.features.find((item) => item.properties.code === state.selectedCode) ||
    null;

  if (!feature) {
    selectionEmpty.classList.remove("is-hidden");
    selectionDetails.classList.add("is-hidden");
    await renderTrendChart(null, renderVersion);
    return;
  }

  selectionEmpty.classList.add("is-hidden");
  selectionDetails.classList.remove("is-hidden");
  selectionName.textContent = feature.properties.name;
  selectionCode.textContent = feature.properties.code;
  selectionParent.textContent = parentLabel(feature.properties);
  selectionBoundarySource.textContent = feature.properties.boundary_source || "raw";
  selectionLevelBadge.textContent = t(`level.${state.currentLevel}`);

  const metricRow = state.currentLookup.get(feature.properties.code);
  selectionMetricValue.textContent = metricRow ? formatMetric(metricRow[state.currentMetric]) : "0";
  selectionCoverage.textContent = metricRow ? formatMetric(metricRow.max_coverage_ratio) : "0";
  await renderTrendChart(feature.properties.code, renderVersion);
}

async function renderTrendChart(code, renderVersion) {
  const ctx = document.querySelector("#trend-chart");
  if (state.trendChart) {
    state.trendChart.destroy();
    state.trendChart = null;
  }

  if (!code || !state.manifest.metric_assets[state.currentLevel]) {
    trendEmpty.classList.remove("is-hidden");
    return;
  }

  trendEmpty.classList.add("is-hidden");
  const rows = await loadTrendRows(state.currentLevel, code);
  if (renderVersion !== state.renderVersion) return;
  if (!rows.length) {
    trendEmpty.classList.remove("is-hidden");
    return;
  }

  rows.sort((left, right) => left.month_start.localeCompare(right.month_start));
  trendEmpty.classList.add("is-hidden");

  state.trendChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: rows.map((row) => row.month_start),
      datasets: [
        {
          label: t(`metric.${state.currentMetric}`),
          data: rows.map((row) => row[state.currentMetric]),
          borderColor: "#14b8a6",
          backgroundColor: "rgba(20, 184, 166, 0.10)",
          borderWidth: 2,
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointHoverBackgroundColor: "#14b8a6",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false,
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "rgba(44, 36, 24, 0.90)",
          titleColor: "#f5f1eb",
          bodyColor: "#f5f1eb",
          borderColor: "rgba(20, 184, 166, 0.3)",
          borderWidth: 1,
          cornerRadius: 8,
          padding: 10,
          titleFont: { family: "Inter", weight: "600", size: 12 },
          bodyFont: { family: "Inter", size: 11 },
        },
      },
      scales: {
        x: {
          ticks: {
            color: "#9a8e7f",
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 6,
            font: { family: "Inter", size: 10 },
          },
          grid: { color: "rgba(120, 90, 50, 0.06)" },
          border: { display: false },
        },
        y: {
          ticks: {
            color: "#9a8e7f",
            font: { family: "Inter", size: 10 },
          },
          grid: { color: "rgba(120, 90, 50, 0.06)" },
          border: { display: false },
        },
      },
    },
  });
}

/* ─── Methodology ─── */
function renderMethodology() {
  methodologyList.innerHTML = "";
  for (const item of state.methodology.notes) {
    const li = document.createElement("li");
    li.textContent = t(item);
    methodologyList.append(li);
  }
}

/* ─── Search ─── */
function handleSearch() {
  const query = searchInput.value.trim().toLowerCase();
  searchResults.innerHTML = "";
  if (!query) return;
  const matches = state.searchIndex
    .filter(
      (row) =>
        state.manifest.available_levels.includes(row.level) &&
        (row.name.toLowerCase().includes(query) || row.code.includes(query))
    )
    .slice(0, 8);

  if (!matches.length) {
    const empty = document.createElement("div");
    empty.className = "search-result";
    empty.textContent = t("search.no_results");
    searchResults.append(empty);
    return;
  }

  for (const match of matches) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "search-result";
    button.innerHTML = `<div><strong>${match.name}</strong><span>${t(`level.${match.level}`)}</span></div><span>${match.code}</span>`;
    button.addEventListener("click", async () => {
      const resolved = resolveSearchSelection(match);
      state.currentLevel = resolved.level;
      levelSelect.value = resolved.level;
      state.selectedCode = resolved.code;
      state.selectedFeature = null;
      state.pendingFit = "selection";
      searchInput.value = match.name;
      searchResults.innerHTML = "";
      syncTimelineSliders();
      await renderExplorer();
    });
    searchResults.append(button);
  }
}

function resolveSearchSelection(match) {
  const levelPriority = [match.level, "district", "regency", "province"];
  for (const level of levelPriority) {
    if (!state.manifest.available_levels.includes(level)) continue;
    if (level === "province") return { level, code: match.province_code || match.code };
    if (level === "regency") return { level, code: match.regency_code || match.code };
    if (level === "district") return { level, code: match.district_code || match.code };
    return { level, code: match.village_code || match.code };
  }
  return { level: state.currentLevel, code: match.code };
}

/* ─── Main render loop ─── */
async function renderExplorer() {
  const renderVersion = ++state.renderVersion;
  updateStatusPanels();
  syncDateRangeDefaults();
  syncTimelineSliders();
  updateMapNotice();
  await renderMap(renderVersion);
  if (renderVersion !== state.renderVersion) return;
  updateStatsPanel();
  await renderSelection(renderVersion);
  if (renderVersion !== state.renderVersion) return;
  renderMethodology();
}

/* ─── Launch ─── */
boot().catch((error) => {
  console.error(error);
  if (coverageBanner) coverageBanner.textContent = "Bootstrap failed";
  if (coverageWarning) coverageWarning.textContent = error.message;
});
