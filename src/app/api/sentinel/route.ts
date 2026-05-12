import { NextResponse } from 'next/server';

// Sentinel-1 SAR Satellite — STAC Catalog via Element84 Earth Search (free, no key)
// Provides radar imagery metadata for any region on Earth
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lat = parseFloat(searchParams.get('lat') || '0');
  const lng = parseFloat(searchParams.get('lng') || '0');
  const radius = parseFloat(searchParams.get('radius') || '2'); // degrees
  const days = parseInt(searchParams.get('days') || '7');

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ error: 'Missing lat/lng parameters' }, { status: 400 });
  }

  try {
    const bbox = [lng - radius, lat - radius, lng + radius, lat + radius];
    const now = new Date();
    const from = new Date(now.getTime() - days * 86400000);
    const datetime = `${from.toISOString().split('.')[0]}Z/${now.toISOString().split('.')[0]}Z`;

    // Element84 Earth Search — STAC API (free, no auth for search)
    const res = await fetch('https://earth-search.aws.element84.com/v1/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(10000),
      body: JSON.stringify({
        collections: ['sentinel-1-grd'],
        bbox,
        datetime,
        limit: 20,
        sortby: [{ field: 'datetime', direction: 'desc' }],
      }),
    });

    if (!res.ok) {
      // Fallback: try Copernicus STAC
      const fallbackRes = await fetch(`https://stac.dataspace.copernicus.eu/v1/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(10000),
        body: JSON.stringify({
          collections: ['SENTINEL-1'],
          bbox,
          datetime,
          limit: 10,
        }),
      });
      if (fallbackRes.ok) {
        const data = await fallbackRes.json();
        return NextResponse.json({
          source: 'copernicus',
          scenes: (data.features || []).map(formatScene),
          total: data.numberMatched || data.features?.length || 0,
          bbox,
          datetime,
        });
      }
      return NextResponse.json({ scenes: [], total: 0, error: 'SAR data unavailable' });
    }

    const data = await res.json();
    const scenes = (data.features || []).map(formatScene);

    return NextResponse.json({
      source: 'element84',
      scenes,
      total: data.numberMatched || scenes.length,
      bbox,
      datetime,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json({ error: 'Sentinel-1 lookup failed', scenes: [] }, { status: 500 });
  }
}

function formatScene(feature: any) {
  const props = feature.properties || {};
  return {
    id: feature.id,
    datetime: props.datetime,
    platform: props.platform || props['sar:instrument_mode'] || 'Sentinel-1',
    orbit: props['sat:orbit_state'] || props.orbitDirection,
    polarization: props['sar:polarizations'] || props.polarisation,
    mode: props['sar:instrument_mode'] || props.productType,
    resolution: props['sar:resolution_range'] || null,
    pass_direction: props['sat:relative_orbit'] || null,
    cloud_cover: props['eo:cloud_cover'] ?? null,
    bbox: feature.bbox,
    thumbnail: feature.assets?.thumbnail?.href || null,
    preview: feature.assets?.preview?.href || null,
    geometry_type: feature.geometry?.type,
    area_km2: feature.bbox ? estimateArea(feature.bbox) : null,
  };
}

function estimateArea(bbox: number[]): number {
  if (bbox.length < 4) return 0;
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const latDiff = Math.abs(maxLat - minLat) * 111; // ~111 km per degree
  const lngDiff = Math.abs(maxLng - minLng) * 111 * Math.cos((minLat + maxLat) / 2 * Math.PI / 180);
  return Math.round(latDiff * lngDiff);
}
