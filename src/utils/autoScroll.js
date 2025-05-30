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
export const scrollToLoadProducts = async (page, productSelector) => {
  await page.evaluate((selector) => {
    return new Promise((resolve) => {
      let lastScrollHeight = 0
      let scrollAttempts = 0
      let noScrollCount = 0
      const maxNoScrollAttempts = 5 // 10 seconds of no scroll detection
      const scrollDistance = 1000
      const scrollDelay = 200 // 1 second between scrolls

      const scroll = () => {
        const currentScrollHeight = document.body.scrollHeight
        const currentScrollTop = window.pageYOffset || document.documentElement.scrollTop

        // Scroll down
        window.scrollBy(0, scrollDistance)

        // Wait a bit for content to load
        setTimeout(() => {
          const newScrollTop = window.pageYOffset || document.documentElement.scrollTop
          const newScrollHeight = document.body.scrollHeight

          // Check if we actually scrolled (page moved)
          if (newScrollTop === currentScrollTop && newScrollHeight === currentScrollHeight) {
            noScrollCount++
            console.log(`📜 No scroll detected (${noScrollCount}/${maxNoScrollAttempts})`)
          } else {
            noScrollCount = 0 // Reset counter if we successfully scrolled
            console.log(`📜 Scrolled to position: ${newScrollTop}, page height: ${newScrollHeight}`)
          }

          // If we can't scroll anymore for 10 consecutive attempts, stop
          if (noScrollCount >= maxNoScrollAttempts) {
            console.log(`📜 Finished scrolling - reached bottom or no more content loading`)
            resolve()
            return
          }

          // Continue scrolling
          lastScrollHeight = newScrollHeight
          scrollAttempts++

          // Safety limit
          if (scrollAttempts > 200) {
            console.log(`📜 Reached maximum scroll attempts (${scrollAttempts})`)
            resolve()
            return
          }

          // Continue scrolling
          setTimeout(scroll, scrollDelay)
        }, 1500) // Wait 1.5 seconds for products to load after each scroll
      }

      // Start scrolling
      scroll()
    })
  }, productSelector)
}
export const loadMoreLuluLemonProducts = async (page, selector, categoryUrl) => {
  const productSelector = selector
  const buttonSelector = 'button[data-lll-pl="button"][class*="pagination_button"]'
  let previousCount = 0
  let round = 1
  let consecutiveNoChanges = 0
  let totalRefreshes = 0
  const maxRefreshes = 10
  const consecutiveNoChangesLimit = 5
  let currentCount = await page.$$eval(productSelector, (els) => els.length)
  console.log(`🔎 [LuluLemon] Initial product count: ${currentCount}`)
  previousCount = currentCount

  while (true) {
    // Try clicking the "View More Products" button if it exists
    console.log(`🔎 [LuluLemon] Round ${round}: Found ${currentCount} products before interaction`)

    const maxRetries = 6
    const retryDelay = 1000 // 2 seconds

    let clicked = false

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const buttonVisible = await page.evaluate((selector) => {
        const btn = document.querySelector(selector)
        if (!btn) return false

        const style = window.getComputedStyle(btn)
        const rect = btn.getBoundingClientRect()
        // btn.scrollIntoView({ behavior: 'smooth', block: 'center' })
        return (
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
        try {
          // Try JavaScript click
          await page.evaluate((selector) => {
            const btn = document.querySelector(selector)
            if (btn) {
              setTimeout(() => {
                btn.click()
                const clickEvent = new MouseEvent('click', {
                  view: window,
                  bubbles: true,
                  cancelable: true,
                  buttons: 1,
                })
                btn.dispatchEvent(clickEvent)
              }, 100)
            }
          }, buttonSelector)

          // Try physical click
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

          console.log(`🖱️ Clicked "View More Products" button on attempt ${attempt}`)
          clicked = true

          break
        } catch (error) {
          console.error(`⚠️ Attempt ${attempt}: Failed to click the button:`, error)
        }
      } else {
        console.log(`🔁 Attempt ${attempt}: Button not visible, retrying in ${retryDelay / 1000}s...`)
        await page.waitForTimeout(retryDelay)
      }
    }

    if (!clicked) {
      console.log(`❌ Failed to click "View More Products" button after ${maxRetries} attempts`)
      break
    }

    const retrySearchDelay = 3000 // 2 seconds
    let newCount = 0

    // Check if we got new products
    while (consecutiveNoChanges < consecutiveNoChangesLimit) {
      newCount = await page.$$eval(productSelector, (els) => els.length)
      console.log(`📦 Products after interaction (check ${consecutiveNoChanges + 1}): ${newCount}`)

      if (newCount > previousCount) {
        console.log(`✨ ${newCount - previousCount} new products loaded!`)
        previousCount = newCount
        currentCount = newCount
        consecutiveNoChanges = 0
        break
      } else {
        consecutiveNoChanges++
        console.log(`⚠️ No new products loaded (consecutive: ${consecutiveNoChanges})`)
        await page.waitForTimeout(retrySearchDelay)
      }
    }

    // If we've tried a few times with no new products, try refreshing the page
    if (consecutiveNoChanges >= consecutiveNoChangesLimit && totalRefreshes < maxRefreshes) {
      totalRefreshes++
      console.log(`🔄 Refreshing page (refresh ${totalRefreshes}/${maxRefreshes})...`)

      // Save the current URL in case we need it
      await page.url()

      // Refresh the page
      await page.goto(categoryUrl, { waitUntil: 'networkidle2', timeout: 120000 }) // <== use this instead of page.reload()

      // await page.waitForTimeout(5000)
      // await autoScroll(page)
      await scrollToLoadProducts(page, productSelector)
      newCount = await page.$$eval(productSelector, (els) => els.length)
      console.log(`📦 Products after refresh: ${newCount}`)

      // If refresh helped, reset the counter
      if (newCount > previousCount) {
        console.log(`✨ ${newCount - previousCount} new products loaded after refresh!`)
        previousCount = newCount
        currentCount = newCount
        consecutiveNoChanges = 0
      }
    } else if (consecutiveNoChanges >= consecutiveNoChangesLimit || totalRefreshes >= maxRefreshes) {
      console.log(`🏁 No more products loading after multiple attempts. Finished at ${newCount} products.`)
      break
    }

    round++
    if (round > 120) {
      console.log('⚠️ Reached maximum number of rounds, stopping')
      break
    }
  }

  const finalCount = await page.$$eval(productSelector, (els) => els.length)
  console.log(`🏁 Final product count: ${finalCount}`)

  return finalCount
}

export const autoScrollReformationProducts = async (page) => {
  await page.evaluate(() => {
    return new Promise((resolve) => {
      const distance = 5000 // scroll distance
      const delay = 300 // delay between scrolls
      let lastCount = 0
      let scrollAttempts = 0
      const maxScrollAttempts = 25

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
