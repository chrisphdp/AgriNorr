
const ee = require('@google/earthengine');
const Queue = require('bull');
const fs = require('fs');
const path = require('path');

// --- CREDENTIALS (FALLBACK) ---
const FALLBACK_KEY = {
  "type": "service_account",
  "project_id": "cppwapp-b12ab",
  "private_key_id": "d8a61919571bd5997dcc4880090544a055d9e0e0",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCzGtz/X5skKo3+\nz3ZVcFjetNVAc43YHA/zBt7Ahc/jOcY4O0GoWDOMLwioJEgl8FGsGTL8JhREeliD\nPZJpLk+qUB4WQv9H78Pe3ONvRxbeZfwRyXZCidE62dDHsAAbuxyaqVNQFlxQ/YTZ\nBR32SeNhQSK1/cjiHNZ5q78Fw/F1mMaaqrvvP9uwjLefbX+/miZpOI1tVMnXR67h\nW+3V7D+YIRty9HihkS6ridoLZZlPb8Yv7M+q9GG/dmykWdPwY8qwCY++ZhHRWD3b\n5GAnBPrEMUVzbfbW9BSC7iHdSDAJovYCzu3uUV1yybodaEERi2i9txzzule9HyNY\nHEPgXLBVAgMBAAECggEANPFZZ2Gu/fNYUvyneZ0CoB5rNSiTQtEUw92Bhf5oE751\nwhR+FZGw9xzGHdHPw+s0cT9nq1JkRlO2C2FtgIrwgKM7KZB3Xp/Y0e2Qi0nD0Ezs\nRKO9QfD0OMW/Ke/0MD5Qt8Uau/9IHaa7GN2i3DU+MfbrmEljEre8jG3AwycHHp/g\n0bzpYvZoT+nSKh0kRb5E/NvNpzLuP2DJhQ2aqIrGfxxx8cifLTBFZ0Dkl0JH/fLO\nGoWAjTIrQ9Jh7jMgOgatTgnr2InbXnNO9at7c0hpfEiWIilgG59hlQItAtpD7kR6\nEWnLUqSPb1W4tsI7BA4DfgoY5OIugfpK1iJzyI1q1wKBgQD65SuSXR44HoOKsjz5\nXaoFMSUOBFNjShwk1J0jPfvnLmvnQl4hWrwHtzcyt5vCNHxNk2b2ZcWtIJPevBqs\n5nPnKCFcWUXPZRiYzVfQKdksXvzDH0XG6f2fTV8A2esZ4iQsHisdbve8Zf6iWMjB\nL9cAXIuWUBCyt7S4HtiwYxFDxwKBgQC2v8Ls3VT0SaNKMp8lWxegC2gtP5Ho3q1k\n2k9iASrrKaM30h8sD5HgGOqz9V16JpNz/sWl2y9mW3Sa/sUuwQ9NWcI11WoammlY\nOjX98bdDV49hZQgr16QfHGNyo6+q4K3tZUeB3WFVCnqMleCJyEDEHVuq6eW2iqeV\nyfXKF5XzAwKBgQD2WduEpYYsmFmU8BpKyBtPacf2kWzHi1dDGrkIh642ezBcLKB8\no7kI4m+CjyKTeDGtglSRD7Efo2NOSujuaIHZsV/Aa6/OSnfyYX4d2Vly5fnOJYDA\nJbVwm+nyzga4rYHTB/RRvEnoZUW3ZvIILs8vfa9Z8lfTA+qg9zjRSRUEtQKBgAsN\ntkCVcpoECjhmr3GW/OrVRcvW2IB5V4uOGNcYsvveXNz3fKMxneUsHKYd5TWKN8kA\nU/wgMdHDHl5xooOdcct/7ltLOUu6ozyO6M0fXbJZDXcaoU/ljyvCj9FTTUDMrjh5\ns8WLGmQGajsupZIv5pr2G6FO3HIaGODagl9i5dL5AoGBAKrqgKweKz7kodL2eQFU\nKBoIJzg+rYM/nzuCQHY0coHdwgWlKdC/34VlZ8BG7sDQReespPVcYpIH4y8TTl9O\noMvq8LpDITyYn9wFnf00yd4sOwMK7YhUflsAflQrorGt2Ho1HIda7LhCKYRK7R7D\nSsH7FaG8/zhlom4/Za6OBF/5\n-----END PRIVATE KEY-----\n",
  "client_email": "earthengine-service@cppwapp-b12ab.iam.gserviceaccount.com"
};

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const EE_KEY_FILE = process.env.EE_KEY_FILE || './service-account-key.json';

