// * Libraries
import { StatusCodes } from 'http-status-codes'
import dotenv from 'dotenv'
const puppeteer = require('puppeteer-extra')
const StealthPlugin = require('puppeteer-extra-plugin-stealth')

puppeteer.use(StealthPlugin())
dotenv.config()
process.setMaxListeners(50)
const MAX_CONCURRENCY = 10
// * Models

import { asyncMiddleware } from '../middlewares'
import { Product } from '../models'
import {
  autoScrollReformationProducts,
  categorizeProducts,
  loadAllProducts,
  loadMoreSelfPotraitProducts,
} from '../utils'
import { autoScroll, loadMoreProducts } from '../utils'
import { getAllProducts } from '../utils'
import { normalizeHtml } from '../utils'
import { fetchSecondaryImages } from '../utils'
import { categorizeProductByName, groupedByType } from '../utils'

let globalBrowser = null

const getBrowser = async () => {
  if (!globalBrowser) {
    globalBrowser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920,1080',
      ],
    })
  }
  return globalBrowser
}

const createPage = async (browser) => {
  const page = await browser.newPage()

  // Set realistic viewport and user agent
  await page.setViewport({ width: 1280, height: 960 })
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  )

  // Block unnecessary resources
  await page.setRequestInterception(true)
  page.on('request', (req) => {
    const resourceType = req.resourceType()
    const url = req.url().toLowerCase()

    const blockedTypes = [
      'image',
      'stylesheet',
      'font',
      'media',
      'xhr',
      'fetch',
      'eventsource',
      'websocket',
      'script',
      'other',
      'iframe',
      'meta',
      'ping',
      'csp_report',
      'prefetch',
      'beacon',
      'template',
      'form',
      'link',
    ]

    const blockedDomains = [
      'google-analytics.com',
      'googletagmanager.com',
      'doubleclick.net',
      'facebook.net',
      'cdn.jsdelivr.net',
      'fonts.googleapis.com',
      'fonts.gstatic.com',
      'adsbygoogle.js',
      'amazon-adsystem.com',
      'hotjar.com',
      'cloudflareinsights.com',
      'optimizely.com',
    ]

    if (blockedTypes.includes(resourceType) || blockedDomains.some((domain) => url.includes(domain))) {
      req.abort()
    } else {
      req.continue()
    }
  })

  return page
}

const createPagePool = async (browser, size = MAX_CONCURRENCY) => {
  const pagePool = []
  for (let i = 0; i < size; i++) {
    pagePool.push(await createPage(browser))
  }
  return pagePool
}

const setupPage = async (categoryUrl, waitForSelector, existingPage = null) => {
  let page = existingPage
  const browser = await getBrowser()

  try {
    if (!page) {
      page = await browser.newPage()

      // Set realistic viewport and user agent
      await page.setViewport({ width: 1920, height: 1080 })
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      )

      // Set additional headers
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        Connection: 'keep-alive',
      })
    }

    await page.goto(categoryUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    })

    if (waitForSelector) {
      await page.waitForSelector(waitForSelector, { timeout: 30000 })
    }

    return page
  } catch (error) {
    console.error(`Error setting up page for ${categoryUrl}:`, error)
    return null
  }
}
const scrapeProductsInParallel = async (products, browser, fetchFunction) => {
  // Create a pool of pages to reuse
  const pagePool = await createPagePool(browser)
  // Process products in batches
  const results = [...products]
  const batchSize = 45

  for (let i = 0; i < products.length; i += batchSize) {
    const batch = products.slice(i, i + batchSize)
    console.log(
      `🔍 Processing batch ${i / batchSize + 1}/${Math.ceil(products.length / batchSize)} (${batch.length} products)`
    )

    // Process batch with concurrency limit
    await Promise.all(
      Array(Math.min(batch.length, MAX_CONCURRENCY))
        .fill(null)
        .map(async (_, index) => {
          const page = pagePool[index]
          let productIndex = index

          // Process products assigned to this worker
          while (productIndex < batch.length) {
            const product = batch[productIndex]
            const globalIndex = i + productIndex

            try {
              console.log(`🔍 [${globalIndex + 1}/${products.length}] Scraping: ${product.name || product.url}`)
              const productDetails = await fetchFunction(product.url, page)
              results[globalIndex] = { ...product, ...productDetails }
              console.log(`✅ [${globalIndex + 1}/${products.length}] Completed`)
            } catch (e) {
              console.error(`Failed to scrape ${product.url}:`, e.message)
              results[globalIndex] = { ...product, description: '' }
            }

            // Move to next product for this worker
            productIndex += MAX_CONCURRENCY

            // Add small delay between requests to avoid detection
            await new Promise((resolve) => setTimeout(resolve, 200))
          }
        })
    )

    // Add delay between batches to reduce server load
    if (i + batchSize < products.length) {
      console.log('Pausing between batches to reduce server load...')
      await new Promise((resolve) => setTimeout(resolve, 1500))
    }
  }

  // Close all pages in the pool
  await Promise.all(pagePool.map((page) => page.close()))

  return results
}
const fetchProductDescription = async (url, page) => {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })

    // Wait for either description selector to appear
    await page.waitForFunction(
      () => {
        return (
          document.querySelector('.product-single__description.rte') ||
          document.querySelector('.collapsible-content__inner.rte')
        )
      },
      { timeout: 30000 }
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
const getProductUrlsFromCategory = async (categoryUrl, existingPage = null) => {
  const selector = '.grid__item.grid-product'
  const page = await setupPage(categoryUrl, selector, existingPage)

  if (!page) {
    return []
  }

  try {
    const products = await extractProductsFromPage(page, categoryUrl)
    console.log(`📋 Found ${products.length} products on page ${categoryUrl}`)
    console.log(`🔄 Fetching descriptions for ${products.length} products...`)
    const productsWithDescriptions = await scrapeProductsInParallel(products, page.browser(), fetchProductDescription)
    console.log(`✅ Completed fetching descriptions for ${productsWithDescriptions.length} products`)
    // const hasNextPage = await page.evaluate(() => {
    //   const nextPageLink = document.querySelector('.next a')
    //   return nextPageLink ? nextPageLink.getAttribute('href') : null
    // })

    // if (hasNextPage) {
    //   const nextPageUrl = new URL(hasNextPage, categoryUrl).toString()
    //   await new Promise((resolve) => setTimeout(resolve, 3000))
    //   const nextPageProducts = await getProductUrlsFromCategory(nextPageUrl, page)
    //   return [...productsWithDescriptions, ...nextPageProducts]
    // }

    return productsWithDescriptions
  } catch (error) {
    console.error(`Error scraping category ${categoryUrl}:`, error)
    return []
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
        id: element.getAttribute('data-productid'),
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

      if (product.url) {
        // Make sure URL is absolute
        product.url = new URL(product.url, baseUrl).toString()
        products.push(product)
      }
    })

    return products
  }, baseUrl)
}

