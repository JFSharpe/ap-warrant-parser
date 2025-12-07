import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

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

interface WarrantInfo {
  municipality: string
  warrantNumber: string
  date: string
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    
    // Use OCR.space API for text extraction
    let text = ''
    
    try {
      text = await extractTextWithOCR(arrayBuffer, file.name)
      console.log('OCR text extraction length:', text.length)
    } catch (ocrError) {
      console.log('OCR extraction failed:', ocrError)
      return NextResponse.json({
        success: false,
        error: 'Could not extract text from PDF. Please try again or contact support.',
      })
    }

    // Check if we got meaningful content
    if (!text || text.trim().length < 50) {
      return NextResponse.json({
        success: false,
        error: 'Could not extract text from PDF. The file may be corrupted or empty.',
      })
    }

    // Parse the warrant data
    const { items, warrantInfo } = parseWarrantText(text)

    if (items.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Could not parse warrant data. The PDF format may not be supported.',
        debug: text.substring(0, 1000),
      })
    }

    const total = items.reduce((sum, item) => sum + item.amount, 0)

    return NextResponse.json({
      success: true,
      data: items,
      warrantInfo,
      total,
    })

  } catch (error) {
    console.error('Parse error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to parse PDF',
    }, { status: 500 })
  }
}

async function extractTextWithOCR(arrayBuffer: ArrayBuffer, filename: string): Promise<string> {
  const apiKey = process.env.OCR_SPACE_API_KEY || 'K85473287788957' // Free API key
  
  // Convert ArrayBuffer to base64
  const base64 = Buffer.from(arrayBuffer).toString('base64')
  const base64Data = `data:application/pdf;base64,${base64}`
  
  // Call OCR.space API
  const formData = new FormData()
  formData.append('base64Image', base64Data)
  formData.append('language', 'eng')
  formData.append('isOverlayRequired', 'false')
  formData.append('filetype', 'PDF')
  formData.append('detectOrientation', 'true')
  formData.append('scale', 'true')
  formData.append('OCREngine', '2') // Engine 2 is better for most documents
  
  const response = await fetch('https://api.ocr.space/parse/image', {
    method: 'POST',
    headers: {
      'apikey': apiKey,
    },
    body: formData,
  })
  
  if (!response.ok) {
    throw new Error(`OCR API error: ${response.status}`)
  }
  
  const result = await response.json()
  
  if (result.IsErroredOnProcessing) {
    throw new Error(result.ErrorMessage || 'OCR processing failed')
  }
  
  // Combine text from all pages
  let fullText = ''
  if (result.ParsedResults && result.ParsedResults.length > 0) {
    for (const page of result.ParsedResults) {
      if (page.ParsedText) {
        fullText += page.ParsedText + '\n\n'
      }
    }
  }
  
  return fullText
}

