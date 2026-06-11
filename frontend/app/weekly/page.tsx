import { ReportList } from '../components/ReportList'
import { PageHeader } from '../components/ui'

export default function WeeklyPage() {
  return (
    <div>
      <PageHeader title="市场周报" description="从近 7 天日报中提取版本更新、功能进展与能力变化" />
      <ReportList
        endpoint="/api/reports/weekly"
        regenerateBase="/api/reports/weekly"
        emptyIcon="weekly"
        emptyTitle="暂无周报"
        emptyDescription="每周三 10:00 自动生成，也可以点击上方按钮手动生成。"
        generateLabel="生成本周周报"
        generatingLabel="生成中..."
        datePrefix="截至 "
      />
    </div>
  )
}
