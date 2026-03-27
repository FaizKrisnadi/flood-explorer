/* ═══════════════════════════════════════════════════
   INDONESIA FLOOD EXPLORER — App v2
   Sidebar layout · Timeline slider · Chart.js theming
   ═══════════════════════════════════════════════════ */

const state = {
  language: "id",
  manifest: null,
  coverageReport: null,
  methodology: null,
  qualitativeStore: null,
  evidenceIndex: null,
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
  evidenceCache: new Map(),
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
  qualitativeRouteOpen: false,
  qualitativeSidebarFocusPending: false,
  suppressRouteSync: false,
};

/* ─── Choropleth colour ramp (YlOrRd inspired, warm palette) ─── */
const COLOR_STEPS = ["#fef9c3", "#fde68a", "#f59e0b", "#b45309", "#78350f", "#451a03"];
const APP_ASSET_VERSION = "20260327e";

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
const evidenceSection = document.querySelector("#evidence-section");
const evidenceEmpty = document.querySelector("#evidence-empty");
const evidencePanel = document.querySelector("#evidence-panel");
const evidenceMonth = document.querySelector("#evidence-month");
const evidenceGapSignal = document.querySelector("#evidence-gap-signal");
const evidenceWindowNote = document.querySelector("#evidence-window-note");
const evidenceNote = document.querySelector("#evidence-note");
const evidenceGapContext = document.querySelector("#evidence-gap-context");
const evidenceInternalScore = document.querySelector("#evidence-internal-score");
const evidenceSourceLabel = document.querySelector("#evidence-source-label");
const evidenceSourceInfo = document.querySelector("#evidence-source-info");
const evidenceExternalScore = document.querySelector("#evidence-external-score");

// Qualitative DOM
const qualitativeSection = document.querySelector("#qualitative-section");
const qualitativeIntro = document.querySelector("#qualitative-intro");
const qualitativeEmpty = document.querySelector("#qualitative-empty");
const qualitativePanel = document.querySelector("#qualitative-panel");
const qualitativePeriod = document.querySelector("#qualitative-period");
const qualitativeStateBadge = document.querySelector("#qualitative-state-badge");
const qualitativeStateNote = document.querySelector("#qualitative-state-note");
const qualitativeDate = document.querySelector("#qualitative-date");
const qualitativeSourceName = document.querySelector("#qualitative-source-name");
const qualitativeLocation = document.querySelector("#qualitative-location");
const qualitativeHeadline = document.querySelector("#qualitative-headline");
const qualitativeSummary = document.querySelector("#qualitative-summary");
const qualitativeMedia = document.querySelector("#qualitative-media");
const qualitativeTags = document.querySelector("#qualitative-tags");
const qualitativeSourceLink = document.querySelector("#qualitative-source-link");
const qualitativeRelatedSection = document.querySelector("#qualitative-related-section");
const qualitativeRelatedCount = document.querySelector("#qualitative-related-count");
const qualitativeRelatedList = document.querySelector("#qualitative-related-list");

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
const trendSectionTitle = document.querySelector("#trend-section-title");
const evidenceSectionTitle = document.querySelector("#evidence-section-title");
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
const TREND_HIGHLIGHT_PLUGIN = {
  id: "trendHighlight",
  afterDatasetsDraw(chart, _args, options) {
    const highlightedMonth = options?.highlightedMonth;
    if (!highlightedMonth) return;
    const labels = chart.data.labels || [];
    const index = labels.findIndex((label) => label?.slice?.(0, 7) === highlightedMonth);
    if (index < 0) return;

    const { ctx, chartArea, scales } = chart;
    const x = scales.x.getPixelForValue(index);
    if (!Number.isFinite(x)) return;
    const y = scales.y.getPixelForValue(chart.data.datasets?.[0]?.data?.[index] || 0);

    ctx.save();
    ctx.strokeStyle = "rgba(10, 132, 255, 0.42)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(x, chartArea.top);
    ctx.lineTo(x, chartArea.bottom);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#0a84ff";
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },
};

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

function formatTemplate(key, values = {}) {
  return Object.entries(values).reduce(
    (message, [token, value]) => message.replaceAll(`{${token}}`, value),
    t(key)
  );
}