function parseWarrantText(text: string): { items: WarrantItem[], warrantInfo: WarrantInfo } {
  const lines = text.split('\n')
  const items: WarrantItem[] = []
  
  // Extract header info
  const dateMatch = text.match(/(\d{2}\/\d{2}\/\d{4})/)
  const warrantMatch = text.match(/Warrant\s+(\d+)/i)
  const municipalityMatch = text.match(/^([A-Za-z]+)\s/m)

  const warrantInfo: WarrantInfo = {
    date: dateMatch ? dateMatch[1] : 'Unknown',
    warrantNumber: warrantMatch ? warrantMatch[1] : 'Unknown',
    municipality: municipalityMatch ? municipalityMatch[1].trim() : 'Unknown',
  }

  let currentVendor = { code: '', name: '' }
  let currentCheck = ''
  let currentMonth = ''

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    // Skip header lines and totals
    if (line.includes('Jrnl') || line.includes('Check') || line.includes('Month') ||
        line.includes('Total-') || line.includes('Invoice Total') || 
        line.includes('Vendor Total') || line.includes('Prepaid Total') ||
        line.includes('Current Total') || line.includes('EFT Total') ||
        line.includes('Warrant Total') || line.includes('TREASURER') ||
        line.includes('CERTIFY') || line.includes('SELECTMEN') ||
        line.includes('Page ')) {
      continue
    }

    // Check for vendor header (5-digit code followed by vendor name)
    const vendorMatch = line.match(/^(\d{5})\s+([A-Za-z][A-Za-z\s&\.,'\-\/\(\)]+?)(?:\s*$|\s+\d)/)
    if (vendorMatch && !line.match(/^\d{5}\s+\d{5}/)) {
      currentVendor = {
        code: vendorMatch[1],
        name: vendorMatch[2].trim().replace(/\s+/g, ' '),
      }
      continue
    }

    // Check for line item (starts with journal code, check#, month)
    const itemMatch = line.match(/^(\d{4})\s+(\d{5})\s+(\d{2})\s+(.*)/)
    if (itemMatch) {
      currentCheck = itemMatch[2]
      currentMonth = itemMatch[3]
      
      let description = itemMatch[4] || ''
      let account = ''
      let deptCategory = ''
      let amount = 0

      // Check current line for amount pattern (amount followed by encumbrance)
      const amtMatch = line.match(/([\d,]+\.\d{2})\s+\d+\.\d{2}\s*$/)
      if (amtMatch) {
        amount = parseFloat(amtMatch[1].replace(/,/g, ''))
        description = description.replace(amtMatch[0], '').trim()
      }

      // Look at next few lines for additional data
      for (let j = 1; j <= 4 && i + j < lines.length; j++) {
        const nextLine = lines[i + j].trim()
        
        // Stop if we hit another item or vendor
        if (nextLine.match(/^\d{4}\s+\d{5}/) || nextLine.match(/^\d{5}\s+[A-Za-z]/)) {
          break
        }

        // Check for account code (E or G prefix)
        const acctMatch = nextLine.match(/([EG])\s*(\d{1,2})[-\s](\d{1,2})[-\s](\d{2})/)
        if (acctMatch && !account) {
          account = `${acctMatch[1]} ${acctMatch[2]}-${acctMatch[3]}-${acctMatch[4]}`
        }

        // Check for FUND pattern
        const fundMatch = nextLine.match(/^FUND\s+\d+\s*\/?\s*(.*)$/i)
        if (fundMatch && !deptCategory) {
          deptCategory = nextLine
        }

        // Check for department/category pattern
        const deptMatch = nextLine.match(/^([A-Z][A-Z\s\.]+)\s*[-–]\s*([A-Z][A-Z\s\.]+)\s*\/\s*(.+)/i)
        if (deptMatch && !deptCategory) {
          deptCategory = `${deptMatch[1].trim()} - ${deptMatch[2].trim()} / ${deptMatch[3].trim()}`
        }

        // Check for amount if not found yet
        if (!amount) {
          const lineAmtMatch = nextLine.match(/([\d,]+\.\d{2})\s+\d+\.\d{2}\s*$/)
          if (lineAmtMatch) {
            amount = parseFloat(lineAmtMatch[1].replace(/,/g, ''))
          }
        }
      }

      // Clean up description
      description = description
        .replace(/[EG]\s*\d{1,2}[-\s]\d{1,2}[-\s]\d{2}/, '')
        .replace(/[\d,]+\.\d{2}\s+\d+\.\d{2}/, '')
        .replace(/\s+/g, ' ')
        .trim()

      // Only add if we have valid data
      if (amount > 0 && currentVendor.name) {
        items.push({
          vendorCode: currentVendor.code,
          vendorName: currentVendor.name,
          check: currentCheck,
          month: currentMonth,
          description: description || 'Payment',
          account: account,
          deptCategory: deptCategory,
          amount: amount,
        })
      }
    }
  }

  // If standard parsing didn't work well, try alternative approach
  if (items.length < 3) {
    return { items: parseAlternativeFormat(text), warrantInfo }
  }

  return { items, warrantInfo }
}

function parseAlternativeFormat(text: string): WarrantItem[] {
  const items: WarrantItem[] = []
  const lines = text.split('\n')
  let currentVendor = { code: '', name: '' }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    // Look for vendor code and name pattern
    const vendorMatch = line.match(/^(\d{5})\s+([A-Za-z][A-Za-z\s&\.,'\-\/\(\)]+?)(?:\s+\d|$)/)
    if (vendorMatch) {
      currentVendor = {
        code: vendorMatch[1],
        name: vendorMatch[2].trim(),
      }
    }

    // Look for amount patterns
    const amounts = line.match(/([\d,]+\.\d{2})/g)
    if (amounts && currentVendor.name && !line.includes('Total')) {
      const parsedAmounts = amounts.map(a => parseFloat(a.replace(/,/g, '')))
      const mainAmount = parsedAmounts.find(a => a > 0 && a < 10000000)

      if (mainAmount) {
        const acctMatch = line.match(/([EG])\s*(\d{1,2})[-\s](\d{1,2})[-\s](\d{2})/)
        const checkMatch = line.match(/\b(2[45]\d{3})\b/)

        items.push({
          vendorCode: currentVendor.code,
          vendorName: currentVendor.name,
          check: checkMatch ? checkMatch[1] : '',
          month: '03',
          description: 'Payment',
          account: acctMatch ? `${acctMatch[1]} ${acctMatch[2]}-${acctMatch[3]}-${acctMatch[4]}` : '',
          deptCategory: '',
          amount: mainAmount,
        })
      }
    }
  }

  return items
}
