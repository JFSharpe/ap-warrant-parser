# A/P Warrant Parser

A Next.js application for parsing Municipal A/P Warrant PDFs, built for the Maine School Board Academy.

## Features

- **Server-side PDF Processing**: Reliable text extraction with OCR fallback
- **Multiple Format Support**: Works with text-based and scanned PDFs
- **Municipal Warrant Format**: Supports Bradford-style warrants with E/G account codes
- **Excel Export**: Download parsed data with vendor and department summaries
- **Modern UI**: Clean, responsive interface with Tailwind CSS

## Deployment to Vercel

### Option 1: GitHub Integration (Recommended)

1. Push this code to a GitHub repository
2. Go to [vercel.com](https://vercel.com) and sign in
3. Click "New Project" and import your repository
4. Vercel will auto-detect Next.js and configure the build
5. Click "Deploy"

### Option 2: Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

## Local Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## Supported PDF Formats

- **Municipal A/P Warrants** with:
  - 5-digit vendor codes
  - Check numbers
  - E/G prefix account codes (e.g., E 10-13-25, G 1-1804-00)
  - Department/Category structure
  - Amount and encumbrance columns

## Technical Details

- **Framework**: Next.js 14 with App Router
- **PDF Parsing**: pdf-parse for text extraction
- **OCR**: Tesseract.js for scanned documents
- **Image Processing**: pdf2pic + sharp for PDF to image conversion
- **Excel Export**: xlsx library
- **Styling**: Tailwind CSS

## API Routes

- `POST /api/parse` - Upload and parse PDF file
- `POST /api/export` - Generate Excel file from parsed data

## Environment Variables

No environment variables required for basic functionality.

For production with Supabase (optional):
```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## License

Proprietary - Maine School Board Academy

## Support

Contact Maine School Board Academy for support.