function normalizeAssetPath(path) {
  if (!path || typeof path !== "string") return "";
  return path.replace(/^\.\//, "").replace(/^data\/latest\//, "");
}

function createEmptyQualitativeStore() {
  return {
    config: null,
    global: { events: [], states: [] },
    regencyIndexByCode: new Map(),
    regencyIndexBySlug: new Map(),
    regencyBundleCache: new Map(),
  };
}

function normalizeQualitativeConfig() {
  const config = state.manifest?.qualitative || {};
  return {
    globalEventsPath: normalizeAssetPath(config.global_events_path || "qualitative_events.json"),
    globalStatesPath: normalizeAssetPath(config.global_states_path || "geography_review_states.json"),
    regencyIndexPath: normalizeAssetPath(config.regency_index_path || "regencies/index.json"),
    regencyAssetsBasePath: normalizeAssetPath(config.regency_assets_base_path || "regencies"),
    supportedLevels: Array.isArray(config.supported_levels) ? config.supported_levels : ["province", "regency", "district"],
    routeVersion: config.route_version || "v1",
  };
}

function normalizeQualitativeEvent(event) {
  return {
    adminCode: event.admin_code || "",
    adminLevel: event.admin_level || "",
    canonicalEventGroup: event.canonical_event_group || "",
    claimType: event.claim_type || "",
    eventDate: event.event_date || "",
    eventId: event.event_id || "",
    headline: event.headline || "",
    impactTags: Array.isArray(event.impact_tags) ? event.impact_tags.filter(Boolean) : [],
    locationLabel: event.location_label || "",
    mediaType: event.media_type || "",
    mediaUrl: event.media_url || "",
    sourceName: event.source_name || "",
    sourceUrl: event.source_url || "",
    summaryId: event.summary_id || "",
    summaryEn: event.summary_en || "",
    supportingRecords: Array.isArray(event.supporting_records)
      ? event.supporting_records.map((record) => ({
          kind: "supporting",
          claimType: record.claim_type || "",
          eventId: record.event_id || "",
          headline: record.headline || "",
          mediaType: record.media_type || "",
          mediaUrl: record.media_url || "",
          sourceDate: record.source_date || "",
          sourceName: record.source_name || "",
          sourceUrl: record.source_url || "",
        }))
      : [],
  };
}

function normalizeQualitativeState(entry) {
  return {
    adminCode: entry.admin_code || "",
    adminLevel: entry.admin_level || "",
    featuredEventId: entry.featured_event_id || "",
    geographyPeriodId: entry.geography_period_id || "",
    periodStart: entry.period_start || "",
    periodEnd: entry.period_end || "",
    publicState: entry.public_state || "",
    reviewStatusRollup: entry.review_status_rollup || "",
    reviewedAt: entry.reviewed_at || "",
    supportingEventCount: Number(entry.supporting_event_count || 0),
  };
}

function normalizeRegencyIndex(rawIndex) {
  const rows = Array.isArray(rawIndex)
    ? rawIndex
    : Object.entries(rawIndex || {}).map(([adminCode, entry]) => ({
        admin_code: adminCode,
        admin_level: "regency",
        province_code: adminCode.split(".")[0] || "",
        slug: entry.slug || "",
        events_path: entry.events_path || "",
        states_path: entry.states_path || "",
        updated_at: entry.updated_at || "",
        public_state_summary: entry.public_state_summary || "",
      }));

  return rows
    .filter((entry) => entry?.admin_code)
    .map((entry) => ({
      adminCode: entry.admin_code,
      adminLevel: entry.admin_level || "regency",
      provinceCode: entry.province_code || entry.admin_code.split(".")[0] || "",
      slug: entry.slug || "",
      eventsPath: normalizeAssetPath(entry.events_path || ""),
      statesPath: normalizeAssetPath(entry.states_path || ""),
      updatedAt: entry.updated_at || "",
      publicStateSummary: entry.public_state_summary || "",
    }));
}

async function loadQualitativeStore() {
  const store = createEmptyQualitativeStore();
  const config = normalizeQualitativeConfig();
  store.config = config;

  try {
    const globalEvents = await loadJson(`./data/latest/${config.globalEventsPath}`);
    store.global.events = Array.isArray(globalEvents) ? globalEvents.map(normalizeQualitativeEvent) : [];
  } catch (error) {
    console.warn("Global qualitative events were not available", error);
  }

  try {
    const globalStates = await loadJson(`./data/latest/${config.globalStatesPath}`);
    store.global.states = Array.isArray(globalStates) ? globalStates.map(normalizeQualitativeState) : [];
  } catch (error) {
    console.warn("Global qualitative states were not available", error);
  }

  try {
    const regencyIndex = await loadJson(`./data/latest/${config.regencyIndexPath}`);
    normalizeRegencyIndex(regencyIndex).forEach((entry) => {
      store.regencyIndexByCode.set(entry.adminCode, entry);
      if (entry.slug) store.regencyIndexBySlug.set(entry.slug, entry);
    });
  } catch (error) {
    console.warn("Regency qualitative index was not available", error);
  }

  return store;
}

async function loadRegencyQualitativeBundle(adminCode) {
  const store = state.qualitativeStore;
  if (!store?.regencyIndexByCode.has(adminCode)) return null;
  if (store.regencyBundleCache.has(adminCode)) {
    return store.regencyBundleCache.get(adminCode);
  }

  const entry = store.regencyIndexByCode.get(adminCode);
  try {
    const [events, states] = await Promise.all([
      loadJson(`./data/latest/${entry.eventsPath}`),
      loadJson(`./data/latest/${entry.statesPath}`),
    ]);
    const bundle = {
      entry,
      events: Array.isArray(events) ? events.map(normalizeQualitativeEvent) : [],
      states: Array.isArray(states) ? states.map(normalizeQualitativeState) : [],
    };
    store.regencyBundleCache.set(adminCode, bundle);
    return bundle;
  } catch (error) {
    console.warn("Failed to load regency qualitative bundle", adminCode, error);
    store.regencyBundleCache.set(adminCode, null);
    return null;
  }
}

function monthTokenForDate(dateValue) {
  return typeof dateValue === "string" ? dateValue.slice(0, 7) : "";
}

function monthInActiveRange(month) {
  if (!month) return false;
  if (state.currentDateFrom && month < state.currentDateFrom) return false;
  if (state.currentDateTo && month > state.currentDateTo) return false;
  return true;
}

function sortQualitativeEvents(left, right) {
  if ((right.mediaUrl ? 1 : 0) !== (left.mediaUrl ? 1 : 0)) {
    return (right.mediaUrl ? 1 : 0) - (left.mediaUrl ? 1 : 0);
  }
  if (right.eventDate !== left.eventDate) {
    return (right.eventDate || "").localeCompare(left.eventDate || "");
  }
  return (right.eventId || "").localeCompare(left.eventId || "");
}

function sortQualitativeStates(left, right) {
  if (right.periodStart !== left.periodStart) {
    return (right.periodStart || "").localeCompare(left.periodStart || "");
  }
  return (right.reviewedAt || "").localeCompare(left.reviewedAt || "");
}

function humanizeClaimType(claimType) {
  if (!claimType) return "";
  return claimType.replaceAll("_", " ");
}

function summarizeStateForDisplay(publicState) {
  if (!publicState) return "";
  return t(`qualitative.state.${publicState}`);
}

function describeStateForDisplay(publicState) {
  if (!publicState) return "";
  return t(`qualitative.state_note.${publicState}`);
}

function emptyMessageForQualitative(publicState) {
  if (publicState === "not_reviewed_yet") return t("qualitative.empty.not_reviewed_yet");
  if (publicState === "reviewed_but_no_publishable_report") {
    return t("qualitative.empty.reviewed_but_no_publishable_report");
  }
  return t("qualitative.empty.none_available");
}

function createRelatedRecordItems(events) {
  const items = [];
  events.slice(1).forEach((event) => {
    items.push({
      kind: "event",
      badgeKey: "qualitative.additional_label",
      eventId: event.eventId,
      headline: event.headline,
      mediaType: event.mediaType,
      mediaUrl: event.mediaUrl,
      sourceDate: event.eventDate,
      sourceName: event.sourceName,
      sourceUrl: event.sourceUrl,
      summaryId: event.summaryId,
      summaryEn: event.summaryEn,
      locationLabel: event.locationLabel,
      impactTags: event.impactTags,
      claimType: event.claimType,
    });
  });
  events.forEach((event) => {
    event.supportingRecords.forEach((record) => {
      items.push({
        kind: "supporting",
        badgeKey: "qualitative.supporting_label",
        eventId: record.eventId,
        headline: record.headline,
        mediaType: record.mediaType,
        mediaUrl: record.mediaUrl,
        sourceDate: record.sourceDate,
        sourceName: record.sourceName,
        sourceUrl: record.sourceUrl,
        summaryId: "",
        summaryEn: "",
        locationLabel: event.locationLabel,
        impactTags: [],
        claimType: record.claimType,
      });
    });
  });
  return items.sort((left, right) => (right.sourceDate || "").localeCompare(left.sourceDate || ""));
}

function deriveRangeState(events, states, relatedCount) {
  if (events.length) {
    return relatedCount > 0 ? "has_featured_report_and_more" : "has_featured_report_only";
  }
  if (!states.length) return "";
  return states[0].publicState || "";
}

function buildQualitativeSummary(events, states, sourceMeta = {}) {
  const sortedEvents = [...events].sort(sortQualitativeEvents);
  const sortedStates = [...states].sort(sortQualitativeStates);
  const relatedItems = createRelatedRecordItems(sortedEvents);
  const featuredEvent = sortedEvents[0] || null;
  const publicState = deriveRangeState(sortedEvents, sortedStates, relatedItems.length);

  return {
    hasData: Boolean(sortedEvents.length || sortedStates.length || sourceMeta.indexEntry),
    featuredEvent,
    relatedItems,
    publicState,
    stateNote: describeStateForDisplay(publicState),
    stateLabel: summarizeStateForDisplay(publicState),
    displayWindow:
      state.currentDateFrom && state.currentDateTo && state.currentDateFrom !== state.currentDateTo
        ? `${formatMonthLabel(state.currentDateFrom)} – ${formatMonthLabel(state.currentDateTo)}`
        : state.currentDateFrom
          ? formatMonthLabel(state.currentDateFrom)
          : t("selection.all_time"),
    sourceMeta,
  };
}

function parseYouTubeEmbedUrl(url) {
  if (!url) return "";
  try {
    const parsed = new URL(url, window.location.origin);
    const host = parsed.hostname.replace(/^www\./, "");
    let videoId = "";

    if (host === "youtu.be") {
      videoId = parsed.pathname.split("/").filter(Boolean)[0] || "";
    } else if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
      if (parsed.pathname === "/watch") {
        videoId = parsed.searchParams.get("v") || "";
      } else if (parsed.pathname.startsWith("/embed/")) {
        videoId = parsed.pathname.split("/")[2] || "";
      } else if (parsed.pathname.startsWith("/shorts/") || parsed.pathname.startsWith("/live/")) {
        videoId = parsed.pathname.split("/")[2] || "";
      }
    }

    if (!videoId) return "";
    return `https://www.youtube-nocookie.com/embed/${videoId}`;
  } catch {
    return "";
  }
}

