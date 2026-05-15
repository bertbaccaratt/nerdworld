import { NextResponse } from 'next/server';

/**
 * OSIRIS — War Simulator / Kinetic OSINT Feed
 * Fetches real-time GDELT data for kinetic strikes (missiles, airstrikes)
 * Uses geopolitical inference to calculate origin coordinates.
 */

// Geopolitical Inference Engine
function inferOrigin(targetLat: number, targetLng: number): { lat: number; lng: number; name: string } {
  // Israel targets
  if (targetLat >= 29.5 && targetLat <= 33.5 && targetLng >= 34.0 && targetLng <= 36.0) {
    if (targetLat > 32.5) return { lat: 33.3, lng: 35.4, name: 'Southern Lebanon' }; // North Israel
    if (targetLat < 30.0) return { lat: 15.3, lng: 44.2, name: 'Yemen (Houthi)' }; // Eilat
    return { lat: 31.5, lng: 34.4, name: 'Gaza Strip' }; // Central/South Israel
  }
  // Lebanon targets
  if (targetLat >= 33.0 && targetLat <= 34.5 && targetLng >= 35.0 && targetLng <= 36.5) {
    return { lat: 32.8, lng: 34.98, name: 'Israel' };
  }
  // Gaza targets
  if (targetLat >= 31.3 && targetLat <= 31.6 && targetLng >= 34.2 && targetLng <= 34.6) {
    return { lat: 31.65, lng: 34.6, name: 'Israel' };
  }
  // Yemen targets
  if (targetLat >= 12.0 && targetLat <= 17.0 && targetLng >= 42.0 && targetLng <= 50.0) {
    return { lat: 29.55, lng: 34.95, name: 'Israel / US / UK Coalition' };
  }
  // Ukraine targets
  if (targetLat >= 44.0 && targetLat <= 52.0 && targetLng >= 22.0 && targetLng <= 40.0) {
    if (targetLat < 47.0) return { lat: 44.5, lng: 33.5, name: 'Black Sea Fleet (Russia)' }; // Odesa/South
    return { lat: 50.6, lng: 36.6, name: 'Belgorod (Russia)' }; // North/East
  }
  // Russia targets (near border)
  if (targetLat >= 50.0 && targetLat <= 55.0 && targetLng >= 30.0 && targetLng <= 45.0) {
    return { lat: 50.0, lng: 36.2, name: 'Kharkiv (Ukraine)' };
  }
  // Syria targets
  if (targetLat >= 32.5 && targetLat <= 37.5 && targetLng >= 35.5 && targetLng <= 42.5) {
    return { lat: 33.1, lng: 35.8, name: 'Israel (Golan Heights)' };
  }

  // Default fallback (local skirmish / unknown origin)
  return { 
    lat: targetLat + (Math.random() - 0.5) * 2, 
    lng: targetLng + (Math.random() - 0.5) * 2, 
    name: 'Unknown Origin' 
  };
}

function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

// In-memory cache for live alerts to simulate T-Minus and state over time
let liveAlertsState: any[] = [];
let lastFetch = 0;

export async function GET() {
  try {
    const now = Date.now();
    
    // Only fetch from GDELT every 60 seconds to avoid API bans
    if (now - lastFetch > 60000 || liveAlertsState.length === 0) {
      lastFetch = now;
      
      // Query GDELT for recent kinetic events
      const url = 'https://api.gdeltproject.org/api/v2/geo/geo?query=missile%20OR%20rocket%20OR%20airstrike%20OR%20"drone%20strike"&mode=PointData&format=GeoJSON&timespan=24h&maxpoints=20';
      
      const res = await fetch(url, {
        signal: AbortSignal.timeout(10000)
      });

      if (res.ok) {
        const data = await res.json();
        const features = data.features || [];

        const newAlerts = features.map((f: any) => {
          const targetLng = f.geometry?.coordinates?.[0];
          const targetLat = f.geometry?.coordinates?.[1];
          if (!targetLat || !targetLng) return null;

          const originData = inferOrigin(targetLat, targetLng);
          const nameStr = (f.properties?.name || 'Unknown Location').split(',')[0];
          const htmlContent = f.properties?.html || '';
          
          // Try to extract a clean URL from GDELT HTML
          let cleanUrl = f.properties?.url || '';
          if (!cleanUrl && htmlContent.includes('href="')) {
            cleanUrl = htmlContent.split('href="')[1].split('"')[0];
          }

          // Determine type based on keywords
          const text = (nameStr + ' ' + htmlContent).toLowerCase();
          const type = text.includes('ballistic') ? 'BALLISTIC_MISSILE' :
                       text.includes('cruise') ? 'CRUISE_MISSILE' :
                       text.includes('drone') || text.includes('uav') ? 'DRONE_STRIKE' :
                       text.includes('airstrike') ? 'AIRSTRIKE' : 'ROCKET';

          // Simulate flight time (since GDELT reports are slightly delayed, we mock a 3-5 minute active window from "now")
          const flightDuration = 180000 + Math.random() * 120000;

          return {
            id: `alert-${generateId()}`,
            city: nameStr,
            originName: originData.name,
            type: type,
            launchTime: now,
            impactTime: now + flightDuration,
            origin: [originData.lng, originData.lat], // [lng, lat] for GeoJSON
            target: [targetLng, targetLat],
            threatLevel: type.includes('MISSILE') ? 'CRITICAL' : 'HIGH',
            status: 'ACTIVE',
            source: 'GDELT_LIVE_OSINT',
            sourceUrl: cleanUrl
          };
        }).filter(Boolean);

        // Merge with existing state, keeping only non-expired alerts
        liveAlertsState = [...liveAlertsState, ...newAlerts].filter((a, i, self) => 
          a.impactTime > now && self.findIndex(t => t.city === a.city && t.type === a.type) === i
        ).slice(0, 8); // Keep max 8 active alerts for UI cleanliness
      }
    }

    // Filter out expired alerts on every request
    liveAlertsState = liveAlertsState.filter(a => a.impactTime > Date.now());

    // Calculate T-Minus
    const formattedAlerts = liveAlertsState.map(a => ({
      ...a,
      timeToImpactMs: Math.max(0, a.impactTime - Date.now())
    })).sort((a, b) => a.timeToImpactMs - b.timeToImpactMs);

    return NextResponse.json({
      alerts: formattedAlerts,
      defcon: formattedAlerts.length >= 3 ? 2 : formattedAlerts.length > 0 ? 3 : 4,
      timestamp: new Date().toISOString()
    }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0'
      }
    });

  } catch (error) {
    console.error('War simulator engine error:', error);
    return NextResponse.json({ alerts: [], error: 'OSINT engine failed' }, { status: 500 });
  }
}