const fetchEbDenimProductDescription = async (url, page) => {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })

    // Wait for either description selector to appear
    await page.waitForFunction(
      () => {
        return (
          document.querySelector('.cc-accordion-item__content') || document.querySelector('.select.original-selector')
        )
      },
      { timeout: 30000 }
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

    let description = await page.evaluate(getDescription)

    return { description, sizes } || ''
  } catch (err) {
    console.error(`❌ Failed to fetch description from ${url}: ${err.message}`)
    return ''
  }
}

const getEbDenimProductUrlsFromCategory = async (categoryUrl, existingPage = null) => {
  const selector = '.product-info .product-link'
  const page = await setupPage(categoryUrl, selector, existingPage)

  if (!page) {
    return []
  }
  try {
    // await autoScroll(page)

    const products = await extractEbDenimProductsFromPage(page, categoryUrl)
    console.log(`📋 Found ${products.length} products on page ${categoryUrl}`)
    console.log(`🔄 Fetching descriptions for ${products.length} products...`)
    const productsWithDescriptions = await scrapeProductsInParallel(
      products,
      page.browser(),
      fetchEbDenimProductDescription
    )
    console.log(`✅ Completed fetching descriptions for ${productsWithDescriptions.length} products`)
    return productsWithDescriptions
  } catch (error) {
    console.error(`Error scraping category ${categoryUrl}:`, error)
    return []
  }
}

