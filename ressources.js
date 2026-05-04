/* =========================================================
   ressources.js — ressources + Prolongements et critiques
   ---------------------------------------------------------
   Données supportées :
   - ancien CSV : ID, voir_aussi
   - export Baserow : identifiant, prolongements_critiques_id,
     deja_la_prolongements_critiques_id

   Comportement :
   - multi-tags conservé ;
   - clic sur “Voir les ressources liées” sans rechargement ;
   - liens manuels réciproques reconstruits automatiquement ;
   - rapprochements automatiques par tags partagés ;
   - lecture de deja-la.csv pour les cartes déjà-là liées.
   ========================================================= */

const CSV_URL = "ressources.csv";
const DEJA_CSV_URL = "deja-la.csv";

const resourcesGrid = document.getElementById("resourcesGrid");
const searchInput = document.getElementById("searchInput");
const resourcesTags = document.getElementById("resourcesTags");
const relatedContent = document.getElementById("relatedContent");
const relatedSection = document.getElementById("prolongements-critiques");

let allResources = [];
let allDejaEntries = [];
let activeTags = new Set();

async function loadCSV(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Impossible de charger le fichier ${url}`);
  }

  const text = await response.text();
  return parseCSV(text);
}

function parseCSVRows(text) {
  const cleanText = text.replace(/^\uFEFF/, "");
  const rows = [];
  let row = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const next = cleanText[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ";" && !inQuotes) {
      row.push(current);
      current = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i++;
      row.push(current);
      if (row.some(cell => String(cell).trim() !== "")) rows.push(row);
      row = [];
      current = "";
    } else {
      current += char;
    }
  }

  row.push(current);
  if (row.some(cell => String(cell).trim() !== "")) rows.push(row);

  return rows;
}

function parseCSV(text) {
  const rows = parseCSVRows(text);

  if (rows.length < 2) {
    return [];
  }

  const headers = rows[0].map(h => h.trim());

  return rows.slice(1).map(values => {
    const row = {};

    headers.forEach((header, index) => {
      row[header] = (values[index] || "").trim();
    });

    return row;
  });
}

function parseResources(rows) {
  return rows
    .map(row => ({
      baserowId: row["id"] || "",
      id: row["identifiant"] || row["ID"] || row["id"] || "",
      statut: row["statut"] || "",
      titre: row["titre"] || "",
      type: normalizeType(row["type"] || ""),
      source: row["source"] || "",
      url: row["url"] || "",
      resume: row["resume"] || "",
      duree: row["duree"] || "",
      tags: parseListField(row["tags"] || ""),
      voir_aussi: parseListField(row["voir_aussi"] || ""),
      prolongementsCritiquesIds: parseListField(
        row["prolongements_critiques_id"] ||
        row["prolongement_critique"] ||
        row["prolongements_critiques_ids"] ||
        ""
      ),
      dejaLaIds: parseListField(
        row["deja_la_prolongements_critiques_id"] ||
        row["deja_la_prolongements_critiques_ids"] ||
        row["deja_la_lies"] ||
        ""
      ),
      notes: row["Notes"] || row["notes"] || ""
    }))
    .filter(resource => resource.titre || resource.url || resource.resume);
}

function parseDejaEntries(rows) {
  return rows
    .map(row => ({
      baserowId: row["id"] || "",
      id: row["identifiant"] || row["ID"] || row["id"] || "",
      statut: row["statut"] || "",
      section: normalizeSection(row["section"] || ""),
      nom: row["nom"] || row["titre"] || "",
      territoire: row["territoire"] || "",
      periode: row["periode"] || "",
      type: row["type"] || "",
      fait_quoi: row["fait_quoi"] || row["met_en_oeuvre"] || "",
      proche_de_la_ci: row["proche_de_la_ci"] || "",
      s_en_distingue: row["s_en_distingue"] || "",
      permet_de_penser: row["permet_de_penser"] || "",
      tags: parseListField(row["tags"] || ""),
      url: row["url"] || "",
      voir_aussi: parseListField(row["voir_aussi"] || ""),
      ressourcesProlongementsCritiquesIds: parseListField(
        row["ressources_prolongements_critiques_id"] ||
        row["ressources_prolongements_critiques_ids"] ||
        row["ressources_liees_ids"] ||
        ""
      ),
      notes: row["Notes"] || row["notes"] || "",
      ordre: Number(row["ordre"] || "999")
    }))
    .filter(entry => entry.nom || entry.url || entry.fait_quoi);
}

function parseListField(value) {
  if (!value) return [];

  return String(value)
    .split(/[|,]/)
    .map(item => item.trim())
    .filter(Boolean);
}

function uniqueList(items) {
  return Array.from(new Set(items.filter(Boolean)));
}

function normalizeTag(tag) {
  return String(tag || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_\s]+/g, "-");
}

function normalizeType(type) {
  return normalizeTag(type);
}

function normalizeSection(value) {
  const normalized = normalizeTag(value);

  const map = {
    "france-aujourdhui": "france-aujourdhui",
    "france_aujourdhui": "france-aujourdhui",
    "franceaujourdhui": "france-aujourdhui",
    "international": "international",
    "reperes-historiques": "reperes-historiques",
    "reperes_historiques": "reperes-historiques",
    "repereshistoriques": "reperes-historiques"
  };

  return map[normalized] || normalized;
}

function escapeHTML(text) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatTagLabel(tag) {
  const cleaned = normalizeTag(tag);

  const specialLabels = {
    "bernard-friot": "Bernard Friot",
    "securite-sociale": "Sécurité sociale",
    "cooperatives": "Coopératives",
    "cooperative": "Coopérative",
    "zapatiste": "Zapatiste",
    "international": "International",
    "video": "Vidéo",
    "audio": "Audio",
    "pdf": "PDF",
    "article": "Article",
    "site": "Site",
    "economie": "Économie",
    "autogestion": "Autogestion",
    "agriculture": "Agriculture",
    "autonomie": "Autonomie"
  };

  if (specialLabels[cleaned]) return specialLabels[cleaned];

  return cleaned
    .split("-")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function labelType(type) {
  const labels = {
    video: "Vidéo",
    audio: "Audio",
    pdf: "PDF",
    article: "Article",
    site: "Site"
  };

  return labels[type] || "Ressource";
}

function hasPublicSource(source) {
  const cleaned = normalizeTag(source || "");
  return cleaned !== "" && cleaned !== "a preciser" && cleaned !== "a préciser";
}

function renderSourceHTML(source) {
  if (!hasPublicSource(source)) {
    return "";
  }

  return `<p class="resource-source">Source : ${escapeHTML(source)}</p>`;
}

function getYouTubeThumbnail(url) {
  try {
    const parsed = new URL(url);

    if (parsed.hostname.includes("youtube.com")) {
      const videoId = parsed.searchParams.get("v");
      if (videoId) {
        return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
      }
    }

    if (parsed.hostname === "youtu.be") {
      const videoId = parsed.pathname.replace("/", "");
      if (videoId) {
        return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
      }
    }
  } catch (error) {
    return "";
  }

  return "";
}

function getResourceById(id) {
  return allResources.find(resource => resource.id === id);
}

function getDejaById(id) {
  return allDejaEntries.find(entry => entry.id === id);
}

function buildSeeAlsoHTML(resource) {
  if (!resource.voir_aussi || resource.voir_aussi.length === 0) {
    return "";
  }

  const items = resource.voir_aussi.map(item => {
    const trimmed = item.trim();

    if (/^https?:\/\//i.test(trimmed)) {
      return `<a class="resource-related-link" href="${escapeHTML(trimmed)}" target="_blank" rel="noopener noreferrer">Voir aussi</a>`;
    }

    if (trimmed.startsWith("deja-la:")) {
      const target = trimmed.replace("deja-la:", "").trim();
      return `<a class="resource-related-link" href="deja-la.html#${escapeHTML(target)}">Voir la carte liée dans Le déjà-là</a>`;
    }

    if (trimmed.startsWith("ressource:") || trimmed.startsWith("ressources:")) {
      const target = trimmed.split(":").slice(1).join(":").trim();
      return `<button class="resource-related-inline" type="button" data-resource-id="${escapeHTML(target)}">Voir la ressource liée</button>`;
    }

    if (trimmed.startsWith("tag:")) {
      const target = trimmed.replace("tag:", "").trim();
      return `<a class="resource-related-link" href="ressources.html?tag=${encodeURIComponent(normalizeTag(target))}">Voir les ressources liées par tag</a>`;
    }

    return `<a class="resource-related-link" href="ressources.html?tag=${encodeURIComponent(normalizeTag(trimmed))}">Voir les ressources liées par tag</a>`;
  });

  return `<div class="resource-related" style="margin-top:0.75rem;">${items.join("<br>")}</div>`;
}

function createCard(resource) {
  const article = document.createElement("article");
  article.className = "resource-card";
  article.dataset.id = resource.id || "";
  article.dataset.tags = resource.tags.map(normalizeTag).join(" ");
  article.id = resource.id || "";

  const tagsHTML = resource.tags
    .map(tag => `<span class="resource-tag">${escapeHTML(formatTagLabel(tag))}</span>`)
    .join("");

  const thumbnail = getYouTubeThumbnail(resource.url);
  const thumbHTML = thumbnail
    ? `<img class="resource-thumb-image" src="${escapeHTML(thumbnail)}" alt="Miniature de la ressource">`
    : `<div class="resource-thumb-text">${escapeHTML(resource.titre || "Sans titre")}</div>`;

  article.innerHTML = `
    <div class="resource-thumb">${thumbHTML}</div>

    <div class="resource-body">
      <div class="resource-meta">
        <span class="resource-pill type">${escapeHTML(labelType(resource.type))}</span>
        <span class="resource-pill time">${escapeHTML(resource.duree || "temps à préciser")}</span>
      </div>

      <h3 class="resource-title">${escapeHTML(resource.titre || "Sans titre")}</h3>
      ${renderSourceHTML(resource.source)}
      <p class="resource-text">${escapeHTML(resource.resume || "")}</p>

      <div class="resource-tags">
        ${tagsHTML}
      </div>

      ${buildSeeAlsoHTML(resource)}

      <button class="resource-link resource-related-button" type="button" data-resource-id="${escapeHTML(resource.id)}">
        Voir les ressources liées
      </button>

      <a class="resource-link" href="${escapeHTML(resource.url || "#")}" target="_blank" rel="noopener noreferrer">
        Ouvrir la ressource
      </a>
    </div>
  `;

  article.querySelector(".resource-related-button")?.addEventListener("click", () => {
    showRelatedForResource(resource.id, { updateURL: true, scroll: true });
  });

  article.querySelectorAll(".resource-related-inline").forEach(button => {
    button.addEventListener("click", () => {
      const targetId = button.dataset.resourceId;
      showRelatedForResource(targetId, { updateURL: true, scroll: true });
    });
  });

  return article;
}

function renderResources(resources) {
  resourcesGrid.innerHTML = "";

  if (resources.length === 0) {
    resourcesGrid.innerHTML = `<p>Aucune ressource ne correspond à la recherche actuelle.</p>`;
    return;
  }

  resources.forEach(resource => {
    resourcesGrid.appendChild(createCard(resource));
  });
}

function renderTagButtons(resources) {
  const allTags = new Set();

  resources.forEach(resource => {
    resource.tags.forEach(tag => allTags.add(normalizeTag(tag)));
  });

  const sortedTags = Array.from(allTags).sort();

  resourcesTags.innerHTML = `
    <button class="resources-tag" type="button" data-tag="all" aria-pressed="true">Tout</button>
    ${sortedTags.map(tag => `
      <button class="resources-tag" type="button" data-tag="${escapeHTML(tag)}" aria-pressed="false">${escapeHTML(formatTagLabel(tag))}</button>
    `).join("")}
  `;

  const tagButtons = resourcesTags.querySelectorAll(".resources-tag");

  tagButtons.forEach(button => {
    button.addEventListener("click", () => {
      const selectedTag = button.dataset.tag;

      if (selectedTag === "all") {
        activeTags.clear();
      } else if (activeTags.has(selectedTag)) {
        activeTags.delete(selectedTag);
      } else {
        activeTags.add(selectedTag);
      }

      syncTagButtons();
      updateDisplay();
    });
  });

  syncTagButtons();
}

function syncTagButtons() {
  const tagButtons = resourcesTags.querySelectorAll(".resources-tag");

  tagButtons.forEach(button => {
    const tag = button.dataset.tag;
    const isActive = tag === "all"
      ? activeTags.size === 0
      : activeTags.has(tag);

    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}

function scoreResource(resource, query) {
  if (!query) return 1;

  let score = 0;
  const q = normalizeTag(query);

  if (normalizeTag(resource.titre).includes(q)) score += 5;
  if (resource.tags.some(tag => normalizeTag(tag).includes(q))) score += 4;
  if (normalizeTag(resource.source).includes(q)) score += 2;
  if (normalizeTag(resource.resume).includes(q)) score += 1;

  return score;
}

function getURLTags() {
  const params = new URLSearchParams(window.location.search);
  const tags = [];

  params.getAll("tag").forEach(tag => {
    if (tag) tags.push(normalizeTag(tag));
  });

  const groupedTags = params.get("tags");
  if (groupedTags) {
    groupedTags
      .split(/[|,]/)
      .map(tag => normalizeTag(tag))
      .filter(Boolean)
      .forEach(tag => tags.push(tag));
  }

  return Array.from(new Set(tags));
}

function updateDisplay() {
  const query = searchInput.value.trim();

  let filtered = allResources.filter(resource => normalizeTag(resource.statut) === "valide");

  if (activeTags.size > 0) {
    filtered = filtered.filter(resource => {
      const resourceTags = resource.tags.map(normalizeTag);
      return Array.from(activeTags).every(tag => resourceTags.includes(tag));
    });
  }

  filtered = filtered
    .map(resource => ({
      ...resource,
      _score: scoreResource(resource, query)
    }))
    .filter(resource => resource._score > 0)
    .sort((a, b) => b._score - a._score);

  renderResources(filtered);
}

function getManuallySelectedResourceIds(resourceId) {
  const resource = getResourceById(resourceId);
  if (!resource) return [];

  const direct = resource.prolongementsCritiquesIds || [];
  const reverse = allResources
    .filter(other => other.id !== resourceId && (other.prolongementsCritiquesIds || []).includes(resourceId))
    .map(other => other.id);

  return uniqueList([...direct, ...reverse])
    .filter(id => id !== resourceId && getResourceById(id));
}

function getManuallySelectedDejaIdsForResource(resourceId) {
  const resource = getResourceById(resourceId);
  const direct = resource ? (resource.dejaLaIds || []) : [];

  const reverse = allDejaEntries
    .filter(entry => (entry.ressourcesProlongementsCritiquesIds || []).includes(resourceId))
    .map(entry => entry.id);

  return uniqueList([...direct, ...reverse])
    .filter(id => getDejaById(id));
}

function getManuallySelectedResourceIdsForDeja(dejaId) {
  const entry = getDejaById(dejaId);
  const direct = entry ? (entry.ressourcesProlongementsCritiquesIds || []) : [];

  const reverse = allResources
    .filter(resource => (resource.dejaLaIds || []).includes(dejaId))
    .map(resource => resource.id);

  return uniqueList([...direct, ...reverse])
    .filter(id => getResourceById(id));
}

function getTagRelatedResources(tags, excludeIds = []) {
  const normalizedTags = uniqueList((tags || []).map(normalizeTag));
  const excluded = new Set(excludeIds);

  if (normalizedTags.length === 0) return [];

  return allResources
    .filter(resource => !excluded.has(resource.id))
    .map(resource => {
      const resourceTags = uniqueList((resource.tags || []).map(normalizeTag));
      const sharedTags = resourceTags.filter(tag => normalizedTags.includes(tag));

      return {
        resource,
        sharedTags,
        score: sharedTags.length
      };
    })
    .filter(item => item.score > 1)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.resource.titre.localeCompare(b.resource.titre, "fr", { sensitivity: "base" });
    });
}

function renderRelatedResourceCard(resource, options = {}) {
  const sharedLabel = options.sharedTags && options.sharedTags.length > 0
    ? `<p class="related-note">Tags partagés : ${escapeHTML(options.sharedTags.map(formatTagLabel).join(", "))}</p>`
    : "";

  const tagsHTML = resource.tags
    .slice(0, 5)
    .map(tag => `<span class="resource-tag">${escapeHTML(formatTagLabel(tag))}</span>`)
    .join("");

  return `
    <article class="resource-card related-card">
      <div class="resource-body">
        <div class="resource-meta">
          <span class="resource-pill type">${escapeHTML(labelType(resource.type))}</span>
          <span class="resource-pill time">${escapeHTML(resource.duree || "temps à préciser")}</span>
        </div>
        <h3 class="resource-title">${escapeHTML(resource.titre || "Sans titre")}</h3>
        ${renderSourceHTML(resource.source)}
        ${resource.resume ? `<p class="resource-text">${escapeHTML(resource.resume)}</p>` : ""}
        ${sharedLabel}
        <div class="resource-tags">${tagsHTML}</div>
        <button class="resource-link resource-related-button" type="button" data-resource-id="${escapeHTML(resource.id)}">Voir les ressources liées</button>
        <a class="resource-link" href="${escapeHTML(resource.url || "#")}" target="_blank" rel="noopener noreferrer">Ouvrir la ressource</a>
      </div>
    </article>
  `;
}

function renderRelatedDejaCard(entry) {
  const tagsHTML = (entry.tags || [])
    .slice(0, 5)
    .map(tag => `<span class="deja-tag">${escapeHTML(formatTagLabel(tag))}</span>`)
    .join("");

  return `
    <article class="deja-card related-card">
      <div class="deja-meta">
        ${entry.periode ? `<span class="deja-pill">${escapeHTML(entry.periode)}</span>` : ""}
        ${entry.territoire ? `<span class="deja-pill deja-pill--orange">${escapeHTML(entry.territoire)}</span>` : ""}
      </div>
      <h3>${escapeHTML(entry.nom || "Sans titre")}</h3>
      ${entry.type ? `<p class="deja-small">Type : ${escapeHTML(entry.type)}</p>` : ""}
      ${entry.fait_quoi ? `<p>${escapeHTML(entry.fait_quoi)}</p>` : ""}
      <div class="deja-tags-row">${tagsHTML}</div>
      <a class="deja-link" href="deja-la.html#${escapeHTML(entry.id)}">Voir la carte</a>
    </article>
  `;
}

function renderEmptyRelated(text) {
  return `<p class="related-empty">${escapeHTML(text)}</p>`;
}

function attachRelatedBoxListeners() {
  relatedContent.querySelectorAll(".resource-related-button").forEach(button => {
    button.addEventListener("click", () => {
      showRelatedForResource(button.dataset.resourceId, { updateURL: true, scroll: true });
    });
  });
}

function updateURLForRelated(params) {
  const url = new URL(window.location.href);
  url.searchParams.delete("ressource");
  url.searchParams.delete("resource");
  url.searchParams.delete("deja");

  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });

  url.hash = "prolongements-critiques";
  window.history.replaceState({}, "", url);
}

function scrollToRelatedSection() {
  relatedSection?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function showRelatedForResource(resourceId, options = {}) {
  const resource = getResourceById(resourceId);
  if (!resource || !relatedContent) return;

  const manualIds = getManuallySelectedResourceIds(resourceId);
  const manualResources = manualIds.map(getResourceById).filter(Boolean);

  const dejaIds = getManuallySelectedDejaIdsForResource(resourceId);
  const dejaEntries = dejaIds.map(getDejaById).filter(Boolean);

  const excludeIds = uniqueList([resource.id, ...manualIds]);
  const tagRelated = getTagRelatedResources(resource.tags, excludeIds);

  relatedContent.innerHTML = `
    <p class="related-context">Autour de : <strong>${escapeHTML(resource.titre)}</strong></p>

    <section class="related-subsection">
      <h3>Ressources sélectionnées</h3>
      <p>Les ressources affichées ici sont sélectionnées humainement pour prolonger, discuter ou critiquer la ressource consultée.</p>
      ${
        manualResources.length > 0
          ? `<div class="related-grid">${manualResources.map(item => renderRelatedResourceCard(item)).join("")}</div>`
          : renderEmptyRelated("Aucune ressource n’a encore été sélectionnée manuellement pour cette carte.")
      }
    </section>

    <section class="related-subsection">
      <h3>À relier au déjà-là</h3>
      <p>Ces cartes renvoient à des expériences, structures ou outils déjà existants qui éclairent la ressource consultée.</p>
      ${
        dejaEntries.length > 0
          ? `<div class="related-grid related-grid--deja">${dejaEntries.map(renderRelatedDejaCard).join("")}</div>`
          : renderEmptyRelated("Aucune carte du déjà-là n’a encore été associée manuellement à cette ressource.")
      }
    </section>

    <section class="related-subsection">
      <h3>Ressources proches par tags</h3>
      <p>Ces ressources sont proposées automatiquement parce qu’elles partagent plusieurs tags avec la ressource consultée.</p>
      ${
        tagRelated.length > 0
          ? `<div class="related-grid">${tagRelated.map(item => renderRelatedResourceCard(item.resource, { sharedTags: item.sharedTags })).join("")}</div>`
          : renderEmptyRelated("Aucune autre ressource ne partage au moins deux tags avec cette carte.")
      }
    </section>
  `;

  attachRelatedBoxListeners();

  if (options.updateURL) {
    updateURLForRelated({ ressource: resource.id });
  }

  if (options.scroll) {
    scrollToRelatedSection();
  }
}

function showRelatedForDeja(dejaId, options = {}) {
  const entry = getDejaById(dejaId);
  if (!entry || !relatedContent) return;

  const manualIds = getManuallySelectedResourceIdsForDeja(dejaId);
  const manualResources = manualIds.map(getResourceById).filter(Boolean);

  const excludeIds = uniqueList(manualIds);
  const tagRelated = getTagRelatedResources(entry.tags, excludeIds);

  relatedContent.innerHTML = `
    <p class="related-context">Autour de : <strong>${escapeHTML(entry.nom)}</strong></p>

    <section class="related-subsection">
      <h3>Ressources sélectionnées</h3>
      <p>Les ressources affichées ici sont sélectionnées humainement pour prolonger, discuter ou critiquer la carte consultée.</p>
      ${
        manualResources.length > 0
          ? `<div class="related-grid">${manualResources.map(item => renderRelatedResourceCard(item)).join("")}</div>`
          : renderEmptyRelated("Aucune ressource n’a encore été associée manuellement à cette carte du déjà-là.")
      }
    </section>

    <section class="related-subsection">
      <h3>À relier au déjà-là</h3>
      <p>Cette carte sert de point d’appui concret pour situer les ressources proposées.</p>
      <div class="related-grid related-grid--deja">${renderRelatedDejaCard(entry)}</div>
    </section>

    <section class="related-subsection">
      <h3>Ressources proches par tags</h3>
      <p>Ces ressources sont proposées automatiquement parce qu’elles partagent plusieurs tags avec la carte consultée.</p>
      ${
        tagRelated.length > 0
          ? `<div class="related-grid">${tagRelated.map(item => renderRelatedResourceCard(item.resource, { sharedTags: item.sharedTags })).join("")}</div>`
          : renderEmptyRelated("Aucune ressource ne partage au moins deux tags avec cette carte.")
      }
    </section>
  `;

  attachRelatedBoxListeners();

  if (options.updateURL) {
    updateURLForRelated({ deja: entry.id });
  }

  if (options.scroll) {
    scrollToRelatedSection();
  }
}

function handleInitialRelatedFromURL() {
  const params = new URLSearchParams(window.location.search);
  const resourceId = params.get("ressource") || params.get("resource");
  const dejaId = params.get("deja");

  if (resourceId) {
    showRelatedForResource(resourceId, { updateURL: false, scroll: window.location.hash === "#prolongements-critiques" });
  } else if (dejaId) {
    showRelatedForDeja(dejaId, { updateURL: false, scroll: window.location.hash === "#prolongements-critiques" });
  }
}

async function initResources() {
  const [resourceRows, dejaRows] = await Promise.all([
    loadCSV(CSV_URL),
    loadCSV(DEJA_CSV_URL).catch(error => {
      console.warn("deja-la.csv non chargé pour les prolongements :", error);
      return [];
    })
  ]);

  allResources = parseResources(resourceRows)
    .filter(resource => normalizeTag(resource.statut) === "valide");

  allDejaEntries = parseDejaEntries(dejaRows)
    .filter(entry => normalizeTag(entry.statut) === "valide");

  const initialTags = getURLTags();
  if (initialTags.length > 0) {
    activeTags = new Set(initialTags);
  }

  renderTagButtons(allResources);
  searchInput.addEventListener("input", updateDisplay);
  updateDisplay();
  handleInitialRelatedFromURL();
}

initResources().catch(error => {
  console.error(error);
  resourcesGrid.innerHTML = `<p>Erreur de chargement des ressources.</p>`;
});
