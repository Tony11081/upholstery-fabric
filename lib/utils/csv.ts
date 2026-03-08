export type CsvRow = Record<string, string>;

function normalizeHeader(value: string) {
  return value.trim().toLowerCase();
}

export function parseCsv(text: string): CsvRow[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (inQuotes) {
      if (char === "\"") {
        if (text[i + 1] === "\"") {
          field += "\"";
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === "\"") {
      inQuotes = true;
      continue;
    }

    if (char === ",") {
      row.push(field);
      field = "";
      continue;
    }

    if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }

    if (char === "\r") {
      continue;
    }

    field += char;
  }

  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }

  const cleaned = rows.filter((entry) => entry.some((cell) => cell.trim() !== ""));
  if (cleaned.length === 0) return [];

  const headers = cleaned[0].map(normalizeHeader);
  return cleaned.slice(1).map((cells) => {
    const record: CsvRow = {};
    headers.forEach((header, idx) => {
      record[header] = (cells[idx] ?? "").trim();
    });
    return record;
  });
}

export function parseBoolean(value?: string | null) {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "y"].includes(normalized)) return true;
  if (["false", "0", "no", "n"].includes(normalized)) return false;
  return undefined;
}

export function splitList(value?: string | null) {
  if (!value) return [];
  return value
    .split(/[|;]+/g)
    .map((item) => item.trim())
    .filter(Boolean);
}
