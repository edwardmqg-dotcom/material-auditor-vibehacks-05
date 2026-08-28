# 材料审核员｜MVP 接口约定

## 一、设计目标

只支持比赛 Demo 所需的最短闭环：上传清单和 PDF，启动审核，查看逐项结果与证据，导出结果。

## 二、数据对象

### ReviewTask

```json
{
  "task_id": "task_demo_001",
  "name": "北京准点科技供应商准入初审",
  "as_of_date": "2026-08-29",
  "status": "processing",
  "progress": {
    "stage": "reviewing",
    "completed_items": 4,
    "total_items": 10
  }
}
```

任务状态：`created | parsing | reviewing | completed | partial_failed | failed`。

### ParsedDocument

```json
{
  "document_id": "doc_001",
  "file_name": "01_营业执照.pdf",
  "page_count": 1,
  "parse_status": "completed",
  "pages": [
    {
      "page": 1,
      "text": "……"
    }
  ]
}
```

### ReviewItemResult

严格使用 `审核结果.schema.json`。

## 三、最小接口

### `POST /api/tasks`

创建审核任务。

请求：

```json
{
  "name": "北京准点科技供应商准入初审",
  "as_of_date": "2026-08-29"
}
```

### `POST /api/tasks/{task_id}/checklist`

上传 XLSX/CSV 清单。比赛版只读取以下字段：

- 审核项编号
- 类别
- 审核要求
- 建议材料

### `POST /api/tasks/{task_id}/documents`

一次上传多个 PDF。每份文件保存：文件名、页数、逐页文本和解析状态。

### `POST /api/tasks/{task_id}/run`

启动审核。按审核项并发处理，但应限制并发数，避免模型接口限流。

### `GET /api/tasks/{task_id}`

返回任务状态、进度、文件解析状态和结果摘要。

### `GET /api/tasks/{task_id}/results`

返回全部审核结果。

### `POST /api/tasks/{task_id}/items/{item_id}/retry`

只重试一个失败或待确认项。

### `GET /api/tasks/{task_id}/export?format=csv`

导出审核结果。MVP 优先 CSV，Markdown 作为第二格式。

## 四、硬性业务规则

1. 无证据不得判“已满足”；
2. 引用未通过原文校验时，结果自动转“待人工确认”；
3. 一个文件解析失败不应阻断其他文件；
4. 一个审核项失败不应阻断其他审核项；
5. 所有中间结果及时保存，刷新页面后可继续查看；
6. 页面始终显示“AI 初审，关键结论需人工复核”；
7. 不在比赛版实现登录、权限、协作和计费。

## 五、Demo 模式

保留一个只对演示数据生效的缓存结果：

- 主流程仍然实际上传和解析；
- 模型接口成功时展示实时结果；
- 模型接口失败或超时时，可切换到经过验证的标准答案；
- 切换动作应由演示者明确触发，不在产品叙述中伪装成实时模型结果。

