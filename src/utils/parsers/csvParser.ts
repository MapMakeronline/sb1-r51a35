import { Feature } from 'geojson';
import { parseWKB } from '../geometry/wkbParser';
import { useNotificationStore } from '../../store/notificationStore';

interface CSVParseResult {
  headers: string[];
  data: Record<string, any>[];
}

export async function parseCSV(content: string): Promise<CSVParseResult> {
  const { addNotification } = useNotificationStore.getState();

  try {
    // Split into lines and filter out empty ones
    const lines = content.trim().split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      throw new Error('CSV file must have header and data rows');
    }

    // Parse headers and detect delimiter
    const firstLine = lines[0];
    const delimiter = firstLine.includes('\t') ? '\t' : 
                     firstLine.includes(';') ? ';' : ',';

    const headers = firstLine.split(delimiter)
      .map(h => h.trim())
      .filter(Boolean);

    // Parse data rows
    const data: Record<string, any>[] = [];
    let skippedRows = 0;

    for (let i = 1; i < lines.length; i++) {
      try {
        const values = lines[i].split(delimiter)
          .map(v => v.trim());

        // Ensure row has correct number of columns
        if (values.length !== headers.length) {
          skippedRows++;
          continue;
        }

        // Create row object
        const row: Record<string, any> = {
          id: `row-${i}`
        };

        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });

        data.push(row);
      } catch (error) {
        console.warn(`Error processing row ${i + 1}:`, error);
        skippedRows++;
      }
    }

    if (skippedRows > 0) {
      addNotification({
        type: 'warning',
        message: `Skipped ${skippedRows} invalid rows`,
        timeout: 5000
      });
    }

    if (data.length === 0) {
      throw new Error('No valid data rows found');
    }

    return { headers, data };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to parse CSV file';
    addNotification({
      type: 'error',
      message,
      timeout: 5000
    });
    throw error;
  }
}

export async function processGeometryColumn(
  data: Record<string, any>[],
  geometryColumn: string
): Promise<Feature[]> {
  const { addNotification } = useNotificationStore.getState();
  const features: Feature[] = [];
  let skippedRows = 0;

  for (const row of data) {
    try {
      const wkbHex = row[geometryColumn]?.toString().trim();
      if (!wkbHex) {
        skippedRows++;
        continue;
      }

      const feature = parseWKB(wkbHex);
      if (feature && feature.geometry) {
        features.push({
          ...feature,
          properties: {
            ...row,
            id: row.id || `feature-${features.length + 1}`
          }
        });
      } else {
        skippedRows++;
      }
    } catch (error) {
      console.warn('Error processing geometry:', error);
      skippedRows++;
    }
  }

  if (skippedRows > 0) {
    addNotification({
      type: 'warning',
      message: `Skipped ${skippedRows} rows with invalid geometry`,
      timeout: 5000
    });
  }

  if (features.length === 0) {
    throw new Error('No valid geometries found in selected column');
  }

  return features;
}