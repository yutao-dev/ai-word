import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'
import { 
  Document, 
  Packer, 
  Paragraph, 
  TextRun, 
  HeadingLevel, 
  AlignmentType, 
  BorderStyle,
  Table,
  TableRow,
  TableCell,
  WidthType,
  VerticalAlign,
  ExternalHyperlink,
  LevelFormat
} from 'docx'
import { marked } from 'marked'
import { saveAs } from 'file-saver'

const sanitizeFilename = (filename) => {
  return filename.replace(/[<>:"/\\|?*]/g, '_').trim() || 'untitled'
}

export const exportAsMarkdown = (content, title) => {
  const filename = `${sanitizeFilename(title)}.md`
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  saveAs(blob, filename)
  return { success: true, filename }
}

export const exportAsHtml = (content, title) => {
  const filename = `${sanitizeFilename(title)}.html`
  const htmlContent = marked(content)
  const fullHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.8;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
    }
    h1 { margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 2px solid #667eea; color: #333; }
    h2 { margin-top: 1.5rem; margin-bottom: 0.8rem; color: #444; }
    h3 { margin-top: 1.2rem; margin-bottom: 0.6rem; color: #555; }
    p { margin-bottom: 1rem; }
    code { background: #f0f0f0; padding: 0.2rem 0.4rem; border-radius: 4px; font-family: 'Courier New', monospace; }
    pre { background: #2d2d2d; color: #f8f8f2; padding: 1rem; border-radius: 8px; overflow-x: auto; margin: 1rem 0; }
    pre code { background: none; padding: 0; }
    blockquote { border-left: 4px solid #667eea; padding-left: 1rem; margin: 1rem 0; color: #666; font-style: italic; }
    ul, ol { margin: 1rem 0; padding-left: 2rem; }
    li { margin: 0.5rem 0; }
    table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
    th, td { border: 1px solid #e0e0e0; padding: 0.6rem 1rem; text-align: left; }
    th { background: #f5f5f5; font-weight: 600; }
    a { color: #667eea; text-decoration: none; }
    a:hover { text-decoration: underline; }
    hr { border: none; border-top: 2px solid #e0e0e0; margin: 1.5rem 0; }
    img { max-width: 100%; height: auto; }
  </style>
</head>
<body>
${htmlContent}
</body>
</html>`
  const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' })
  saveAs(blob, filename)
  return { success: true, filename }
}

export const exportAsPdf = async (content, title) => {
  const filename = `${sanitizeFilename(title)}.pdf`
  
  try {
    const container = document.createElement('div')
    container.style.cssText = `
      position: absolute;
      left: -9999px;
      top: 0;
      width: 800px;
      padding: 40px;
      background: white;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.8;
      color: #333;
    `
    
    const htmlContent = marked(content)
    container.innerHTML = `
      <style>
        h1 { margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 2px solid #667eea; color: #333; font-size: 24px; }
        h2 { margin-top: 1.5rem; margin-bottom: 0.8rem; color: #444; font-size: 20px; }
        h3 { margin-top: 1.2rem; margin-bottom: 0.6rem; color: #555; font-size: 16px; }
        p { margin-bottom: 1rem; }
        code { background: #f0f0f0; padding: 2px 6px; border-radius: 4px; font-family: 'Courier New', monospace; font-size: 14px; }
        pre { background: #2d2d2d; color: #f8f8f2; padding: 1rem; border-radius: 8px; overflow-x: auto; margin: 1rem 0; }
        pre code { background: none; padding: 0; }
        blockquote { border-left: 4px solid #667eea; padding-left: 1rem; margin: 1rem 0; color: #666; font-style: italic; }
        ul, ol { margin: 1rem 0; padding-left: 2rem; }
        li { margin: 0.5rem 0; }
        table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
        th, td { border: 1px solid #e0e0e0; padding: 8px 12px; text-align: left; }
        th { background: #f5f5f5; font-weight: 600; }
        a { color: #667eea; text-decoration: none; }
        hr { border: none; border-top: 2px solid #e0e0e0; margin: 1.5rem 0; }
      </style>
      ${htmlContent}
    `
    
    document.body.appendChild(container)
    
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    })
    
    document.body.removeChild(container)
    
    const imgWidth = 210
    const pageHeight = 297
    const imgHeight = (canvas.height * imgWidth) / canvas.width
    let heightLeft = imgHeight
    
    const pdf = new jsPDF('p', 'mm', 'a4')
    let position = 0
    
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight)
    heightLeft -= pageHeight
    
    while (heightLeft > 0) {
      position = heightLeft - imgHeight
      pdf.addPage()
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight
    }
    
    pdf.save(filename)
    return { success: true, filename }
  } catch (error) {
    console.error('PDF export error:', error)
    return { success: false, error: error.message }
  }
}

const parseInlineFormatting = (text) => {
  if (!text) return [new TextRun({ text: '' })]
  
  const tokens = []
  let remaining = text
  
  const patterns = [
    { regex: /^\*\*\*(.+?)\*\*\*/, type: 'bold-italic' },
    { regex: /^\*\*(.+?)\*\*/, type: 'bold' },
    { regex: /^\*(.+?)\*/, type: 'italic' },
    { regex: /^~~(.+?)~~/, type: 'strikethrough' },
    { regex: /^`(.+?)`/, type: 'code' },
    { regex: /^\[([^\]]+)\]\(([^)]+)\)/, type: 'link' },
    { regex: /^!\[([^\]]*)\]\(([^)]+)\)/, type: 'image' }
  ]
  
  while (remaining.length > 0) {
    let matched = false
    
    for (const pattern of patterns) {
      const match = remaining.match(pattern.regex)
      if (match) {
        if (pattern.type === 'bold-italic') {
          tokens.push({ text: match[1], bold: true, italics: true })
        } else if (pattern.type === 'bold') {
          tokens.push({ text: match[1], bold: true })
        } else if (pattern.type === 'italic') {
          tokens.push({ text: match[1], italics: true })
        } else if (pattern.type === 'strikethrough') {
          tokens.push({ text: match[1], strike: true })
        } else if (pattern.type === 'code') {
          tokens.push({ text: match[1], font: 'Courier New', shading: { fill: 'F0F0F0' } })
        } else if (pattern.type === 'link') {
          tokens.push({ text: match[1], link: match[2], color: '667eea', underline: {} })
        } else if (pattern.type === 'image') {
          tokens.push({ text: `[图片: ${match[1] || 'image'}]`, italics: true, color: '888888' })
        }
        remaining = remaining.slice(match[0].length)
        matched = true
        break
      }
    }
    
    if (!matched) {
      const nextSpecial = remaining.search(/(\*\*\*|\*\*|\*|~~|`|\[|!)/)
      if (nextSpecial === -1) {
        tokens.push({ text: remaining })
        break
      } else if (nextSpecial === 0) {
        tokens.push({ text: remaining[0] })
        remaining = remaining.slice(1)
      } else {
        tokens.push({ text: remaining.slice(0, nextSpecial) })
        remaining = remaining.slice(nextSpecial)
      }
    }
  }
  
  return tokens.map(token => new TextRun(token))
}

const createParagraphWithFormatting = (text, options = {}) => {
  return new Paragraph({
    children: parseInlineFormatting(text),
    ...options
  })
}

const parseTable = (lines, startIndex) => {
  const tableLines = []
  let currentIndex = startIndex
  
  while (currentIndex < lines.length) {
    const line = lines[currentIndex]
    if (line.trim() === '' || !line.includes('|')) {
      break
    }
    tableLines.push(line)
    currentIndex++
  }
  
  if (tableLines.length < 2) {
    return { rows: null, endIndex: startIndex }
  }
  
  const headerLine = tableLines[0]
  const separatorLine = tableLines[1]
  const dataLines = tableLines.slice(2)
  
  const parseTableRow = (line) => {
    return line
      .split('|')
      .map(cell => cell.trim())
      .filter((_, index, arr) => index > 0 && index < arr.length - 1)
  }
  
  const headerCells = parseTableRow(headerLine)
  const dataRows = dataLines.map(parseTableRow)
  
  const alignments = separatorLine
    .split('|')
    .filter((_, index, arr) => index > 0 && index < arr.length - 1)
    .map(cell => {
      const trimmed = cell.trim()
      if (trimmed.startsWith(':') && trimmed.endsWith(':')) return 'center'
      if (trimmed.endsWith(':')) return 'right'
      return 'left'
    })
  
  const tableRows = []
  
  tableRows.push(new TableRow({
    children: headerCells.map((cell, index) => 
      new TableCell({
        children: [new Paragraph({ 
          children: parseInlineFormatting(cell),
          alignment: alignments[index] === 'center' ? AlignmentType.CENTER : 
                     alignments[index] === 'right' ? AlignmentType.RIGHT : AlignmentType.LEFT
        })],
        shading: { fill: 'F5F5F5' },
        verticalAlign: VerticalAlign.CENTER,
        width: { size: 100 / headerCells.length, type: WidthType.PERCENTAGE }
      })
    ),
    tableHeader: true
  }))
  
  for (const row of dataRows) {
    tableRows.push(new TableRow({
      children: row.map((cell, index) => 
        new TableCell({
          children: [new Paragraph({ 
            children: parseInlineFormatting(cell),
            alignment: alignments[index] === 'center' ? AlignmentType.CENTER : 
                       alignments[index] === 'right' ? AlignmentType.RIGHT : AlignmentType.LEFT
          })],
          verticalAlign: VerticalAlign.CENTER,
          width: { size: 100 / headerCells.length, type: WidthType.PERCENTAGE }
        })
      )
    }))
  }
  
  return { 
    rows: tableRows, 
    endIndex: currentIndex - 1 
  }
}

const parseMarkdownToDocx = (content) => {
  const lines = content.split('\n')
  const children = []
  let inCodeBlock = false
  let codeContent = []
  let inBlockquote = false
  let blockquoteContent = []
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    
    if (line.startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true
        codeContent = []
      } else {
        inCodeBlock = false
        codeContent.forEach(codeLine => {
          children.push(new Paragraph({
            children: [new TextRun({
              text: codeLine || ' ',
              font: 'Courier New',
              size: 20
            })],
            shading: { fill: 'F5F5F5' },
            spacing: { before: 0, after: 0, line: 276 }
          }))
        })
        children.push(new Paragraph({ text: '' }))
      }
      continue
    }
    
    if (inCodeBlock) {
      codeContent.push(line)
      continue
    }
    
    if (line.startsWith('>')) {
      inBlockquote = true
      const quoteLine = line.replace(/^>\s?/, '')
      blockquoteContent.push(quoteLine)
      continue
    } else if (inBlockquote) {
      inBlockquote = false
      blockquoteContent.forEach(qLine => {
        children.push(new Paragraph({
          children: parseInlineFormatting(qLine),
          indent: { left: 720 },
          spacing: { before: 60, after: 60 },
          border: {
            left: { color: '667eea', size: 24, style: BorderStyle.SINGLE }
          }
        }))
      })
      children.push(new Paragraph({ text: '' }))
      blockquoteContent = []
    }
    
    if (line.includes('|') && lines[i + 1]?.includes('|') && /^\|?[\s-:|]+\|?$/.test(lines[i + 1])) {
      const { rows, endIndex } = parseTable(lines, i)
      if (rows && rows.length > 0) {
        children.push(new Table({
          rows: rows,
          width: { size: 100, type: WidthType.PERCENTAGE }
        }))
        children.push(new Paragraph({ text: '' }))
        i = endIndex
      }
      continue
    }
    
    if (line.match(/^#{1,6}\s/)) {
      const match = line.match(/^(#{1,6})\s+(.*)/)
      if (match) {
        const level = match[1].length
        const text = match[2]
        const headingMap = {
          1: HeadingLevel.HEADING_1,
          2: HeadingLevel.HEADING_2,
          3: HeadingLevel.HEADING_3,
          4: HeadingLevel.HEADING_4,
          5: HeadingLevel.HEADING_5,
          6: HeadingLevel.HEADING_6
        }
        const spacingMap = {
          1: { before: 400, after: 200 },
          2: { before: 300, after: 150 },
          3: { before: 240, after: 120 },
          4: { before: 200, after: 100 },
          5: { before: 160, after: 80 },
          6: { before: 120, after: 60 }
        }
        
        children.push(new Paragraph({
          children: parseInlineFormatting(text),
          heading: headingMap[level],
          spacing: spacingMap[level],
          border: level === 1 ? {
            bottom: { color: '667eea', size: 12, style: BorderStyle.SINGLE }
          } : undefined
        }))
      }
      continue
    }
    
    const bulletMatch = line.match(/^(\s*)[-*+]\s+(.*)/)
    if (bulletMatch) {
      const indent = bulletMatch[1].length
      const level = Math.min(Math.floor(indent / 2), 3)
      const text = bulletMatch[2]
      
      children.push(new Paragraph({
        children: parseInlineFormatting(text),
        bullet: { level },
        spacing: { before: 60, after: 60 }
      }))
      continue
    }
    
    const orderedMatch = line.match(/^(\s*)(\d+)\.\s+(.*)/)
    if (orderedMatch) {
      const indent = orderedMatch[1].length
      const level = Math.min(Math.floor(indent / 2), 3)
      const text = orderedMatch[3]
      
      children.push(new Paragraph({
        children: parseInlineFormatting(text),
        numbering: { reference: 'ordered-list', level },
        spacing: { before: 60, after: 60 }
      }))
      continue
    }
    
    if (line.trim() === '---' || line.trim() === '***' || line.trim() === '___') {
      children.push(new Paragraph({
        text: '',
        border: {
          bottom: { color: 'E0E0E0', size: 6, style: BorderStyle.SINGLE }
        },
        spacing: { before: 200, after: 200 }
      }))
      continue
    }
    
    if (line.trim() === '') {
      children.push(new Paragraph({ text: '' }))
      continue
    }
    
    children.push(createParagraphWithFormatting(line, {
      spacing: { before: 60, after: 60 }
    }))
  }
  
  if (inBlockquote && blockquoteContent.length > 0) {
    blockquoteContent.forEach(qLine => {
      children.push(new Paragraph({
        children: parseInlineFormatting(qLine),
        indent: { left: 720 },
        spacing: { before: 60, after: 60 },
        border: {
          left: { color: '667eea', size: 24, style: BorderStyle.SINGLE }
        }
      }))
    })
  }
  
  return children
}

export const exportAsWord = async (content, title) => {
  const filename = `${sanitizeFilename(title)}.docx`
  
  try {
    const children = parseMarkdownToDocx(content)
    
    const doc = new Document({
      numbering: {
        config: [
          {
            reference: 'ordered-list',
            levels: [0, 1, 2, 3].map(level => ({
              level,
              format: LevelFormat.DECIMAL,
              text: `%${level + 1}.`,
              alignment: AlignmentType.START,
              style: {
                paragraph: {
                  indent: { left: 720 + level * 360, hanging: 260 }
                }
              }
            }))
          }
        ]
      },
      sections: [{
        properties: {
          page: {
            margin: {
              top: 1440,
              right: 1440,
              bottom: 1440,
              left: 1440
            }
          }
        },
        children: children
      }]
    })
    
    const blob = await Packer.toBlob(doc)
    saveAs(blob, filename)
    return { success: true, filename }
  } catch (error) {
    console.error('Word export error:', error)
    return { success: false, error: error.message }
  }
}

export const exportDocument = async (format, content, title) => {
  switch (format) {
    case 'md':
      return exportAsMarkdown(content, title)
    case 'html':
      return exportAsHtml(content, title)
    case 'pdf':
      return await exportAsPdf(content, title)
    case 'word':
      return await exportAsWord(content, title)
    default:
      return { success: false, error: '不支持的导出格式' }
  }
}
