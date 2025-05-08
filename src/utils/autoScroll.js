export const autoScroll = async (page) => {
  await page.evaluate(() => {
    return new Promise((resolve) => {
      let totalHeight = 0
      const distance = 100
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight
        window.scrollBy(0, distance)
        totalHeight += distance

        if (totalHeight >= scrollHeight) {
          clearInterval(timer)
          resolve()
        }
      }, 100)
    })
  })
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const countValidProducts = async (page) => {
  return await page.evaluate(() => {
    return Array.from(document.querySelectorAll('div.flex.transition-all.w-full')).filter((block) => {
      const link = block.querySelector('a.flex.relative.justify-center.items-start')
      const name = block.querySelector('div.font-chemre')
      const price = block.querySelector('div.font-gotham-bold')
      return link && name && price
    }).length
  })
}

export async function loadMoreLuluLemonProducts(page) {
  const productSelector = 'div[data-testid="product-tile"]'
  const buttonSelector = 'button[data-lll-pl="button"][class*="pagination_button"]'
  let previousCount = 0
  let round = 1
  let consecutiveNoChanges = 0
  let totalRefreshes = 0
  const maxRefreshes = 5

  // Initial page scroll to load all initial products
  await fullPageScroll(page)

  // Get initial product count
  let currentCount = await page.$$eval(productSelector, (els) => els.length)
  console.log(`🔎 [LuluLemon] Initial product count: ${currentCount}`)
  previousCount = currentCount

  while (true) {
    // Try clicking the "View More Products" button if it exists
    console.log(`🔎 [LuluLemon] Round ${round}: Found ${currentCount} products before interaction`)

    // Check if button exists and is visible
    const buttonVisible = await page.evaluate((selector) => {
      const btn = document.querySelector(selector)
      if (!btn) return false

      const style = window.getComputedStyle(btn)
      const rect = btn.getBoundingClientRect()

      return (
        btn &&
        !btn.disabled &&
        btn.offsetParent !== null &&
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        style.opacity !== '0' &&
        rect.width > 0 &&
        rect.height > 0
      )
    }, buttonSelector)

    if (buttonVisible) {
      // Try to click the button using multiple methods
      try {
        // Try JavaScript click
        await page.evaluate((selector) => {
          const btn = document.querySelector(selector)
          if (btn) {
            btn.scrollIntoView({ behavior: 'smooth', block: 'center' })
            setTimeout(() => {
              btn.click()

              // Also dispatch a MouseEvent
              const clickEvent = new MouseEvent('click', {
                view: window,
                bubbles: true,
                cancelable: true,
                buttons: 1,
              })
              btn.dispatchEvent(clickEvent)
            }, 500)
          }
        }, buttonSelector)

        console.log('🖱️ Clicked "View More Products" button')
        await page.waitForTimeout(2500)

        // Try physical mouse click as well
        const buttonHandle = await page.$(buttonSelector)
        if (buttonHandle) {
          const box = await buttonHandle.boundingBox()
          if (box) {
            await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 5 })
            await page.mouse.down()
            await page.waitForTimeout(100)
            await page.mouse.up()
          }
        }
      } catch (error) {
        console.error('Error trying to click button:', error)
      }

      // Scroll to load any new content
      await fullPageScroll(page)
    } else {
      console.log('🚫 "View More Products" button not found or not visible')

      // If we're in later rounds and the button disappears, we've likely loaded all products
      if (round > 1) {
        console.log('✅ Button no longer visible - likely all products loaded')
        break
      }
    }

    // Wait for new products to appear
    await page.waitForTimeout(2500)
    let newCount = await page.$$eval(productSelector, (els) => els.length)
    console.log(`📦 Products after interaction: ${newCount}`)

    // Check if we got new products
    if (newCount > previousCount) {
      console.log(`✨ ${newCount - previousCount} new products loaded!`)
      previousCount = newCount
      currentCount = newCount
      consecutiveNoChanges = 0
    } else {
      consecutiveNoChanges++
      console.log(`⚠️ No new products loaded (attempt ${consecutiveNoChanges})`)

      // If we've tried a few times with no new products, try refreshing the page
      if (consecutiveNoChanges >= 2 && totalRefreshes < maxRefreshes) {
        totalRefreshes++
        console.log(`🔄 Refreshing page (refresh ${totalRefreshes}/${maxRefreshes})...`)

        // Save the current URL in case we need it
        const currentUrl = await page.url()

        // Refresh the page
        await page.reload({ waitUntil: 'networkidle2' })
        await page.waitForTimeout(5000)

        // Scroll to load all content after refresh
        await fullPageScroll(page)

        // Get new count after refresh
        newCount = await page.$$eval(productSelector, (els) => els.length)
        console.log(`📦 Products after refresh: ${newCount}`)

        // If refresh helped, reset the counter
        if (newCount > previousCount) {
          console.log(`✨ ${newCount - previousCount} new products loaded after refresh!`)
          previousCount = newCount
          currentCount = newCount
          consecutiveNoChanges = 0
        }
      } else if (consecutiveNoChanges >= 3 || totalRefreshes >= maxRefreshes) {
        console.log(`🏁 No more products loading after multiple attempts. Finished at ${newCount} products.`)
        break
      }
    }

    round++

    // Safety check to prevent infinite loops
    if (round > 15) {
      console.log('⚠️ Reached maximum number of rounds, stopping')
      break
    }
  }

  // Do one final scroll and count to make sure we have everything
  await fullPageScroll(page)
  const finalCount = await page.$$eval(productSelector, (els) => els.length)
  console.log(`🏁 Final product count: ${finalCount}`)

  return finalCount
}