function looksLikeImageUrl(url) {
  if (!url) return false;
  try {
    const parsed = new URL(url, window.location.origin);
    return /\.(avif|gif|jpe?g|png|webp)$/i.test(parsed.pathname);
  } catch {
    return /\.(avif|gif|jpe?g|png|webp)$/i.test(url);
  }
}

function normalizeMediaCandidate(mediaType, mediaUrl, sourceUrl = "") {
  const youtubeEmbedUrl = parseYouTubeEmbedUrl(mediaUrl) || parseYouTubeEmbedUrl(sourceUrl);
  if (youtubeEmbedUrl) {
    return { kind: "video", url: youtubeEmbedUrl };
  }

  if (!mediaUrl) {
    return { kind: "", url: "" };
  }

  if (mediaType === "video") {
    return { kind: "link", url: mediaUrl };
  }

  if (looksLikeImageUrl(mediaUrl)) {
    return { kind: "image", url: mediaUrl };
  }

  if (mediaType === "article" || mediaType === "report" || mediaType === "post") {
    return { kind: "link", url: sourceUrl || mediaUrl };
  }

  return { kind: "link", url: sourceUrl || mediaUrl };
}

function resolveQualitativeMedia(event) {
  if (!event) return { kind: "", url: "" };

  const primaryCandidate = normalizeMediaCandidate(event.mediaType, event.mediaUrl, event.sourceUrl);
  if (primaryCandidate.kind === "video") return primaryCandidate;

  const supportingRecords = Array.isArray(event.supportingRecords) ? event.supportingRecords : [];
  const supportingCandidates = supportingRecords
    .map((record) => normalizeMediaCandidate(record.mediaType, record.mediaUrl, record.sourceUrl))
    .filter((candidate) => candidate.url);

  const supportingVideo = supportingCandidates.find((candidate) => candidate.kind === "video");
  if (supportingVideo) return supportingVideo;

  if (primaryCandidate.url) return primaryCandidate;
  return supportingCandidates[0] || { kind: "", url: "" };
}

