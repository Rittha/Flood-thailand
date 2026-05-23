let map;
let markerLayer;
let heatLayer;
let provinceChart;
let trendChart;
let latestUser = null;

const provinceFilter = document.getElementById("provinceFilter");
const viewMode = document.getElementById("viewMode");
const daysSelect = document.getElementById("daysSelect");
const refreshBtn = document.getElementById("refreshBtn");
const syncBtn = document.getElementById("syncBtn");
const floodList = document.getElementById("floodList");
const predictionList = document.getElementById("predictionList");

function initMap() {
  map = L.map("map").setView([13.7563, 100.5018], 6);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);
  markerLayer = L.layerGroup().addTo(map);
}

async function getAuthHeader() {
  if (!window.firebaseAuth?.currentUser) return {};
  const token = await window.firebaseAuth.currentUser.getIdToken();
  return { Authorization: `Bearer ${token}` };
}

async function apiGet(url) {
  const headers = await getAuthHeader();
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`GET ${url} failed`);
  return await res.json();
}

async function apiPost(url, body = {}, extraHeaders = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(await getAuthHeader()),
    ...extraHeaders
  };
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`POST ${url} failed`);
  return await res.json();
}

function renderMarkers(items) {
  markerLayer.clearLayers();
  items.forEach(item => {
    if (typeof item.lat !== "number" || typeof item.lon !== "number") return;
    L.marker([item.lat, item.lon])
      .addTo(markerLayer)
      .bindPopup(`
        <b>${item.province}</b><br>
        อำเภอ: ${item.amphoe || "-"}<br>
        ตำบล: ${item.tambon || "-"}<br>
        ระดับน้ำ: ${item.level || "-"}<br>
        เวลา: ${item.snapshotAt || "-"}
      `);
  });
}

function renderHeat(items) {
  if (heatLayer) {
    map.removeLayer(heatLayer);
    heatLayer = null;
  }
  const heatPoints = items
    .filter(item => typeof item.lat === "number" && typeof item.lon === "number")
    .map(item => [item.lat, item.lon, 0.8]);

  heatLayer = L.heatLayer(heatPoints, {
    radius: 24,
    blur: 18,
    maxZoom: 10
  });
}

function renderFloodList(items) {
  if (!items.length) {
    floodList.innerHTML = `<div class="list-item">ไม่พบข้อมูลน้ำท่วมล่าสุด</div>`;
    return;
  }
  floodList.innerHTML = items.map(item => `
    <div class="list-item">
      <div class="title">${item.province}</div>
      <div>อำเภอ: ${item.amphoe || "-"}</div>
      <div>ตำบล: ${item.tambon || "-"}</div>
      <div>ระดับน้ำ: ${item.level || "-"}</div>
      <div class="muted">เวลา snapshot: ${item.snapshotAt || "-"}</div>
    </div>
  `).join("");
}

function renderProvinceChart(items) {
  const mapCount = {};
  items.forEach(item => {
    mapCount[item.province] = (mapCount[item.province] || 0) + 1;
  });
  const labels = Object.keys(mapCount);
  const values = Object.values(mapCount);

  if (provinceChart) provinceChart.destroy();
  const ctx = document.getElementById("provinceChart").getContext("2d");
  provinceChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{ label: "จำนวนจุดน้ำท่วม", data: values }]
    },
    options: { responsive: true, maintainAspectRatio: true }
  });
}

function renderTrendChart(history) {
  const labels = history.map(x => x.date);
  const values = history.map(x => x.totalEvents);

  if (trendChart) trendChart.destroy();
  const ctx = document.getElementById("trendChart").getContext("2d");
  trendChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "จุดน้ำท่วมย้อนหลัง",
        data: values,
        fill: true,
        tension: 0.25
      }]
    },
    options: { responsive: true, maintainAspectRatio: true }
  });
}

function renderPredictions(predictions) {
  if (!predictions.length) {
    predictionList.innerHTML = `<div class="list-item">ยังไม่มีข้อมูล prediction</div>`;
    return;
  }
  predictionList.innerHTML = predictions.slice(0, 20).map(item => {
    const cls = item.riskLevel === "สูง" ? "high" : (item.riskLevel === "ปานกลาง" ? "medium" : "low");
    return `
      <div class="list-item">
        <div class="title">${item.province}<span class="badge ${cls}">${item.riskLevel}</span></div>
        <div>Risk score: ${item.riskScore}/100</div>
        <div>ฝนล่าสุด: ${item.rainMm || 0} mm</div>
        <div>จุดน้ำท่วมล่าสุด: ${item.latestFlood || 0}</div>
        <div>ค่าเฉลี่ย 7 วัน: ${item.avg7 || 0}</div>
      </div>
    `;
  }).join("");
}

function updateProvinceFilter(items) {
  const provinces = [...new Set(items.map(x => x.province).filter(Boolean))].sort();
  const selected = provinceFilter.value || "all";
  provinceFilter.innerHTML = `<option value="all">ทั้งหมด</option>` + provinces.map(p => `<option value="${p}">${p}</option>`).join("");
  provinceFilter.value = provinces.includes(selected) ? selected : "all";
}

async function bootstrapApp() {
  try {
    latestUser = null;
    if (window.firebaseAuth?.currentUser) {
      latestUser = await apiGet("/api/me");
    }
  } catch {
    latestUser = null;
  }
  syncBtn.style.display = latestUser?.role === "admin" ? "inline-block" : "none";
  await loadDashboard();
}

async function loadDashboard() {
  try {
    const province = provinceFilter.value || "all";
    const days = Number(daysSelect.value || 7);

    const latest = await apiGet(`/api/flood/latest?province=${encodeURIComponent(province)}&limit=1000`);
    const history = await apiGet(`/api/flood/history?days=${days}`);
    const predictions = await apiGet(`/api/predict${province !== "all" ? `?province=${encodeURIComponent(province)}` : ""}`);

    const items = latest.items || [];
    updateProvinceFilter(items);
    renderMarkers(items);
    renderHeat(items);

    const mode = viewMode.value;
    if (mode === "markers") {
      renderMarkers(items);
      if (heatLayer && map.hasLayer(heatLayer)) map.removeLayer(heatLayer);
    } else if (mode === "heatmap") {
      markerLayer.clearLayers();
      if (heatLayer) heatLayer.addTo(map);
    } else {
      renderMarkers(items);
      if (heatLayer) heatLayer.addTo(map);
    }

    renderFloodList(items);
    renderProvinceChart(items);
    renderTrendChart(history);
    renderPredictions(predictions);
  } catch (error) {
    console.error(error);
    floodList.innerHTML = `<div class="list-item">เกิดข้อผิดพลาดในการโหลดข้อมูล</div>`;
  }
}

refreshBtn.addEventListener("click", loadDashboard);
provinceFilter.addEventListener("change", loadDashboard);
viewMode.addEventListener("change", loadDashboard);
daysSelect.addEventListener("change", loadDashboard);

syncBtn.addEventListener("click", async () => {
  try {
    await apiPost("/api/admin/sync", {});
    alert("Sync สำเร็จ");
    await loadDashboard();
  } catch (error) {
    console.error(error);
    alert("Sync ไม่สำเร็จ");
  }
});

window.bootstrapApp = bootstrapApp;
initMap();
bootstrapApp();
setInterval(loadDashboard, 5 * 60 * 1000);
