import {
  getFirestore,
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

let map;
let markerLayer;
let heatLayer;
let provinceChart;

const floodList = document.getElementById("floodList");

const GISTDA_API =
  "https://api-gateway.gistda.or.th/api/2.0/resources/features/flood/1day?api_key=Ds96dDVsU4piyMnpedAQdSMTQs0oUli1m7eg5Go3hvn4fEOo5jTYAG1FABSiswL0";

function initMap() {
  map = L.map("map").setView([13.7563, 100.5018], 6);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
  }).addTo(map);

  markerLayer = L.layerGroup().addTo(map);
}

function renderMarkers(items) {
  markerLayer.clearLayers();

  items.forEach(item => {
    if (!item.lat || !item.lon) return;

    L.marker([item.lat, item.lon])
      .addTo(markerLayer)
      .bindPopup(`
        <b>${item.province}</b><br>
        อำเภอ: ${item.amphoe}<br>
        ตำบล: ${item.tambon}<br>
      `);
  });
}

function renderFloodList(items) {
  if (!items.length) {
    floodList.innerHTML = `<div class="list-item">✅ วันนี้ไม่มีน้ำท่วม</div>`;
    return;
  }

  floodList.innerHTML = items.map(item => `
    <div class="list-item">
      <b>${item.province}</b><br>
      ${item.amphoe || ""} ${item.tambon || ""}
    </div>
  `).join("");
}

function renderChart(items) {
  const mapCount = {};

  items.forEach(i => {
    mapCount[i.province] = (mapCount[i.province] || 0) + 1;
  });

  const ctx = document.getElementById("provinceChart").getContext("2d");

  new Chart(ctx, {
    type: "bar",
    data: {
      labels: Object.keys(mapCount),
      datasets: [{
        label: "น้ำท่วม",
        data: Object.values(mapCount)
      }]
    }
  });
}

async function loadGistda() {
  try {
    const res = await fetch(GISTDA_API);
    const data = await res.json();

    const features = data.features || [];

    const items = features.map(f => ({
      province: f.properties?.province || "ไม่ระบุ",
      amphoe: f.properties?.amphoe || "",
      tambon: f.properties?.tambon || "",
      lat: f.geometry?.coordinates?.[1],
      lon: f.geometry?.coordinates?.[0]
    }));

    renderMarkers(items);
    renderFloodList(items);
    renderChart(items);

  } catch (err) {
    console.error(err);
    floodList.innerHTML = "โหลด GISTDA ไม่สำเร็จ";
  }
}

initMap();
loadGistda();
setInterval(loadGistda, 300000);