import { Product, SizeChart, UserMeasurement } from '../models'
import { determineSubCategory } from './categoryConfig'
import { getMatchingSizes } from './misc'

export async function getUserMeasurements(userId) {
  const user = await UserMeasurement.findOne({ userId }).lean()
  if (!user) {
    return null
  }

  return {
    userBust: user.upperBody?.bust?.value || user.upperBody?.chest?.value,
    userWaist: user.lowerBody?.waist?.value,
    userHip: user.lowerBody?.hip?.value,
    userSleeves: user.upperBody?.sleevesLength?.value,
    unit: user.lowerBody?.waist?.unit,
    gender: user.gender,
    fit: user.fit,
  }
}

export async function getSizeCharts(brands, unit) {
  const sizeChartDocs = await SizeChart.find({ brand: { $in: brands } }, { brand: 1, [`sizeChart.${unit}`]: 1 }).lean()

  const sizeChartMap = {}
  sizeChartDocs.forEach((doc) => {
    const chart = doc.sizeChart?.[unit]
    if (chart) {
      sizeChartMap[doc.brand] = chart
    }
  })

  return sizeChartMap
}

export const validateRequiredParams = (brands, userId) => {
  return brands && userId
}
// Helper function to parse brands parameter
export const parseBrandsArray = (brands) => {
  return Array.isArray(brands) ? brands : brands.split(',')
}
// Helper function to parse skip values
export const parseSkipValues = (skipParam) => {
  const defaultSkip = '{}'
  const skip = skipParam || defaultSkip
  return typeof skip === 'string' ? JSON.parse(skip) : skip
}

// Helper function to initialize brand processing state
export const initializeBrandState = (brandsArray, skipValues) => {
  const productsProcessed = {}
  const nextSkipValues = {}

  brandsArray.forEach((brand) => {
    productsProcessed[brand] = 0
    nextSkipValues[brand] = skipValues[brand] || 0
  })

  return { productsProcessed, nextSkipValues }
}

// Helper function to determine category key for size chart lookup
const getCategoryKey = (subCategory, brand, gender, category) => {
  const isTopsCategory = subCategory === 'tops' || subCategory === 'outerwear' || subCategory === 'dresses'
  let categoryKey = isTopsCategory ? 'tops' : 'bottoms'

  const isJCrew = brand === 'J_Crew'
  if (isJCrew && gender === 'female' && category === 'denim') {
    categoryKey = 'denim'
  }

  return categoryKey
}

// Helper function to get size chart for a brand and category
export const getBrandSizeChart = (sizeChartMap, brand, gender, categoryKey, unit) => {
  const sizeChart =
    sizeChartMap[brand]?.[gender]?.[categoryKey] ||
    sizeChartMap[brand]?.[gender]?.default ||
    sizeChartMap[brand]?.default ||
    null

  if (!sizeChart) {
    console.warn(`No sizeChart found for brand ${brand} with unit ${unit}`)
  }

  return sizeChart
}

// Helper function to filter available sizes
export const getAvailableSizes = (product, sizeSet, isJCrew) => {
  return product.sizes?.filter((s) => {
    const sizeKey = isJCrew ? stripSuffix(s.size) : s.size
    return sizeSet.has(sizeKey)
  })
}

// export const stripSuffix = (sizeName) => sizeName.split('#')[0]
export const stripSuffix = (sizeName) => {
  if (!sizeName) return ''

  const base = sizeName.split('#')[0] // Remove suffix like "M#1"
  const primary = base.split('/')[0] // If size is "28/32", get "28"

  return primary.trim()
}
export const getSizeMatch = (size, filteredSizes, isJCrew = false) => {
  const sizeKey = isJCrew ? stripSuffix(size) : size
  return filteredSizes.find((m) => m.name === sizeKey || m.numericalSize === sizeKey || m.numericalValue === sizeKey)
}
export const calculateFitAttributeDifferences = (matching, fitAttribute) => {
  if (!matching.length) return null

  return matching.reduce((best, curr) => {
    const bestDiff = parseFloat(best.attributeDifferences[fitAttribute] || 'Infinity')
    const currDiff = parseFloat(curr.attributeDifferences[fitAttribute] || 'Infinity')
    return currDiff < bestDiff ? curr : best
  }).attributeDifferences
}
// Helper function to calculate attribute differences
export const calculateAttributeDifferences = (availableSizes, filteredSizes, category, isJCrew) => {
  const fitAttribute = category === 'bottoms' ? 'waist' : 'bust'

  const matching = availableSizes.map((s) => getSizeMatch(s.size, filteredSizes, isJCrew)).filter(Boolean)

  return calculateFitAttributeDifferences(matching, fitAttribute)
}

