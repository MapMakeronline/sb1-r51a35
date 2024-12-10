import { xml2js } from 'xml-js';
import { Feature, FeatureCollection } from 'geojson';
import { mercatorToWgs84 } from '../coordinates/coordinateTransform';
import { cleanString } from '../string/stringCleaner';

interface GMLParseResult {
  features: Feature[];
  metadata: {
    attributes: Record<string, any>[];
    orderedColumns: string[];
  };
}

function parseGMLGeometry(gmlGeometry: any): any {
  try {
    if (gmlGeometry['gml:MultiPolygon']) {
      const polygons = gmlGeometry['gml:MultiPolygon']['gml:polygonMember'];
      if (!polygons) return null;

      const coordinates = (Array.isArray(polygons) ? polygons : [polygons])
        .map(polygon => {
          const coords = polygon?.['gml:Polygon']?.['gml:outerBoundaryIs']?.['gml:LinearRing']?.['gml:coordinates']?._text;
          if (!coords) return null;

          return coords.split(' ')
            .map(pair => {
              const [x, y] = pair.split(',').map(Number);
              const { lat, lng } = mercatorToWgs84(x, y);
              return [lng, lat];
            })
            .filter(coord => coord.every(n => isFinite(n)));
        })
        .filter(Boolean);

      if (coordinates.length === 0) return null;

      return {
        type: 'MultiPolygon',
        coordinates: [coordinates]
      };
    }
    return null;
  } catch (error) {
    console.error('Error parsing GML geometry:', error);
    return null;
  }
}

function extractProperties(featureData: any): Record<string, any> {
  const properties: Record<string, any> = {};
  
  Object.entries(featureData).forEach(([key, value]: [string, any]) => {
    if (key === '_attributes' || key.includes('geometry')) return;
    
    if (typeof value === 'object' && value._text !== undefined) {
      properties[cleanString(key)] = cleanString(value._text);
    }
  });

  return properties;
}

export async function parseGML(file: File): Promise<GMLParseResult> {
  try {
    const text = await file.text();
    const result = xml2js(text, { compact: true });
    
    const features: Feature[] = [];
    const attributes: Record<string, any>[] = [];
    const propertyKeys = new Set<string>();
    
    const featureMembers = result?.['wfs:FeatureCollection']?.['gml:featureMember'] || 
                          result?.['ogr:FeatureCollection']?.['gml:featureMember'] || [];
                          
    if (!featureMembers || (Array.isArray(featureMembers) && featureMembers.length === 0)) {
      throw new Error('No features found in GML file');
    }
    
    const members = Array.isArray(featureMembers) ? featureMembers : [featureMembers];
    
    members.forEach((member: any, index) => {
      const featureTypeKey = Object.keys(member).find(key => key !== '_attributes');
      if (!featureTypeKey) return;
      
      const featureData = member[featureTypeKey];
      const properties = {
        id: `feature-${index + 1}`,
        ...extractProperties(featureData)
      };
      
      Object.keys(properties).forEach(key => propertyKeys.add(key));
      
      const geometry = parseGMLGeometry(featureData);
      if (!geometry) return;
      
      features.push({
        type: 'Feature',
        properties,
        geometry
      });
      
      attributes.push({
        ...properties,
        geometry
      });
    });
    
    if (features.length === 0) {
      throw new Error('No valid features found in the GML file');
    }
    
    return {
      features,
      metadata: {
        attributes,
        orderedColumns: ['id', ...Array.from(propertyKeys)]
      }
    };
  } catch (error) {
    console.error('Error parsing GML:', error);
    throw error;
  }
}