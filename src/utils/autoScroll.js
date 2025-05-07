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