async function getQualitativeSummaryForGeography(level, code) {
  if (!level || !code || !state.qualitativeStore?.config?.supportedLevels?.includes(level)) {
    return { hasData: false, featuredEvent: null, relatedItems: [], publicState: "", stateNote: "", stateLabel: "", displayWindow: "", sourceMeta: {} };
  }

  let events = state.qualitativeStore.global.events.filter(
    (event) => event.adminLevel === level && event.adminCode === code && monthInActiveRange(monthTokenForDate(event.eventDate))
  );
  let states = state.qualitativeStore.global.states.filter((entry) => {
    if (entry.adminLevel !== level || entry.adminCode !== code) return false;
    return monthInActiveRange(monthTokenForDate(entry.periodStart)) || monthInActiveRange(monthTokenForDate(entry.periodEnd));
  });

  const sourceMeta = {
    indexEntry: null,
    bundleLoaded: false,
  };

  if (level === "regency") {
    sourceMeta.indexEntry = state.qualitativeStore.regencyIndexByCode.get(code) || null;
    if (sourceMeta.indexEntry) {
      const bundle = await loadRegencyQualitativeBundle(code);
      if (bundle) {
        sourceMeta.bundleLoaded = true;
        events = bundle.events.filter(
          (event) => event.adminCode === code && monthInActiveRange(monthTokenForDate(event.eventDate))
        );
        states = bundle.states.filter((entry) => {
          if (entry.adminCode !== code) return false;
          return monthInActiveRange(monthTokenForDate(entry.periodStart)) || monthInActiveRange(monthTokenForDate(entry.periodEnd));
        });
      }
    }
  }

  return buildQualitativeSummary(events, states, sourceMeta);
}

function buildQualitativeMedia(node, media, altText) {
  node.innerHTML = "";
  if (!media?.url) {
    node.classList.add("is-hidden");
    return;
  }

  if (media.kind === "link") {
    const anchor = document.createElement("a");
    anchor.href = media.url;
    anchor.target = "_blank";
    anchor.rel = "noreferrer";
    anchor.className = "source-link";
    anchor.textContent = t("qualitative.open_media");
    node.append(anchor);
  } else if (media.kind === "video") {
    const iframe = document.createElement("iframe");
    iframe.src = media.url;
    iframe.className = "qualitative-video";
    iframe.title = altText || "Qualitative report video";
    iframe.loading = "lazy";
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    iframe.setAttribute("allowfullscreen", "true");
    iframe.setAttribute("frameborder", "0");
    iframe.setAttribute(
      "allow",
      "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
    );
    node.append(iframe);
  } else {
    const image = document.createElement("img");
    image.src = media.url;
    image.alt = altText || "Qualitative report media";
    image.className = "qualitative-image";
    node.append(image);
  }

  node.classList.remove("is-hidden");
}

function populateTagContainer(node, tags) {
  node.innerHTML = "";
  const normalizedTags = Array.isArray(tags) ? tags.filter(Boolean) : [];
  node.classList.toggle("is-hidden", normalizedTags.length === 0);
  normalizedTags.forEach((tag) => {
    const pill = document.createElement("span");
    pill.className = "tag-pill";
    pill.textContent = humanizeClaimType(tag);
    node.append(pill);
  });
}

