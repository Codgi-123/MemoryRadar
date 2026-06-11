import { ReportList } from '../components/ReportList'
import { PageHeader } from '../components/ui'

export default function ReportsPage() {
  return (
    <div>
      <PageHeader title="市场日报" description="LLM 生成的 Agent Memory 市场每日简报" />
      <ReportList
        endpoint="/api/reports/daily"
        regenerateBase="/api/reports/daily"
        emptyIcon="daily"
        emptyTitle="暂无日报"
        emptyDescription="点击上方按钮生成第一份日报"
        generateLabel="生成今日日报"
        generatingLabel="生成中..."
      />
    </div>
  )
}
