import { scrapeProductsInParallel, setupPage } from '../../utils'

export const getJCrewProductUrlsFromCategory = async (categoryUrl, existingPage = null) => {
  const selector = '.product-tile--info'
  const page = await setupPage(categoryUrl, selector, existingPage)

  // if (!page) {
  //   return []
  // }
  if (!page) {
    console.warn(`⚠️ Skipping ${failedPages.size} page due to setup failure: ${categoryUrl}`)
    failedPages.add(categoryUrl)

    // Stop if we've failed 3 times on different pages
    if (failedPages.size >= maxFailures) {
      console.error(`🛑 Too many consecutive setup failures (${maxFailures}). Aborting.`)
      return []
    }

    // Try to move to the next page manually
    try {
      const urlObj = new URL(categoryUrl)
      const currentPage = parseInt(urlObj.searchParams.get('Npge'), 10)
      const nextPage = currentPage + 1
      urlObj.searchParams.set('Npge', nextPage.toString())

      await new Promise((resolve) => setTimeout(resolve, 3000))
      return await getJCrewProductUrlsFromCategory(urlObj.toString(), null)
    } catch (e) {
      console.error('⚠️ Failed to construct next page URL after setup error.', e)
      return []
    }
  }

  // Reset failure counter if a page loads successfully
  failedPages.clear()

  page.on('console', (msg) => {
    if (msg.type() === 'log') {
      console.log(`🧠 BROWSER LOG: ${msg.text()}`)
    }
  })
  try {
    const products = await extractJCrewProductsFromPage(page, categoryUrl)
    console.log(`📋 Found ${products.length} products on page ${categoryUrl}`)
    const productsWithDescriptions = await scrapeProductsInParallel(
      products,
      page.browser(),
      fetchJCrewProductDescription
    )

    console.log(`✅ Completed fetching descriptions for ${productsWithDescriptions.length} products`)
    const hasNextPage = await page.evaluate(() => {
      const nextPageLink = document.querySelector('.ArrayPagination__next___lrjgC')
      return nextPageLink ? nextPageLink.getAttribute('to') : null
    })

    if (hasNextPage) {
      const nextPageUrl = new URL(hasNextPage, categoryUrl).toString()
      await new Promise((resolve) => setTimeout(resolve, 6000))
      const nextPageProducts = await getJCrewProductUrlsFromCategory(nextPageUrl, page)
      return [...productsWithDescriptions, ...nextPageProducts]
    }
    return productsWithDescriptions
  } catch (error) {
    console.error(`Error scraping category ${categoryUrl}:`, error)
    return []
  }
}
const fetchJCrewProductDescription = async (url, page) => {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 240000 })

    // 1️⃣ Extract productId from URL
    const parsedUrl = new URL(url)
    const finalProductId = parsedUrl.searchParams.get('colorProductCode')

    // 2️⃣ Get description, images, and colorCode from meta tag
    const { description, image, colorCode } = await page.evaluate(() => {
      const descEl = document.querySelector('[data-qaid="pdpProductDescriptionRomance"]')
      const description = descEl ? descEl.innerText.trim() : ''

      const metaImage = document.querySelector('meta[property="og:image"]')
      let colorCode = ''
      if (metaImage) {
        const content = metaImage.getAttribute('content')
        const match = content?.match(/_(\w+)\?\$/) // Extracts WX4098
        colorCode = match ? match[1] : ''
      }

      const imageUrls = Array.from(document.querySelectorAll('figure.RevampedZoomImage__container___vCNGc'))
        .map((fig) => fig.getAttribute('data-img'))
        .filter(Boolean)

      const primary = imageUrls.length > 0 ? imageUrls[0] : ''
      const secondary = imageUrls.length > 1 ? imageUrls.slice(1) : []

      return {
        description,
        image: {
          primary,
          secondary,
        },
        colorCode,
      }
    })
    // 3️⃣ Fetch variant data via API
    let sizes = []
    if (finalProductId && colorCode) {
      const variantApiUrl = `https://www.jcrew.com/browse/products/${finalProductId}?expand=availability%2Cvariations%2Cprices%2Cset_products`
      const variantRes = await axios.get(variantApiUrl)
      const variants = variantRes?.data?.variants || []

      sizes = variants
        .filter((variant) => variant.variation_values?.color === colorCode.toString())
        .map((variant) => ({
          size: `${variant.variation_values.size}#${variant.variation_values.productSizingName}`,
          inStock: variant.orderable,
        }))
    }

    // 4️⃣ Optional: Fetch review data
    let rating = null
    let reviewCount = null
    if (finalProductId) {
      const reviewApiUrl = `https://api.bazaarvoice.com/data/reviews.json?apiversion=5.4&stats=Reviews&Include=Products&displaycode=1706-en_us&passkey=caJpG5rYXbVOctCfag3gPCp2AQlVjvBqzWi3pUGVUsEm8&filter=productid:eq:${finalProductId}&limit=6&Sort=submissiontime:desc`
      const response = await axios.get(reviewApiUrl)
      const reviewData = response.data

      const productStats = reviewData?.Includes?.Products?.[finalProductId]?.ReviewStatistics
      rating = productStats?.AverageOverallRating ? Math.round(productStats.AverageOverallRating * 10) / 10 : null
      reviewCount = reviewData?.TotalResults || null
    }

    return {
      description,
      image,
      rating,
      reviewCount,
      sizes,
    }
  } catch (err) {
    console.error(`❌ Failed to fetch product data: ${err.message}`)
    return {
      description: '',
      image: {
        primary: '',
        secondary: [],
      },
      rating: null,
      reviewCount: null,
      sizes: [],
    }
  }
}
const extractJCrewProductsFromPage = async (page, baseUrl) => {
  return await page.evaluate((baseUrl) => {
    const products = []

    document.querySelectorAll('[data-testid="product-tile"]').forEach((block) => {
      const titleElement = block.querySelector('h2.ProductDescription__name___HqeEd')
      const linkElement = block.querySelector('a.ProductDetails__link___8Bf30')

      if (titleElement && linkElement) {
        const relativeUrl = linkElement.getAttribute('href')
        const absoluteUrl = new URL(relativeUrl, baseUrl).toString()
        // Extract rating
        const wasPrice = block.querySelector('[data-testid="strikethrough"]')?.textContent.trim()
        const currentPrice = block.querySelector('[data-testid="currentPrice"]')?.textContent.trim()
        const nowPrice = block.querySelector('.is-price')?.textContent.trim()
        let price = nowPrice || wasPrice || currentPrice || ''
        if (/^Sale Price:\s*(from\s*)?/i.test(price)) {
          price = price.replace(/^Sale Price:\s*(from\s*)?/i, '').trim()
        }
        const product = {
          name: titleElement.textContent.trim(),
          description: '',
          gender: 'female',
          url: absoluteUrl,
          price,
          image: {
            primary: '',
            secondary: [],
          },
          sizes: [], // still waiting on size selector
          rating: null,
          reviewCount: null,
        }

        products.push(product)
      }
    })

    return products
  }, baseUrl)
}
