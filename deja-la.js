/* =========================================================
   deja-la.js — version avec ancres précises, sélection multi-tags
   et liens vers Prolongements et critiques
   ---------------------------------------------------------
   Syntaxes supportées dans voir_aussi :
   - deja-la:<id-carte>        -> deja-la.html#id-carte
   - ressource:<id-ressource>  -> ressources.html?ressource=id#prolongements-critiques
   - ressources:<id-ressource> -> ressources.html?ressource=id#prolongements-critiques
   - tag:<tag>                 -> ressources.html?tag=tag
   - https://...               -> lien externe direct

   Export Baserow supporté :
   - identifiant comme identifiant public ;
   - titre comme nom affiché ;
   - ressources_prolongements_critiques_id pour le lien
     “Voir les ressources liées”.
   ========================================================= */

const CSV_URL = "deja-la.csv";

const franceGrid = document.getElementById("dejaFranceGrid");
const internationalGrid = document.getElementById("dejaInternationalGrid");
const historiqueGrid = document.getElementById("dejaHistoriqueGrid");
const dejaSearchInput = document.getElementById("dejaSearchInput");
const dejaTags = document.getElementById("dejaTags");

let allEntries = [];
let activeTags = new Set();

async function loadCSV() {
  const response = await fetch(CSV_URL);

  if (!response.ok) {
    throw new Error("Impossible de charger le fichier deja-la.csv");
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

  if (rows.length < 2) return [];

  const headers = rows[0].map(h => h.trim());

  return rows.slice(1).map(values => {
    const row = {};

    headers.forEach((header, index) => {
      row[header] = (values[index] || "").trim();
    });

    return row;
  }).map(row => ({
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
    notes: row["notes"] || row["Notes"] || "",
    ordre: Number(row["ordre"] || "999")
  })).filter(entry => entry.nom || entry.url || entry.fait_quoi);
}

function parseListField(value) {
  if (!value) return [];

  return String(value)
    .split(/[|,]/)
    .map(item => item.trim())
    .filter(Boolean);
}

function normalizeTag(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_\s]+/g, "-");
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

