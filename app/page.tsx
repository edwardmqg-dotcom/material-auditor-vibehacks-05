"use client";

import { useMemo, useState } from "react";
import {
  type ChecklistItem,
  type ParsedDocument,
  type ReviewResult,
  type ReviewStatus,
  getStandardChecklist,
  parseChecklist,
  parsePdf,
  reviewDocuments,
} from "@/lib/review-engine";

const DEMO_PDFS = [
  "01_营业执照.pdf",
  "02_银行账户证明.pdf",
  "03_2025年度审计报告摘要.pdf",
  "04_信息安全管理制度.pdf",
  "05_项目合同摘要.pdf",
  "06_雇主责任险证明_已过期.pdf",
  "07_技术团队名册.pdf",
  "08_社保缴纳证明.pdf",
];

const STATUS_ORDER: ReviewStatus[] = ["已满足", "信息不足", "缺失", "待人工确认"];
const STATUS_META: Record<ReviewStatus, { short: string; color: string; className: string }> = {
  已满足: { short: "满足", color: "#69c58b", className: "status-pass" },
  信息不足: { short: "不足", color: "#e3a62f", className: "status-warning" },
  缺失: { short: "缺失", color: "#e7675b", className: "status-danger" },
  待人工确认: { short: "人工", color: "#7c91a3", className: "status-human" },
};

type Stage = "idle" | "loading-demo" | "parsing" | "reviewing" | "completed" | "error";

