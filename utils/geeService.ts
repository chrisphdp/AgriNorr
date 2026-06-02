export const DEFAULT_BACKEND_URL = ''; // Changed to empty to force user configuration

export const getBackendUrl = () => {
    // Priority: LocalStorage -> Default
    let url = localStorage.getItem('gee_backend_url') || DEFAULT_BACKEND_URL;
    if (url && url.endsWith('/')) {
        url = url.slice(0, -1);
    }
    return url;
};

const isOfflineMode = () => {
    return localStorage.getItem('gee_simulation_mode') === 'true';
};

// Helper: Convert {lat, lng} array to [lng, lat] array (GeoJSON Ring)
const toLngLatRing = (coords: { lat: number, lng: number }[]) => {
    const arr = coords.map(p => [p.lng, p.lat]);
    if (arr.length > 0) {
        const first = arr[0];
        const last = arr[arr.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) {
            arr.push(first);
        }
    }
    return arr;
};

const formatPolygonForBackend = (boundary: any) => {
    let coordinates: number[][][] = [];
    if (Array.isArray(boundary) && boundary.length > 0) {
        if ('lat' in boundary[0]) {
             coordinates = [toLngLatRing(boundary)];
        } 
        else if (Array.isArray(boundary[0])) {
             coordinates = boundary.map((ring: any) => toLngLatRing(ring));
        }
    }
    if (coordinates.length === 0) {
        coordinates = [[[0,0], [0,0], [0,0], [0,0]]];
    }
    return { type: "Polygon", coordinates: coordinates };
};

export const fetchGeeLayer = async (
    layer: string,
    boundary: any,
    backendUrl: string
): Promise<{ tile_url: string; stats?: { min: number; max: number } } | null> => {
    if (isOfflineMode() || !backendUrl) return null;
    try {
        const polygon = formatPolygonForBackend(boundary);
        const response = await fetch(`${backendUrl}/api/get-layer`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true'
            },
            body: JSON.stringify({ polygon, layer })
        });
        if (!response.ok) throw new Error(`Server ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error("GEE Layer Fetch Failed:", error);
        throw error;
    }
};

export interface GeeTimeSeriesPoint {
    date: string;
    value: number;
    ndvi: number;
    ndre: number | null;
    ndmi: number | null;
    sm: number | null;
}

export const fetchGeeTimeSeries = async (
    boundary: any,
    startDate: string,
    endDate: string,
    backendUrl: string
): Promise<GeeTimeSeriesPoint[] | null> => {
    if (isOfflineMode() || !backendUrl) return null;
    try {
        const polygon = formatPolygonForBackend(boundary);
        const enqueueRes = await fetch(`${backendUrl}/api/get-stats`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true'
            },
            body: JSON.stringify({ polygon, startDate, endDate })
        });
        if (!enqueueRes.ok) throw new Error(`Server Error (${enqueueRes.status})`);
        const { jobId } = await enqueueRes.json();
        const maxAttempts = 40; 
        for (let i = 0; i < maxAttempts; i++) {
            await new Promise(r => setTimeout(r, 2000));
            const jobRes = await fetch(`${backendUrl}/api/job/${jobId}?t=${Date.now()}`, {
                headers: { 'ngrok-skip-browser-warning': 'true' }
            });
            if (!jobRes.ok) continue; 
            const jobData = await jobRes.json();
            if (jobData.state === 'completed') return jobData.result;
            if (jobData.state === 'failed') return null;
        }
        throw new Error("Job timed out");
    } catch (error) {
        console.error("GEE Stats Error:", error);
        throw error;
    }
};