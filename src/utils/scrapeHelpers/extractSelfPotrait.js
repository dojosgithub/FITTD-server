import { normalizeHtml, scrapeProductsInParallel, setupPage } from '../../utils'

export const getSelfPotraitProductUrlsFromCategory = async (categoryUrl, existingPage = null) => {
  const selector = 'li.prd-List_Item'
  const page = await setupPage(categoryUrl, selector, existingPage)
  if (!page) {
    return []
  }
  page.on('console', (msg) => {
    if (msg.type() === 'log') {
      console.log(`🧠 BROWSER LOG: ${msg.text()}`)
    }
  })
  try {
    const products = await extractSelfPortraitProductsFromPage(page, categoryUrl)
    const productsWithDescriptions = await scrapeProductsInParallel(
      products,
      page.browser(),
      fetchSelfPotraitProductDescription
    )
    console.log(`✅ Completed fetching descriptions for ${productsWithDescriptions.length} products`)
    const hasNextPage = await page.evaluate(() => {
      const nextPageLink = document.querySelector('link[rel=next]')
      return nextPageLink ? nextPageLink.getAttribute('href') : null
    })

    if (hasNextPage) {
      const nextPageUrl = new URL(hasNextPage, categoryUrl).toString()
      await new Promise((resolve) => setTimeout(resolve, 3000))
      const nextPageProducts = await getSelfPotraitProductUrlsFromCategory(nextPageUrl, page)
      return [...productsWithDescriptions, ...nextPageProducts]
    }

    return productsWithDescriptions
  } catch (error) {
    console.error(`Error scraping category ${categoryUrl}:`, error)
    return []
  }
}
const fetchSelfPotraitProductDescription = async (url, page) => {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 })

    // Wait for either description to load
    await page.waitForFunction(
      () => {
        return document.querySelector('.drw-PrdAccordion_AccText')
      },
      { timeout: 30000 }
    )

    const data = await page.evaluate(() => {
      // Extract description HTML
      const descElement = document.querySelector('.drw-PrdAccordion_AccText')

      const description = descElement?.innerHTML.trim() || ''

      // Extract secondary images from data-href (skip first one)
      const imageAnchors = Array.from(document.querySelectorAll('product-photoswipe a[data-href]'))
      const imageUrls = imageAnchors.map((a) => a.getAttribute('data-href'))
      const primaryImage = imageUrls[0] ? 'https:' + imageUrls[0].replace(/&width=\d+/, '') : ''
      // Remove first image (main) and strip &width=
      const secondaryImages = imageUrls.slice(1).map((src) => 'https:' + src.replace(/&width=\d+/, ''))

      return {
        description,
        primaryImage,
        secondaryImages,
      }
    })

    return {
      description: normalizeHtml(data.description),
      image: { primary: data.primaryImage, secondary: data.secondaryImages },
    }
  } catch (err) {
    console.error(`❌ Failed to fetch from ${url}: ${err.message}`)
    return {
      description: '',
      secondaryImages: [],
    }
  }
}
const extractSelfPortraitProductsFromPage = async (page, baseUrl) => {
  return await page.evaluate((baseUrl) => {
    const products = []

    document.querySelectorAll('li.prd-List_Item').forEach((item) => {
      const article = item.querySelector('article.prd-Card')
      if (!article) return

      const titleElement = article.querySelector('.prd-Card_Title')
      const priceElement = article.querySelector('.prd-Card_Price')
      const urlElement = article.querySelector('a.prd-Card_FauxLink')

      const title = titleElement?.textContent.trim() || ''
      const price = priceElement?.textContent.trim() || ''
      const productUrl = urlElement?.getAttribute('href') || ''

      const fullProductUrl = productUrl.startsWith('/') ? new URL(productUrl, baseUrl).toString() : productUrl

      const sizes = []
      article.querySelectorAll('ul.prd-Card_Options li button').forEach((btn) => {
        const size = btn.textContent.trim()
        const isSoldOut = btn.classList.contains('prd-Card_Link-soldOut')
        sizes.push({
          size,
          inStock: !isSoldOut,
        })
      })

      products.push({
        name: title,
        price: price,
        url: fullProductUrl,
        image: {
          primary: '',
          secondary: [],
        },
        sizes,
        gender: 'female',
        description: '',
        rating: null,
        reviewCount: null,
      })
    })

    return products
  }, baseUrl)
}
