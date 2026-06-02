import { getCoordinates } from './weatherService';

const BASE_URL = 'https://api.agromonitoring.com/agro/1.0';

// Provided by user
export const DEFAULT_API_KEY = 'ca0097d74a1680c22d098e8b50772fc1';

export const getApiKey = () => {
    return localStorage.getItem('agro_api_key') || DEFAULT_API_KEY;
};

export interface AgroStat {
    dt: number;
    data: {
        mean: number;
        max: number;
        min: number;
    }
}

// Convert Google Maps path to GeoJSON Polygon format
// Supports both simple Polygon and MultiPolygon structures
const formatGeoJson = (name: string, boundary: any) => {
    let type = "Polygon";
    let coordinates: any = [];

    // Check if it is a simple array of points (Polygon) or array of arrays (MultiPolygon)
    if (boundary.length > 0 && Array.isArray(boundary[0])) {
         type = "MultiPolygon";
         // Map each polygon path
         coordinates = boundary.map((path: any[]) => {
             const coords = path.map(p => [p.lng, p.lat]);
             if (coords.length > 0) coords.push(coords[0]); // Close loop
             return [coords]; // Wrap in array as GeoJSON Polygon expects array of rings
         });
    } else {
         // Simple Polygon
         const coords = boundary.map((p: any) => [p.lng, p.lat]);
         if (coords.length > 0) coords.push(coords[0]); // Close loop
         coordinates = [coords];
    }

    return {
        name,
        geo_json: {
            type: "Feature",
            properties: {},
            geometry: {
                type: type,
                coordinates: coordinates
            }
        }
    };
};

export const createAgroPolygon = async (name: string, boundary: any, apiKey: string) => {
    if (!apiKey) return null;

    try {
        const payload = formatGeoJson(name, boundary);
        const response = await fetch(`${BASE_URL}/polygons?appid=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.message || 'Failed to create polygon');
        }

        const data = await response.json();
        return data.id; // Return the new Polygon ID

    } catch (error) {
        console.error("Agro API Error:", error);
        return null;
    }
};

export const getHistoricalNdvi = async (polygonId: string, start: Date, end: Date, apiKey: string): Promise<AgroStat[]> => {
    if (!apiKey) return [];

    try {
        const startUnix = Math.floor(start.getTime() / 1000);
        const endUnix = Math.floor(end.getTime() / 1000);

        const response = await fetch(
            `${BASE_URL}/ndvi/history?polyid=${polygonId}&start=${startUnix}&end=${endUnix}&appid=${apiKey}`
        );

        if (!response.ok) return [];

        const data = await response.json();
        // Sort by date ascending
        return data.sort((a: AgroStat, b: AgroStat) => a.dt - b.dt);
    } catch (error) {
        console.error("Failed to fetch NDVI history", error);
        return [];
    }
};

export const getTileUrlTemplate = (polyId: string, apiKey: string) => {
    if (!apiKey) return '';
    // Returns a URL template for Google Maps ImageMapType
    return `https://m.agromonitoring.com/image/1.0/100/{z}/{x}/{y}?polyid=${polyId}&appid=${apiKey}`;
};