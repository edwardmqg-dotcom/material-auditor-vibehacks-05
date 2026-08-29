import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import readXlsxFile from "read-excel-file/node";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const demoDir = path.join(root, "public", "demo");

test("demo package is complete and explicitly synthetic", () => {
  const spec = JSON.parse(fs.readFileSync(path.join(demoDir, "demo-spec.json"), "utf8"));
  const pdfDir = path.join(demoDir, "evidence-pdfs");
  const pdfs = fs.readdirSync(pdfDir).filter((name) => name.endsWith(".pdf"));
  const statusCounts = Object.groupBy(spec.checklist, (item) => item.expected_status);

  assert.equal(pdfs.length, 8);
  assert.equal(spec.checklist.length, 10);
  assert.equal(statusCounts["已满足"].length, 5);
  assert.equal(statusCounts["信息不足"].length, 2);
  assert.equal(statusCounts["缺失"].length, 2);
  assert.equal(statusCounts["待人工确认"].length, 1);
});

test("Sites deployment binding contains only the expected fields", () => {
  const hosting = JSON.parse(fs.readFileSync(path.join(root, ".openai", "hosting.json"), "utf8"));
  assert.deepEqual(Object.keys(hosting).sort(), ["d1", "project_id", "r2"]);
  assert.match(hosting.project_id, /^appgprj_[a-z0-9]+$/);
  assert.equal(hosting.d1, null);
  assert.equal(hosting.r2, null);
  assert.match(fs.readFileSync(path.join(root, ".gitignore"), "utf8"), /hosting\.json/);
});

test("the published XLSX checklist remains readable", async () => {
  const sheets = await readXlsxFile(path.join(demoDir, "供应商准入审核清单.xlsx"));
  const rows = sheets[0].data;
  const headerIndex = rows.findIndex((row) => String(row[0]).trim() === "审核项编号");
  const itemIds = rows.slice(headerIndex + 1)
    .map((row) => String(row[0] ?? "").trim())
    .filter((value) => /^R-\d+$/.test(value));

  assert.ok(headerIndex >= 0);
  assert.deepEqual(itemIds, Array.from({ length: 10 }, (_, index) => `R-${String(index + 1).padStart(2, "0")}`));
});

test("the vendored PDF.js worker matches the declared package", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  const worker = fs.readFileSync(path.join(root, "public", "pdf.worker.min.mjs"), "utf8");
  assert.equal(pkg.dependencies["pdfjs-dist"], "6.2.108");
  assert.match(worker, /6\.2\.108/);
  assert.match(worker.slice(0, 2000), /Apache License/);
});

test("the initial page exposes an empty result state instead of demo findings", () => {
  const page = fs.readFileSync(path.join(root, "app", "page.tsx"), "utf8");
  assert.match(page, /尚未生成审核结果/);
  assert.doesNotMatch(page, /const previewResults/);
  assert.doesNotMatch(page, /results\.length \|\| 10/);
});

test("the primary flow requires real file selection and hides emergency results until an error", () => {
  const page = fs.readFileSync(path.join(root, "app", "page.tsx"), "utf8");
  assert.doesNotMatch(page, />载入演示材料</);
  assert.doesNotMatch(page, />一键载入虚构演示材料</);
  assert.doesNotMatch(page, /function loadDemo/);
  assert.match(page, /stage === "error" && checklistFile && documentFiles\.length > 0/);
  assert.match(page, /应急：打开已验证结果（非实时）/);
  assert.match(page, /上传、解析与审核流程均为实时执行/);
});