const ndviQueue = new Queue('ndvi-jobs', { redis: REDIS_URL });

function eeInitializeWithPrivateKey(keyObj) {
  return new Promise((resolve, reject) => {
    ee.data.authenticateViaPrivateKey(keyObj, () => {
      ee.initialize(null, null, () => resolve(), (err) => reject(err));
    }, (err) => reject(err));
  });
}

async function initializeEarthEngine() {
  let keyObj = null;
  if (process.env.EE_PRIVATE_KEY && process.env.EE_CLIENT_EMAIL) {
    keyObj = { private_key: process.env.EE_PRIVATE_KEY.replace(/\\n/g, '\n'), client_email: process.env.EE_CLIENT_EMAIL };
  } else if (fs.existsSync(EE_KEY_FILE)) {
    keyObj = require(path.resolve(EE_KEY_FILE));
  } else {
    console.log("Worker: No key file found, using fallback credentials.");
    keyObj = FALLBACK_KEY;
  }
  await eeInitializeWithPrivateKey(keyObj);
}

// --- CLOUD MASKING HELPERS ---

function maskS2Clouds(image) {
  const qa = image.select('QA60');
  const cloudBitMask = 1 << 10;
  const cirrusBitMask = 1 << 11;
  const mask = qa.bitwiseAnd(cloudBitMask).eq(0)
    .and(qa.bitwiseAnd(cirrusBitMask).eq(0));
  // Explicitly copy 'system:time_start' to ensure it survives .divide()
  return image.updateMask(mask).divide(10000).copyProperties(image, ['system:time_start']);
}

function maskLandsatClouds(image) {
  const qa = image.select('QA_PIXEL');
  const mask = qa.bitwiseAnd(1 << 3).eq(0)
      .and(qa.bitwiseAnd(1 << 4).eq(0));
  // Explicitly copy 'system:time_start' to ensure it survives arithmetic operations
  return image.updateMask(mask)
      .select('SR_B.').multiply(0.0000275).add(-0.2)
      .copyProperties(image, ['system:time_start']);
}

