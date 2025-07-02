import { autoScrollReformationProducts, normalizeHtml, scrapeProductsInParallel, setupPage } from '../../utils'

export const getTheReformationProductUrlsFromCategory = async (categoryUrl, existingPage = null) => {
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
    console.log(`Fetching for ${categoryUrl}`)
    await autoScrollReformationProducts(page)
    const products = await extractTheReformationProductsFromPage(page, categoryUrl)
    const productsWithDescriptions = await scrapeProductsInParallel(
      products,
      page.browser(),
      fetchTheReformationProductDescription
    )
    console.log(`✅ Completed fetching descriptions for ${productsWithDescriptions.length} products`)
    return productsWithDescriptions
  } catch (error) {
    console.error(`Error scraping category ${categoryUrl}:`, error)
    return []
  }
}
const fetchTheReformationProductDescription = async (url, page) => {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 })

    await page.waitForFunction(
      () => {
        return document.querySelector('.pdp_fit-details') || document.querySelector('.product-attribute__contents')
      },
      { timeout: 120000 }
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
const extractTheReformationProductsFromPage = async (page, baseUrl) => {
  return await page.evaluate((baseUrl) => {
    const products = []

    // Select all product tiles
    document.querySelectorAll('.product-grid__item').forEach((productEl) => {
      const titleElement = productEl.querySelector('.product-tile__body-section.product-tile__name')
      const priceElement = productEl.querySelector('.price--reduced')
      const linkElement = productEl.querySelector('.product-tile__anchor')

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
