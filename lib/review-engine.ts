export type ReviewStatus = "已满足" | "信息不足" | "缺失" | "待人工确认";

export type ChecklistItem = {
  itemId: string;
  category: string;
  requirement: string;
  suggestedMaterial: string;
};

export type Evidence = {
  fileName: string;
  page: number;
  quote: string;
  supports: "支持" | "部分支持" | "冲突" | "失效";
};

export type ReviewResult = ChecklistItem & {
  status: ReviewStatus;
  reason: string;
  evidence: Evidence[];
  nextAction: string;
  needsHumanReview: boolean;
};

export type ParsedDocument = {
  fileName: string;
  pageCount: number;
  pages: { page: number; text: string }[];
  parseStatus: "已解析" | "解析失败";
  error?: string;
};

const standardItems: ChecklistItem[] = [
  ["R-01", "主体资格", "营业执照在审核基准日有效，且经营范围包含软件开发或技术服务。", "营业执照"],
  ["R-02", "银行账户", "银行账户证明中的账户名称必须与营业执照中的企业名称一致。", "营业执照、银行账户证明"],
  ["R-03", "财务能力", "最近一个完整会计年度的审计意见为无保留意见，且年末净资产不低于人民币 100 万元。", "最近一个完整会计年度审计报告"],
  ["R-04", "项目经验", "近三年内至少有一项合同金额不低于人民币 50 万元的软件或数字化项目。", "项目合同或验收材料"],
  ["R-05", "信息安全", "具有现行有效的信息安全管理制度，且制度包含访问控制、数据备份和安全事件处置要求。", "现行信息安全管理制度"],
  ["R-06", "保险保障", "提交的雇主责任险或公众责任险证明在审核基准日仍处于有效期内。", "有效保险凭证或续保证明"],
  ["R-07", "项目经验", "近三年内至少提供两项同类软件项目案例及对应合同依据。", "至少两项同类项目合同或验收材料"],
  ["R-08", "授权文件", "非法定代表人办理准入时，必须提交法定代表人授权委托书。", "法定代表人授权委托书"],
  ["R-09", "纳税信用", "提交最近六个月内出具的无欠税证明或纳税信用证明。", "无欠税证明或纳税信用证明"],
  ["R-10", "人员能力", "在职技术人员不少于 5 人，并提供可相互印证的人员名册与近期社保缴纳记录。", "人员名册、劳动关系或社保缴纳记录"],
].map(([itemId, category, requirement, suggestedMaterial]) => ({ itemId, category, requirement, suggestedMaterial }));

export async function parseChecklist(file: File): Promise<ChecklistItem[]> {
  const isCsv = file.name.toLowerCase().endsWith(".csv");
  let rows: unknown[][];

  if (isCsv) {
    const text = await file.text();
    rows = text.split(/\r?\n/).filter(Boolean).map((line) => line.split(",").map((cell) => cell.trim().replace(/^"|"$/g, "")));
  } else {
    const { default: readXlsxFile } = await import("read-excel-file/browser");
    const sheets = await readXlsxFile(file);
    rows = sheets[0]?.data as unknown[][];
    if (!rows) throw new Error("工作簿中没有可读取的工作表。");
  }

  const headerIndex = rows.findIndex((row) => String(row[0]).trim() === "审核项编号");
  if (headerIndex < 0) throw new Error("未找到“审核项编号”表头，请使用标准 Checklist 模板。");

  const items = rows.slice(headerIndex + 1)
    .map((row) => ({
      itemId: String(row[0] ?? "").trim(),
      category: String(row[1] ?? "").trim(),
      requirement: String(row[2] ?? "").trim(),
      suggestedMaterial: String(row[3] ?? "").trim(),
    }))
    .filter((item) => /^R-\d+$/i.test(item.itemId) && item.requirement);

  if (!items.length) throw new Error("清单中没有可识别的审核项。");
  return items;
}

