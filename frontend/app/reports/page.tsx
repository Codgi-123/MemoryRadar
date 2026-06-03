import { ReportList } from '../components/ReportList'

export default function ReportsPage() {
  return (
    <div>
      <div className="page-header">
        <div><h1>市场日报</h1><p>LLM 生成的 Agent Memory 市场每日简报</p></div>
      </div>
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
