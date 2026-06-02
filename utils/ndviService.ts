
// This service currently simulates NDVI data.
// FUTURE INTEGRATION: Replace these functions with calls to Sentinel Hub or Agromonitoring APIs.

export interface NdviPoint {
    date: string;
    ndvi: number;
    ndre: number | null;
    ndmi: number | null;
    value?: number; // Legacy alias for backward compatibility
}

export const generateMockNdviHistory = (plantingDate: string, cropType: string): NdviPoint[] => {
    const history: NdviPoint[] = [];
    const start = new Date(plantingDate);
    const today = new Date();
    
    // Create a curve that simulates crop growth
    // 0.2 (soil) -> 0.8 (peak biomass) -> 0.4 (harvest/senescence)
    
    let currentDate = new Date(start);
    let daysSincePlanting = 0;

    while (currentDate <= today) {
        // Only add data points every ~5 days (Sentinel-2 revisit time)
        if (daysSincePlanting % 5 === 0) {
            // Simple growth curve simulation (Logistic function shape)
            const growthRate = 0.05;
            const peakDay = 90; // Approx 3 months to peak
            
            // Base calculation
            let val = 0.2 + (0.7 / (1 + Math.exp(-growthRate * (daysSincePlanting - peakDay))));
            
            // Add some "noise" to simulate real world clouds/variations
            val += (Math.random() * 0.1 - 0.05);
            
            // Clamp values
            const ndvi = parseFloat(Math.max(0.1, Math.min(0.95, val)).toFixed(3));
            
            // Simulate other indices correlated with NDVI but slightly different
            const ndre = parseFloat(Math.max(0.1, Math.min(0.8, ndvi * 0.85 + 0.05)).toFixed(3));
            const ndmi = parseFloat(Math.max(-0.2, Math.min(0.6, ndvi * 0.6)).toFixed(3));

            history.push({
                date: currentDate.toISOString().split('T')[0],
                ndvi: ndvi,
                ndre: ndre,
                ndmi: ndmi,
                value: ndvi // Legacy
            });
        }

        currentDate.setDate(currentDate.getDate() + 1);
        daysSincePlanting++;
    }

    return history;
};

// Returns a color based on NDVI value
export const getNdviColor = (value: number): string => {
    if (value < 0.2) return '#a1662f'; // Bare soil (Brown)
    if (value < 0.4) return '#eab308'; // Sparse/Stressed (Yellow)
    if (value < 0.6) return '#84cc16'; // Moderate (Light Green)
    if (value < 0.8) return '#22c55e'; // Dense (Green)
    return '#14532d'; // Very Dense (Dark Green)
};