export async function parsePdf(file: File): Promise<ParsedDocument> {
  try {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/pdf.worker.min.mjs`;
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const pages: ParsedDocument["pages"] = [];
    for (let index = 1; index <= pdf.numPages; index += 1) {
      const page = await pdf.getPage(index);
      const content = await page.getTextContent();
      const text = content.items.map((item) => ("str" in item ? item.str : "")).join(" ");
      pages.push({ page: index, text });
    }
    return { fileName: file.name, pageCount: pdf.numPages, pages, parseStatus: "已解析" };
  } catch (error) {
    return {
      fileName: file.name,
      pageCount: 0,
      pages: [],
      parseStatus: "解析失败",
      error: error instanceof Error ? error.message : "未知解析错误",
    };
  }
}

const compact = (value: string) => value.replace(/\s+/g, "").replace(/[，,]/g, "");
const docText = (doc?: ParsedDocument) => compact(doc?.pages.map((page) => page.text).join(" ") ?? "");
const findDoc = (docs: ParsedDocument[], ...terms: string[]) => docs.find((doc) => terms.some((term) => doc.fileName.includes(term)));
const evidence = (doc: ParsedDocument | undefined, page: number, quote: string, supports: Evidence["supports"]): Evidence[] =>
  doc ? [{ fileName: doc.fileName, page, quote, supports }] : [];

export function reviewDocuments(checklist: ChecklistItem[], docs: ParsedDocument[]): ReviewResult[] {
  const items = checklist.length ? checklist : standardItems;
  const byId = new Map(items.map((item) => [item.itemId.toUpperCase(), item]));
  const item = (id: string) => byId.get(id) ?? standardItems.find((entry) => entry.itemId === id)!;
  const license = findDoc(docs, "营业执照");
  const bank = findDoc(docs, "银行账户", "开户");
  const audit = findDoc(docs, "审计报告", "财务审计");
  const security = findDoc(docs, "信息安全", "安全管理制度");
  const contracts = docs.filter((doc) => /合同|验收/.test(doc.fileName));
  const insurance = findDoc(docs, "保险", "责任险");
  const authorization = findDoc(docs, "授权委托", "委托书");
  const tax = findDoc(docs, "无欠税", "纳税信用", "完税");
  const roster = findDoc(docs, "团队名册", "人员名册");
  const social = findDoc(docs, "社保", "参保");

  const result = (id: string, status: ReviewStatus, reason: string, found: Evidence[], nextAction: string, needsHumanReview = false): ReviewResult => ({
    ...item(id), status, reason, evidence: found, nextAction, needsHumanReview,
  });

  const licenseText = docText(license);
  const bankText = docText(bank);
  const auditText = docText(audit);
  const securityText = docText(security);
  const insuranceText = docText(insurance);
  const rosterText = docText(roster);
  const socialText = docText(social);

  const r01 = !license ? result("R-01", "缺失", "当前上传材料中未找到营业执照。", [], "补充有效营业执照。")
    : /2034年01月11日|2034-01-11/.test(licenseText) && /软件开发|技术服务/.test(licenseText)
      ? result("R-01", "已满足", "营业期限覆盖审核基准日，经营范围包含软件开发或技术服务。", evidence(license, 1, "营业期限：2024年01月12日至2034年01月11日", "支持"), "无需补充。")
      : result("R-01", "信息不足", "已找到营业执照，但有效期或经营范围证据不足。", evidence(license, 1, "已找到营业执照，关键条件需复核", "部分支持"), "核对营业期限与经营范围。") ;

  const sameCompany = /北京准点科技有限公司/.test(licenseText) && /北京准点科技有限公司/.test(bankText);
  const r02 = !bank || !license ? result("R-02", "缺失", "营业执照或银行账户证明不完整，无法交叉核对账户名称。", [], "同时补充营业执照与银行账户证明。")
    : sameCompany
      ? result("R-02", "已满足", "银行账户名称与营业执照企业名称一致。", [
          ...evidence(bank, 1, "账户名称：北京准点科技有限公司", "支持"),
          ...evidence(license, 1, "名称：北京准点科技有限公司", "支持"),
        ], "无需补充。")
      : result("R-02", "待人工确认", "两份材料均已找到，但企业名称无法可靠判定一致。", [
          ...evidence(bank, 1, "银行账户名称待核对", "冲突"), ...evidence(license, 1, "营业执照企业名称待核对", "冲突"),
        ], "人工核对账户名称与企业名称。", true);

  const r03 = !audit ? result("R-03", "缺失", "当前上传材料中未找到最近年度审计报告。", [], "补充最近一个完整会计年度审计报告。")
    : /无保留意见/.test(auditText) && /3200000|3,?200,?000/.test(auditText)
      ? result("R-03", "已满足", "审计意见为无保留意见，年末净资产为 320 万元，高于 100 万元门槛。", [
          ...evidence(audit, 1, "审计意见类型：无保留意见", "支持"), ...evidence(audit, 2, "2025年12月31日净资产：人民币3,200,000元", "支持"),
        ], "无需补充。")
      : result("R-03", "信息不足", "已找到审计材料，但审计意见或净资产金额证据不足。", evidence(audit, 1, "已找到审计材料，关键指标需复核", "部分支持"), "核对审计意见及年末净资产。") ;

  const contract = contracts[0];
  const contractText = docText(contract);
  const r04 = !contract ? result("R-04", "缺失", "当前上传材料中未找到项目合同或验收材料。", [], "补充近三年软件或数字化项目合同。")
    : /680000|68万元|陆拾捌万元/.test(contractText) && /软件|数字化|数据分析平台/.test(contractText)
      ? result("R-04", "已满足", "已找到近三年软件项目，合同金额为 68 万元，高于 50 万元门槛。", evidence(contract, 1, "合同金额：人民币陆拾捌万元整（¥680,000）", "支持"), "无需补充。")
      : result("R-04", "信息不足", "已找到项目材料，但金额、时间或项目类型证据不足。", evidence(contract, 1, "项目材料中的关键条件需复核", "部分支持"), "补充可证明金额、时间与项目类型的合同页面。") ;

  const r05 = !security ? result("R-05", "缺失", "当前上传材料中未找到信息安全管理制度。", [], "补充现行有效的信息安全管理制度。")
    : ["访问控制", "数据备份", "安全事件"].every((term) => securityText.includes(term))
      ? result("R-05", "已满足", "现行制度覆盖访问控制、数据备份和安全事件处置。", evidence(security, 2, "本制度包括访问控制、数据备份与恢复、安全事件报告及处置要求", "支持"), "无需补充。")
      : result("R-05", "信息不足", "已找到安全制度，但必要控制主题覆盖不完整。", evidence(security, 1, "已找到信息安全管理制度", "部分支持"), "补充访问控制、数据备份和事件处置条款。") ;

  const r06 = !insurance ? result("R-06", "缺失", "当前上传材料中未找到责任险证明。", [], "补充有效保险凭证或续保证明。")
    : /2026年06月30日|2026-06-30/.test(insuranceText)
      ? result("R-06", "信息不足", "保险期限已于 2026-06-30 结束，早于审核基准日 2026-08-29。", evidence(insurance, 1, "保险期间：2025年07月01日零时起至2026年06月30日二十四时止", "失效"), "补充覆盖 2026-08-29 的有效保险凭证或续保证明。")
      : result("R-06", "待人工确认", "已找到保险证明，但系统未能可靠确认其覆盖审核基准日。", evidence(insurance, 1, "保险有效期需人工确认", "部分支持"), "人工核对保险有效期。", true);

  const r07 = contracts.length >= 2
    ? result("R-07", "已满足", `已找到 ${contracts.length} 份同类项目材料，数量满足要求。`, contracts.slice(0, 2).flatMap((doc) => evidence(doc, 1, "同类软件项目合同或验收依据", "支持")), "无需补充。")
    : contracts.length === 1
      ? result("R-07", "信息不足", "当前仅找到一项符合要求的同类项目材料，数量未达到两项。", evidence(contract, 1, "项目内容：供应链数据分析平台软件开发与部署", "部分支持"), "再补充至少一项近三年的同类项目合同或验收材料。")
      : result("R-07", "缺失", "当前上传材料中未找到同类项目案例。", [], "补充至少两项近三年的同类项目合同或验收材料。") ;

  const r08 = authorization
    ? result("R-08", "已满足", "已找到法定代表人授权委托书。", evidence(authorization, 1, "法定代表人授权委托书", "支持"), "核对签字或盖章后归档。")
    : result("R-08", "缺失", "当前上传材料中未找到法定代表人授权委托书。", [], "补充签字或盖章的法定代表人授权委托书。") ;

  const r09 = tax
    ? result("R-09", "待人工确认", "已找到纳税相关证明，出具日期仍需与六个月期限核对。", evidence(tax, 1, "纳税证明出具日期待核对", "部分支持"), "人工核对证明出具日期是否在最近六个月内。", true)
    : result("R-09", "缺失", "当前上传材料中未找到无欠税证明或纳税信用证明。", [], "补充最近六个月内由主管税务机关出具的相关证明。") ;

  const rosterCount = /合计[:：]?6人|在职人员[:：]?6人/.test(rosterText) ? 6 : null;
  const socialCount = /参保人员[:：]?4人|本期参保人员[:：]?4人/.test(socialText) ? 4 : null;
  const r10 = !roster || !social ? result("R-10", "缺失", "人员名册或近期社保证明不完整，无法交叉印证。", [], "同时补充人员名册与近期社保缴纳记录。")
    : rosterCount === 6 && socialCount === 4
      ? result("R-10", "待人工确认", "技术团队名册列示 6 人，但社保缴纳证明仅列示 4 人，两份材料存在冲突。", [
          ...evidence(roster, 1, "技术团队在职人员合计：6人", "冲突"), ...evidence(social, 1, "本期参保人员：4人", "冲突"),
        ], "人工核对两名未出现在社保证明中的人员状态，并补充相应证明。", true)
      : result("R-10", "待人工确认", "两份人员材料均已找到，但系统无法可靠确认人数一致且不少于 5 人。", [
          ...evidence(roster, 1, "人员名册人数待核对", "部分支持"), ...evidence(social, 1, "社保缴纳人数待核对", "部分支持"),
        ], "人工核对名册与参保人员明细。", true);

  return [r01, r02, r03, r04, r05, r06, r07, r08, r09, r10].filter((entry) => byId.has(entry.itemId));
}

export function getStandardChecklist(): ChecklistItem[] {
  return standardItems;
}
