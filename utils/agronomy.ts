export interface WeatherData {
  tMax: number;
  tMin: number;
  rainfall: number;
  humidity: number;
}

export interface PhenologyEstimate {
  stage: string;
  desc: string;
  bbch: number | string;
  progress: number;
  gddAccumulated: number;
  confidence: number;
}

export interface YieldEstimate {
  totalTokens: string;
  perHaTokens: string;
  totalTonnage: number;
  perHaTonnage: number;
  confidence: number;
}

export interface RiskAssessment {
  level: 'Low' | 'Medium' | 'High';
  score: number;
  factors: string[];
}

export interface Recommendation {
  id: string;
  title: string;
  description: string;
  reason: string;
  category: 'Scouting' | 'Application' | 'Harvest' | 'General';
  severity: 'Info' | 'Warning' | 'Critical';
}

export interface FieldHealth {
  status: 'Healthy' | 'Watch' | 'Warning' | 'Critical';
  score: number;
  trend: 'Improving' | 'Stable' | 'Declining';
  anomalies: string[];
}

// 1. Growing Degree Days (GDD) Calculation
export const calculateDailyGDD = (tMax: number, tMin: number, baseTemp: number, maxTemp?: number): number => {
  let effectiveTMax = tMax;
  if (maxTemp !== undefined && tMax > maxTemp) {
    effectiveTMax = maxTemp;
  }
  let effectiveTMin = tMin < baseTemp ? baseTemp : tMin;
  
  const gdd = ((effectiveTMax + effectiveTMin) / 2) - baseTemp;
  return Math.max(0, gdd);
};

// Simulate accumulating GDD over dap (Days After Planting) for demo purposes
// In a real app, this would iterate historical daily weather data.
export const simulateAccumulatedGDD = (dap: number, avgTMax: number, avgTMin: number, baseTemp: number, maxTemp?: number): number => {
  const dailyGDD = calculateDailyGDD(avgTMax, avgTMin, baseTemp, maxTemp);
  return dailyGDD * dap;
};

// 2. Phenology Engine
export const getPhenologyEstimate = (crop: string, dap: number, lat: number, avgTMax: number, avgTMin: number): PhenologyEstimate => {
  const normCrop = crop.toLowerCase();
  let baseTemp = 5;
  let maxTemp: number | undefined = undefined;

  if (normCrop.includes('corn') || normCrop.includes('maize')) {
    baseTemp = 10;
    maxTemp = 30;
  } else if (normCrop.includes('wheat') || normCrop.includes('barley')) {
    baseTemp = 0; // Winter wheat base is often near 0
  }

  // Calculate GDD
  // Adjusting simulated daily temp based on latitude roughly for demo purposes
  const latFactor = Math.max(0.7, 1 - (Math.abs(lat) - 40) * 0.015);
  const simTMax = avgTMax * latFactor;
  const simTMin = avgTMin * latFactor;
  const gddAccumulated = Math.floor(simulateAccumulatedGDD(dap, simTMax, simTMin, baseTemp, maxTemp));

  let bbch = 0;
  let stage = "Unknown";
  let desc = "";
  let progress = 0;
  let confidence = Math.min(100, Math.max(50, 100 - (dap * 0.1))); // Confidence drops over time without ground truth

  if (normCrop.includes('wheat') || normCrop.includes('barley')) {
      if (gddAccumulated < 150) { bbch = 9; stage = "Emergence"; desc = "BBCH 00-09: Sprouting and emergence."; progress = 10; }
      else if (gddAccumulated < 300) { bbch = 15; stage = "Leaf Development"; desc = "BBCH 10-19: Unfolding of leaves."; progress = 20; }
      else if (gddAccumulated < 500) { bbch = 25; stage = "Tillering"; desc = "BBCH 20-29: Formation of side shoots."; progress = 35; }
      else if (gddAccumulated < 750) { bbch = 35; stage = "Stem Elongation"; desc = "BBCH 30-39: Jointing and node appearance."; progress = 50; }
      else if (gddAccumulated < 900) { bbch = 50; stage = "Booting & Heading"; desc = "BBCH 40-59: Ear emergence."; progress = 65; }
      else if (gddAccumulated < 1100) { bbch = 65; stage = "Flowering"; desc = "BBCH 60-69: Anthesis."; progress = 80; }
      else if (gddAccumulated < 1400) { bbch = 80; stage = "Grain Filling"; desc = "BBCH 70-89: Milk and dough development."; progress = 90; }
      else { bbch = 99; stage = "Maturation"; desc = "BBCH 90-99: Senescence and ready for harvest."; progress = 100; }
  } else if (normCrop.includes('corn') || normCrop.includes('maize')) {
      if (gddAccumulated < 100) { bbch = 9; stage = "Emergence (VE)"; desc = "BBCH 00-09: Emergence through soil."; progress = 10; }
      else if (gddAccumulated < 400) { bbch = 19; stage = "Vegetative (V1-V9)"; desc = "BBCH 10-19: Leaf development."; progress = 30; }
      else if (gddAccumulated < 800) { bbch = 39; stage = "Stem Elongation"; desc = "BBCH 30-39: Rapid vegetative growth."; progress = 50; }
      else if (gddAccumulated < 1000) { bbch = 65; stage = "Tasseling/Silking"; desc = "BBCH 50-69: Flowering and silk appearance."; progress = 70; }
      else if (gddAccumulated < 1300) { bbch = 85; stage = "Dough & Dent"; desc = "BBCH 70-89: Grain development."; progress = 90; }
      else { bbch = 99; stage = "Physiological Maturity"; desc = "BBCH 90-99: Black layer formation."; progress = 100; }
  } else {
      if (gddAccumulated < 200) { bbch = 15; stage = "Seedling"; desc = "Early vegetative establishment."; progress = 15; }
      else if (gddAccumulated < 600) { bbch = 35; stage = "Vegetative Growth"; desc = "Biomass accumulation."; progress = 45; }
      else if (gddAccumulated < 1000) { bbch = 65; stage = "Flowering"; desc = "Reproductive stage."; progress = 75; }
      else { bbch = 85; stage = "Maturation"; desc = "Crop ripening."; progress = 100; }
  }

  // Format BBCH as range for probabilistic reporting
  let bbchRange = `${bbch}`;
  if (bbch > 0 && bbch < 99) {
      if (bbch % 10 < 5) bbchRange = `${Math.floor(bbch/10)*10}-${bbch+2}`;
      else bbchRange = `${bbch - 2}-${Math.ceil(bbch/10)*10 - 1}`;
  }

  return { stage, desc, bbch: bbchRange, progress, gddAccumulated, confidence };
};