function formatTagLabel(tag) {
  const cleaned = normalizeTag(tag);

  const labels = {
    "zapatiste": "Zapatiste",
    "autonomie": "Autonomie",
    "cooperatives": "Coopératives",
    "cooperative": "Coopérative",
    "foncier": "Foncier",
    "ravitaillement": "Ravitaillement",
    "international": "International",
    "historique": "Historique",
    "securite-sociale": "Sécurité sociale",
    "terre": "Terre",
    "agriculture": "Agriculture",
    "permaculture": "Permaculture",
    "economie": "Économie",
    "autogestion": "Autogestion"
  };

  if (labels[cleaned]) return labels[cleaned];

  return cleaned
    .split("-")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function escapeHTML(text) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function sortEntries(entries) {
  return [...entries].sort((a, b) => {
    if (a.ordre !== b.ordre) return a.ordre - b.ordre;
    return a.nom.localeCompare(b.nom, "fr", { sensitivity: "base" });
  });
}

function buildMetaPills(entry) {
  const pills = [];

  if (entry.periode) {
    pills.push(`<span class="deja-pill">${escapeHTML(entry.periode)}</span>`);
  }

  if (entry.territoire) {
    pills.push(`<span class="deja-pill deja-pill--orange">${escapeHTML(entry.territoire)}</span>`);
  }

  if (pills.length === 0) return "";
  return `<div class="deja-meta">${pills.join("")}</div>`;
}

function buildSecondaryLine(entry) {
  if (!entry.type) return "";
  return `<p class="deja-small">Type : ${escapeHTML(entry.type)}</p>`;
}

function buildThinkingList(entry) {
  const items = [];

  if (entry.proche_de_la_ci) {
    items.push(`<li><strong>Proche de la CI par :</strong> ${escapeHTML(entry.proche_de_la_ci)}</li>`);
  }

  if (entry.s_en_distingue) {
    items.push(`<li><strong>S’en distingue par :</strong> ${escapeHTML(entry.s_en_distingue)}</li>`);
  }

  if (entry.permet_de_penser) {
    items.push(`<li><strong>Ce que cela permet de penser :</strong> ${escapeHTML(entry.permet_de_penser)}</li>`);
  }

  if (items.length === 0) return "";
  return `<ul class="deja-list">${items.join("")}</ul>`;
}

function buildSeeAlso(entry) {
  const items = [];

  if (entry.id) {
    items.push(`<a href="ressources.html?deja=${encodeURIComponent(entry.id)}#prolongements-critiques">Voir les ressources liées</a>`);
  }

  if (entry.voir_aussi && entry.voir_aussi.length > 0) {
    entry.voir_aussi.forEach(item => {
      const trimmed = item.trim();

      if (/^https?:\/\//i.test(trimmed)) {
        items.push(`<a href="${escapeHTML(trimmed)}" target="_blank" rel="noopener noreferrer">Voir aussi</a>`);
      } else if (trimmed.startsWith("deja-la:")) {
        const target = trimmed.replace("deja-la:", "").trim();
        items.push(`<a href="deja-la.html#${escapeHTML(target)}">Voir la carte liée dans Le déjà-là</a>`);
      } else if (trimmed.startsWith("ressource:") || trimmed.startsWith("ressources:")) {
        const target = trimmed.split(":").slice(1).join(":").trim();
        items.push(`<a href="ressources.html?ressource=${encodeURIComponent(target)}#prolongements-critiques">Voir la ressource liée</a>`);
      } else if (trimmed.startsWith("tag:")) {
        const target = trimmed.replace("tag:", "").trim();
        items.push(`<a href="ressources.html?tag=${encodeURIComponent(normalizeTag(target))}">Voir les ressources liées par tag</a>`);
      } else {
        items.push(`<a href="ressources.html?tag=${encodeURIComponent(normalizeTag(trimmed))}">Voir les ressources liées par tag</a>`);
      }
    });
  }

  if (items.length === 0) return "";
  return `<p class="deja-related">${items.join("<br>")}</p>`;
}

function buildCardTags(entry) {
  if (!entry.tags || entry.tags.length === 0) return "";

  const tags = entry.tags.map(tag => {
    const label = formatTagLabel(tag);
    return `<span class="deja-tag"><a href="ressources.html?tag=${encodeURIComponent(normalizeTag(tag))}">${escapeHTML(label)}</a></span>`;
  }).join("");

  return `<div class="deja-tags-row">${tags}</div>`;
}

function createCard(entry) {
  const article = document.createElement("article");
  article.className = "deja-card";
  article.id = entry.id || "";
  article.dataset.section = entry.section;
  article.dataset.tags = (entry.tags || []).map(normalizeTag).join(" ");
  article.dataset.search = buildSearchText(entry);

  article.innerHTML = `
    ${buildMetaPills(entry)}

    <div>
      <h3>${escapeHTML(entry.nom || "Sans nom")}</h3>
      ${buildSecondaryLine(entry)}
    </div>

    <p>${escapeHTML(entry.fait_quoi || "")}</p>

    ${buildThinkingList(entry)}

    ${buildSeeAlso(entry)}

    ${entry.url ? `<a class="deja-link" href="${escapeHTML(entry.url)}" target="_blank" rel="noopener noreferrer">Voir la structure</a>` : ""}

    ${buildCardTags(entry)}
  `;

  return article;
}

function buildSearchText(entry) {
  return [
    entry.nom,
    entry.territoire,
    entry.periode,
    entry.type,
    entry.fait_quoi,
    entry.proche_de_la_ci,
    entry.s_en_distingue,
    entry.permet_de_penser,
    (entry.tags || []).join(" ")
  ]
    .join(" ")
    .toLowerCase();
}

function renderTagButtons(entries) {
  const allTagsSet = new Set();

  entries.forEach(entry => {
    (entry.tags || []).forEach(tag => allTagsSet.add(normalizeTag(tag)));
  });

  const sortedTags = Array.from(allTagsSet).sort();

  dejaTags.innerHTML = `
    <button class="resources-tag" type="button" data-tag="all" aria-pressed="true">Tout</button>
    ${sortedTags.map(tag => `
      <button class="resources-tag" type="button" data-tag="${escapeHTML(tag)}" aria-pressed="false">${escapeHTML(formatTagLabel(tag))}</button>
    `).join("")}
  `;

  const buttons = dejaTags.querySelectorAll(".resources-tag");

  buttons.forEach(button => {
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
  const buttons = dejaTags.querySelectorAll(".resources-tag");

  buttons.forEach(button => {
    const tag = button.dataset.tag;
    const isActive = tag === "all"
      ? activeTags.size === 0
      : activeTags.has(tag);

    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}

function scoreEntry(entry, query) {
  if (!query) return 1;

  let score = 0;
  const q = normalizeTag(query);

  if (normalizeTag(entry.nom).includes(q)) score += 5;
  if ((entry.tags || []).some(tag => normalizeTag(tag).includes(q))) score += 4;
  if (normalizeTag(entry.territoire).includes(q)) score += 3;
  if (normalizeTag(entry.type).includes(q)) score += 2;
  if (normalizeTag(entry.fait_quoi).includes(q)) score += 1;
  if (normalizeTag(entry.proche_de_la_ci).includes(q)) score += 1;
  if (normalizeTag(entry.s_en_distingue).includes(q)) score += 1;
  if (normalizeTag(entry.permet_de_penser).includes(q)) score += 1;

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

function renderSection(entries, grid, emptyText) {
  grid.innerHTML = "";

  if (!entries || entries.length === 0) {
    grid.innerHTML = `<p class="deja-empty">${escapeHTML(emptyText)}</p>`;
    return;
  }

  sortEntries(entries).forEach(entry => {
    grid.appendChild(createCard(entry));
  });
}

function updateDisplay() {
  const query = dejaSearchInput.value.trim();

  let filtered = allEntries.filter(entry => normalizeTag(entry.statut) === "valide");

  if (activeTags.size > 0) {
    filtered = filtered.filter(entry => {
      const entryTags = (entry.tags || []).map(normalizeTag);
      return Array.from(activeTags).every(tag => entryTags.includes(tag));
    });
  }

  filtered = filtered
    .map(entry => ({ ...entry, _score: scoreEntry(entry, query) }))
    .filter(entry => entry._score > 0);

  renderSection(
    filtered.filter(entry => entry.section === "france-aujourdhui"),
    franceGrid,
    "Aucune carte ne correspond à la recherche actuelle dans cette section."
  );

  renderSection(
    filtered.filter(entry => entry.section === "international"),
    internationalGrid,
    "Aucune carte ne correspond à la recherche actuelle dans cette section."
  );

  renderSection(
    filtered.filter(entry => entry.section === "reperes-historiques"),
    historiqueGrid,
    "Aucune carte ne correspond à la recherche actuelle dans cette section."
  );
}

function scrollToHashTarget(behavior = "auto") {
  if (!window.location.hash || window.location.hash === "#") return;

  let targetId = window.location.hash.slice(1);

  try {
    targetId = decodeURIComponent(targetId);
  } catch (error) {
    // Si le hash est mal encodé, on garde la version brute.
  }

  if (!targetId) return;

  const target = document.getElementById(targetId);
  if (!target) return;

  // Les cartes sont générées par JS après le chargement du CSV :
  // on attend un très court instant pour laisser le navigateur finir le rendu.
  window.setTimeout(() => {
    target.scrollIntoView({ behavior, block: "start" });
  }, 60);
}

async function initDejaLa() {
  allEntries = await loadCSV();
  allEntries = allEntries.filter(entry => normalizeTag(entry.statut) === "valide");

  const initialTags = getURLTags();
  if (initialTags.length > 0) {
    activeTags = new Set(initialTags);
  }

  renderTagButtons(allEntries);
  dejaSearchInput.addEventListener("input", updateDisplay);
  updateDisplay();
  scrollToHashTarget();
}

window.addEventListener("hashchange", () => {
  updateDisplay();
  scrollToHashTarget("smooth");
});

initDejaLa().catch(error => {
  console.error(error);
  franceGrid.innerHTML = `<p class="deja-empty">Erreur de chargement du déjà-là.</p>`;
  internationalGrid.innerHTML = `<p class="deja-empty">Erreur de chargement du déjà-là.</p>`;
  historiqueGrid.innerHTML = `<p class="deja-empty">Erreur de chargement du déjà-là.</p>`;
});
