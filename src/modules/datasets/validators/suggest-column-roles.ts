/**
 * Cassandra's real Configure screen shows up pre-filled, not blank — Anas
 * asked for the same thing here. This is not machine learning, it's plain
 * name matching against a real column list, exactly the kind of guess a
 * person would make looking at the same header row. It's a starting point
 * the user can still change on the real screen, never applied silently.
 */
export interface ColumnRoleSuggestions {
  dateColumn: string | null;
  targetColumn: string | null;
  mediaColumns: string[];
  controlColumns: string[];
  organicColumns: string[];
}

function tokens(columnName: string): string[] {
  return columnName
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 0);
}

const DATE_TOKENS = new Set(['date', 'week', 'week_start', 'period']);
const TARGET_TOKENS = new Set(['revenue', 'subscriptions', 'subscription', 'conversions', 'conversion', 'customers', 'orders', 'sales']);
const MEDIA_TOKENS = new Set(['cost', 'spend', 'spends']);
const CONTROL_KEYWORDS = ['holiday', 'promo', 'promotion', 'discount', 'competitor'];
const ORGANIC_KEYWORDS = ['organic'];

export function suggestColumnRoles(columns: string[]): ColumnRoleSuggestions {
  const claimed = new Set<string>();

  let dateColumn: string | null = null;
  for (const col of columns) {
    if (tokens(col).some((t) => DATE_TOKENS.has(t))) {
      dateColumn = col;
      claimed.add(col);
      break;
    }
  }

  let targetColumn: string | null = null;
  for (const col of columns) {
    if (claimed.has(col)) continue;
    if (tokens(col).some((t) => TARGET_TOKENS.has(t))) {
      targetColumn = col;
      claimed.add(col);
      break;
    }
  }

  const mediaColumns: string[] = [];
  for (const col of columns) {
    if (claimed.has(col)) continue;
    if (tokens(col).some((t) => MEDIA_TOKENS.has(t))) {
      mediaColumns.push(col);
      claimed.add(col);
    }
  }

  const controlColumns: string[] = [];
  for (const col of columns) {
    if (claimed.has(col)) continue;
    const lower = col.toLowerCase();
    if (CONTROL_KEYWORDS.some((k) => lower.includes(k))) {
      controlColumns.push(col);
      claimed.add(col);
    }
  }

  const organicColumns: string[] = [];
  for (const col of columns) {
    if (claimed.has(col)) continue;
    const lower = col.toLowerCase();
    if (ORGANIC_KEYWORDS.some((k) => lower.includes(k))) {
      organicColumns.push(col);
      claimed.add(col);
    }
  }

  return { dateColumn, targetColumn, mediaColumns, controlColumns, organicColumns };
}
