import { fetchSecondaryImages, loadMoreLuluLemonProducts, scrapeProductsInParallel, setupPage } from '../../utils'

export const getLuluLemonProductUrlsFromCategory = async (categoryUrl, existingPage = null) => {
  const selector = 'div[data-testid="product-tile"]'
  const page = await setupPage(categoryUrl, selector, existingPage)

  if (!page) {
    return []
  }

  try {
    await loadMoreLuluLemonProducts(page, selector, categoryUrl)
    const products = await extractLuluLemonProductsFromPage(page, categoryUrl)
    console.log(`📋 Found ${products.length} products on page ${categoryUrl}`)
    const productsWithDescriptions = await scrapeProductsInParallel(
      products,
      page.browser(),
      fetchLuluLemonProductDescription,
      true
    )
    console.log(`✅ Completed fetching descriptions for ${productsWithDescriptions.length} products`)
    return productsWithDescriptions
  } catch (error) {
    console.error(`Error scraping category ${categoryUrl}:`, error)
    return []
  }
}
const fetchLuluLemonProductDescription = async (url, page) => {
  const TIMEOUT_MS = 120000

  try {
    const result = await Promise.race([
      (async () => {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUT_MS })

        // Ensure the product page actually loaded
        if (page.url() !== url) {
          throw new Error(`Redirected to ${page.url()}`)
        }

        await page.waitForSelector('[data-lll-pl="size-tile"]', { timeout: 15000 })

        const [primaryImageUrl, sizes, description, reviewCount, rating] = await Promise.all([
          page.evaluate(() => {
            const preloadLink = document.querySelector('link[rel="preload"][as="image"]')
            return preloadLink?.href || null
          }),

          page.evaluate(() => {
            return Array.from(document.querySelectorAll('[data-lll-pl="size-tile"]')).map((el) => {
              const size = el.textContent.trim()
              const inStock = !el.className.includes('size-tile_sizeTileUnavailable')
              return { size, inStock }
            })
          }),

          page.evaluate(() => {
            return Array.from(document.querySelectorAll('button[data-testid="designed-for-button"]'))
              .map((el) => `<li>${el.innerHTML.trim()}</li>`)
              .join('')
          }),

          page.evaluate(() => {
            try {
              const el = document.querySelector('.reviews-link_reviewsLinkCount__Ok1LX')
              const countText = el?.textContent?.trim() || ''
              const match = countText.match(/\d+/)
              return match ? parseInt(match[0], 10) : 0
            } catch (e) {
              return 0
            }
          }),

          page.evaluate(() => {
            try {
              const ldJson = document.querySelector('script[type="application/ld+json"]')
              const data = JSON.parse(ldJson?.textContent || '{}')
              return data.aggregateRating?.ratingValue ? Math.round(data.aggregateRating.ratingValue * 10) / 10 : null
            } catch (e) {
              return null
            }
          }),
        ])

        const secondaryImageUrls = primaryImageUrl ? await fetchSecondaryImages(primaryImageUrl) : []
        return {
          description: description || '',
          sizes: sizes || [],
          image: {
            primary: primaryImageUrl,
            secondary: secondaryImageUrls,
          },
          reviewCount,
          rating,
        }
      })(),

      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout after ${TIMEOUT_MS / 1000}s`)), TIMEOUT_MS)
      ),
    ])

    return result
  } catch (err) {
    console.error(`❌ Skipped ${url}: ${err.message}`)
    return { description: '', sizes: [] } // fallback
  }
}
const extractLuluLemonProductsFromPage = async (page, baseUrl) => {
  return await page.evaluate((baseUrl) => {
    const products = []

    document.querySelectorAll('div[data-testid="product-tile"]').forEach((productTile) => {
      const titleAnchor = productTile.querySelector('h3.product-tile__product-name a')
      const priceElement = productTile.querySelector('.price span')

      if (titleAnchor && priceElement) {
        const title = titleAnchor.textContent.trim()
        const relativeUrl = titleAnchor.getAttribute('href')
        const absoluteUrl = new URL(relativeUrl, baseUrl).toString()
        const price = priceElement.textContent.trim()

        // Get both default and hover images

        products.push({
          name: title,
          description: '',
          url: absoluteUrl,
          price,
          image: {
            primary: '',
            secondary: [],
          },
          sizes: [],
          rating: null,
          reviewCount: null,
        })
      }
    })

    return products
  }, baseUrl)
}
