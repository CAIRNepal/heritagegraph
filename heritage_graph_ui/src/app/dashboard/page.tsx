import { DataTable } from "@/components/data-table"
import { SectionCards } from "@/app/dashboard/components/section-cards"
import data from "./data.json"

export default function Page() {
  return (
    <div className="space-y-6">
      <div className="bg-white/80 backdrop-blur-sm border border-blue-200 rounded-xl p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-blue-900 mb-4">Dashboard Overview</h2>
        <SectionCards />
      </div>
      
      <div className="bg-white/80 backdrop-blur-sm border border-blue-200 rounded-xl p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-blue-900 mb-4">Recent Activity</h2>
        <DataTable data={data} />
      </div>
    </div>
  )
}