export default function Home() {
  const [checklistFile, setChecklistFile] = useState<File | null>(null);
  const [documentFiles, setDocumentFiles] = useState<File[]>([]);
  const [parsedDocs, setParsedDocs] = useState<ParsedDocument[]>([]);
  const [results, setResults] = useState<ReviewResult[]>([]);
  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<ReviewResult | null>(null);
  const [filter, setFilter] = useState<"全部" | ReviewStatus>("全部");
  const [mode, setMode] = useState<"live" | "verified">("live");

  const counts = useMemo(() => Object.fromEntries(STATUS_ORDER.map((status) => [status, results.filter((item) => item.status === status).length])) as Record<ReviewStatus, number>, [results]);
  const filtered = filter === "全部" ? results : results.filter((item) => item.status === filter);
  const isBusy = ["loading-demo", "parsing", "reviewing"].includes(stage);

  async function loadDemo() {
    setStage("loading-demo");
    setMessage("正在准备完全虚构的演示材料…");
    setProgress(8);
    try {
      const checklistResponse = await fetch("/demo/供应商准入审核清单.xlsx");
      const checklistBlob = await checklistResponse.blob();
      setChecklistFile(new File([checklistBlob], "供应商准入审核清单.xlsx", { type: checklistBlob.type }));
      const files: File[] = [];
      for (let index = 0; index < DEMO_PDFS.length; index += 1) {
        const name = DEMO_PDFS[index];
        const response = await fetch(`/demo/evidence-pdfs/${name}`);
        const blob = await response.blob();
        files.push(new File([blob], name, { type: "application/pdf" }));
        setProgress(10 + Math.round(((index + 1) / DEMO_PDFS.length) * 60));
      }
      setDocumentFiles(files);
      setResults([]);
      setParsedDocs([]);
      setMode("live");
      setStage("idle");
      setProgress(0);
      setMessage("演示材料已就绪：1 份清单，8 份 PDF。点击开始逐项审核。");
    } catch {
      setStage("error");
      setMessage("演示材料载入失败，请刷新页面后重试。");
    }
  }

  async function runReview() {
    if (!checklistFile || documentFiles.length === 0) {
      setStage("error");
      setMessage("请先上传 1 份标准 Checklist 和至少 1 份 PDF 材料。");
      return;
    }
    setMode("live");
    setResults([]);
    setParsedDocs([]);
    setSelected(null);
    setStage("parsing");
    setProgress(6);
    setMessage("正在读取标准 Checklist…");
    try {
      const checklist = await parseChecklist(checklistFile);
      setProgress(15);
      const docs: ParsedDocument[] = [];
      for (let index = 0; index < documentFiles.length; index += 1) {
        setMessage(`正在解析 ${documentFiles[index].name}（${index + 1}/${documentFiles.length}）…`);
        docs.push(await parsePdf(documentFiles[index]));
        setProgress(15 + Math.round(((index + 1) / documentFiles.length) * 55));
      }
      setParsedDocs(docs);
      if (docs.every((doc) => doc.parseStatus === "解析失败")) throw new Error("所有 PDF 均解析失败");
      setStage("reviewing");
      setMessage(`已提取 ${docs.reduce((sum, doc) => sum + doc.pageCount, 0)} 页文本，正在逐项核验证据…`);
      setProgress(82);
      await pause(450);
      const reviewed = reviewDocuments(checklist, docs);
      setProgress(96);
      await pause(300);
      setResults(reviewed);
      setStage("completed");
      setProgress(100);
      setMessage(`审核完成：${reviewed.length} 项中有 ${reviewed.filter((item) => item.status !== "已满足").length} 项需要处理。`);
    } catch (error) {
      setStage("error");
      setMessage(error instanceof Error ? error.message : "审核失败，请检查文件后重试。");
    }
  }

  async function useVerifiedResults() {
    setStage("reviewing");
    setProgress(65);
    setMessage("正在载入已验证的演示标准答案（备用模式）…");
    try {
      const response = await fetch("/demo/demo-spec.json");
      const data = await response.json();
      const standard = new Map(getStandardChecklist().map((item) => [item.itemId, item]));
      const verified = data.checklist.map((entry: Record<string, unknown>) => ({
        ...(standard.get(String(entry.item_id)) as ChecklistItem),
        status: entry.expected_status,
        reason: entry.expected_reason,
        evidence: (entry.evidence as Array<Record<string, unknown>>).map((item) => ({
          fileName: item.file_name,
          page: item.page,
          quote: item.quote,
          supports: entry.expected_status === "已满足" ? "支持" : entry.expected_status === "待人工确认" ? "冲突" : "部分支持",
        })),
        nextAction: entry.next_action,
        needsHumanReview: entry.needs_human_review,
      })) as ReviewResult[];
      await pause(300);
      setResults(verified);
      setMode("verified");
      setStage("completed");
      setProgress(100);
      setMessage("已切换到明确标注的备用演示结果；这些结果不是本次实时解析生成的。");
    } catch {
      setStage("error");
      setMessage("备用结果载入失败。");
    }
  }

  function openEvidence(fileName: string) {
    const file = documentFiles.find((entry) => entry.name === fileName);
    if (!file) return;
    window.open(URL.createObjectURL(file), "_blank", "noopener,noreferrer");
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="container topbar-inner">
          <div className="brand">
            <span className="brand-mark">✓</span>
            <span><small>演策实验</small><strong>材料审核员</strong></span>
          </div>
          <div className="top-actions">
            <span className="trust-badge"><i /> 规则初审 · 人工决策</span>
            <button className="quiet-button" onClick={loadDemo} disabled={isBusy}>载入演示材料</button>
          </div>
        </div>
      </header>

      <section className="container hero">
        <div className="eyebrow"><span>01</span> CHECKLIST → EVIDENCE → EXCEPTIONS</div>
        <h1>把几小时的材料核对，<em>压缩成几分钟的异常处理</em></h1>
        <p>上传标准审核清单和供应商材料，系统逐项寻找证据、识别缺项与冲突，并把关键判断交还给人。</p>
      </section>

      <section className="container workspace-grid">
        <section className="upload-card">
          <div className="card-heading">
            <div><span>新建审核任务</span><h2>供应商准入初审</h2></div>
            <time>基准日 2026-08-29</time>
          </div>

          <div className="upload-stack">
            <UploadZone
              number="1" title="上传标准 Checklist" detail="XLSX 或 CSV · 仅支持材料审核员标准模板"
              accept=".xlsx,.csv" files={checklistFile ? [checklistFile] : []}
              onChange={(files) => { setChecklistFile(files[0] ?? null); setResults([]); setMessage(""); }}
            />
            <UploadZone
              number="2" title="上传待审核材料" detail="支持多份 PDF · 证据保留文件名与页码"
              accept=".pdf" multiple files={documentFiles}
              onChange={(files) => { setDocumentFiles(files); setResults([]); setMessage(""); }}
            />
          </div>

          {message && <div className={`task-message ${stage === "error" ? "is-error" : ""}`}><span>{stage === "completed" ? "✓" : stage === "error" ? "!" : "·"}</span>{message}</div>}
          {isBusy && <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>}

          <button type="button" className="primary-button" onClick={runReview} disabled={isBusy}>
            {stage === "parsing" ? "正在解析文件…" : stage === "reviewing" ? "正在核验证据…" : "开始逐项审核"}
            <span>→</span>
          </button>
          <div className="button-row">
            <button type="button" className="text-button" onClick={loadDemo} disabled={isBusy}>一键载入虚构演示材料</button>
            <button type="button" className="text-button muted" onClick={useVerifiedResults} disabled={isBusy}>备用：使用已验证结果</button>
          </div>
          <p className="disclaimer">演示数据完全虚构。系统结果为初审意见，关键结论需由专业人员最终复核。</p>
        </section>

        <aside className="summary-card">
          <div className="summary-heading">
            <div><span>{results.length ? (mode === "live" ? "实时解析结果" : "备用演示结果") : "审核结果预览"}</span><h2>只看需要处理的问题</h2></div>
            <strong>{results.length || 10} 项</strong>
          </div>
          <div className="summary-counts">
            {STATUS_ORDER.map((status, index) => (
              <button key={status} onClick={() => results.length && setFilter(status)}>
                <b style={{ color: STATUS_META[status].color }}>{results.length ? counts[status] : [5, 2, 2, 1][index]}</b>
                <span>{STATUS_META[status].short}</span>
              </button>
            ))}
          </div>
          <div className="exception-list">
            {(results.length ? results.filter((item) => item.status !== "已满足").slice(0, 3) : previewResults).map((item) => (
              <button key={item.itemId} onClick={() => "requirement" in item && setSelected(item as ReviewResult)}>
                <i className={STATUS_META[item.status].className}>!</i>
                <span><strong>{"title" in item ? item.title : anomalyTitle(item as ReviewResult)}</strong><small>{item.itemId} · {item.status}</small></span>
                <b>›</b>
              </button>
            ))}
          </div>
          <div className="principle"><small>核心原则</small><p>没有可验证证据，就不能判定通过。<br /><b>机器找材料，人做最终判断。</b></p></div>
        </aside>
      </section>

      {results.length > 0 && (
        <section className="container results-section" id="results">
          <div className="results-heading">
            <div>
              <span className={`mode-pill ${mode === "verified" ? "verified" : ""}`}>{mode === "live" ? "实时文件解析" : "备用结果 · 非实时"}</span>
              <h2>审核工作台</h2>
              <p>优先处理异常项，点击任意一项查看证据原文和下一步动作。</p>
            </div>
            <div className="export-actions"><button onClick={() => exportCsv(results)}>导出 CSV</button><button onClick={() => exportMarkdown(results)}>导出 Markdown</button></div>
          </div>

          <div className="filter-row">
            {(["全部", ...STATUS_ORDER] as const).map((status) => <button className={filter === status ? "active" : ""} onClick={() => setFilter(status)} key={status}>{status}{status !== "全部" && ` ${counts[status]}`}</button>)}
          </div>

          <div className="result-grid">
            {filtered.map((item) => (
              <button className="result-card" key={item.itemId} onClick={() => setSelected(item)}>
                <div className="result-top"><span>{item.itemId} · {item.category}</span><b className={STATUS_META[item.status].className}>{item.status}</b></div>
                <h3>{item.requirement}</h3>
                <p>{item.reason}</p>
                <div className="result-bottom"><span>{item.evidence.length ? `${item.evidence.length} 条证据` : "未找到证据"}</span><strong>查看详情 →</strong></div>
              </button>
            ))}
          </div>

          <details className="parse-report">
            <summary>文件解析报告：{parsedDocs.filter((doc) => doc.parseStatus === "已解析").length}/{parsedDocs.length} 份成功</summary>
            <div>{parsedDocs.map((doc) => <span key={doc.fileName} className={doc.parseStatus === "解析失败" ? "failed" : ""}>{doc.parseStatus === "已解析" ? "✓" : "!"} {doc.fileName} · {doc.pageCount} 页</span>)}</div>
          </details>
        </section>
      )}

      <footer className="footer container"><span>材料审核员 · VibeHacks #05</span><span>所有材料仅在当前浏览器会话中处理</span></footer>

      {selected && (
        <div className="drawer-backdrop" onMouseDown={() => setSelected(null)}>
          <aside className="detail-drawer" onMouseDown={(event) => event.stopPropagation()}>
            <button className="drawer-close" onClick={() => setSelected(null)} aria-label="关闭">×</button>
            <div className="drawer-title"><span>{selected.itemId} · {selected.category}</span><b className={STATUS_META[selected.status].className}>{selected.status}</b></div>
            <h2>{anomalyTitle(selected)}</h2>
            <section><small>审核要求</small><p>{selected.requirement}</p></section>
            <section><small>判断理由</small><p>{selected.reason}</p></section>
            <section>
              <small>证据链</small>
              {selected.evidence.length ? selected.evidence.map((item, index) => (
                <article className="evidence-card" key={`${item.fileName}-${index}`}>
                  <div><b>{item.fileName}</b><span>第 {item.page} 页 · {item.supports}</span></div>
                  <blockquote>“{item.quote}”</blockquote>
                  <button onClick={() => openEvidence(item.fileName)}>打开原文件 ↗</button>
                </article>
              )) : <div className="empty-evidence">当前上传材料中未找到可引用证据。</div>}
            </section>
            <section className="next-action"><small>建议下一步</small><p>{selected.nextAction}</p></section>
            <p className="human-note">自动规则初审结果，请由专业人员完成最终确认。</p>
          </aside>
        </div>
      )}
    </main>
  );
}

