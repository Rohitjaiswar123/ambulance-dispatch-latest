// Firebase configuration (same as in your ESP32 code)
const firebaseConfig = {
    apiKey: "AIzaSyBwbjQq0Zyx8PQLj77i0V9A69FyDCMI4xI",
    databaseURL: "https://esp32datatransfertest-default-rtdb.firebaseio.com"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Initialize charts
const tempCtx = document.getElementById('temp-chart').getContext('2d');
const tempChart = new Chart(tempCtx, {
    type: 'line',
    data: { labels: [], datasets: [{ label: 'Temperature (°C)', data: [], borderColor: 'red' }] },
    options: { responsive: true }
});

const humCtx = document.getElementById('hum-chart').getContext('2d');
const humChart = new Chart(humCtx, {
    type: 'line',
    data: { labels: [], datasets: [{ label: 'Humidity (%)', data: [], borderColor: 'blue' }] },
    options: { responsive: true }
});

// Initialize Google Maps
let map;
function initMap() {
    map = new google.maps.Map(document.getElementById('map'), {
        center: { lat: 19.23857, lng: 73.12901 },
        zoom: 15
    });
}

// Realtime listeners
database.ref('sensor/temperature').on('value', (snapshot) => {
    const temp = snapshot.val();
    document.getElementById('temp-value').textContent = temp.toFixed(1);
    updateChart(tempChart, temp);
});

database.ref('sensor/humidity').on('value', (snapshot) => {
    const hum = snapshot.val();
    document.getElementById('hum-value').textContent = hum.toFixed(1);
    updateChart(humChart, hum);
});

database.ref('sensor/lpg_ppm').on('value', (snapshot) => {
    const gas = snapshot.val();
    document.getElementById('gas-value').textContent = gas.toFixed(2);
    updateGasBar(gas);
});

database.ref('gps').on('value', (snapshot) => {
    const gpsData = snapshot.val();
    if (gpsData.latitude && gpsData.longitude && map) {
        const pos = { lat: gpsData.latitude, lng: gpsData.longitude };
        new google.maps.Marker({ position: pos, map });
        map.setCenter(pos);
    }
    if (gpsData.speed) {
        document.getElementById('speed-value').textContent = gpsData.speed.toFixed(1);
    }
});

// Helper functions
function updateChart(chart, newValue) {
    const now = new Date().toLocaleTimeString();
    chart.data.labels.push(now);
    chart.data.datasets[0].data.push(newValue);
    if (chart.data.labels.length > 10) {
        chart.data.labels.shift();
        chart.data.datasets[0].data.shift();
    }
    chart.update();
}

function updateGasBar(value) {
    // Update gas level indicator color based on value
    const gasBar = document.querySelector('.gas-bar');
    gasBar.style.height = '20px';
    gasBar.style.width = Math.min(100, value / 10000) + '%';
    gasBar.style.backgroundColor = value > 10000 ? 'red' : value > 5000 ? 'orange' : 'green';
}