// 3. NDVI Analytics & Health
export const getFieldHealth = (currentNdvi: number, previousNdvi: number, stageProgress: number): FieldHealth => {
    let status: 'Healthy' | 'Watch' | 'Warning' | 'Critical' = 'Healthy';
    let trend: 'Improving' | 'Stable' | 'Declining' = 'Stable';
    let score = 85;
    const anomalies: string[] = [];

    const delta = currentNdvi - previousNdvi;
    
    if (delta > 0.05) { trend = 'Improving'; score += 10; }
    else if (delta < -0.05) { trend = 'Declining'; score -= 15; }

    if (currentNdvi <= 0) {
        status = 'Critical';
        score = 0;
        anomalies.push("Invalid or missing vegetation data");
    } else {
        // Expected NDVI based on simple progress curve
        let expectedNdvi = 0.2;
        if (stageProgress < 20) expectedNdvi = 0.3;
        else if (stageProgress < 50) expectedNdvi = 0.6;
        else if (stageProgress < 80) expectedNdvi = 0.8;
        else expectedNdvi = 0.5; // senescence

        const deviation = currentNdvi - expectedNdvi;
        
        if (deviation < -0.2 && stageProgress > 20 && stageProgress < 90) {
            status = 'Warning';
            score -= 20;
            anomalies.push("Significantly below expected biomass accumulation");
        } else if (deviation < -0.1) {
            status = 'Watch';
            score -= 10;
            anomalies.push("Slightly behind expected growth curve");
        }

        if (currentNdvi > 0.85) {
            anomalies.push("Canopy saturation detected in NDVI");
        }
    }

    // Clamp score
    score = Math.max(0, Math.min(100, score));
    if (score < 40) status = 'Critical';
    else if (score < 60) status = 'Warning';
    else if (score < 80) status = 'Watch';
    else status = 'Healthy';

    return { status, score, trend, anomalies };
};

// 4. Yield Estimation
export const getYieldEstimate = (crop: string, ndvi: number, sizeRaw: string, healthScore: number, gddProgress: number): YieldEstimate | null => {
    const size = parseFloat(sizeRaw) || 0;
    if (size === 0) return null;
    
    let baseYield = 5; 
    const normCrop = crop.toLowerCase();
    
    if (normCrop.includes('wheat')) baseYield = 6.5; 
    if (normCrop.includes('corn') || normCrop.includes('maize')) baseYield = 10;
    if (normCrop.includes('soy')) baseYield = 3.5;
    if (normCrop.includes('potato')) baseYield = 40;
    if (normCrop.includes('beet')) baseYield = 60;

    // Environmental / Health modifier (max 20% deviation based on health)
    const healthMod = 0.8 + ((healthScore / 100) * 0.4);
    
    // Growth stage confidence
    const phenologyConfidence = gddProgress > 50 ? 80 : 40;
    
    // Final modifier
    const modifier = ndvi > 0 ? Math.max(0.6, Math.min(1.2, (ndvi / 0.7) * healthMod)) : 1.0;
    
    const perHaTonnage = baseYield * modifier;
    const totalTonnage = perHaTonnage * size;

    return { 
        totalTonnage, 
        perHaTonnage,
        totalTokens: totalTonnage.toFixed(1), 
        perHaTokens: perHaTonnage.toFixed(2),
        confidence: Math.round((phenologyConfidence + healthScore) / 2)
    };
};

