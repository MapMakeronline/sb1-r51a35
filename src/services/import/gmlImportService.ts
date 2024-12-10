import { Feature } from 'geojson';
import { parseGML } from '../../utils/parsers/gmlParser';
import { useNotificationStore } from '../../store/notificationStore';
import { useLoadingStore } from '../../store/loadingStore';
import { Layer } from '../firebase/layerService';

export interface GMLImportResult {
  layer: Omit<Layer, 'id'>;
  features: Feature[];
}

const DEFAULT_STYLE = {
  color: '#3b82f6',
  fillColor: '#93c5fd',
  weight: 2,
  opacity: 0.8,
  fillOpacity: 0.2
};

export async function importGMLFile(file: File): Promise<GMLImportResult> {
  const { addNotification } = useNotificationStore.getState();
  const { setLoading } = useLoadingStore.getState();
  
  try {
    setLoading(true, 'Processing GML file...');
    
    if (!file) {
      throw new Error('No file provided');
    }

    const maxSize = 10 * 1024 * 1024; // 10MB limit
    if (file.size > maxSize) {
      throw new Error('File size exceeds 10MB limit');
    }

    const { features, metadata } = await parseGML(file);
    const layerName = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9-_\s]/g, '');

    const result: GMLImportResult = {
      layer: {
        name: layerName || 'Imported GML Layer',
        type: 'layer',
        visible: true,
        data: {
          type: 'FeatureCollection',
          features
        },
        attributes: metadata.attributes,
        orderedColumns: metadata.orderedColumns,
        style: DEFAULT_STYLE,
        userId: 'anonymous',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      features
    };

    addNotification({
      type: 'success',
      message: `Successfully imported ${features.length} features`,
      timeout: 3000
    });

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error importing GML file';
    addNotification({
      type: 'error',
      message,
      timeout: 5000
    });
    throw error;
  } finally {
    setLoading(false);
  }
}