// Your controller function that uses asyncMiddleware
const extractEbDenimProductsFromPage = async (page, baseUrl) => {
  return await page.evaluate((baseUrl) => {
    const products = []

    // Select all product blocks
    document.querySelectorAll('.block-inner-inner').forEach((block) => {
      // Get the product link element inside the product info
      const productInfoLink = block.querySelector('.product-info .product-link')

      if (productInfoLink) {
        const productUrl = productInfoLink.getAttribute('href')

        const product = {
          name: productInfoLink.querySelector('.product-block__title')?.textContent.trim() || '',
          gender: 'female',
          url: productUrl ? new URL(productUrl, baseUrl).toString() : '',
          image: { primary: '', secondary: [] }, // Placeholder for images
          price: productInfoLink.querySelector('.product-price__amount')?.textContent.trim() || '',
          description: '',
          sizes: [],
          rating: null,
          reviewCount: null,
        }

        if (product.url) {
          // Find the primary image - try multiple approaches to be more robust
          const primaryImageContainer = block.querySelector('.product-block__image--primary')

          if (primaryImageContainer) {
            // First try to get the img element with class rimage__image
            let primaryImageElement = primaryImageContainer.querySelector('img.rimage__image')

            if (primaryImageElement) {
              // Try srcset first (already loaded images)
              let srcset = primaryImageElement.getAttribute('srcset') || primaryImageElement.getAttribute('data-src')

              // If we have a srcset, parse it to get the highest resolution image
              if (srcset) {
                const srcsetParts = srcset.split(',')
                // Get the URL with the highest resolution (usually the last one)
                let highestResUrl = srcsetParts[srcsetParts.length - 1].trim().split(' ')[0] // Get just the URL part

                if (highestResUrl) {
                  // Add https: if the URL starts with //
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

          secondaryImageContainers.forEach((bgDiv) => {
            let bgUrl = bgDiv.getAttribute('data-lazy-bgset-src')
            if (bgUrl) {
              if (bgUrl.startsWith('//')) {
                bgUrl = 'https:' + bgUrl
              }

              bgUrl = bgUrl.replace(/(_\d+x|_{width}x)/, '') // Clean the URL
              product.image.secondary.push(bgUrl)
            }
          })
          products.push(product)
        }
      }
    })

    return products
  }, baseUrl)
}
const transformProducts = (products) => {
  return products.map((product) => {
    const images = product.images || []
    const variants = product.variants || []

    return {
      name: product.title,
      url: `https://agolde.com/products/${product.handle}`,
      brand: product.vendor,
      gender: 'male',
      image: {
        primary: images.length > 0 ? images[0].src : null,
        secondary: images.slice(1).map((img) => img.src),
      },
      price: variants.length > 0 ? `$${variants[0].price}` : null,
      description: product.body_html,
      sizes: variants.map((variant) => ({
        size: variant.option1,
        inStock: variant.available,
      })),
      rating: null,
      reviewCount: null,
    }
  })
}
const fetchHouseOfCBProductDescription = async (url, page) => {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })

    // Wait for either description selector to appear
    await page.waitForFunction(
      () => {
        return document.querySelector('div.font-gotham-book') // Wait for the first div with the description
      },
      { timeout: 30000 }
    )

    // Fetch description and sizes in parallel
    const [description, sizes] = await Promise.all([
      // Get description
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

      // Get sizes
      page.evaluate(() => {
        // Look for size elements with the specific classes in the provided HTML
        const sizeElements = Array.from(
          document.querySelectorAll(
            'div.flex.items-center.justify-center[class*="size-"][class*="p-"][class*="cursor-pointer"][class*="font-jjannon-italic"]'
          )
        )

        // If we can't find sizes with exact class match, try a more general approach
        const sizeDivs =
          sizeElements.length > 0
            ? sizeElements
            : Array.from(
                document.querySelectorAll('.flex div[class*="flex"][class*="items-center"][class*="justify-center"]')
              )

        return sizeDivs
          .map((div) => {
            // Get the inner text which should be the size label (XS, S, M, L, etc.)
            const sizeText = div.innerText.trim()

            // Check if the element has any classes or attributes indicating it's out of stock

            return {
              size: sizeText,
              inStock: true,
            }
          })
          .filter((size) => size.size !== '') // Filter out empty sizes
      }),
    ])

    // Format the description HTML if needed
    const formattedHTML = normalizeHtml(description)
    const secondaryImages = await page.evaluate(() => {
      const gridContainer = document.querySelector('div.grid.grid-cols-2')
      if (!gridContainer) return []

      const allImages = Array.from(gridContainer.querySelectorAll('img'))

      // Ignore the first image and extract the rest
      const imageSources = allImages.slice(1).map((img) => img.src)

      return imageSources
    })

    return {
      description: formattedHTML || '',
      sizes: sizes || [],
      image: { secondary: secondaryImages },
    }
  } catch (err) {
    console.error(`❌ Failed to fetch description from ${url}: ${err.message}`)
    return { description: '', sizes: [] }
  }
}

const getHouseOfCbProductUrlsFromCategory = async (categoryUrl, existingPage = null) => {
  const selector = 'a.flex.relative.justify-center.items-start'
  const page = await setupPage(categoryUrl, selector, existingPage)

  if (!page) {
    return []
  }
  try {
    // await loadMoreProducts(page)
    const products = await extractHouseOfCBProductsFromPage(page, categoryUrl)
    console.log(`📋 Found ${products.length} products on page ${categoryUrl}`)
    console.log(`🔄 Fetching descriptions for ${products.length} products...`)
    // const productsWithDescriptions = await scrapeProductsInParallel(
    //   products,
    //   page.browser(),
    //   fetchHouseOfCBProductDescription
    // )
    // console.log(`✅ Completed fetching descriptions for ${productsWithDescriptions.length} products`)
    return products
  } catch (error) {
    console.error(`Error scraping category ${categoryUrl}:`, error)
    return []
  }
}
const extractHouseOfCBProductsFromPage = async (page, baseUrl) => {
  return await page.evaluate((baseUrl) => {
    const products = []

    // Select all product containers
    document.querySelectorAll('div.flex.transition-all.w-full').forEach((block) => {
      const linkElement = block.querySelector('a.flex.relative.justify-center.items-start')
      const nameElement = block.querySelector('div.font-chemre')
      const descElement = block.querySelector('div.font-jjannon-italic')
      const priceElement = block.querySelector('div.font-gotham-bold')
      let priceText = priceElement?.textContent.trim() || ''
      priceText = priceText.replace(/^GBP\s*/, '') // Remove the 'GBP ' prefix
      if (linkElement && nameElement && priceElement) {
        const relativeUrl = linkElement.getAttribute('href')
        const absoluteUrl = new URL(relativeUrl, baseUrl).toString()

        // Image handling
        const imgTag = linkElement.querySelector('img')
        const imgSrc = imgTag?.getAttribute('src') || ''

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
            primary: imgSrc.startsWith('http') ? imgSrc : new URL(imgSrc, baseUrl).toString(),
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

const getJCrewProductUrlsFromCategory = async (categoryUrl, existingPage = null) => {
  const selector = '.product-tile--info'
  const page = await setupPage(categoryUrl, selector, existingPage)

  if (!page) {
    return []
  }
  try {
    // await loadMoreProducts(page)
    const products = await extractJCrewProductsFromPage(page, categoryUrl)
    console.log(`📋 Found ${products.length} products on page ${categoryUrl}`)
    console.log(`🔄 Fetching descriptions for ${products.length} products...`)
    // const productsWithDescriptions = await fetchProductDescription(
    //   products,
    //   page.browser(),
    //   fetchEbDenimProductDescription
    // )
    // console.log(`✅ Completed fetching descriptions for ${productsWithDescriptions.length} products`)
    return products
  } catch (error) {
    console.error(`Error scraping category ${categoryUrl}:`, error)
    return []
  }
}
const extractJCrewProductsFromPage = async (page, baseUrl) => {
  return await page.evaluate((baseUrl) => {
    const products = []

    document.querySelectorAll('[data-qaid^="arrProductListItem"]').forEach((block) => {
      const titleElement = block.querySelector('h2.ProductDescription__name___HqeEd')
      const linkElement = block.querySelector('a.ProductDetails__link___8Bf30')
      const imgTag = block.querySelector('.image-wrapper img')
      const ratingContainer = block.querySelector('[data-testid="ratings"]')
      const reviewCountElement = block.querySelector('.ProductReviews__review-text____9dKI')

      if (titleElement && linkElement && imgTag) {
        const relativeUrl = linkElement.getAttribute('href')
        const absoluteUrl = new URL(relativeUrl, baseUrl).toString()

        const fullImgSrc = imgTag.getAttribute('src') || ''
        const imgUrlBase = fullImgSrc.split('?')[0] // Strip query params

        // Extract rating
        let rating = null
        const ratingLabel = ratingContainer?.getAttribute('aria-label')
        if (ratingLabel) {
          const match = ratingLabel.match(/([\d.]+)\s+out of 5/)
          if (match) {
            rating = parseFloat(match[1])
          }
        }

        // Extract review count
        let reviewCount = null
        const reviewText = reviewCountElement?.textContent.trim()
        if (reviewText) {
          const countMatch = reviewText.match(/\d+/)
          if (countMatch) {
            reviewCount = parseInt(countMatch[0], 10)
          }
        }

        const product = {
          name: titleElement.textContent.trim(),
          description: '',
          gender: 'female',
          url: absoluteUrl,
          price: '', // still waiting on price selector
          image: {
            primary: imgUrlBase,
            secondary: [],
          },
          sizes: [], // still waiting on size selector
          rating,
          reviewCount,
        }

        products.push(product)
      }
    })

    return products
  }, baseUrl)
}

const fetchLuluLemonProductDescription = async (url, page) => {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })

    await page.waitForFunction(
      () => {
        return document.querySelector('.pdp-components-wrapper') // Wait for the first div with the description
      },
      { timeout: 30000 }
    )

    const [primaryImageUrl, sizes, description, reviewCount] = await Promise.all([
      page.evaluate(() => {
        const preloadLink = document.querySelector('link[rel="preload"][as="image"]')
        return preloadLink?.href || null
      }),

      page.evaluate(() => {
        return Array.from(document.querySelectorAll('.sizeTile-3i47L')).map((el) => {
          const size = el.textContent.trim().replace(/\s*\(.*\)/, '')
          const inStock = !el.className.includes('sizeTileDisabled')
          return { size, inStock }
        })
      }),

      page.evaluate(() => {
        return Array.from(document.querySelectorAll('button[data-testid="designed-for-button"]')).map((button) =>
          button.textContent.trim()
        )
      }),

      page.evaluate(() => {
        const countText = document.querySelector('.reviews-link_reviewsLinkCount__FUZlT')?.textContent
        if (!countText) return 0
        const match = countText.replace(/[()]/g, '').match(/\d+/) // Remove parentheses before matching
        return match ? parseInt(match[0], 10) : 0
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
    }
  } catch (err) {
    console.error(`❌ Failed to fetch description from ${url}: ${err.message}`)
    return { description: '', sizes: [] }
  }
}

const getLuluLemonProductUrlsFromCategory = async (categoryUrl, existingPage = null) => {
  const selector = '.product-list_productListItem__uA9Id'
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
    const products = await extractLuluLemonProductsFromPage(page, categoryUrl)
    console.log(`📋 Found ${products.length} products on page ${categoryUrl}`)
    // console.log(`🔄 Fetching descriptions for ${products.length} products...`)
    // const productsWithDescriptions = await scrapeProductsInParallel(
    //   products,
    //   page.browser(),
    //   fetchLuluLemonProductDescription
    // )
    // console.log(`✅ Completed fetching descriptions for ${productsWithDescriptions.length} products`)
    return products
  } catch (error) {
    console.error(`Error scraping category ${categoryUrl}:`, error)
    return []
  }
}
const extractLuluLemonProductsFromPage = async (page, baseUrl) => {
  return await page.evaluate((baseUrl) => {
    const products = []

    document.querySelectorAll('.product-list_productListItem__uA9Id').forEach((productTile) => {
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
          // description: '',
          // url: absoluteUrl,
          // price,
          // image: {
          //   primary: '',
          //   secondary: [],
          // },
          // sizes: [],
          // rating: null,
          // reviewCount: null,
        })
      }
    })

    return products
  }, baseUrl)
}

const fetchTheReformationProductDescription = async (url, page) => {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })

    await page.waitForFunction(
      () => {
        return document.querySelector('.pdp_fit-details') || document.querySelector('.product-attribute__contents')
      },
      { timeout: 30000 }
    )

    const { description, sizes, images } = await page.evaluate(() => {
      const sections = []

      // === Description (Fit & Details) ===
      const fitHeader = document.querySelector('.pdp__fit_header')?.textContent.trim()
      if (fitHeader) {
        sections.push(`<strong>${fitHeader}</strong>`)
      }

      document.querySelectorAll('.pdp_fit-details-item--fit').forEach((el) => {
        const isHidden = el.classList.contains('hidden') || el.getAttribute('aria-hidden') === 'true'
        if (isHidden) return

        const content = el.querySelector('[data-product-component-content]')?.textContent.trim()
        const fallbackText = el.textContent.trim()

        if (content) {
          sections.push(`<li>${content}</li>`)
        } else if (fallbackText) {
          sections.push(`<li>${fallbackText}</li>`)
        }
      })

      const detailHeader = document.querySelector('.pdp__details_header')?.textContent.trim()
      if (detailHeader) {
        sections.push(`<strong>${detailHeader}</strong>`)
      }

      document.querySelectorAll('.pdp_fit-details-item--details').forEach((el) => {
        const isHidden = el.classList.contains('hidden') || el.getAttribute('aria-hidden') === 'true'
        if (isHidden) return

        const spanText = el.querySelector('[data-product-component-content]')?.textContent.trim()
        const text = spanText || el.textContent.trim()
        if (text) sections.push(`<li>${text}</li>`)
      })

      // === Sizes ===
      const sizes = []
      document.querySelectorAll('.product-attribute__anchor.anchor--size').forEach((button) => {
        const sizeText = button.textContent.trim()
        const isWaitlisted = button.classList.contains('waitlist') || button.getAttribute('aria-pressed') === 'true'
        if (sizeText) {
          sizes.push({
            size: sizeText,
            inStock: !isWaitlisted,
          })
        }
      })

      const imageUrls = []

      document.querySelectorAll('.product-gallery__button img[data-product-component="image"]').forEach((img) => {
        const srcset = img.getAttribute('srcset') || img.getAttribute('data-srcset')
        if (srcset) {
          const imageUrl = srcset.split(' ')[0]
          imageUrls.push(imageUrl.replace('/w_500/', '/'))
        }
      })

      return {
        description: sections.filter(Boolean).join('<br><br>'),
        sizes,
        images: {
          primary: imageUrls[0] || '',
          secondary: imageUrls.slice(1) || [],
        },
      }
    })

    return {
      description: normalizeHtml(description),
      sizes,
      image: images,
    }
  } catch (err) {
    console.error(`❌ Failed to fetch description from ${url}: ${err.message}`)
    return ''
  }
}

