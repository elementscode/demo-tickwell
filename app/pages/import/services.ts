import { File, ValidationError } from "@elements/app";
import { adminOrThrow, listMembers } from "#app/shared/services/auth";
import { Status, Priority, issues, projectByKeyOrThrow } from "#app/shared/services/tracker";

export const MAX_ROWS = 1000;

export interface ImportRow {
  id: string;
  line: number;
  title: string;
  description: string;
  status: Status;
  priority: Priority;
  assigneeId: string | null;
  assigneeName: string;
  sourceStatus: string;
  sourcePriority: string;
  sourceAssignee: string;
  warnings: string[];
}

export interface ImportPreview {
  fileName: string;
  rows: ImportRow[];
  skipped: number;
}

/**
 * RFC 4180: quoted fields may hold commas, newlines and doubled quotes. Jira
 * exports all three in descriptions.
 */
export function parseCsv(text: string): string[][] {
  let rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }

  for (let i = 0; i < text.length; i++) {
    let ch = text[i];

    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }

      continue;
    }

    if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") {
        i++;
      }

      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

const STATUS_MAP: Record<string, Status> = {
  "backlog": "backlog",
  "open": "todo",
  "to do": "todo",
  "todo": "todo",
  "selected for development": "todo",
  "reopened": "todo",
  "in progress": "in_progress",
  "in development": "in_progress",
  "in review": "in_review",
  "code review": "in_review",
  "review": "in_review",
  "qa": "in_review",
  "testing": "in_review",
  "done": "done",
  "closed": "done",
  "resolved": "done",
  "complete": "done",
};

const PRIORITY_MAP: Record<string, Priority> = {
  "highest": "urgent",
  "blocker": "urgent",
  "critical": "urgent",
  "urgent": "urgent",
  "high": "high",
  "major": "high",
  "medium": "medium",
  "normal": "medium",
  "low": "low",
  "minor": "low",
  "lowest": "low",
  "trivial": "low",
};

export function mapStatus(value: string): Status | undefined {
  return STATUS_MAP[value.trim().toLowerCase()];
}

export function mapPriority(value: string): Priority | undefined {
  return PRIORITY_MAP[value.trim().toLowerCase()];
}

/** Turns a Jira export into rows ready to insert, with a note on each guess. */
export function buildRows(text: string, members: { id: string; name: string; email: string }[]): { rows: ImportRow[]; skipped: number } {
  let table = parseCsv(text);
  if (table.length === 0) {
    throw new ValidationError("The file is empty.");
  }

  let header = table[0].map((h) => h.trim().toLowerCase());
  let col = (name: string) => header.indexOf(name);
  let summary = col("summary");

  if (summary < 0) {
    throw new ValidationError("No Summary column. Export from Jira with the Summary, Description, Status, Priority and Assignee columns.");
  }

  let description = col("description");
  let status = col("status");
  let priority = col("priority");
  let assignee = col("assignee");

  let body = table.slice(1);
  if (body.length > MAX_ROWS) {
    throw new ValidationError(`The file has ${body.length} issues. Import at most ${MAX_ROWS} at a time.`);
  }

  let rows: ImportRow[] = [];
  let skipped = 0;

  body.forEach((cells, index) => {
    let get = (i: number) => (i >= 0 ? (cells[i] ?? "").trim() : "");
    let title = get(summary);

    if (!title) {
      skipped++;
      return;
    }

    let warnings: string[] = [];
    let sourceStatus = get(status);
    let sourcePriority = get(priority);
    let sourceAssignee = get(assignee);

    let mappedStatus = sourceStatus ? mapStatus(sourceStatus) : "backlog";
    if (!mappedStatus) {
      warnings.push(`Unknown status “${sourceStatus}”, filed in Backlog`);
    }

    let mappedPriority = sourcePriority ? mapPriority(sourcePriority) : "medium";
    if (!mappedPriority) {
      warnings.push(`Unknown priority “${sourcePriority}”, set to Medium`);
    }

    let who = sourceAssignee.toLowerCase();
    let match = who ? members.find((m) => m.name.toLowerCase() === who || m.email.toLowerCase() === who) : undefined;
    if (who && !match) {
      warnings.push(`No teammate named “${sourceAssignee}”, left unassigned`);
    }

    rows.push({
      id: `row-${index + 2}`,
      line: index + 2,
      title: title.slice(0, 200),
      description: get(description),
      status: mappedStatus ?? "backlog",
      priority: mappedPriority ?? "medium",
      assigneeId: match?.id ?? null,
      assigneeName: match?.name ?? "",
      sourceStatus,
      sourcePriority,
      sourceAssignee,
      warnings,
    });
  });

  return { rows, skipped };
}

function readFile(file: File | undefined): string {
  if (!file) {
    throw new ValidationError("Choose a CSV file first.");
  }

  return new TextDecoder("utf-8").decode(file.data);
}

/** @rpc */
export function previewImport(form: { projectKey: string; file: File | undefined }): ImportPreview {
  adminOrThrow();
  projectByKeyOrThrow(form.projectKey);

  let { rows, skipped } = buildRows(readFile(form.file), listMembers());

  return { fileName: form.file!.name, rows, skipped };
}

/**
 * Inserts through the project's live view, so every open board and list
 * shows the imported issues as they land.
 * @rpc
 */
export function runImport(form: { projectKey: string; file: File | undefined }): number {
  adminOrThrow();
  let project = projectByKeyOrThrow(form.projectKey);

  let { rows } = buildRows(readFile(form.file), listMembers());
  let view = issues.view({ projectId: project.id });

  for (let row of rows) {
    view.insert({
      title: row.title,
      description: row.description,
      status: row.status,
      priority: row.priority,
      assigneeId: row.assigneeId,
      labels: ["imported"],
    });
  }

  return rows.length;
}
