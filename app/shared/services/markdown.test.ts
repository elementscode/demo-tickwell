import { test, equal, assert } from "@elements/app";
import { renderMarkdown } from "#app/shared/services/markdown";

test("markdown", () => {
  test("renders emphasis and lists", () => {
    let html = renderMarkdown("**bold**\n\n- one\n- two");
    assert(html.includes("<strong>bold</strong>"), html);
    assert(html.includes("<li>one</li>"), html);
  });

  test("escapes raw html", () => {
    let html = renderMarkdown("<script>alert(1)</script>");
    assert(!html.includes("<script>"), html);
    assert(html.includes("&lt;script&gt;"), html);
  });

  test("neutralizes javascript links", () => {
    let html = renderMarkdown("[x](javascript:alert(1))");
    equal(html.includes("javascript:"), false, html);
  });
});