const getTheReformationProductUrlsFromCategory = async (categoryUrl, existingPage = null) => {
  const selector = '.product-grid__item'
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
    await autoScrollReformationProducts(page, '.product-grid__item')
    const products = await extractTheReformationProductsFromPage(page, categoryUrl)
    console.log(`📋 Found ${products.length} products on page ${categoryUrl}`)
    // console.log(`🔄 Fetching descriptions for ${products.length} products...`)
    // const productsWithDescriptions = await scrapeProductsInParallel(
    //   products,
    //   page.browser(),
    //   fetchTheReformationProductDescription
    // )
    // console.log(`✅ Completed fetching descriptions for ${productsWithDescriptions.length} products`)
    return products
  } catch (error) {
    console.error(`Error scraping category ${categoryUrl}:`, error)
    return []
  }
}

// Your controller function that uses asyncMiddleware
const extractTheReformationProductsFromPage = async (page, baseUrl) => {
  return await page.evaluate((baseUrl) => {
    const products = []

    // Select all product tiles
    document.querySelectorAll('.product-grid__item').forEach((productEl) => {
      const titleElement = productEl.querySelector('.product-tile__body-section.product-tile__name')
      const priceElement = productEl.querySelector('.price--reduced')
      const linkElement = productEl.querySelector('.product-tile__anchor')
      // const imageEl = productEl.querySelector('img.tile-image-primary')
      // let primaryImage = null

      // if (imageEl) {
      //   const src = imageEl.getAttribute('src')
      //   // Remove the width part, e.g. /w_600/
      //   primaryImage = src.replace(/\/w_\d+\//, '/')
      // }

      const name = titleElement?.textContent.trim() || ''
      const price = priceElement?.textContent.trim() || ''
      const href = linkElement?.getAttribute('href') || ''
      const url = href ? new URL(href, baseUrl).toString() : ''

      const product = {
        name,
        gender: 'female',
        url,
        image: { primary: '', secondary: [] }, // Placeholder for images
        price,
        description: '',
        sizes: [],
        rating: null,
        reviewCount: null,
      }

      // Optional: Add logic to extract primary and secondary images if structure changes
      products.push(product)
    })

    return products
  }, baseUrl)
}

