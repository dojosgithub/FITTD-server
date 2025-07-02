// utils/scrapeHelpers/houseofcb/extractProducts.js
import { loadMoreProducts, normalizeHtml } from '../../utils'
import { scrapeProductsInParallel } from './commonScraper.js'

export const getHouseOfCbProductUrlsFromCategory = async (categoryUrl, existingPage = null) => {
  const selector = 'a.flex.relative.justify-center.items-start'
  const page = await setupPage(categoryUrl, selector, existingPage)
  console.log('page', page)
  if (!page) return []

  try {
    await loadMoreProducts(page)
    const products = await extractHouseOfCBProductsFromPage(page, categoryUrl)
    console.log(`📋 Found ${products.length} products on page ${categoryUrl}`)
    const productsWithDescriptions = await scrapeProductsInParallel(
      products,
      page.browser(),
      fetchHouseOfCBProductDescription
    )
    console.log(`✅ Completed fetching descriptions for ${productsWithDescriptions.length} products`)
    return productsWithDescriptions
  } catch (error) {
    console.error(`Error scraping category ${categoryUrl}:`, error)
    return []
  }
}

export const fetchHouseOfCBProductDescription = async (url, page) => {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 240000 })

    await page.waitForFunction(
      () => {
        return document.querySelector('div.font-gotham-book')
      },
      { timeout: 240000 }
    )

    const [description, sizes] = await Promise.all([
      page.evaluate(() => {
        const candidates = Array.from(document.querySelectorAll('div.font-gotham-book'))
        const longest = candidates.reduce(
          (prev, curr) => {
            return curr.innerText.trim().length > prev.innerText.trim().length ? curr : prev
          },
          { innerHTML: '', innerText: '' }
        )

        return longest.innerHTML.trim()
      }),
      page.evaluate(() => {
        const sizeElements = Array.from(
          document.querySelectorAll(
            'div.flex.items-center.justify-center[class*="size-"][class*="p-"][class*="cursor-pointer"][class*="font-jjannon-italic"]'
          )
        )

        return sizeElements
          .map((div) => {
            const sizeText = div.innerText.trim()
            return { size: sizeText, inStock: true }
          })
          .filter((size) => size.size !== '')
      }),
    ])

    const formattedHTML = normalizeHtml(description)
    const imagesData = await page.evaluate(() => {
      const gridContainer = document.querySelector('div.grid.grid-cols-2')
      if (!gridContainer) return { primary: null, secondary: [] }

      const allImages = Array.from(gridContainer.querySelectorAll('img'))

      const primary = allImages.length > 0 ? allImages[0].src : null
      const secondary = allImages.length > 1 ? allImages.slice(1).map((img) => img.src) : []

      return { primary, secondary }
    })

    return {
      description: formattedHTML || '',
      sizes: sizes || [],
      image: imagesData,
    }
  } catch (err) {
    console.error(`❌ Failed to fetch description from ${url}: ${err.message}`)
    return { description: '', sizes: [] }
  }
}

export const extractHouseOfCBProductsFromPage = async (page, baseUrl) => {
  return await page.evaluate((baseUrl) => {
    const products = []

    document.querySelectorAll('div.flex.transition-all.w-full').forEach((block) => {
      const linkElement = block.querySelector('a.flex.relative.justify-center.items-start')
      const nameElement = block.querySelector('div.font-chemre')
      const descElement = block.querySelector('div.font-jjannon-italic')
      const priceElement = block.querySelector('div.font-gotham-bold')
      let priceText = priceElement?.textContent.trim() || ''
      priceText = priceText.replace(/^GBP\s*/, '')

      if (linkElement && nameElement && priceElement) {
        const relativeUrl = linkElement.getAttribute('href')
        const absoluteUrl = new URL(relativeUrl, baseUrl).toString()

        const product = {
          name: `${nameElement.textContent.trim()} - ${
            descElement?.textContent
              .trim()
              .replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()) || ''
          }`,
          description: '',
          gender: 'female',
          url: absoluteUrl,
          price: priceText,
          image: {
            primary: '',
            secondary: [],
          },
          sizes: [],
          rating: null,
          reviewCount: null,
        }

        products.push(product)
      }
    })

    return products
  }, baseUrl)
}
