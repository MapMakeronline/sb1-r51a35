import { useNotificationStore } from '../../store/notificationStore';

export interface TableParseResult {
  headers: string[];
  data: Record<string, any>[];
  orderedColumns: string[];
}

export async function parseTableFile(file: File): Promise<TableParseResult> {
  const { addNotification } = useNotificationStore.getState();

  try {
    const text = await file.text();
    const lines = text.trim().split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      throw new Error('File must have header and data rows');
    }

    // Detect delimiter
    const firstLine = lines[0];
    const delimiter = firstLine.includes('\t') ? '\t' : 
                     firstLine.includes(';') ? ';' : ',';

    // Parse headers
    const headers = firstLine
      .split(delimiter)
      .map(h => h.trim())
      .filter(Boolean);

    // Parse data rows
    const data: Record<string, any>[] = [];
    let skippedRows = 0;

    for (let i = 1; i < lines.length; i++) {
      try {
        const values = lines[i].split(delimiter)
          .map(v => v.trim());

        if (values.length !== headers.length) {
          skippedRows++;
          continue;
        }

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

    return {
      headers,
      data,
      orderedColumns: ['id', ...headers]
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to parse file';
    addNotification({
      type: 'error',
      message,
      timeout: 5000
    });
    throw error;
  }
}