// Helper function to check if alteration is required
export const checkAlterationRequired = (availableSizes, filteredSizes, isJCrew) => {
  return !availableSizes.some((s) => {
    const match = getSizeMatch(s.size, filteredSizes, isJCrew)
    return match?.alterationRequired === false
  })
}

export const createBasicProductInfo = (product) => {
  const { _id, name, price, image } = product
  return {
    _id,
    name,
    price,
    image: { primary: image?.primary },
  }
}

// Helper function to create product result object
const createProductResult = (product, alterationRequired, wishlistSet) => {
  const { _id } = product
  return {
    product: createBasicProductInfo(product),
    alterationRequired,
    // attributeDifferences,
    isWishlist: wishlistSet.has(_id.toString()),
  }
}

// Main function to process a single product
export const processProduct = (
  product,
  category,
  sizeChartMap,
  sizeMatchCacheByBrand,
  subCategoryCacheByBrand,
  userMeasurements,
  fitType,
  wishlistSet,
  unit
) => {
  const { userBust, userWaist, userHip, userSleeves, gender } = userMeasurements
  const brand = product.brand
  const name = product.name || ''

  // Handle subcategory determination
  const subCategoryCache = subCategoryCacheByBrand[brand]
  const subCategory =
    category === 'denim' ? subCategoryCache.get(name) || determineSubCategory(category, name) : category

  if (category === 'denim' && !subCategoryCache.has(name)) {
    subCategoryCache.set(name, subCategory)
  }

  const categoryKey = getCategoryKey(subCategory, brand, gender, category)
  const isJCrew = brand === 'J_Crew'

  const sizeChart = getBrandSizeChart(sizeChartMap, brand, gender, categoryKey, unit)
  if (!sizeChart) {
    return null // Skip this product
  }

  const matchingSizes = getMatchingSizes(
    brand,
    subCategory,
    sizeChart,
    sizeMatchCacheByBrand,
    userBust,
    userWaist,
    userHip,
    userSleeves,
    fitType
  )
  const filteredSizes = matchingSizes.filter((s) => s.fitType === fitType)

  const sizeSet = new Set(
    filteredSizes.flatMap(({ name, numericalSize, numericalValue }) => [name, numericalSize, numericalValue])
  )

  const availableSizes = getAvailableSizes(product, sizeSet, isJCrew)

  if (!availableSizes?.length) {
    return null // No matching sizes available
  }

  const alterationRequired = checkAlterationRequired(availableSizes, filteredSizes, isJCrew)

  // let attributeDifferences = null
  // if (alterationRequired) {
  //   attributeDifferences = calculateAttributeDifferences(availableSizes, filteredSizes, category, isJCrew)
  // }

  return createProductResult(product, alterationRequired, wishlistSet)
}

