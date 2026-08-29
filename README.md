# 材料审核员 · Material Auditor

把标准审核清单和 PDF 材料包转成可追溯的逐项审核结果：找证据、标缺项、识别冲突，并把真正需要判断的事项留给人。

- 主演示地址：<https://material-auditor-vh05.edwardmqg.chatgpt.site/>
- 中国大陆备用镜像：<https://edwardmqg-dotcom.github.io/material-auditor-vibehacks-05/>
- 比赛背景：VibeHacks #05「Vibe Coding for 准点下班」
- 技术栈：Next.js、React、Vinext、PDF.js、read-excel-file

## 这个版本能做什么

- 读取标准 XLSX/CSV 审核清单；
- 在浏览器中逐页解析多份 PDF；
- 按可解释规则核验日期、金额、数量和跨文件一致性；
- 输出“已满足 / 信息不足 / 缺失 / 待人工确认”四种状态；
- 为每条结论保留来源文件、页码、证据原文和建议动作；
- 在顶部突出保险过期、授权缺失和人数冲突三项代表性异常，同时标明共 5 项需要处理并提供全部异常入口；
- 支持筛选，以及 CSV、Markdown 导出。

当前实现是面向内置供应商准入案例的比赛原型，不是通用 AI 审核服务，也不替代法律、财务、采购或合规专业判断。没有可验证证据时，系统不会判定满足。

## 安全与隐私

当前版本在浏览器内解析上传文件，不将文件写入本项目的服务端存储。公开仓库只包含明确标注的合成演示数据：虚构公司、人员、地址、编号和交易，不对应真实主体。

即便如此，真实敏感材料仍应仅在获得授权且环境符合组织安全要求时使用。最终结论必须由有资质的人员复核。

## 演示数据

`public/demo/` 包含：

- 1 份标准 XLSX 清单，共 10 个审核项；
- 8 份合成 PDF，覆盖营业执照、审计摘要、合同、保险、团队名册和社保等；
- 1 份机器可读的预期结果 `demo-spec.json`。

标准结果为 5 项已满足、2 项信息不足、2 项缺失、1 项待人工确认。演示数据禁止用于真实采购、合规或资质认定。

## 本地运行

需要 Node.js 22.13+ 与 pnpm 10。

```bash
pnpm install --frozen-lockfile
pnpm dev
```

质量检查：

```bash
pnpm lint
pnpm test
pnpm build
pnpm audit --prod
```

## 目录结构

```text
app/                 页面与样式
lib/                 文件解析和审核规则
public/demo/         合成清单、PDF 与预期结果
tests/               发布完整性测试
.github/workflows/   持续集成
```

`.openai/hosting.json` 是具体部署实例的私有绑定，不进入版本控制；仓库中的 `.openai/hosting.example.json` 仅说明本项目不使用 D1 或 R2。公开演示的现有部署与本仓库相互独立。

## 许可证

项目原创代码与合成演示材料采用 [MIT License](./LICENSE)。PDF.js worker 与依赖包沿用各自许可证，详见 [第三方声明](./THIRD_PARTY_NOTICES.md)。
