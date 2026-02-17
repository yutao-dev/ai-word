import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle } from 'docx'
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

const parseMarkdownToDocx = (content) => {
  const lines = content.split('\n')
  const children = []
  let inCodeBlock = false
  let codeContent = []
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    
    if (line.startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true
        codeContent = []
      } else {
        inCodeBlock = false
        children.push(new Paragraph({
          children: [new TextRun({
            text: codeContent.join('\n'),
            font: 'Courier New',
            size: 20,
            shading: { fill: 'F0F0F0' }
          })],
          spacing: { before: 200, after: 200 }
        }))
      }
      continue
    }
    
    if (inCodeBlock) {
      codeContent.push(line)
      continue
    }
    
    if (line.startsWith('# ')) {
      children.push(new Paragraph({
        text: line.slice(2),
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
        border: {
          bottom: { color: '667eea', size: 12, style: BorderStyle.SINGLE }
        }
      }))
    } else if (line.startsWith('## ')) {
      children.push(new Paragraph({
        text: line.slice(3),
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 150 }
      }))
    } else if (line.startsWith('### ')) {
      children.push(new Paragraph({
        text: line.slice(4),
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 200, after: 100 }
      }))
    } else if (line.startsWith('#### ')) {
      children.push(new Paragraph({
        text: line.slice(5),
        heading: HeadingLevel.HEADING_4,
        spacing: { before: 200, after: 100 }
      }))
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      children.push(new Paragraph({
        text: line.slice(2),
        bullet: { level: 0 },
        spacing: { before: 60, after: 60 }
      }))
    } else if (line.match(/^\d+\.\s/)) {
      children.push(new Paragraph({
        text: line.replace(/^\d+\.\s/, ''),
        numbering: { reference: 'default-numbering', level: 0 },
        spacing: { before: 60, after: 60 }
      }))
    } else if (line.startsWith('> ')) {
      children.push(new Paragraph({
        text: line.slice(2),
        indent: { left: 720 },
        spacing: { before: 100, after: 100 },
        border: {
          left: { color: '667eea', size: 24, style: BorderStyle.SINGLE }
        }
      }))
    } else if (line.trim() === '---') {
      children.push(new Paragraph({
        text: '',
        border: {
          bottom: { color: 'E0E0E0', size: 6, style: BorderStyle.SINGLE }
        },
        spacing: { before: 200, after: 200 }
      }))
    } else if (line.trim() === '') {
      children.push(new Paragraph({ text: '' }))
    } else {
      const boldRegex = /\*\*(.+?)\*\*/g
      const italicRegex = /\*(.+?)\*/g
      const codeRegex = /`(.+?)`/g
      
      const parts = []
      
      const allMatches = []
      let match
      
      while ((match = boldRegex.exec(line)) !== null) {
        allMatches.push({ start: match.index, end: match.index + match[0].length, text: match[1], type: 'bold' })
      }
      while ((match = italicRegex.exec(line)) !== null) {
        allMatches.push({ start: match.index, end: match.index + match[0].length, text: match[1], type: 'italic' })
      }
      while ((match = codeRegex.exec(line)) !== null) {
        allMatches.push({ start: match.index, end: match.index + match[0].length, text: match[1], type: 'code' })
      }
      
      allMatches.sort((a, b) => a.start - b.start)
      
      let pos = 0
      for (const m of allMatches) {
        if (m.start > pos) {
          parts.push({ text: line.slice(pos, m.start), type: 'normal' })
        }
        parts.push({ text: m.text, type: m.type })
        pos = m.end
      }
      if (pos < line.length) {
        parts.push({ text: line.slice(pos), type: 'normal' })
      }
      
      if (parts.length === 0) {
        parts.push({ text: line, type: 'normal' })
      }
      
      const textRuns = parts.map(part => {
        const runOptions = { text: part.text }
        if (part.type === 'bold') {
          runOptions.bold = true
        } else if (part.type === 'italic') {
          runOptions.italics = true
        } else if (part.type === 'code') {
          runOptions.font = 'Courier New'
          runOptions.shading = { fill: 'F0F0F0' }
        }
        return new TextRun(runOptions)
      })
      
      children.push(new Paragraph({
        children: textRuns,
        spacing: { before: 60, after: 60 }
      }))
    }
  }
  
  return children
}

export const exportAsWord = async (content, title) => {
  const filename = `${sanitizeFilename(title)}.docx`
  
  try {
    const children = parseMarkdownToDocx(content)
    
    const doc = new Document({
      numbering: {
        config: [{
          reference: 'default-numbering',
          levels: [{
            level: 0,
            format: 'decimal',
            text: '%1.',
            alignment: AlignmentType.START
          }]
        }]
      },
      sections: [{
        properties: {},
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