/**
 * Scroll through the entire page to ensure all lazy-loaded content appears
 * @param {Page} page - Puppeteer page object
 */
async function fullPageScroll(page) {
  // Get the page height
  const pageHeight = await page.evaluate(() => document.body.scrollHeight)
  const viewportHeight = await page.evaluate(() => window.innerHeight)

  // Scroll in small increments
  for (let i = 0; i < pageHeight; i += Math.floor(viewportHeight / 2)) {
    await page.evaluate((position) => window.scrollTo(0, position), i)
    await page.waitForTimeout(300)
  }

  // Scroll to bottom
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.waitForTimeout(800)

  // Scroll back up a bit to trigger any remaining lazy loading
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight - 200))
  await page.waitForTimeout(500)
}

export const autoScrollReformationProducts = async (page) => {
  await page.evaluate(() => {
    return new Promise((resolve) => {
      const distance = 5000 // scroll distance
      const delay = 150 // delay between scrolls
      let lastCount = 0
      let scrollAttempts = 0
      const maxScrollAttempts = 50

      console.log('🌀 Starting autoScroll...')

      const scrollInterval = setInterval(() => {
        window.scrollBy(0, distance)
        const items = document.querySelectorAll('.product-grid__item')

        console.log(`📦 Loaded ${items.length} items`)

        if (items.length > lastCount) {
          lastCount = items.length
          scrollAttempts = 0 // reset if new items are loaded
        } else {
          scrollAttempts++
          console.log(`🔁 No new items. Attempt ${scrollAttempts}/${maxScrollAttempts}`)
        }

        if (scrollAttempts >= maxScrollAttempts) {
          clearInterval(scrollInterval)
          console.log('✅ Finished scrolling. All products loaded.')
          resolve()
        }
      }, delay)
    })
  })
}

export const loadMoreProducts = async (
  page,
  productSelector = 'div.flex.transition-all.w-full',
  buttonXPath = "//button[contains(text(), 'Load More')]",
  maxRetries = 3
) => {
  let previousCount = 0
  let retries = 0

  await page.waitForSelector(productSelector)

  while (true) {
    const [loadMoreButton] = await page.$x(buttonXPath)
    if (!loadMoreButton) break

    const isVisible = (await loadMoreButton.boundingBox()) !== null
    if (!isVisible) break

    const currentCount = await countValidProducts(page)

    console.log(`🖱️ Clicking Load More... (${currentCount} products)`)

    await loadMoreButton.evaluate((btn) => btn.click())
    await wait(3000)

    // Wait until new products appear or timeout
    await page.waitForFunction(
      (prevCount, selector) => {
        return document.querySelectorAll(selector).length > prevCount
      },
      { timeout: 10000 },
      currentCount,
      productSelector
    )

    const newCount = await countValidProducts(page)

    if (newCount === previousCount) {
      retries++
      if (retries >= maxRetries) break
    } else {
      retries = 0
      previousCount = newCount
    }
  }

  // Final wait to ensure all JS-rendered content is settled
  await wait(3000)
}

export const loadMoreSelfPotraitProducts = async (page, itemSelector, loadMoreBtnSelector, maxClicks = 50) => {
  let previousCount = 0
  let currentCount = 0
  let tries = 0

  while (tries < maxClicks) {
    // Check if button is visible
    const loadMoreVisible = await page.evaluate((btnSelector) => {
      const btn = document.querySelector(btnSelector)
      return btn && btn.offsetParent !== null
    }, loadMoreBtnSelector)

    if (!loadMoreVisible) break

    // Get count before clicking
    previousCount = await page.$$eval(itemSelector, (items) => items.length)

    // console.log(`🧮 Product count before click: ${previousCount}`)

    // Click "Load More" button
    await page.evaluate((btnSelector) => {
      const btn = document.querySelector(btnSelector)
      if (btn) btn.click()
    }, loadMoreBtnSelector)

    // Wait for new items to load
    try {
      await page.waitForFunction(
        (selector, prevCount) => {
          return document.querySelectorAll(selector).length > prevCount
        },
        { timeout: 120000 },
        itemSelector,
        previousCount
      )
    } catch (e) {
      console.warn('⏳ Timed out waiting for new items. Ending loop.')
      break
    }

    currentCount = await page.$$eval(itemSelector, (items) => items.length)

    console.log(`📈 Product count after click: ${currentCount}`)

    if (currentCount === previousCount) break

    tries++
  }

  console.log(`✅ Finished loading. Total products: ${currentCount}`)
}