// Function to process a single brand
export const processBrandProducts = async (
  brand,
  category,
  gender,
  productsPerBrand,
  skipValues,
  sizeChartMap,
  sizeMatchCacheByBrand,
  subCategoryCacheByBrand,
  userMeasurements,
  fitType,
  wishlistSet,
  unit,
  BATCH_SIZE
) => {
  const matchedProducts = []
  let currentSkip = skipValues[brand] || 0
  let hasMoreProducts = true
  let productsProcessed = 0
  const defaultCategories = ['tops', 'dresses', 'bottoms', 'outerwear', 'denim']
  while (matchedProducts.length < productsPerBrand && hasMoreProducts) {
    const productsBatch = await Product.aggregate([
      {
        $match: {
          brand,
          category: category ? category : { $in: defaultCategories },
          gender,
        },
      },
      { $skip: currentSkip },
      { $limit: BATCH_SIZE },
    ])

    if (!productsBatch.length) {
      hasMoreProducts = false
      break
    }

    for (let i = 0; i < productsBatch.length; i++) {
      const product = productsBatch[i]
      productsProcessed++

      const processedProduct = processProduct(
        product,
        product.category,
        sizeChartMap,
        sizeMatchCacheByBrand,
        subCategoryCacheByBrand,
        userMeasurements,
        fitType,
        wishlistSet,
        unit
      )
      if (processedProduct) {
        matchedProducts.push(processedProduct)
      }

      if (matchedProducts.length >= productsPerBrand) {
        const nextSkip = currentSkip + i + 1
        return {
          brand,
          products: matchedProducts,
          productsProcessed,
          nextSkip,
          hasMore: true,
        }
      }
    }

    currentSkip += productsBatch.length
  }

  return {
    brand,
    products: matchedProducts,
    productsProcessed,
    nextSkip: hasMoreProducts ? currentSkip : null,
    hasMore: hasMoreProducts,
  }
}

//---------------FOR SEARCH PRODUCTS--------------------
export const validateSearchParams = (keyword, userId) => {
  return keyword && userId
}

// Helper function to get unique brands from products
export const extractUniqueBrands = (products) => {
  return [...new Set(products.map((p) => p.brand))]
}

// Helper function to initialize brand caches for search
export const initializeSearchCaches = (brands) => {
  const sizeMatchCacheByBrand = {}
  const subCategoryCacheByBrand = {}

  brands.forEach((brand) => {
    sizeMatchCacheByBrand[brand] = {}
    subCategoryCacheByBrand[brand] = new Map()
  })

  return { sizeMatchCacheByBrand, subCategoryCacheByBrand }
}

// Helper function to find best matching size
const findBestMatchingSize = (filteredSizes, productSizeList) => {
  // First try to find exact match
  let bestMatch = filteredSizes.find(
    (s) =>
      productSizeList.includes(s.name) ||
      productSizeList.includes(s.numericalSize) ||
      productSizeList.includes(s.numericalValue)
  )

  // If no exact match, find closest by size difference
  if (!bestMatch && filteredSizes.length > 0) {
    bestMatch = [...filteredSizes].sort((a, b) => a.sizeDifference - b.sizeDifference)[0]
  }

  return bestMatch
}

// Helper function to create search result object
const createSearchResult = (product, bestMatch, wishlistSet) => {
  const { _id } = product
  const alterationRequired = bestMatch?.alterationRequired ?? true
  const closestSizeDiff = bestMatch?.sizeDifference ?? Infinity
  // const attributeDifferences = alterationRequired ? bestMatch?.attributeDifferences : null

  return {
    product: createBasicProductInfo(product),
    alterationRequired,
    closestSizeDiff,
    // attributeDifferences,
    isWishlist: wishlistSet.has(_id.toString()),
  }
}

// Helper function to sort search results
export const sortSearchResults = (results) => {
  return results.sort((a, b) => {
    // No alteration first, then by closest size diff
    if (a.alterationRequired !== b.alterationRequired) {
      return a.alterationRequired ? 1 : -1
    }
    return a.closestSizeDiff - b.closestSizeDiff
  })
}

// Helper function to format search response
export const formatSearchResponse = (results) => {
  return results.map(({ product, alterationRequired, isWishlist }) => ({
    product,
    alterationRequired,
    // attributeDifferences,
    isWishlist,
  }))
}

