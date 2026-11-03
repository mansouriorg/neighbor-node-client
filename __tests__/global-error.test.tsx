import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import GlobalError from "@/app/global-error";

test("renders its own html and body with a Try again button", () => {
  const html = renderToStaticMarkup(
    <GlobalError error={new Error("boom")} unstable_retry={() => {}} />,
  );
  expect(html).toContain('<html lang="en"');
  expect(html).toContain("<body");
  expect(html).toContain("Try again");
});
