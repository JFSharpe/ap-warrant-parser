'use client'

import { useState, useCallback } from 'react'
import { Upload, FileText, Download, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'

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

interface ParseResult {
  success: boolean
  data: WarrantItem[]
  warrantInfo: {
    municipality: string
    warrantNumber: string
    date: string
  }
  total: number
  error?: string
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState('')
  const [result, setResult] = useState<ParseResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile?.type === 'application/pdf') {
      setFile(droppedFile)
      setError(null)
      setResult(null)
    } else {
      setError('Please upload a PDF file')
    }
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setError(null)
      setResult(null)
    }
  }

  const processFile = async () => {
    if (!file) return

    setLoading(true)
    setProgress('Uploading PDF...')
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      setProgress('Processing PDF on server (this may take up to 60 seconds for scanned documents)...')
      
      const response = await fetch('/api/parse', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (data.success) {
        setResult(data)
        setProgress('Complete!')
      } else {
        setError(data.error || 'Failed to parse PDF')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const downloadExcel = async () => {
    if (!result) return

    const response = await fetch('/api/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result),
    })

    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${result.warrantInfo.municipality}_Warrant_${result.warrantInfo.warrantNumber}.xlsx`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-primary-400 flex items-center justify-center gap-3">
            <FileText className="w-10 h-10" />
            A/P Warrant Parser
          </h1>
          <p className="text-slate-400 mt-2">
            Maine School Board Academy • Extract payment data from Municipal A/P Warrant PDFs
          </p>
        </header>

        {/* Upload Card */}
        <div className="bg-slate-800/50 rounded-2xl p-8 mb-6 backdrop-blur">
          <div className="bg-primary-500/10 border-l-4 border-primary-500 p-4 rounded-r mb-6">
            <p className="text-slate-300">
              <strong className="text-primary-400">Supported Formats:</strong> Municipal A/P Warrants 
              with vendor codes, check numbers, account codes (E/G prefix), department categories, and amounts.
              Uses OCR technology - works with most PDF formats including scanned documents.
            </p>
          </div>

          {/* Drop Zone */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="border-2 border-dashed border-slate-600 rounded-xl p-12 text-center 
                       hover:border-primary-500 hover:bg-primary-500/5 transition-all cursor-pointer"
            onClick={() => document.getElementById('fileInput')?.click()}
          >
            <input
              type="file"
              id="fileInput"
              accept=".pdf"
              onChange={handleFileChange}
              className="hidden"
            />
            <Upload className="w-16 h-16 mx-auto mb-4 text-slate-500" />
            <p className="text-lg font-medium">Drop your A/P Warrant PDF here</p>
            <p className="text-slate-500 mt-1">or click to browse</p>
          </div>

          {/* Selected File */}
          {file && (
            <div className="mt-4 flex items-center justify-between bg-slate-700/50 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <FileText className="w-6 h-6 text-primary-400" />
                <span>{file.name}</span>
                <span className="text-slate-500 text-sm">
                  ({(file.size / 1024 / 1024).toFixed(2)} MB)
                </span>
              </div>
              <button
                onClick={processFile}
                disabled={loading}
                className="bg-primary-500 hover:bg-primary-600 disabled:opacity-50 
                         px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    Parse Warrant
                  </>
                )}
              </button>
            </div>
          )}

          {/* Progress */}
          {loading && (
            <div className="mt-4 text-center text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
              {progress}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-4 bg-red-500/10 border-l-4 border-red-500 p-4 rounded-r flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-red-400">{error}</p>
            </div>
          )}
        </div>

        {/* Results */}
        {result && result.success && (
          <div className="bg-slate-800/50 rounded-2xl p-8 backdrop-blur">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-primary-400">
                📊 Extraction Results
              </h2>
              <button
                onClick={downloadExcel}
                className="bg-green-600 hover:bg-green-700 px-6 py-2 rounded-lg 
                         font-medium transition-colors flex items-center gap-2"
              >
                <Download className="w-5 h-5" />
                Download Excel
              </button>
            </div>

            {/* Warrant Info */}
            <div className="bg-slate-700/30 rounded-lg p-4 mb-6">
              <p className="text-slate-300">
                <strong className="text-primary-400">{result.warrantInfo.municipality}</strong>
                {' • '}Warrant #{result.warrantInfo.warrantNumber}
                {' • '}{result.warrantInfo.date}
              </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-slate-700/50 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-primary-400">{result.data.length}</div>
                <div className="text-slate-500 text-sm uppercase mt-1">Line Items</div>
              </div>
              <div className="bg-slate-700/50 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-primary-400">
                  {new Set(result.data.map(d => d.vendorName)).size}
                </div>
                <div className="text-slate-500 text-sm uppercase mt-1">Vendors</div>
              </div>
              <div className="bg-slate-700/50 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-primary-400">
                  {new Set(result.data.filter(d => d.check).map(d => d.check)).size}
                </div>
                <div className="text-slate-500 text-sm uppercase mt-1">Checks</div>
              </div>
              <div className="bg-slate-700/50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-green-400">
                  ${result.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-slate-500 text-sm uppercase mt-1">Total Amount</div>
              </div>
            </div>

            {/* Data Table */}
            <div className="overflow-x-auto rounded-lg border border-slate-700">
              <table className="w-full text-sm">
                <thead className="bg-slate-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-primary-400">Vendor Code</th>
                    <th className="px-4 py-3 text-left text-primary-400">Vendor Name</th>
                    <th className="px-4 py-3 text-left text-primary-400">Check #</th>
                    <th className="px-4 py-3 text-left text-primary-400">Description</th>
                    <th className="px-4 py-3 text-left text-primary-400">Account</th>
                    <th className="px-4 py-3 text-left text-primary-400">Department</th>
                    <th className="px-4 py-3 text-right text-primary-400">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {result.data.map((item, idx) => (
                    <tr key={idx} className="border-t border-slate-700/50 hover:bg-slate-700/30">
                      <td className="px-4 py-3 font-mono text-slate-400">{item.vendorCode}</td>
                      <td className="px-4 py-3">{item.vendorName}</td>
                      <td className="px-4 py-3 font-mono">{item.check}</td>
                      <td className="px-4 py-3 text-slate-400">{item.description}</td>
                      <td className="px-4 py-3 font-mono text-slate-400">{item.account}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{item.deptCategory}</td>
                      <td className="px-4 py-3 text-right font-mono">
                        ${item.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="text-center text-slate-500 text-sm mt-8">
          Maine School Board Academy • A/P Warrant Parser v1.0 • Server-side PDF Processing
        </footer>
      </div>
    </main>
  )
}
