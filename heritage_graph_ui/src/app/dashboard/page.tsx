import { DataTable } from "@/components/data-table"
import { SectionCards } from "@/app/dashboard/components/section-cards"

import data from "./data.json"

export default function Page() {
  return (
    <>
      <SectionCards />
      <div className="px-4 lg:px-6">
      </div>
      <DataTable data={data} />
    </>
  )
}
