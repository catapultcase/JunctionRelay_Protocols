import type { SensorEntry } from '@junctionrelay/payload-protocol';

/**
 * Convert a sensors record into a flat array with tag included.
 * Useful for plugins that need to iterate sensors with their keys.
 */
export function buildSensorArray(
  sensors: Record<string, SensorEntry>,
): Array<SensorEntry & { tag: string }> {
  return Object.entries(sensors).map(([tag, sensor]) => ({
    ...sensor,
    tag,
  }));
}

/**
 * Format a sensor value with its unit for display.
 */
export function formatValue(value: string | number | boolean, unit?: string): string {
  const str = String(value);
  if (!unit || unit === 'N/A') return str;
  return `${str} ${unit}`;
}

/**
 * Filter a sensors record to only include entries matching the given tags.
 */
export function filterSensorsByTags(
  sensors: Record<string, SensorEntry>,
  tags: string[],
): Record<string, SensorEntry> {
  const tagSet = new Set(tags);
  const result: Record<string, SensorEntry> = {};
  for (const [tag, sensor] of Object.entries(sensors)) {
    if (tagSet.has(tag)) {
      result[tag] = sensor;
    }
  }
  return result;
}