// Function to process a single product for search
const processSearchProduct = (product, sizeChartMap, sizeMatchCacheByBrand, userMeasurements, fitType, wishlistSet) => {
  const { userBust, userWaist, userHip, userSleeves, unit } = userMeasurements
  const subCategory = product.category
  const categoryKey = getCategoryKey(subCategory, product.brand, product.gender, product.category)
  const brandSizeChart = getBrandSizeChart(sizeChartMap, product.brand, product.gender, categoryKey, unit)
  console.log('brandSizeChart', brandSizeChart)
  if (!product.sizes?.length || !brandSizeChart) {
    return {
      product: createBasicProductInfo(product),
      alterationRequired: null,
      closestSizeDiff: null,
      isWishlist: wishlistSet.has(product._id.toString()),
      noSizesAvailable: true, // Add flag to indicate no sizes
    }
  }

  const matchingSizes = getMatchingSizes(
    product.brand,
    subCategory,
    brandSizeChart,
    sizeMatchCacheByBrand,
    userBust,
    userWaist,
    userHip,
    userSleeves,
    fitType
  )

  const filteredSizes = matchingSizes.filter((s) => s.fitType === fitType)
  const productSizeList = product.sizes?.map((s) => s.size) || []

  if (!productSizeList?.length) {
    return null // No sizes available
  }

  const bestMatch = findBestMatchingSize(filteredSizes, productSizeList)
  return createSearchResult(product, bestMatch, wishlistSet)
}

// Function to process all matching products
export const processAllSearchProducts = (
  matchingProducts,
  sizeChartMap,
  sizeMatchCacheByBrand,
  userMeasurements,
  fitType,
  wishlistSet
) => {
  const results = []

  for (const product of matchingProducts) {
    const result = processSearchProduct(
      product,
      sizeChartMap,
      sizeMatchCacheByBrand,
      userMeasurements,
      fitType,
      wishlistSet
    )

    if (result) {
      results.push(result)
    }
  }

  return results
}

// Function to search for products by keyword
export const findProductsByKeyword = async (keyword, gender, category, brand) => {
  const query = {
    name: { $regex: keyword, $options: 'i' },
    gender,
    brand: { $ne: 'Sabo_Skirt' },
  }
  if (brand) {
    query.brand = brand
  }
  if (category) {
    query.category = category
  }

  return await Product.find(query).lean()
}