function createQualitativeRelatedItem(item) {
  const article = document.createElement("article");
  article.className = "qualitative-related-item";

  const topline = document.createElement("div");
  topline.className = "qualitative-related-topline";

  const badge = document.createElement("span");
  badge.className = "period-badge";
  badge.textContent = t(item.badgeKey);
  topline.append(badge);

  if (item.sourceDate) {
    const date = document.createElement("span");
    date.className = "qualitative-related-date";
    date.textContent = formatFullDateLabel(item.sourceDate);
    topline.append(date);
  }

  const headline = document.createElement("strong");
  headline.className = "qualitative-related-headline";
  headline.textContent = item.headline || item.locationLabel || item.eventId;

  const meta = document.createElement("p");
  meta.className = "text-muted qualitative-related-meta";
  meta.textContent = [item.sourceName, humanizeClaimType(item.claimType)].filter(Boolean).join(" · ");

  article.append(topline, headline, meta);

  const summaryText =
    state.language === "id" ? item.summaryId || item.summaryEn : item.summaryEn || item.summaryId;
  if (summaryText) {
    const summary = document.createElement("p");
    summary.className = "qualitative-related-summary";
    summary.textContent = summaryText;
    article.append(summary);
  }

  if (item.sourceUrl) {
    const link = document.createElement("a");
    link.href = item.sourceUrl;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.className = "source-link";
    link.textContent = t("qualitative.source");
    article.append(link);
  }

  return article;
}

function setQualitativeRouteOpen(nextValue) {
  state.qualitativeRouteOpen = Boolean(nextValue && state.currentLevel === "regency" && state.selectedCode);
}

function queueQualitativeSidebarFocus() {
  state.qualitativeSidebarFocusPending = true;
}

function focusQualitativeSidebarSection() {
  if (!qualitativeSection) return;
  if (state.sidebarCollapsed) {
    setSidebarCollapsed(false);
  }
  requestAnimationFrame(() => {
    qualitativeSection.scrollIntoView({
      block: "start",
      behavior: mobileViewport.matches ? "auto" : "smooth",
    });
  });
}

function buildRouteUrl() {
  const url = new URL(window.location.href);
  url.search = "";
  if (state.language && state.language !== (state.manifest?.default_language || "id")) {
    url.searchParams.set("lang", state.language);
  }
  if (state.currentLevel && state.currentLevel !== (state.manifest?.default_level || "province")) {
    url.searchParams.set("level", state.currentLevel);
  }
  if (state.selectedCode) {
    url.searchParams.set("code", state.selectedCode);
  }
  if (state.currentDateFrom) {
    url.searchParams.set("from", state.currentDateFrom);
  }
  if (state.currentDateTo) {
    url.searchParams.set("to", state.currentDateTo);
  }
  if (state.qualitativeRouteOpen) {
    url.searchParams.set("view", "qualitative");
  }
  return url;
}

function syncRouteState({ replace = false } = {}) {
  if (state.suppressRouteSync) return;
  const url = buildRouteUrl();
  const next = `${url.pathname}${url.search}${url.hash}`;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (next === current) return;
  const method = replace ? "replaceState" : "pushState";
  window.history[method]({}, "", next);
}

function applyRouteStateFromUrl() {
  const url = new URL(window.location.href);
  const requestedLanguage = url.searchParams.get("lang");
  const requestedLevel = url.searchParams.get("level");
  const requestedCode = url.searchParams.get("code");
  const requestedFrom = url.searchParams.get("from");
  const requestedTo = url.searchParams.get("to");
  const requestedView = url.searchParams.get("view");

  state.currentLevel = state.manifest?.default_level || state.currentLevel;
  state.selectedCode = null;
  state.selectedFeature = null;
  state.currentDateFrom = "";
  state.currentDateTo = "";
  state.qualitativeRouteOpen = false;
  state.qualitativeSidebarFocusPending = false;

  if (requestedLanguage && state.translations.has(requestedLanguage)) {
    state.language = requestedLanguage;
  } else {
    state.language = state.manifest?.default_language || state.language;
  }

  if (requestedLevel && state.manifest?.available_levels?.includes(requestedLevel)) {
    state.currentLevel = requestedLevel;
  }
  if (requestedCode) {
    state.selectedCode = requestedCode;
    state.selectedFeature = null;
    state.pendingFit = "selection";
  }
  if (requestedFrom) state.currentDateFrom = requestedFrom;
  if (requestedTo) state.currentDateTo = requestedTo;

  if (requestedView === "qualitative" && state.currentLevel === "regency" && state.selectedCode) {
    state.qualitativeRouteOpen = true;
    state.qualitativeSidebarFocusPending = true;
  }
}

