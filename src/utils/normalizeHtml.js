export function normalizeHtml(html) {
  return html
    .replace(/\\n/g, '') // remove literal \n
    .replace(/\n/g, '')
    .replace(/\s{2,}/g, ' ') // remove excessive spaces
    .replace(/&nbsp;/g, '<br>') // normalize non-breaking spaces
    .trim()
}
