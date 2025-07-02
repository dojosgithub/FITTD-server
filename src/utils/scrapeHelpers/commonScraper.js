// commonScraperUtils.js
import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'

puppeteer.use(StealthPlugin())

let globalBrowser = null
export const MAX_CONCURRENCY = 5

export const getBrowser = async (headless = 'new') => {
  if (!globalBrowser) {
    globalBrowser = await puppeteer.launch({
      headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--window-size=1920,1080',
        '--disable-blink-features=AutomationControlled',
        '--enable-javascript',
        '--enable-cookies',
      ],
    })
  }
  return globalBrowser
}
const createPage = async (browser, isLululemon) => {
  const page = await browser.newPage()

  // Set realistic viewport and user agent
  await page.setViewport({ width: 1280, height: 720 })
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  )
  if (isLululemon) {
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      Accept: '*/*',
      'Accept-Encoding': 'gzip, deflate, br',
      Connection: 'keep-alive',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-site',
      Origin: 'https://shop.lululemon.com',
      Referer: 'https://shop.lululemon.com/',
    })
  }
  // Block unnecessary resources
  await blockUnnecessaryResources(page)

  return page
}
export const blockUnnecessaryResources = async (page) => {
  await page.setRequestInterception(true)

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

  page.on('request', (req) => {
    const resourceType = req.resourceType()
    const url = req.url().toLowerCase()

    if (blockedTypes.includes(resourceType) || blockedDomains.some((domain) => url.includes(domain))) {
      req.abort()
    } else {
      req.continue()
    }
  })
}

const createPagePool = async (browser, isLululemon) => {
  const pagePool = []
  for (let i = 0; i < MAX_CONCURRENCY; i++) {
    pagePool.push(await createPage(browser, isLululemon))
  }
  return pagePool
}
export const setupPage = async (url, waitForSelector = null, existingPage = null, headless = 'new') => {
  let page = existingPage
  const browser = await getBrowser(headless)

  try {
    if (!page) {
      page = await browser.newPage()
      await page.setViewport({ width: 1280, height: 960 })
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      )

      if (url.includes('lululemon.com')) {
        await page.setExtraHTTPHeaders({
          'Accept-Language': 'en-US,en;q=0.9',
          Accept: '*/*',
          'Accept-Encoding': 'gzip, deflate, br',
          Connection: 'keep-alive',
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'same-site',
          Origin: 'https://shop.lululemon.com',
          Referer: 'https://shop.lululemon.com/',
        })
      } else {
        await page.setExtraHTTPHeaders({
          'Accept-Language': 'en-US,en;q=0.9',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          Connection: 'keep-alive',
        })
      }
    }

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 1000000 })

    if (waitForSelector) {
      await page.waitForSelector(waitForSelector, { timeout: 1000000 })
    }

    return page
  } catch (error) {
    console.error(`❌ Error loading page: ${url}`, error)
    return null
  }
}

export const scrapeProductsInParallel = async (products, browser, fetchFunction, isLululemon = false) => {
  // Create a pool of pages to reuse
  const pagePool = await createPagePool(browser, isLululemon)
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

export const closeGlobalBrowser = async () => {
  if (globalBrowser) {
    await globalBrowser.close()
    globalBrowser = null
  }
}