function computeMultiIndexTimeSeries(polygon, months, startDate, endDate) {
  return new Promise((resolve, reject) => {
    try {
      const region = ee.Geometry(polygon);
      
      let start, end;

      if (startDate && endDate) {
          start = ee.Date(startDate);
          end = ee.Date(endDate);
      } else {
          end = ee.Date(Date.now());
          start = end.advance(-(months || 6), 'month');
      }

      // 1. Sentinel-2
      const s2 = ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
        .filterBounds(region)
        .filterDate(start, end)
        .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 40))
        .map(maskS2Clouds)
        .map(img => {
            const ndvi = img.normalizedDifference(['B8', 'B4']).rename('NDVI');
            const ndre = img.normalizedDifference(['B8', 'B5']).rename('NDRE'); // B5 is Red Edge
            const ndmi = img.normalizedDifference(['B8', 'B11']).rename('NDMI');
            return img.addBands([ndvi, ndre, ndmi]).select(['NDVI', 'NDRE', 'NDMI']);
        });

      // 2. Landsat 9
      const l9 = ee.ImageCollection("LANDSAT/LC09/C02/T1_L2")
        .filterBounds(region)
        .filterDate(start, end)
        .filter(ee.Filter.lt('CLOUD_COVER', 40))
        .map(maskLandsatClouds)
        .map(img => {
            const ndvi = img.normalizedDifference(['SR_B5', 'SR_B4']).rename('NDVI');
            const ndmi = img.normalizedDifference(['SR_B5', 'SR_B6']).rename('NDMI');
            // NDRE is not natively supported by Landsat (no red edge band). 
            // We masked it so it returns null for Landsat entries.
            const ndre = ee.Image.constant(0).selfMask().rename('NDRE');
            return img.addBands([ndvi, ndre, ndmi]).select(['NDVI', 'NDRE', 'NDMI']);
        });

      // 3. Landsat 8
      const l8 = ee.ImageCollection("LANDSAT/LC08/C02/T1_L2")
        .filterBounds(region)
        .filterDate(start, end)
        .filter(ee.Filter.lt('CLOUD_COVER', 40))
        .map(maskLandsatClouds)
        .map(img => {
            const ndvi = img.normalizedDifference(['SR_B5', 'SR_B4']).rename('NDVI');
            const ndmi = img.normalizedDifference(['SR_B5', 'SR_B6']).rename('NDMI');
            const ndre = ee.Image.constant(0).selfMask().rename('NDRE');
            return img.addBands([ndvi, ndre, ndmi]).select(['NDVI', 'NDRE', 'NDMI']);
        });

      const collection = s2.merge(l9).merge(l8).sort('system:time_start');

      const timeSeries = collection.map(image => {
        const stats = image.reduceRegion({
            reducer: ee.Reducer.mean(),
            geometry: region,
            scale: 10,
            maxPixels: 1e9
        });

        return ee.Feature(null, {
            'ndvi': stats.get('NDVI'),
            'ndre': stats.get('NDRE'),
            'ndmi': stats.get('NDMI'),
            'date': image.date().format('YYYY-MM-DD')
        });
      }).filter(ee.Filter.notNull(['ndvi']));

      timeSeries.evaluate((data, error) => {
        if (error) {
            reject(new Error(error));
        } else {
            if (!data || !data.features) {
                resolve([]);
                return;
            }
            const points = data.features
                .map(f => ({
                    date: f.properties.date,
                    ndvi: typeof f.properties.ndvi === 'number' ? Number(f.properties.ndvi.toFixed(3)) : null,
                    ndre: typeof f.properties.ndre === 'number' ? Number(f.properties.ndre.toFixed(3)) : null,
                    ndmi: typeof f.properties.ndmi === 'number' ? Number(f.properties.ndmi.toFixed(3)) : null,
                    value: typeof f.properties.ndvi === 'number' ? Number(f.properties.ndvi.toFixed(3)) : 0 // legacy
                }))
                .filter(p => p.ndvi !== null && p.ndvi > 0.05 && p.ndvi <= 1.0)
                .reduce((acc, current) => {
                    // Remove duplicates for same day (e.g. tile overlap)
                    const exists = acc.find(item => item.date === current.date);
                    if (!exists) return acc.concat([current]);
                    return acc;
                }, [])
                .sort((a, b) => new Date(a.date) - new Date(b.date));

            resolve(points);
        }
      });

    } catch (err) {
      reject(err);
    }
  });
}

(async () => {
  try {
    await initializeEarthEngine();
    console.log('Worker: Earth Engine initialized');

    ndviQueue.process(async (job) => {
      console.log('Worker: processing job', job.id);
      const { polygon, months, startDate, endDate } = job.data;
      const result = await computeMultiIndexTimeSeries(polygon, months, startDate, endDate);
      return result;
    });

    ndviQueue.on('completed', (job, result) => {
      console.log('Job completed', job.id);
    });

    ndviQueue.on('failed', (job, err) => {
      console.error('Job failed', job.id, err);
    });

  } catch (err) {
    console.error('Worker init failed', err);
    process.exit(1);
  }
})();