function UploadZone({ number, title, detail, accept, multiple = false, files, onChange }: { number: string; title: string; detail: string; accept: string; multiple?: boolean; files: File[]; onChange: (files: File[]) => void }) {
  return (
    <label className={`upload-zone ${files.length ? "has-files" : ""}`}>
      <input type="file" accept={accept} multiple={multiple} onChange={(event) => onChange(Array.from(event.target.files ?? []))} />
      <span className="step-number">{files.length ? "✓" : number}</span>
      <span className="upload-copy"><strong>{files.length ? (multiple ? `已选择 ${files.length} 份 PDF` : files[0].name) : title}</strong><small>{files.length ? formatFiles(files) : detail}</small></span>
      <span className="file-button">{files.length ? "重新选择" : "选择文件"}</span>
    </label>
  );
}

const previewResults: Array<{ itemId: string; status: ReviewStatus; title: string }> = [
  { itemId: "R-06", status: "信息不足", title: "保险证明已过期" },
  { itemId: "R-08", status: "缺失", title: "未找到授权委托书" },
  { itemId: "R-10", status: "待人工确认", title: "团队名册与社保证明冲突" },
];

function anomalyTitle(item: ReviewResult) {
  const titles: Record<string, string> = { "R-06": "保险证明已过期", "R-07": "同类项目案例数量不足", "R-08": "未找到授权委托书", "R-09": "未找到纳税信用证明", "R-10": "团队名册与社保证明冲突" };
  return titles[item.itemId] ?? `${item.category}审核${item.status}`;
}

