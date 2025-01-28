import fetch from "node-fetch";
import dotenv from "dotenv";
import express from "express";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;

app.use(express.static('frontend')); // Serve static frontend files

// Route to handle the cycling route request
app.get('/api/route', async (req, res) => {
  const { start, end, speed, departureTime } = req.query;

  if (!start || !end || !speed || !departureTime) {
    return res.status(400).send('Missing required parameters');
  }

  try {
    // Get route from Google Maps Directions API
    const routeData = await getRouteData(start, end);
    const markers = await getWeatherAndWindData(routeData, speed, departureTime);

    res.json({ markers });
  } catch (err) {
    console.error("Error calculating route or fetching weather data", err);
    res.status(500).send("Internal Server Error");
  }
});

// Function to get route data using Google Maps Directions API
async function getRouteData(start, end) {
  const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(start)}&destination=${encodeURIComponent(end)}&key=${GOOGLE_MAPS_API_KEY}`;
  const response = await fetch(url);
  const data = await response.json();
  return data.routes[0].legs[0].steps; // Returning steps in the route
}

// Function to get weather and wind data for each marker
async function getWeatherAndWindData(routeData, speed, departureTime) {
  const markers = [];
  let totalDistance = 0;
  let currentTime = new Date(departureTime).getTime() / 1000; // Convert departure time to Unix timestamp

  for (let i = 0; i < routeData.length; i++) {
    const step = routeData[i];
    totalDistance += step.distance.value; // In meters

    // Calculate arrival time at each marker
    const travelTime = (totalDistance / 1000) / speed * 3600; // Time in seconds (distance in km / speed in km/h)
    const arrivalTime = currentTime + travelTime;

    // Get weather data for the marker
    const weatherData = await getWeatherData(step.end_location.lat, step.end_location.lng, arrivalTime);

    markers.push({
      lat: step.end_location.lat,
      lng: step.end_location.lng,
      weather: weatherData.weather,
      arrivalTime: arrivalTime,
      wind: weatherData.wind,
    });
  }

  return markers;
}

// Function to get weather and wind data using OpenWeather API
async function getWeatherData(lat, lng, arrivalTime) {
  const url = `https://api.openweathermap.org/data/2.5/onecall?lat=${lat}&lon=${lng}&exclude=minutely,hourly,daily&appid=${OPENWEATHER_API_KEY}`;
  const response = await fetch(url);
  const data = await response.json();

  // Find the weather at the arrival time
  const weather = data.current; // Using current data as an approximation
  return {
    weather: {
      description: weather.weather[0].description,
    },
    wind: weather.wind || {},
  };
}

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