const parseMeasurementRange = (measurement) => {
  if (!measurement) return []

  const measurementStr = measurement.toString().trim()

  // Handle range format like "35-36"
  if (measurementStr.includes('-')) {
    const [start, end] = measurementStr.split('-').map((num) => parseFloat(num.trim()))
    return [start, end]
  }

  // Handle comma-separated format like "35,36,37,38" or quoted values like "35", "36", "37", "38"
  if (measurementStr.includes(',')) {
    return measurementStr
      .split(',')
      .map((num) => parseFloat(num.trim().replace(/['"]/g, ''))) // Remove quotes and trim
      .filter((num) => !isNaN(num)) // Filter out invalid numbers
  }

  // Handle single value like "35" or 35
  const singleValue = parseFloat(measurementStr.replace(/['"]/g, ''))
  return isNaN(singleValue) ? [] : [singleValue]
}

// Helper function to get the primary measurement value for sorting
const getPrimaryMeasurement = (measurement) => {
  const values = parseMeasurementRange(measurement)
  return values.length > 0 ? Math.min(...values) : 0
}

// Helper function to determine the best fit based on user measurement and fit type
export const getBestFitForMeasurement = (userMeasurement, sizeMeasurement, fitType) => {
  const measurementValues = parseMeasurementRange(sizeMeasurement)

  if (measurementValues.length === 0) return { fits: false, score: Infinity }

  switch (fitType) {
    case 'fitted':
      // For fitted, look for exact match only
      if (userMeasurement >= Math.min(...measurementValues) && userMeasurement <= Math.max(...measurementValues)) {
        return { fits: true, score: 0, matchType: 'fitted' }
      }
      const smallerValues = measurementValues.filter((val) => val < userMeasurement)
      const largerValues = measurementValues.filter((val) => val > userMeasurement)

      const bestTight = smallerValues.length > 0 ? Math.max(...smallerValues) : null
      const bestLoose = largerValues.length > 0 ? Math.min(...largerValues) : null

      const tightScore = bestTight !== null ? userMeasurement - bestTight : Infinity
      const looseScore = bestLoose !== null ? bestLoose - userMeasurement : Infinity
      if (tightScore < looseScore) {
        return { fits: true, score: tightScore, matchType: 'tight' }
      } else if (looseScore < Infinity) {
        return { fits: true, score: looseScore, matchType: 'loose' }
      }

      return { fits: false, score: Infinity, matchType: 'fitted' }
    case 'tight':
      // For tight fit, prefer sizes smaller than user measurement (not equal)
      const tightVals = measurementValues.filter((val) => val < userMeasurement)
      if (tightVals.length > 0) {
        const bestTight = Math.max(...tightVals) // Closest smaller value

        return { fits: true, score: userMeasurement - bestTight, matchType: 'tight' }
      }
      // If no smaller values, find closest for fallback
      const closestTight = measurementValues.reduce((closest, val) =>
        Math.abs(val - userMeasurement) < Math.abs(closest - userMeasurement) ? val : closest
      )

      return { fits: false, score: Math.abs(closestTight - userMeasurement), matchType: 'tight' }

    case 'loose':
      // For loose fit, prefer sizes larger than user measurement (not equal)
      const looseVals = measurementValues.filter((val) => val > userMeasurement)
      if (looseVals.length > 0) {
        const bestLoose = Math.min(...looseVals) // Closest larger value
        return { fits: true, score: bestLoose - userMeasurement, matchType: 'loose' }
      }
      // If no larger values, find closest for fallback
      const closestLoose = measurementValues.reduce((closest, val) =>
        Math.abs(val - userMeasurement) < Math.abs(closest - userMeasurement) ? val : closest
      )
      return { fits: false, score: Math.abs(closestLoose - userMeasurement), matchType: 'loose' }

    default:
      return { fits: false, score: Infinity, matchType: 'fitted' }
  }
}

// Enhanced function to find best fit based on bust measurements
export const findBestFit = (sizeChart, userMeasurements, fitType, measurementType, productSizes, isJCrew) => {
  const userMeasurement = measurementType === 'bust' ? userMeasurements.bust : userMeasurements.waist
  const matchingAvailableSizes = new Set(productSizes.map((s) => (isJCrew ? stripSuffix(s.size) : s.size)))

  if (!userMeasurement || !sizeChart) return null
  // Convert size chart to array and sort by bust measurement
  const sortedSizes = sizeChart
    .filter(
      (size) =>
        // Only include sizes that exist in product's sizes
        matchingAvailableSizes.has(size.name) ||
        matchingAvailableSizes.has(size.numericalSize) ||
        matchingAvailableSizes.has(size.numericalValue)
    )
    .map((size) => ({
      name: size.name,
      measurements: size.measurements,
      measurementValue: getPrimaryMeasurement(size.measurements[measurementType]),
      numericalSize: size.numericalSize,
      numericalValue: size.numericalValue,
    }))
    .filter((size) => size.measurements?.[measurementType]) // ensure bust exists
    .sort((a, b) => a.measurementValue - b.measurementValue)

  // Find best fit based on fit type
  let bestFit = null
  let bestScore = Infinity
  const selectedLabels = new Set()
  for (const size of sortedSizes) {
    const measurement = size.measurements[measurementType]
    const fitResult = getBestFitForMeasurement(userMeasurement, measurement, fitType)
    // Prioritize exact fits, then best scores
    if (fitResult.fits && fitResult.score === 0) {
      // Perfect match found
      return {
        name: size.name,
        numericalSize: size.numericalSize,
        numericalValue: size.numericalValue,
        measurements: size.measurements,
        fitMatch: fitResult.matchType,
      }
    }

    if (fitResult.fits) {
      // If this label already selected with the same score, skip this one
      // if (selectedLabels.has(size.name)) {
      //   continue // skip this duplicate label with same score
      // }

      // If this candidate is better score or bestFit not set yet
      if (fitResult.score < bestScore || !bestFit) {
        bestScore = fitResult.score
        bestFit = {
          name: size.name,
          numericalSize: size.numericalSize,
          numericalValue: size.numericalValue,
          measurements: size.measurements,
          fitMatch: fitResult.matchType,
        }
        selectedLabels.add(size.name)
      }
    } else {
      // If not fit, but better score and no fit found yet
      if (fitResult.score < bestScore && !bestFit) {
        bestScore = fitResult.score
        bestFit = {
          name: size.name,
          numericalSize: size.numericalSize,
          numericalValue: size.numericalValue,
          measurements: size.measurements,
          fitMatch: fitResult.matchType,
        }
        selectedLabels.add(size.name)
      }
    }
  }

  return bestFit
}