function formatFiles(files: File[]) {
  const size = files.reduce((sum, file) => sum + file.size, 0);
  return `${files.map((file) => file.name).slice(0, 2).join("、")}${files.length > 2 ? ` 等 ${files.length} 份` : ""} · ${(size / 1024 / 1024).toFixed(1)} MB`;
}

function pause(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)); }

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = name; anchor.click(); URL.revokeObjectURL(url);
}

function exportCsv(results: ReviewResult[]) {
  const rows = [["审核项", "类别", "审核要求", "状态", "判断理由", "证据", "下一步动作"], ...results.map((item) => [item.itemId, item.category, item.requirement, item.status, item.reason, item.evidence.map((entry) => `${entry.fileName} 第${entry.page}页：${entry.quote}`).join("｜"), item.nextAction])];
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\r\n");
  download("材料审核员-审核结果.csv", `\ufeff${csv}`, "text/csv;charset=utf-8");
}

function exportMarkdown(results: ReviewResult[]) {
  const lines = ["# 材料审核员｜审核结果", "", "> 自动规则初审结果，关键结论需由专业人员最终复核。", ""];
  results.forEach((item) => lines.push(`## ${item.itemId} ${item.category}｜${item.status}`, "", `**审核要求：** ${item.requirement}`, "", `**判断理由：** ${item.reason}`, "", `**证据：** ${item.evidence.length ? item.evidence.map((entry) => `${entry.fileName} 第 ${entry.page} 页：“${entry.quote}”`).join("；") : "当前上传材料中未找到。"}`, "", `**下一步：** ${item.nextAction}`, ""));
  download("材料审核员-审核结果.md", lines.join("\n"), "text/markdown;charset=utf-8");
}
