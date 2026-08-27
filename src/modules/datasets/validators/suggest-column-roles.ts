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

/**
 * Real regex rewrite, 2026-08-24 — Anas's own ask. The old version split a column name into
 * single tokens on any non-alphanumeric character, then checked each token against a fixed Set —
 * which quietly broke on any multi-word phrase: `'week_start'` was listed as a real date token,
 * but the splitter always cut it into `'week'` and `'start'` separately, so it could never match
 * as written. Real regexes match against the normalized *phrase*, not single tokens, so
 * `week_start`, `Week Start`, and `WeekStart` (camelCase, split before matching) all match the
 * same pattern instead of needing a separate exact entry for every real spelling.
 */
function normalize(columnName: string): string {
  return columnName
    // Two real camelCase/PascalCase boundary shapes, both before lowercasing wipes out the case
    // information a boundary needs: "tvSpend" -> "tv Spend" (lower-to-upper), and "TVSpend" ->
    // "TV Spend" (an all-caps acronym run immediately followed by a capitalized word — the first
    // regex alone can't see this one, there's no lowercase letter anywhere near the boundary).
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function matches(pattern: RegExp, columnName: string): boolean {
  return pattern.test(normalize(columnName));
}

const DATE_PATTERN = /\b(date|week[\s_]?start|week|period)\b/;
const TARGET_PATTERN = /\b(revenue|subscriptions?|conversions?|customers?|orders?|sales)\b/;
const MEDIA_PATTERN = /\b(cost|spends?)\b/;
// No trailing \b here, deliberately — these need to match a real plural or suffixed form too
// ("holidays", "promotions", "competitor's") the same way the old substring-based version did,
// unlike DATE_PATTERN/TARGET_PATTERN/MEDIA_PATTERN above, which need the trailing boundary to
// correctly stay off "Dates_School_Holidays" (a real control column, not a date column).
const CONTROL_PATTERN = /\b(holiday|promo(?:tion)?|discount|competitor)/;
const ORGANIC_PATTERN = /\borganic/;

export function suggestColumnRoles(columns: string[]): ColumnRoleSuggestions {
  const claimed = new Set<string>();

  let dateColumn: string | null = null;
  for (const col of columns) {
    if (matches(DATE_PATTERN, col)) {
      dateColumn = col;
      claimed.add(col);
      break;
    }
  }

  let targetColumn: string | null = null;
  for (const col of columns) {
    if (claimed.has(col)) continue;
    if (matches(TARGET_PATTERN, col)) {
      targetColumn = col;
      claimed.add(col);
      break;
    }
  }

  const mediaColumns: string[] = [];
  for (const col of columns) {
    if (claimed.has(col)) continue;
    if (matches(MEDIA_PATTERN, col)) {
      mediaColumns.push(col);
      claimed.add(col);
    }
  }

  const controlColumns: string[] = [];
  for (const col of columns) {
    if (claimed.has(col)) continue;
    if (matches(CONTROL_PATTERN, col)) {
      controlColumns.push(col);
      claimed.add(col);
    }
  }

  const organicColumns: string[] = [];
  for (const col of columns) {
    if (claimed.has(col)) continue;
    if (matches(ORGANIC_PATTERN, col)) {
      organicColumns.push(col);
      claimed.add(col);
    }
  }

  return { dateColumn, targetColumn, mediaColumns, controlColumns, organicColumns };
}
