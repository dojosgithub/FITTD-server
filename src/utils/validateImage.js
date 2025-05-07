const https = require('https')
const crypto = require('crypto')
const PLACEHOLDER_HASH = 'd70f2cc848600503dc83d05a5286dd3e'
const isValidLuluImage = async (url) => {
  return new Promise((resolve) => {
    https
      .get(url, (res) => {
        const chunks = []
        res.on('data', (chunk) => chunks.push(chunk))
        res.on('end', () => {
          const buffer = Buffer.concat(chunks)
          const hash = crypto.createHash('md5').update(buffer).digest('hex')
          resolve(hash !== PLACEHOLDER_HASH)
        })
      })
      .on('error', () => resolve(false))
  })
}
export const fetchSecondaryImages = async (primaryImageUrl) => {
  const baseUrl = primaryImageUrl.replace(/_\d+$/, '')
  const secondaryImages = []
  let index = 2

  while (true) {
    const imageUrl = `${baseUrl}_${index}`
    const isValid = await isValidLuluImage(imageUrl)
    if (!isValid) break
    secondaryImages.push(imageUrl)
    index++
  }

  return secondaryImages
}
