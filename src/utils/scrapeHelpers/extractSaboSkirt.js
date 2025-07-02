import { scrapeProductsInParallel, setupPage } from '../../utils'

export const getProductUrlsFromCategory = async (categoryUrl, existingPage = null) => {
  const selector = '.grid__item.grid-product'
  const page = await setupPage(categoryUrl, selector, existingPage)

  if (!page) {
    return []
  }

  try {
    const products = await extractProductsFromPage(page, categoryUrl)
    console.log(`📋 Found ${products.length} products on page ${categoryUrl}`)
    const productsWithDescriptions = await scrapeProductsInParallel(products, page.browser(), fetchProductDescription)
    console.log(`✅ Completed fetching descriptions for ${productsWithDescriptions.length} products`)
    const hasNextPage = await page.evaluate(() => {
      const nextPageLink = document.querySelector('.next a')
      return nextPageLink ? nextPageLink.getAttribute('href') : null
    })

    if (hasNextPage) {
      const nextPageUrl = new URL(hasNextPage, categoryUrl).toString()
      await new Promise((resolve) => setTimeout(resolve, 3000))
      const nextPageProducts = await getProductUrlsFromCategory(nextPageUrl, page)
      return [...productsWithDescriptions, ...nextPageProducts]
    }

    return productsWithDescriptions
  } catch (error) {
    console.error(`Error scraping category ${categoryUrl}:`, error)
    return []
  }
}
const fetchProductDescription = async (url, page) => {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 })

    // Wait for either description selector to appear
    await page.waitForFunction(
      () => {
        return (
          document.querySelector('.product-single__description.rte') ||
          document.querySelector('.collapsible-content__inner.rte')
        )
      },
      { timeout: 120000 }
    )

    const getDescription = () => {
      const desc1 = document.querySelector('.product-single__description.rte')?.innerText.trim() || ''
      const desc2 = document.querySelector('.collapsible-content__inner.rte')?.innerHTML.trim() || ''
      return [desc1, desc2].filter(Boolean).join('<br>').trim()
    }

    let description = await page.evaluate(getDescription)

    // Retry once after delay if empty
    if (!description) {
      await page.waitForTimeout(2000)
      description = await page.evaluate(getDescription)
    }

    return { description } || ''
  } catch (err) {
    console.error(`❌ Failed to fetch description from ${url}: ${err.message}`)
    return ''
  }
}
const extractProductsFromPage = async (page, baseUrl) => {
  return await page.evaluate((baseUrl) => {
    const products = []

    // Select all product grid items
    document.querySelectorAll('.grid__item.grid-product').forEach((element) => {
      const rawPrimary = element.querySelector('.grid-product__image')?.getAttribute('data-src') || ''
      const rawSecondary = element.querySelector('.grid-product__secondary-image')?.getAttribute('data-bgset') || ''

      // Format primary image (replace {width} and strip leading slashes)
      const primary = 'https://' + rawPrimary.replace(/(_\d+x|_{width}x)/, '').replace(/^\/\//, '')

      // Format secondary images
      const secondary = rawSecondary
        .split(',')
        .map((entry) => entry.trim().split(' ')[0]) // remove resolution suffixes like "300w"
        .filter((url) => url.startsWith('//'))
        .map((url) => 'https://' + url.replace(/^\/\//, '').replace(/_\d+x/, ''))
        .shift()

      // Extract product data
      const product = {
        // id: element.getAttribute('data-productid'),
        url: element.querySelector('a.grid-product__link')?.getAttribute('href'),
        name: element.querySelector('.grid-product__title')?.textContent.trim(),
        gender: 'female',
        description: '',
        price: element.querySelector('.grid-product__actual-price')?.textContent.trim(),
        image: {
          primary,
          secondary,
        },
        sizes: [],
      }

      // Extract available sizes
      element.querySelectorAll('.swatch.is-size').forEach((sizeBtn) => {
        product.sizes.push({
          size: sizeBtn.getAttribute('data-size-value'),
          inStock: sizeBtn.getAttribute('data-tooltip') === 'In Stock',
          rating: element.querySelector('.oke-sr-rating')?.textContent.trim(), // Extract rating
          reviewCount: element.querySelector('.oke-sr-count-number')?.textContent.trim(), // Extract review count
        })
      })

      //   // Make sure URL is absolute
      product.url = new URL(product.url, baseUrl).toString()
      products.push(product)
    })

    return products
  }, baseUrl)
}