const fetchSelfPotraitProductDescription = async (url, page) => {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })

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

const getSelfPotraitProductUrlsFromCategory = async (categoryUrl, existingPage = null) => {
  const selector = '.prd-List'
  const page = await setupPage(categoryUrl, selector, existingPage)
  if (!page) {
    return []
  }
  try {
    await loadMoreSelfPotraitProducts(page, '.prd-List_Item', '.pgn-LoadMore_Button')
    const products = await extractSelfPortraitProductsFromPage(page, categoryUrl)
    console.log(`📋 Found ${products.length} products on page ${categoryUrl}`)
    console.log(`🔄 Fetching descriptions for ${products.length} products...`)
    const productsWithDescriptions = await scrapeProductsInParallel(
      products,
      page.browser(),
      fetchSelfPotraitProductDescription
    )
    console.log(`✅ Completed fetching descriptions for ${productsWithDescriptions.length} products`)
    return productsWithDescriptions
  } catch (error) {
    console.error(`Error scraping category ${categoryUrl}:`, error)
    return []
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

export const CONTROLLER_SCRAPER = {
  getSaboSkirtProducts: asyncMiddleware(async (req, res) => {
    // Scrape products from Dior (or your specific source)
    try {
      const categoryUrl = 'https://us.saboskirt.com/collections/active-products' // Example category URL
      // const categoryUrl = 'https://us.saboskirt.com/collections/dresses/mini-dresses' // Example category URL

      const products = await getProductUrlsFromCategory(categoryUrl)
      const categorizedProducts = await categorizeProducts(products)
      // // Save products to DB
      // for (const product of products) {
      //   const newProduct = new Product(product)
      //   await newProduct.save()
      // }
      console.log(
        `🏁 Scraping completed. Found ${products.length} products across ${
          Object.keys(categorizedProducts).length
        } categories.`
      )
      // Respond with the scraped products data
      res.status(StatusCodes.OK).json({
        data: categorizedProducts,
        results: products.length,
        message: 'Products Fetched and Saved successfully',
      })
    } finally {
      // Clean up the browser instance
      if (globalBrowser) {
        await globalBrowser.close()
        globalBrowser = null
      }
    }
  }),
  getEbDenimProducts: asyncMiddleware(async (req, res) => {
    // Scrape products from Dior (or your specific source)
    try {
      const categoryUrl = 'https://www.ebdenim.com/collections/all-products' // Example category URL

      const products = await getEbDenimProductUrlsFromCategory(categoryUrl)
      // const categorizedProducts = await categorizeProducts(products)
      // // Save products to DB
      // for (const product of products) {
      //   const newProduct = new Product(product)
      //   await newProduct.save()
      // }
      // console.log(
      //   `🏁 Scraping completed. Found ${products.length} products across ${
      //     Object.keys(categorizedProducts).length
      //   } categories.`
      // )
      // Respond with the scraped products data
      res.status(StatusCodes.OK).json({
        data: products,
        results: products.length,
        message: 'Products Fetched and Saved successfully',
      })
    } finally {
      // Clean up the browser instance
      if (globalBrowser) {
        await globalBrowser.close()
        globalBrowser = null
      }
    }
  }),
  getAgoldeMenAndWomenProducts: asyncMiddleware(async (req, res) => {
    // Scrape products from Dior (or your specific source)
    try {
      const menUrl = 'https://agolde.com/collections/shop-all-mens/products.json'
      const womenUrl = 'https://agolde.com/collections/shop-all-womens/products.json'

      // Fetch both categories in parallel
      const [menProductsRaw, womenProductsRaw] = await Promise.all([getAllProducts(menUrl), getAllProducts(womenUrl)])

      // Transform data
      const menProducts = transformProducts(menProductsRaw).map((product) => ({
        ...product,
        gender: 'male',
      }))

      const womenProducts = transformProducts(womenProductsRaw).map((product) => ({
        ...product,
        gender: 'female',
      }))
      const allProducts = [...menProducts, ...womenProducts]

      for (const product of allProducts) {
        const cat = categorizeProductByName(product.name)
        groupedByType[cat].push(product)
      }
      // const categorizedProducts = await categorizeProducts(products)
      // // Save products to DB
      // for (const product of products) {
      //   const newProduct = new Product(product)
      //   await newProduct.save()
      // }
      console.log(`✅ Successfully fetched ${menProducts.length} men's and ${womenProducts.length} women's products.`)

      // Respond with the scraped products data
      res.status(StatusCodes.OK).json({
        data: groupedByType,
        // results: transformedProducts.length,
        message: 'Products Fetched and Saved successfully',
      })
    } catch (error) {
      console.error('Error fetching products:', error)
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        message: 'Failed to fetch products',
        error: error.message,
      })
    }
  }),
  getHouseOfCBProducts: asyncMiddleware(async (req, res) => {
    // Scrape products from Dior (or your specific source)

    try {
      const categories = [
        { type: 'accessories', url: 'https://app.houseofcb.com/category?category_id=11' },
        { type: 'clothing', url: 'https://app.houseofcb.com/category?category_id=2' },
      ]

      for (const category of categories) {
        const products = await getHouseOfCbProductUrlsFromCategory(category.url)

        for (const product of products) {
          let cat

          if (category.type === 'accessories') {
            cat = 'accessories'
          } else {
            cat = categorizeProductByName(product.name)
          }

          groupedByType[cat].push(product)
        }
      }
      // const categorizedProducts = await categorizeProducts(products)
      // // Save products to DB
      // for (const product of products) {
      //   const newProduct = new Product(product)
      //   await newProduct.save()
      // }
      // console.log(
      //   `🏁 Scraping completed. Found ${products.length} products across ${
      //     Object.keys(categorizedProducts).length
      //   } categories.`
      // )
      // Respond with the scraped products data
      res.status(StatusCodes.OK).json({
        // results: products.length,
        data: groupedByType,
        message: 'Products Fetched and Saved successfully',
      })
    } finally {
      // Clean up the browser instance
      if (globalBrowser) {
        await globalBrowser.close()
        globalBrowser = null
      }
    }
  }),
  getJCrewProducts: asyncMiddleware(async (req, res) => {
    try {
      // const products = await getHouseOfCbProductUrlsFromCategory(categoryUrl)
      const categories = [
        { type: 'men', url: 'https://www.jcrew.com/plp/mens' },
        // { type: 'women', url: 'https://www.jcrew.com/plp/womens' },
      ]

      const results = []

      for (const category of categories) {
        const products = await getJCrewProductUrlsFromCategory(category.url)
        results.push(products)
      }

      // Optionally group by type if needed:
      const groupedByType = results.reduce((acc, curr) => {
        acc[curr.type] = acc[curr.type] || []
        acc[curr.type].push(curr)
        return acc
      }, {})
      // const categorizedProducts = await categorizeProducts(products)
      // // Save products to DB
      // for (const product of products) {
      //   const newProduct = new Product(product)
      //   await newProduct.save()
      // }
      // console.log(
      //   `🏁 Scraping completed. Found ${products.length} products across ${
      //     Object.keys(categorizedProducts).length
      //   } categories.`
      // )
      // Respond with the scraped products data
      res.status(StatusCodes.OK).json({
        data: groupedByType,
        results: results.length,
        message: 'Products Fetched and Saved successfully',
      })
    } finally {
      // Clean up the browser instance
      if (globalBrowser) {
        await globalBrowser.close()
        globalBrowser = null
      }
    }
  }),
  getLuluLemonProducts: asyncMiddleware(async (req, res) => {
    try {
      const categories = [
        {
          type: 'men',
          url: 'https://shop.lululemon.com/c/men-clothes/n1oxc7',
        },
        { type: 'women', url: 'https://shop.lululemon.com/c/women-clothes/n14uwk' },
      ]

      let products = []
      for (const category of categories) {
        products = await getLuluLemonProductUrlsFromCategory(category.url)
        // Add gender to each product
        const gender = category.type === 'men' ? 'male' : 'female'
        const productsWithGender = products.map((product) => ({
          ...product,
          gender,
        }))
        for (const product of productsWithGender) {
          const cat = categorizeProductByName(product.name)
          groupedByType[cat].push(product)
        }
        // if (!groupedByType[category.type]) {
        //   groupedByType[category.type] = []
        // }
        // groupedByType[category.type].push(...productsWithGender)
      }
      // const categorizedProducts = await categorizeProducts(products)
      // // Save products to DB
      // for (const product of products) {
      //   const newProduct = new Product(product)
      //   await newProduct.save()
      // }
      // console.log(
      //   `🏁 Scraping completed. Found ${products.length} products across ${
      //     Object.keys(categorizedProducts).length
      //   } categories.`
      // )
      // Respond with the scraped products data
      res.status(StatusCodes.OK).json({
        // results: products.length,
        data: groupedByType,
        message: 'Products Fetched and Saved successfully',
      })
    } finally {
      // Clean up the browser instance
      if (globalBrowser) {
        await globalBrowser.close()
        globalBrowser = null
      }
    }
  }),
  getTheReformationProducts: asyncMiddleware(async (req, res) => {
    // Scrape products from Dior (or your specific source)
    try {
      // const categoryUrl = 'https://www.thereformation.com/search?cgid=all-products' // Example category URL
      const categories = [
        { type: 'wedding', url: 'https://www.thereformation.com/bridal' },
        { type: 'shoes', url: 'https://www.thereformation.com/shoes' },
        { type: 'bags', url: 'https://www.thereformation.com/bags' },
        { type: 'clothes', url: 'https://www.thereformation.com/clothing' },
      ]

      const groupedByType = {}
      let allProducts = [] // Collect all products here

      for (const category of categories) {
        const products = await getTheReformationProductUrlsFromCategory(category.url)

        if (!groupedByType[category.type]) {
          groupedByType[category.type] = []
        }

        groupedByType[category.type].push(...products)
        allProducts.push(...products) // Accumulate into total
      }

      // // Save products to DB
      // for (const product of products) {
      //   const newProduct = new Product(product)
      //   await newProduct.save()
      // }
      // console.log(
      //   `🏁 Scraping completed. Found ${products.length} products across ${
      //     Object.keys(categorizedProducts).length
      //   } categories.`
      // )
      // Respond with the scraped products data
      res.status(StatusCodes.OK).json({
        results: allProducts.length,
        data: groupedByType,
        message: 'Products Fetched and Saved successfully',
      })
    } finally {
      // Clean up the browser instance
      if (globalBrowser) {
        await globalBrowser.close()
        globalBrowser = null
      }
    }
  }),
  getSelfPotraitProducts: asyncMiddleware(async (req, res) => {
    // Scrape products from Dior (or your specific source)
    try {
      const categoryUrl = 'https://us.self-portrait.com/collections/all' // Example category URL

      const products = await getSelfPotraitProductUrlsFromCategory(categoryUrl)
      // const categorizedProducts = await categorizeProducts(products)
      // // Save products to DB
      // for (const product of products) {
      //   const newProduct = new Product(product)
      //   await newProduct.save()
      // }
      // console.log(
      //   `🏁 Scraping completed. Found ${products.length} products across ${
      //     Object.keys(categorizedProducts).length
      //   } categories.`
      // )
      // Respond with the scraped products data
      res.status(StatusCodes.OK).json({
        data: products,
        results: products.length,
        message: 'Products Fetched and Saved successfully',
      })
    } finally {
      // Clean up the browser instance
      if (globalBrowser) {
        await globalBrowser.close()
        globalBrowser = null
      }
    }
  }),
}

