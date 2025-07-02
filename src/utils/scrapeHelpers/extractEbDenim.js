import { normalizeHtml } from '../../utils'
import { scrapeProductsInParallel, setupPage } from './commonScraper.js'

export const getEbDenimProductUrlsFromCategory = async (categoryUrl, existingPage = null) => {
  const selector = '.product-info .product-link'
  const page = await setupPage(categoryUrl, selector, existingPage)

  if (!page) {
    return []
  }
  try {
    const products = await extractEbDenimProductsFromPage(page, categoryUrl)
    console.log(`📋 Found ${products.length} products on page ${categoryUrl}`)
    const productsWithDescriptions = await scrapeProductsInParallel(
      products,
      page.browser(),
      fetchEbDenimProductDescription
    )
    console.log(`✅ Completed fetching descriptions for ${productsWithDescriptions.length} products`)
    const hasNextPage = await page.evaluate(() => {
      const nextPageLink = document.querySelector('link[rel=next]')
      return nextPageLink ? nextPageLink.getAttribute('href') : null
    })

    if (hasNextPage) {
      const nextPageUrl = new URL(hasNextPage, categoryUrl).toString()
      await new Promise((resolve) => setTimeout(resolve, 3000))
      const nextPageProducts = await getEbDenimProductUrlsFromCategory(nextPageUrl, page)
      return [...productsWithDescriptions, ...nextPageProducts]
    }
    return productsWithDescriptions
  } catch (error) {
    console.error(`Error scraping category ${categoryUrl}:`, error)
    return []
  }
}

export const fetchEbDenimProductDescription = async (url, page) => {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 })

    await page.waitForFunction(
      () => {
        return (
          document.querySelector('.cc-accordion-item__content') || document.querySelector('.select.original-selector')
        )
      },
      { timeout: 120000 }
    )

    const getDescription = () => {
      const desc = document.querySelector('.cc-accordion-item__content')?.innerHTML.trim() || ''
      return [desc].filter(Boolean).join('<br>').trim()
    }
    const sizes = await page.evaluate(() => {
      const sizeOptions = []
      const options = document.querySelectorAll('.original-selector option[value]:not([value=""])')

      options.forEach((option) => {
        sizeOptions.push({
          size: option.textContent.trim(),
          inStock: option.getAttribute('data-stock') !== 'out',
        })
      })

      return sizeOptions
    })

    let description = normalizeHtml(await page.evaluate(getDescription))

    return { description, sizes } || ''
  } catch (err) {
    console.error(`❌ Failed to fetch description from ${url}: ${err.message}`)
    return ''
  }
}

export const extractEbDenimProductsFromPage = async (page, baseUrl) => {
  return await page.evaluate((baseUrl) => {
    const products = []

    document.querySelectorAll('.block-inner-inner').forEach((block) => {
      const productInfoLink = block.querySelector('.product-info .product-link')

      if (productInfoLink) {
        const productUrl = productInfoLink.getAttribute('href')

        const product = {
          name: productInfoLink.querySelector('.product-block__title')?.textContent.trim() || '',
          gender: 'female',
          url: productUrl ? new URL(productUrl, baseUrl).toString() : '',
          image: { primary: '', secondary: [] },
          price: productInfoLink.querySelector('.product-price__amount')?.textContent.trim() || '',
          description: '',
          sizes: [],
          rating: null,
          reviewCount: null,
        }

        const primaryImageContainer = block.querySelector('.product-block__image--primary')

        if (primaryImageContainer) {
          let primaryImageElement = primaryImageContainer.querySelector('img.rimage__image')

          if (primaryImageElement) {
            let srcset = primaryImageElement.getAttribute('srcset') || primaryImageElement.getAttribute('data-src')

            if (srcset) {
              const srcsetParts = srcset.split(',')
              let highestResUrl = srcsetParts[srcsetParts.length - 1].trim().split(' ')[0]

              if (highestResUrl) {
                if (highestResUrl.startsWith('//')) {
                  highestResUrl = 'https:' + highestResUrl
                }

                highestResUrl = highestResUrl.replace(/(_\d+x|_{width}x)/, '')

                product.image.primary = highestResUrl
              }
            }
          }
        }
        const secondaryImageContainers = block.querySelectorAll('.product-block__image--secondary .rimage-background')

        product.image.secondary = []
        secondaryImageContainers.forEach((bgDiv) => {
          let bgUrl = bgDiv.getAttribute('data-lazy-bgset-src')
          if (bgUrl) {
            if (bgUrl.startsWith('//')) {
              bgUrl = 'https:' + bgUrl
            }

            bgUrl = bgUrl.replace(/(_\d+x|_{width}x)/, '')
            product.image.secondary.push(bgUrl)
          }
        })
        products.push(product)
      }
    })

    return products
  }, baseUrl)
}