function formatFullDateLabel(monthStart) {
  if (!monthStart) return "—";
  const date = new Date(monthStart);
  const locale = state.language === "id" ? "id-ID" : "en-US";
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatTrendAxisLabel(monthStart, index, total) {
  if (!monthStart) return "";
  const year = monthStart.slice(0, 4);
  const step = Math.max(1, Math.ceil(total / 6));
  if (index === 0 || index === total - 1 || index % step === 0) {
    return year;
  }
  return "";
}

function levelLabelForEvidence() {
  return t(`level.${state.currentLevel}`).toLowerCase();
}

function buildEvidenceExplanation(bundle) {
  const { gap_signal: gapSignal, internal_score: internalScore, external_score: externalScore } = bundle.signals;
  if (gapSignal !== "mixed") {
    return t(`evidence.gap.note.${gapSignal}`);
  }
  const directionKey = internalScore >= externalScore ? "internal_higher" : "external_higher";
  return t(`evidence.gap.note.mixed.${directionKey}`);
}

function buildEvidenceSourceTooltip(bundle) {
  const sourceLabel = state.language === "id" ? bundle.source_label_id : bundle.source_label_en;
  const vintage = state.language === "id" ? bundle.source_vintage_id : bundle.source_vintage_en;
  const resolution = state.language === "id" ? bundle.source_resolution_id : bundle.source_resolution_en;
  return [sourceLabel, vintage, resolution].filter(Boolean).join("\n");
}

/* ─── Boot ─── */
async function boot() {
  await loadTranslations();
  await loadManifest();
  initControls();
  initSidebar();
  initTimeline();
  initPlayButton();
  initQualitativeRoute();
  applyRouteStateFromUrl();
  if (levelSelect) levelSelect.value = state.currentLevel;
  if (metricSelect) metricSelect.value = state.currentMetric;
  syncCustomSelectValues();
  applyTranslations();
  initMap();
}

async function loadTranslations() {
  const [id, en] = await Promise.all([
    loadJson(`./translations/id.json?v=${APP_ASSET_VERSION}`),
    loadJson(`./translations/en.json?v=${APP_ASSET_VERSION}`),
  ]);
  state.translations.set("id", id);
  state.translations.set("en", en);
}

async function loadManifest() {
  state.manifest = await loadJson("./data/latest/build_manifest.json");
  state.coverageReport = await loadJson(`./data/latest/${state.manifest.coverage_report}`);
  state.methodology = await loadJson(`./data/latest/${state.manifest.methodology}`);
  state.searchIndex = await loadJson(`./data/latest/${state.manifest.search_index}`);
  state.language = state.manifest.default_language || state.language;
  state.qualitativeStore = await loadQualitativeStore();
  state.evidenceIndex = null;
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
let timelineRenderTimeout = null;

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

function scheduleTimelineRender(immediate = false) {
  if (timelineRenderTimeout) {
    window.clearTimeout(timelineRenderTimeout);
    timelineRenderTimeout = null;
  }
  const run = () => {
    timelineRenderTimeout = null;
    void renderExplorer();
    syncRouteState();
  };
  if (immediate) {
    run();
    return;
  }
  timelineRenderTimeout = window.setTimeout(run, 80);
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

function initQualitativeRoute() {
  window.addEventListener("popstate", async () => {
    state.suppressRouteSync = true;
    applyRouteStateFromUrl();
    if (levelSelect) levelSelect.value = state.currentLevel;
    syncCustomSelectValues();
    document.querySelectorAll(".lang-btn").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.language === state.language);
    });
    applyTranslations();
    syncTimelineSliders();
    await renderExplorer();
    state.suppressRouteSync = false;
  });

  mobileViewport.addEventListener("change", async () => {
    state.suppressRouteSync = true;
    if (mobileViewport.matches) {
      setQualitativeRouteOpen(false);
    } else if (state.currentLevel === "regency" && state.selectedCode) {
      setQualitativeRouteOpen(true);
    }
    await renderExplorer();
    syncRouteState({ replace: true });
    state.suppressRouteSync = false;
  });
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
      scheduleTimelineRender();
    }
  });

  dateFromInput.addEventListener("change", async () => {
    scheduleTimelineRender(true);
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
      scheduleTimelineRender();
    }
  });

  dateToInput.addEventListener("change", async () => {
    scheduleTimelineRender(true);
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
    button.classList.toggle("is-active", button.dataset.language === state.language);
    button.addEventListener("click", async () => {
      state.language = button.dataset.language;
      document.querySelectorAll(".lang-btn").forEach((item) =>
        item.classList.toggle("is-active", item === button)
      );
      applyTranslations();
      await renderExplorer();
      syncRouteState();
    });
  });

  levelSelect.addEventListener("change", async () => {
    state.currentLevel = levelSelect.value;
    state.selectedCode = null;
    state.selectedFeature = null;
    state.pendingFit = "level";
    if (state.currentLevel !== "regency") {
      setQualitativeRouteOpen(false);
    }
    syncTimelineSliders();
    await renderExplorer();
    syncRouteState();
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
    setQualitativeRouteOpen(false);
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
    syncRouteState();
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
  if (trendSectionTitle) {
    trendSectionTitle.textContent = t("panel.trends");
  }
  if (evidenceSectionTitle) {
    evidenceSectionTitle.textContent = t("panel.evidence");
  }
  if (state.selectedCode) {
    void renderQualitativeData(state.selectedCode, state.renderVersion);
  }
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

async function ensureEvidenceIndex() {
  if (state.evidenceIndex) return state.evidenceIndex;
  if (!state.manifest?.evidence_available || !state.manifest?.evidence_index) {
    state.evidenceIndex = { generated_at: null, levels: {} };
    return state.evidenceIndex;
  }
  try {
    state.evidenceIndex = await loadJson(`./data/latest/${state.manifest.evidence_index}`);
  } catch {
    state.evidenceIndex = { generated_at: null, levels: {} };
  }
  return state.evidenceIndex;
}

function getEvidenceEntry(level, code) {
  return state.evidenceIndex?.levels?.[level]?.[code] || null;
}

function activeRangeIsSingleMonth() {
  return Boolean(state.currentDateFrom && state.currentDateTo && state.currentDateFrom === state.currentDateTo);
}

function resolveEvidenceMonthEntry(level, code) {
  const entry = getEvidenceEntry(level, code);
  if (!entry?.months?.length) return null;

  if (activeRangeIsSingleMonth()) {
    return entry.months.find((item) => item.month === state.currentDateFrom) || null;
  }

  const inWindow = entry.months.filter((item) => {
    if (state.currentDateFrom && item.month < state.currentDateFrom) return false;
    if (state.currentDateTo && item.month > state.currentDateTo) return false;
    return true;
  });
  if (!inWindow.length) return null;
  return [...inWindow].sort((left, right) => {
    if ((right.internal_score || 0) !== (left.internal_score || 0)) {
      return (right.internal_score || 0) - (left.internal_score || 0);
    }
    return right.month.localeCompare(left.month);
  })[0];
}

async function loadEvidenceBundle(relativePath) {
  if (!relativePath) return null;
  if (!state.evidenceCache.has(relativePath)) {
    const bundle = await loadJson(`./data/latest/${relativePath}`);
    state.evidenceCache.set(relativePath, bundle);
  }
  return state.evidenceCache.get(relativePath);
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
    await commitSelection({
      level: state.currentLevel,
      code: feature.properties.code,
      feature,
    });
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
  if (state.selectedCode) {
    state.selectedFeature =
      state.currentGeojsonData.features.find((feature) => feature.properties.code === state.selectedCode) || null;
  }

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

async function commitSelection({ level = state.currentLevel, code = null, feature = null } = {}) {
  const previousLevel = state.currentLevel;
  const previousCode = state.selectedCode;
  state.currentLevel = level;
  if (levelSelect) levelSelect.value = level;
  state.selectedCode = code;
  state.selectedFeature = feature?.properties?.code === code ? feature : null;
  state.pendingFit = code ? "selection" : "level";
  if (level !== "regency" || !code) {
    setQualitativeRouteOpen(false);
  } else if (level !== previousLevel || code !== previousCode) {
    queueQualitativeSidebarFocus();
  }
  syncTimelineSliders();
  await renderExplorer();
  syncRouteState();
}

/* ─── Selection + Trend ─── */
async function renderSelection(renderVersion) {
  const boundaryData = await getBoundaryData(state.currentLevel);
  if (renderVersion !== state.renderVersion) return;
  const featureFromCode = state.selectedCode
    ? state.currentGeojsonData?.features?.find((item) => item.properties.code === state.selectedCode) ||
      boundaryData.features.find((item) => item.properties.code === state.selectedCode) ||
      null
    : null;
  const feature =
    featureFromCode ||
    (state.selectedFeature?.properties?.code === state.selectedCode ? state.selectedFeature : null);

  state.selectedFeature = feature;

  if (!feature) {
    selectionEmpty.classList.remove("is-hidden");
    selectionDetails.classList.add("is-hidden");
    await renderTrendChart(null, renderVersion);
    await renderEvidence(null, renderVersion);
    await renderQualitativeData(state.selectedCode, renderVersion, null);
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
  await ensureEvidenceIndex();
  if (renderVersion !== state.renderVersion) return;
  const evidenceMonthEntry = resolveEvidenceMonthEntry(state.currentLevel, feature.properties.code);
  const highlightedMonth = activeRangeIsSingleMonth()
    ? state.currentDateFrom
    : evidenceMonthEntry?.month || null;
  await renderTrendChart(feature.properties.code, renderVersion, highlightedMonth);
  await renderEvidence(feature.properties.code, renderVersion, evidenceMonthEntry);
  await renderQualitativeData(feature.properties.code, renderVersion, feature);
}

function renderQualitativeSidebar(summary, feature, code) {
  if (!qualitativeSection) return;

  const shouldShowSection = Boolean(
    code && state.qualitativeStore?.config?.supportedLevels?.includes(state.currentLevel)
  );
  qualitativeSection.classList.toggle("is-hidden", !shouldShowSection);
  if (!shouldShowSection) {
    qualitativeEmpty.classList.remove("is-hidden");
    qualitativePanel.classList.add("is-hidden");
    return;
  }

  const selectionLabel = feature?.properties?.name || state.adminByCode.get(code)?.name || code || "—";

  qualitativeStateBadge.textContent = summary.stateLabel || "";
  qualitativeStateBadge.classList.toggle("is-hidden", !summary.stateLabel);
  qualitativePeriod.textContent = summary.displayWindow;
  qualitativeStateNote.textContent = summary.stateNote || "";
  qualitativeStateNote.classList.toggle("is-hidden", !summary.stateNote);

  if (!summary.featuredEvent) {
    qualitativeEmpty.textContent = emptyMessageForQualitative(summary.publicState);
    qualitativeEmpty.classList.remove("is-hidden");
    qualitativePanel.classList.add("is-hidden");
    return;
  }

  const event = summary.featuredEvent;
  const summaryText = state.language === "id" ? event.summaryId || event.summaryEn : event.summaryEn || event.summaryId;
  const media = resolveQualitativeMedia(event);

  qualitativeEmpty.classList.add("is-hidden");
  qualitativePanel.classList.remove("is-hidden");
  qualitativeDate.textContent = formatFullDateLabel(event.eventDate);
  qualitativeLocation.textContent = event.locationLabel || selectionLabel;
  qualitativeHeadline.textContent = event.headline || selectionLabel;
  qualitativeSummary.textContent = summaryText || "";
  qualitativeSourceName.textContent = event.sourceName || "";
  qualitativeSourceName.classList.toggle("is-hidden", !event.sourceName);
  buildQualitativeMedia(qualitativeMedia, media, event.headline || selectionLabel);
  populateTagContainer(qualitativeTags, event.impactTags);

  if (event.sourceUrl) {
    qualitativeSourceLink.href = event.sourceUrl;
    qualitativeSourceLink.classList.remove("is-hidden");
  } else {
    qualitativeSourceLink.removeAttribute("href");
    qualitativeSourceLink.classList.add("is-hidden");
  }

  qualitativeRelatedList.innerHTML = "";
  qualitativeRelatedCount.textContent = String(summary.relatedItems.length);
  qualitativeRelatedSection.classList.toggle("is-hidden", summary.relatedItems.length === 0);
  summary.relatedItems.forEach((item) => qualitativeRelatedList.append(createQualitativeRelatedItem(item)));
}

function syncQualitativeSidebarPresentation(summary, code) {
  document.body.classList.remove("qualitative-route-active");
  const shouldFocus =
    state.qualitativeSidebarFocusPending &&
    state.currentLevel === "regency" &&
    Boolean(code) &&
    (state.qualitativeRouteOpen || summary.hasData);
  if (!shouldFocus) return;
  focusQualitativeSidebarSection();
  state.qualitativeSidebarFocusPending = false;
}

async function renderQualitativeData(code, renderVersion, feature = null) {
  if (renderVersion !== state.renderVersion) return;

  const summary =
    code && state.currentLevel
      ? await getQualitativeSummaryForGeography(state.currentLevel, code)
      : {
          hasData: false,
          featuredEvent: null,
          relatedItems: [],
          publicState: "",
          stateNote: "",
          stateLabel: "",
          displayWindow: "",
          sourceMeta: {},
        };
  if (renderVersion !== state.renderVersion) return;

  renderQualitativeSidebar(summary, feature, code);
  syncQualitativeSidebarPresentation(summary, code);
}

async function renderTrendChart(code, renderVersion, highlightedMonth = null) {
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
    plugins: [TREND_HIGHLIGHT_PLUGIN],
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
          callbacks: {
            title(items) {
              return formatFullDateLabel(items?.[0]?.label);
            },
          },
        },
        trendHighlight: {
          highlightedMonth,
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
            callback(value, index) {
              return formatTrendAxisLabel(this.getLabelForValue(value), index, rows.length);
            },
          },
          grid: { color: "rgba(120, 90, 50, 0.06)" },
          border: { display: false },
        },
        y: {
          title: {
            display: true,
            text: t(`metric.${state.currentMetric}`),
            color: "#7b6d5f",
            font: { family: "Inter", size: 11, weight: "600" },
          },
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

function setEvidenceEmpty(messageKey) {
  evidenceEmpty.textContent = t(messageKey);
  evidenceEmpty.classList.remove("is-hidden");
  evidencePanel.classList.add("is-hidden");
}

async function renderEvidence(code, renderVersion, monthEntryOverride = null) {
  if (!code || !state.manifest.evidence_available) {
    setEvidenceEmpty("evidence.none_selected");
    return;
  }

  const monthEntry = monthEntryOverride || resolveEvidenceMonthEntry(state.currentLevel, code);
  if (!monthEntry) {
    setEvidenceEmpty("evidence.none_available");
    return;
  }

  let bundle = null;
  try {
    bundle = await loadEvidenceBundle(monthEntry.path);
  } catch (error) {
    console.warn("Failed to load evidence bundle", monthEntry.path, error);
    setEvidenceEmpty("evidence.none_available");
    return;
  }
  if (renderVersion !== state.renderVersion || !bundle) return;

  evidenceEmpty.classList.add("is-hidden");
  evidencePanel.classList.remove("is-hidden");

  evidenceMonth.textContent = formatMonthLabel(bundle.month);
  evidenceGapSignal.textContent = t(`evidence.gap.${bundle.signals.gap_signal}`);
  evidenceGapSignal.className = `evidence-gap-signal evidence-gap-signal--${bundle.signals.gap_signal}`;

  const inSingleMonth = activeRangeIsSingleMonth();
  if (!inSingleMonth && evidenceWindowNote) {
    evidenceWindowNote.textContent = formatTemplate("evidence.window_note", {
      month: formatMonthLabel(bundle.month),
    });
    evidenceWindowNote.classList.remove("is-hidden");
  } else if (evidenceWindowNote) {
    evidenceWindowNote.classList.add("is-hidden");
    evidenceWindowNote.textContent = "";
  }

  evidenceNote.textContent = buildEvidenceExplanation(bundle);
  evidenceGapContext.textContent = formatTemplate("evidence.gap.context", {
    gap: formatMetric(bundle.gap_magnitude),
    baseline: formatMetric(bundle.baseline_gap),
    level_label: levelLabelForEvidence(),
  });
  evidenceInternalScore.textContent = formatMetric(bundle.signals.internal_score);
  evidenceSourceLabel.textContent = state.language === "id" ? bundle.source_label_id : bundle.source_label_en;
  evidenceSourceInfo.title = buildEvidenceSourceTooltip(bundle);
  evidenceSourceInfo.setAttribute("aria-label", t("evidence.source_info_aria"));
  evidenceExternalScore.textContent = formatMetric(bundle.signals.external_score);
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
      searchInput.value = match.name;
      searchResults.innerHTML = "";
      await commitSelection({
        level: resolved.level,
        code: resolved.code,
      });
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
