import { Feature } from 'geojson';
import { Buffer } from 'buffer';
import { puwg1992ToWgs84 } from '../coordinates/coordinateTransform';

export function parseWKB(wkbHex: string): Feature | null {
  try {
    if (!wkbHex?.trim()) return null;

    // Clean WKB string
    wkbHex = wkbHex.replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
    
    // Handle SRID prefix if present
    const hasSRID = wkbHex.startsWith('01') && wkbHex.length >= 18;
    const dataStart = hasSRID ? 18 : 10;

    // Parse number of rings
    const numRings = parseInt(wkbHex.substring(dataStart, dataStart + 8), 16);
    if (numRings <= 0) return null;

    let offset = dataStart + 8;
    const rings: number[][][] = [];

    for (let ring = 0; ring < numRings; ring++) {
      // Parse number of points in this ring
      const numPoints = parseInt(wkbHex.substring(offset, offset + 8), 16);
      if (numPoints < 3) return null;
      offset += 8;

      const coordinates: number[][] = [];

      // Parse points
      for (let i = 0; i < numPoints; i++) {
        const x = Buffer.from(wkbHex.substring(offset, offset + 16), 'hex').readDoubleLE(0);
        offset += 16;
        const y = Buffer.from(wkbHex.substring(offset, offset + 16), 'hex').readDoubleLE(0);
        offset += 16;

        // Convert from PUWG1992 to WGS84
        const { lat, lng } = puwg1992ToWgs84(x, y);
        coordinates.push([lng, lat]);
      }

      rings.push(coordinates);
    }

    return {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: rings
      }
    };
  } catch (error) {
    console.error('WKB parsing error:', error);
    return null;
  }
}