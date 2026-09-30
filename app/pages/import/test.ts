import { test, equal, assert } from "@elements/app";
import { parseCsv, buildRows, mapStatus, mapPriority } from "./services";

const MEMBERS = [
  { id: "u1", name: "Sam Okafor", email: "sam@tickwell.dev" },
  { id: "u2", name: "Maya Chen", email: "maya@tickwell.dev" },
];

test("jira import", () => {
  test("parses quoted fields with commas, quotes and newlines", () => {
    let rows = parseCsv('﻿Summary,Description\r\n"Fix, then ship","Line one\nsaid ""hi"""\r\n');
    equal(rows, [["Summary", "Description"], ["Fix, then ship", 'Line one\nsaid "hi"']]);
  });

  test("maps Jira statuses and priorities", () => {
    equal(mapStatus("To Do"), "todo");
    equal(mapStatus("In Progress"), "in_progress");
    equal(mapStatus("Closed"), "done");
    equal(mapPriority("Highest"), "urgent");
    equal(mapPriority("Minor"), "low");
  });

  test("builds rows and notes what it could not map", () => {
    let csv = [
      "Issue key,Summary,Description,Status,Priority,Assignee",
      "OLD-1,Login fails,Steps here,In Progress,High,Sam Okafor",
      "OLD-2,Export is slow,,Waiting,Lowest,Nobody Here",
      "OLD-3,,skipped because it has no summary,Done,Low,",
      "OLD-4,Typo on pricing,,Done,Medium,maya@tickwell.dev",
    ].join("\n");

    let { rows, skipped } = buildRows(csv, MEMBERS);

    equal(rows.length, 3);
    equal(skipped, 1);
    equal(rows[0].status, "in_progress");
    equal(rows[0].priority, "high");
    equal(rows[0].assigneeId, "u1");
    equal(rows[1].status, "backlog");
    equal(rows[1].priority, "low");
    equal(rows[1].assigneeId, null);
    equal(rows[1].warnings.length, 2);
    equal(rows[2].assigneeId, "u2");
  });

  test("rejects a file with no Summary column", () => {
    let failed = false;

    try {
      buildRows("Title,Body\nx,y", MEMBERS);
    } catch (err: any) {
      failed = true;
      assert(err.message.includes("Summary"), err.message);
    }

    assert(failed, "expected a ValidationError");
  });
});