// 5. Disease Risk Scoring
export const getDiseaseRisk = (weather: WeatherData, bbchRaw: string | number): RiskAssessment => {
    let score = 0;
    const factors: string[] = [];
    const bbchBase = typeof bbchRaw === 'string' ? parseInt(bbchRaw.split('-')[0]) : bbchRaw;

    if (weather.humidity > 80) { score += 30; factors.push("High sustained humidity"); }
    else if (weather.humidity > 60) { score += 10; factors.push("Moderate humidity"); }

    if (weather.rainfall > 10) { score += 20; factors.push("Recent significant rainfall"); }

    if (weather.tMax > 15 && weather.tMax < 25) { score += 10; factors.push("Optimal fungal temperature range"); }

    if (bbchBase >= 60 && bbchBase <= 69) {
        score += 20;
        factors.push("Crop in highly susceptible flowering stage");
    } else if (bbchBase >= 30 && bbchBase <= 39) {
        score += 10;
        factors.push("Canopy closure increasing microclimate humidity");
    }

    let level: 'Low' | 'Medium' | 'High' = 'Low';
    if (score > 60) level = 'High';
    else if (score > 35) level = 'Medium';

    return { level, score, factors };
};

// 6. Recommendations Engine
export const getRecommendations = (phenology: PhenologyEstimate, health: FieldHealth, risk: RiskAssessment): Recommendation[] => {
    const recs: Recommendation[] = [];
    const bbchBase = typeof phenology.bbch === 'string' ? parseInt(phenology.bbch.split('-')[0]) : phenology.bbch;

    // Early Stage
    if (bbchBase < 20) {
        recs.push({
            id: 'weed-1',
            title: 'Early Weed Competition Scouting',
            description: 'Scout for pre-emergence or early weed pressure before canopy closure.',
            reason: `Crop is in establishment stage (estimated BBCH ${phenology.bbch}). Minimizing weed completion now protects yield potential.`,
            category: 'Scouting',
            severity: 'Info'
        });
        if (health.status === 'Watch' || health.status === 'Warning') {
             recs.push({
                id: 'emergence-1',
                title: 'Confirm Stand Establishment',
                description: 'Physically inspect field for poor germination or pest damage.',
                reason: 'NDVI anomalies detected early in the season often indicate uneven emergence.',
                category: 'Scouting',
                severity: 'Warning'
            });
        }
    }

    // Vegetative / Stem Elongation
    if (bbchBase >= 30 && bbchBase < 40) {
        recs.push({
            id: 'n-top',
            title: 'Nitrogen Top-Dressing Consideration',
            description: 'Evaluate need for N-fertilization based on local soil tests and VRA maps.',
            reason: 'Crop is in rapid vegetative growth phase with high nutrient demand.',
            category: 'Application',
            severity: 'Info'
        });
        
        if (risk.level === 'High' || risk.level === 'Medium') {
             recs.push({
                id: 'fung-t1',
                title: 'Early Fungicide Timing (T1)',
                description: 'Consider protective fungicides on newly emerging leaves.',
                reason: `Environmental risk is ${risk.level}. Protecting lower canopy limits disease spread.`,
                category: 'Application',
                severity: 'Warning'
            });
        }
    }

    // Flowering
    if (bbchBase >= 60 && bbchBase < 70) {
        if (risk.level === 'High') {
             recs.push({
                id: 'fusarium-1',
                title: 'Head Blight / Flowering Disease Risk',
                description: 'High risk of flowering diseases (e.g., Fusarium) due to wet/humid conditions.',
                reason: `Crop is at flowering (BBCH ${phenology.bbch}) concurrent with high moisture. Monitor closely for intervention.`,
                category: 'Application',
                severity: 'Critical'
            });
        }
        if (health.anomalies.some(a => a.includes("biomass"))) {
             recs.push({
                id: 'drought-1',
                title: 'Flowering Stress Alert',
                description: 'Monitor moisture levels. Stress during anthesis severely cuts yield.',
                reason: 'Anomalies detected in biomass trajectory during critical reproductive phase.',
                category: 'Scouting',
                severity: 'Warning'
            });
        }
    }

    // Maturation / Harvest
    if (bbchBase >= 80) {
        recs.push({
            id: 'harvest-1',
            title: 'Grain Moisture Sampling',
            description: 'Begin physical sampling to check if moisture level has reached the harvest threshold.',
            reason: `Estimated BBCH ${phenology.bbch} indicates grain filling is complete.`,
            category: 'Harvest',
            severity: 'Info'
        });
        recs.push({
            id: 'harvest-2',
            title: 'Harvest Logistics Planning',
            description: 'Ready telematics, combine header calibration, and silo intake routing.',
            reason: 'Approaching maturity. Prepare operational logistics to minimize downtime.',
            category: 'General',
            severity: 'Info'
        });
    }

    // General Health Alerts
    if (health.status === 'Critical') {
        recs.push({
            id: 'crit-health',
            title: 'Critical Health Decline',
            description: 'Immediate ground truthing required. Check for severe pest, disease, or abiotic damage.',
            reason: `Health score is ${health.score}/100 with declining trajectory.`,
            category: 'Scouting',
            severity: 'Critical'
        });
    }

    return recs;
};
