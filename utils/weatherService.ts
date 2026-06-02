
// Using Open-Meteo API which aggregates data from DMI (Denmark), DWD, and NOAA.
// It automatically selects the best model (DMI Harmonie) for Denmark.

export interface WeatherData {
  current: {
    temperature: number;
    windSpeed: number;
    windDirection: number; // in degrees
    humidity: number;
    weatherCode: number;
    isDay: number;
  };
  daily: Array<{
    date: string;
    maxTemp: number;
    minTemp: number;
    rainSum: number;
    maxWind: number;
    evapotranspiration: number; // ET0 in mm
    weatherCode: number;
  }>;
}

// Helper to parse location string "56.1234°N, 9.1234°E" to numbers
export const getCoordinates = (locString: string) => {
    try {
      if (!locString || !locString.includes(',')) return { lat: 56.2639, lng: 9.5018 }; // Default Denmark center
      const [latStr, lngStr] = locString.split(', ');
      return {
        lat: parseFloat(latStr.replace('°N', '')),
        lng: parseFloat(lngStr.replace('°E', ''))
      };
    } catch (e) {
      return { lat: 56.2639, lng: 9.5018 };
    }
};

// WMO Weather interpretation codes
export const getWeatherLabel = (code: number): string => {
  const codes: Record<number, string> = {
    0: 'Clear sky',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Fog',
    48: 'Depositing rime fog',
    51: 'Light Drizzle',
    53: 'Moderate Drizzle',
    55: 'Dense Drizzle',
    61: 'Slight Rain',
    63: 'Moderate Rain',
    65: 'Heavy Rain',
    71: 'Slight Snow',
    73: 'Moderate Snow',
    75: 'Heavy Snow',
    80: 'Rain showers',
    81: 'Moderate showers',
    82: 'Violent showers',
    95: 'Thunderstorm',
  };
  return codes[code] || 'Unknown';
};

export const fetchFieldWeather = async (lat: number, lng: number): Promise<WeatherData> => {
  try {
    const params = new URLSearchParams({
      latitude: lat.toString(),
      longitude: lng.toString(),
      current_weather: 'true',
      hourly: 'relativehumidity_2m',
      daily: 'weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max,et0_fao_evapotranspiration',
      timezone: 'Europe/Copenhagen',
      models: 'best_match' // This prioritizes DMI Harmonie model in Denmark
    });

    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
    
    if (!response.ok) throw new Error('Weather data fetch failed');
    
    const data = await response.json();

    // Map the API response to our simplified interface
    return {
      current: {
        temperature: data.current_weather.temperature,
        windSpeed: data.current_weather.windspeed,
        windDirection: data.current_weather.winddirection,
        weatherCode: data.current_weather.weathercode,
        isDay: data.current_weather.is_day,
        // Approximate humidity from the first hourly slot (current hour)
        humidity: data.hourly.relativehumidity_2m[0] || 60 
      },
      daily: data.daily.time.map((date: string, index: number) => ({
        date,
        maxTemp: data.daily.temperature_2m_max[index],
        minTemp: data.daily.temperature_2m_min[index],
        rainSum: data.daily.precipitation_sum[index],
        maxWind: data.daily.windspeed_10m_max[index],
        evapotranspiration: data.daily.et0_fao_evapotranspiration[index],
        weatherCode: data.daily.weathercode[index]
      }))
    };

  } catch (error) {
    console.error("Error fetching weather:", error);
    throw error;
  }
};