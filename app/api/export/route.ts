import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

interface WarrantItem {
  vendorCode: string
  vendorName: string
  check: string
  month: string
  description: string
  account: string
  deptCategory: string
  amount: number
}

interface ExportRequest {
  data: WarrantItem[]
  warrantInfo: {
    municipality: string
    warrantNumber: string
    date: string
  }
  total: number
}

export async function POST(request: NextRequest) {
  try {
    const body: ExportRequest = await request.json()
    const { data, warrantInfo, total } = body

    const wb = XLSX.utils.book_new()

    // Sheet 1: Detail
    const detailData: (string | number)[][] = [
      ['A/P Warrant Details'],
      [`${warrantInfo.municipality} - Warrant #${warrantInfo.warrantNumber} - ${warrantInfo.date}`],
      [],
      ['Vendor Code', 'Vendor Name', 'Check #', 'Month', 'Description', 'Account Code', 'Department/Category', 'Amount'],
    ]

    data.forEach(item => {
      detailData.push([
        item.vendorCode,
        item.vendorName,
        item.check,
        item.month,
        item.description,
        item.account,
        item.deptCategory,
        item.amount,
      ])
    })

    // Add total row
    detailData.push([])
    detailData.push(['', '', '', '', '', '', 'TOTAL:', total])

    const ws1 = XLSX.utils.aoa_to_sheet(detailData)
    ws1['!cols'] = [
      { wch: 12 }, { wch: 40 }, { wch: 10 }, { wch: 8 },
      { wch: 35 }, { wch: 14 }, { wch: 40 }, { wch: 14 },
    ]
    XLSX.utils.book_append_sheet(wb, ws1, 'A-P Warrant Details')

    // Sheet 2: Summary by Vendor
    const vendorTotals: Record<string, number> = {}
    data.forEach(item => {
      if (!vendorTotals[item.vendorName]) vendorTotals[item.vendorName] = 0
      vendorTotals[item.vendorName] += item.amount
    })

    const vendorData: (string | number)[][] = [
      ['Summary by Vendor'],
      [],
      ['Vendor', 'Total Amount', '% of Total'],
    ]

    Object.entries(vendorTotals)
      .sort((a, b) => b[1] - a[1])
      .forEach(([vendor, amount]) => {
        vendorData.push([vendor, amount, amount / total])
      })

    vendorData.push([])
    vendorData.push(['TOTAL', total, 1])

    const ws2 = XLSX.utils.aoa_to_sheet(vendorData)
    ws2['!cols'] = [{ wch: 45 }, { wch: 15 }, { wch: 12 }]
    XLSX.utils.book_append_sheet(wb, ws2, 'Summary by Vendor')

    // Sheet 3: Summary by Department
    const deptTotals: Record<string, number> = {}
    data.forEach(item => {
      let dept = item.deptCategory || 'Uncategorized'
      if (dept.includes(' - ')) {
        dept = dept.split(' - ')[0]
      } else if (dept.includes(' / ')) {
        dept = dept.split(' / ')[0]
      }
      if (!deptTotals[dept]) deptTotals[dept] = 0
      deptTotals[dept] += item.amount
    })

    const deptData: (string | number)[][] = [
      ['Summary by Department'],
      [],
      ['Department', 'Total Amount', '% of Total'],
    ]

    Object.entries(deptTotals)
      .sort((a, b) => b[1] - a[1])
      .forEach(([dept, amount]) => {
        deptData.push([dept, amount, amount / total])
      })

    deptData.push([])
    deptData.push(['TOTAL', total, 1])

    const ws3 = XLSX.utils.aoa_to_sheet(deptData)
    ws3['!cols'] = [{ wch: 30 }, { wch: 15 }, { wch: 12 }]
    XLSX.utils.book_append_sheet(wb, ws3, 'Summary by Department')

    // Generate buffer
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${warrantInfo.municipality}_Warrant_${warrantInfo.warrantNumber}.xlsx"`,
      },
    })

  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to export',
    }, { status: 500 })
  }
}