// Testing For 1 Product

// const extractProductsFromPage = async (page, baseUrl) => {
//   return await page.evaluate((baseUrl) => {
//     const products = []
//     const firstElement = document.querySelector('.grid__item.grid-product')
//     const rawPrimary = firstElement.querySelector('.grid-product__image')?.getAttribute('data-src') || ''
//     const rawSecondary = firstElement.querySelector('.grid-product__secondary-image')?.getAttribute('data-bgset') || ''

//     // Format primary image (replace {width} and strip leading slashes)
//     const primary = 'https://' + rawPrimary.replace(/(_\d+x|_{width}x)/, '').replace(/^\/\//, '')

//     // Format secondary images
//     const secondary = rawSecondary
//       .split(',')
//       .map((entry) => entry.trim().split(' ')[0]) // remove resolution suffixes like "300w"
//       .filter((url) => url.startsWith('//'))
//       .map((url) => 'https://' + url.replace(/^\/\//, '').replace(/_\d+x/, ''))
//       .shift()

//     if (firstElement) {
//       const product = {
//         id: firstElement.getAttribute('data-productid'),
//         url: firstElement.querySelector('a.grid-product__link')?.getAttribute('href'),
//         name: firstElement.querySelector('.grid-product__title')?.textContent.trim(),
//         price: firstElement.querySelector('.grid-product__actual-price')?.textContent.trim(),
//         image: {
//           primary,
//           secondary,
//         },
//         sizes: [],
//       }

//       firstElement.querySelectorAll('.swatch.is-size').forEach((sizeBtn) => {
//         product.sizes.push({
//           size: sizeBtn.getAttribute('data-size-value'),
//           inStock: sizeBtn.getAttribute('data-tooltip') === 'In Stock',
//           rating: firstElement.querySelector('.oke-sr-rating')?.textContent.trim(),
//           reviewCount: firstElement.querySelector('.oke-sr-count-number')?.textContent.trim(),
//         })
//       })

//       if (product.url) {
//         product.url = new URL(product.url, baseUrl).toString()
//         products.push(product)
//       }
//     }

//     return products
//   }, baseUrl)
// }
