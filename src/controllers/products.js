// * Libraries
import { StatusCodes } from 'http-status-codes'
import dotenv from 'dotenv'
import { Product, ProductMetrics, SizeChart, UserMeasurement, UserWishlist } from '../models'
import { asyncMiddleware } from '../middlewares'
import { categorizeProductByName, determineSubCategory, getCategoriesName } from '../utils/categoryConfig'
import {
  aggregateProductsByBrandAndCategory,
  calculateAttributeDifferences,
  checkAlterationRequired,
  extractUniqueBrands,
  findBestFit,
  findProductsByKeyword,
  formatSearchResponse,
  getBestFitForMeasurement,
  getCategoryCounts,
  getMatchingSizes,
  getSimilarProducts,
  getSizeCharts,
  getTrendingProducts,
  getUserMeasurements,
  getWishlistProductIdSet,
  initializeBrandState,
  initializeSearchCaches,
  parseBrandsArray,
  parseSkipValues,
  processAllSearchProducts,
  processBrandProducts,
  sortSearchResults,
  stripSuffix,
  validateRequiredParams,
  validateSearchParams,
} from '../utils'

dotenv.config()

export const CONTROLLER_PRODUCT = {
  getCategoryCountsAcrossBrands: asyncMiddleware(async (req, res) => {
    const categories = getCategoriesName()
    const brand = req.query.brand // single brand string or undefined

    const categoryCounts = await getCategoryCounts(categories, brand)

    return res.status(200).json({
      data: categoryCounts,
    })
  }),

  getByBrandsAndCategories: asyncMiddleware(async (req, res) => {
    const { brand, category, page = 1, limit = 10 } = req.query
    const userId = req.decoded._id

    if (!brand && !category) {
      return res.status(400).json({
        message: "At least one query param ('brand' or 'category') is required.",
      })
    }
    const user = await UserMeasurement.findOne({ userId }).lean()
    const wishlistSet = await getWishlistProductIdSet(userId)

    if (!user) {
      return res.status(404).json({ message: 'User not found.' })
    }
    const gender = user.gender
    const brands = brand?.split(',').map((b) => b.trim()) || []
    const categories = category?.split(',').map((c) => c.trim()) || []

    const aggregationPipeline = aggregateProductsByBrandAndCategory(brands, categories, gender, page, limit)

    const groupedResults = await Product.aggregate(aggregationPipeline)

    if (!groupedResults.length) {
      return res.status(404).json({ message: 'No matching products found.' })
    }

    const groupedByCategory = {}
    for (const item of groupedResults) {
      const productsWithWishlistFlag = item.products.map((product) => {
        return {
          ...product,
          isWishlist: wishlistSet.has(product._id.toString()),
        }
      })
      groupedByCategory[item.category] = productsWithWishlistFlag
    }

    // Count total number of matched products (without pagination)
    const totalCount = await Product.countDocuments({
      ...(brands.length && { brand: { $in: brands } }),
      ...(categories.length && { category: { $in: categories } }),
      gender,
    })
    return res.status(200).json({
      results: totalCount,
      data: groupedByCategory,
    })
  }),

  // getRecommendedProducts: asyncMiddleware(async (req, res) => {
  //   const BATCH_SIZE = 20 // Number of products to fetch in each database query
  //   const { brands, category, PAGE_SIZE = 10, fitType = 'fitted' } = req.query
  //   const userId = req.decoded._id

  //   // Parse skip values for each brand
  //   const skipParam = req.query.skip || '{}'
  //   const skipValues = typeof skipParam === 'string' ? JSON.parse(skipParam) : skipParam

  //   // Parse brands parameter (could be a single brand or an array)
  //   const brandsArray = Array.isArray(brands) ? brands : brands.split(',')

  //   if (!brands || !userId || !category) {
  //     return res.status(StatusCodes.BAD_REQUEST).json({ message: 'brands, category, and userId are required' })
  //   }
  //   const wishlistSet = await getWishlistProductIdSet(userId)
  //   // Fetch user measurements
  //   const userMeasurements = await getUserMeasurements(userId)
  //   if (!userMeasurements) {
  //     return res.status(StatusCodes.NOT_FOUND).json({ message: 'User not found.' })
  //   }

  //   const { userBust, userWaist, userHip, userSleeves, unit, gender } = userMeasurements

  //   // Calculate products per brand - distribute evenly
  //   const numBrands = brandsArray.length
  //   const productsPerBrand = Math.ceil(PAGE_SIZE / numBrands)

  //   // Set up result structure
  //   const result = {}
  //   // Keep track of processed products per brand
  //   const productsProcessed = {}
  //   const nextSkipValues = {}

  //   // Initialize counters for each brand
  //   brandsArray.forEach((brand) => {
  //     productsProcessed[brand] = 0
  //     nextSkipValues[brand] = skipValues[brand] || 0
  //   })

  //   const sizeChartMap = await getSizeCharts(brandsArray, unit)
  //   // Create size match cache per brand
  //   const sizeMatchCacheByBrand = {}
  //   const subCategoryCacheByBrand = {}

  //   // Process each brand to find matching products
  //   const processPromises = brandsArray.map(async (brand) => {
  //     // Initialize caches for this brand
  //     sizeMatchCacheByBrand[brand] = {}
  //     subCategoryCacheByBrand[brand] = new Map()

  //     // Process products in batches until we have enough matches
  //     const matchedProducts = []
  //     let currentSkip = skipValues[brand] || 0
  //     let hasMoreProducts = true

  //     while (matchedProducts.length < productsPerBrand && hasMoreProducts) {
  //       const productsBatch = await Product.aggregate([
  //         {
  //           $match: {
  //             brand,
  //             category,
  //             gender,
  //           },
  //         },
  //         { $skip: currentSkip },
  //         { $limit: BATCH_SIZE },
  //       ])

  //       if (!productsBatch.length) {
  //         hasMoreProducts = false
  //         break
  //       }

  //       for (let i = 0; i < productsBatch.length; i++) {
  //         const product = productsBatch[i]
  //         productsProcessed[brand]++

  //         const name = product.name || ''
  //         const gender = product.gender
  //         const subCategoryCache = subCategoryCacheByBrand[brand]
  //         const subCategory =
  //           category === 'denim' ? subCategoryCache.get(name) || determineSubCategory(category, name) : category
  //         if (category === 'denim' && !subCategoryCache.has(name)) {
  //           subCategoryCache.set(name, subCategory)
  //         }

  //         const isTopsCategory = subCategory === 'tops' || subCategory === 'outerwear' || subCategory === 'dresses'
  //         const categoryKey = isTopsCategory ? 'tops' : 'bottoms'
  //         // const hasTallSize = product.sizes?.some((s) => s.size.includes('#Tall'))
  //         // Determine which size chart key to use for fallback: 'tall' or 'default'
  //         // const fallbackSizeKey = hasTallSize ? 'tall' : 'default'
  //         const isJCrew = product.brand === 'J_Crew'

  //         if (isJCrew && gender === 'female' && category === 'denim') {
  //           categoryKey = 'denim'
  //         }

  //         const sizeChart =
  //           sizeChartMap[brand]?.[gender]?.[categoryKey] ||
  //           // sizeChartMap[brand]?.[gender]?.[fallbackSizeKey] ||
  //           sizeChartMap[brand]?.[gender]?.default ||
  //           sizeChartMap[brand]?.default ||
  //           null

  //         if (!sizeChart) {
  //           console.warn(`No sizeChart found for brand ${brand} with unit ${unit}`)
  //           continue
  //         }

  //         const matchingSizes = getMatchingSizes(
  //           brand,
  //           subCategory,
  //           sizeChart,
  //           sizeMatchCacheByBrand,
  //           userBust,
  //           userWaist,
  //           userHip,
  //           userSleeves,
  //           fitType
  //         )
  //         const filteredSizes = matchingSizes.filter((s) => s.fitType === fitType)
  //         const sizeSet = new Set(
  //           filteredSizes.flatMap(({ name, numericalSize, numericalValue }) => [name, numericalSize, numericalValue])
  //         )

  //         // const availableSizes = product.sizes?.filter((s) => sizeSet.has(s.size))
  //         const stripSuffix = (sizeName) => sizeName.split('#')[0]

  //         const availableSizes = product.sizes?.filter((s) => {
  //           const sizeKey = isJCrew ? stripSuffix(s.size) : s.size
  //           return sizeSet.has(sizeKey)
  //         })
  //         if (availableSizes?.length) {
  //           const alterationRequired = !availableSizes.some((s) => {
  //             const sSizeKey = isJCrew ? stripSuffix(s.size) : s.size
  //             const match = filteredSizes.find(
  //               (m) => m.name === sSizeKey || m.numericalSize === sSizeKey || m.numericalValue === sSizeKey
  //             )
  //             return match?.alterationRequired === false
  //           })
  //           let attributeDifferences = null

  //           if (alterationRequired) {
  //             // Collect differences from first matching size
  //             const fitAttribute = category === 'bottoms' ? 'waist' : 'bust'

  //             const matching = availableSizes
  //               .map((s) => {
  //                 const sSizeKey = isJCrew ? stripSuffix(s.size) : s.size
  //                 return filteredSizes.find(
  //                   (m) => m.name === sSizeKey || m.numericalSize === sSizeKey || m.numericalValue === sSizeKey
  //                 )
  //               })
  //               .filter(Boolean)

  //             if (matching.length > 0) {
  //               // Find the one with the smallest difference based on fitAttribute
  //               const bestMatch = matching.reduce((best, curr) => {
  //                 const bestDiff = parseFloat(best.attributeDifferences[fitAttribute] || 'Infinity')
  //                 const currDiff = parseFloat(curr.attributeDifferences[fitAttribute] || 'Infinity')
  //                 return currDiff < bestDiff ? curr : best
  //               })

  //               attributeDifferences = bestMatch.attributeDifferences
  //             } else {
  //               attributeDifferences = null
  //             }
  //           }

  //           const { _id, name, price, image } = product
  //           matchedProducts.push({
  //             product: { _id, name, price, image: { primary: image?.primary } },
  //             alterationRequired,
  //             attributeDifferences,
  //             isWishlist: wishlistSet.has(_id.toString()),
  //           })
  //         }
  //         if (matchedProducts.length >= productsPerBrand) {
  //           nextSkipValues[brand] = currentSkip + i + 1
  //           break
  //         }
  //       }

  //       currentSkip += productsBatch.length
  //     }

  //     // If we didn't get enough products and there are no more, set nextSkip to null for this brand
  //     if (matchedProducts.length < productsPerBrand && !hasMoreProducts) {
  //       nextSkipValues[brand] = null
  //     }

  //     return { brand, products: matchedProducts }
  //   })

  //   // Wait for all brand processing to complete
  //   const brandResults = await Promise.all(processPromises)

  //   result[category] = []

  //   brandResults.forEach(({ products }) => {
  //     result[category].push(...products)
  //   })

  //   // Calculate total matched
  //   const totalMatched = result[category].length
  //   // Determine if there are more products for any brand
  //   const hasMoreForAnyBrand = Object.values(nextSkipValues).some((value) => value !== null)

  //   return res.status(StatusCodes.OK).json({
  //     pageSize: PAGE_SIZE,
  //     totalMatched,
  //     productsPerBrand,
  //     productsProcessed,
  //     nextSkip: hasMoreForAnyBrand ? nextSkipValues : null,
  //     data: result,
  //   })
  // }),

  getRecommendedProducts: asyncMiddleware(async (req, res) => {
    const BATCH_SIZE = 20 // Number of products to fetch in each database query
    const { brands, category, PAGE_SIZE = 10, fitType = 'fitted' } = req.query
    const userId = req.decoded._id

    // Parse and validate parameters
    const skipValues = parseSkipValues(req.query.skip)
    const brandsArray = parseBrandsArray(brands)

    if (!validateRequiredParams(brands, userId, category)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: 'brands, category, and userId are required',
      })
    }

    // Get user data
    const wishlistSet = await getWishlistProductIdSet(userId)
    const userMeasurements = await getUserMeasurements(userId)

    if (!userMeasurements) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: 'User not found.' })
    }

    const { unit, gender } = userMeasurements

    // Calculate products per brand
    const numBrands = brandsArray.length
    const productsPerBrand = Math.ceil(PAGE_SIZE / numBrands)

    // Initialize state
    const { productsProcessed, nextSkipValues } = initializeBrandState(brandsArray, skipValues)
    const sizeChartMap = await getSizeCharts(brandsArray, unit)

    // Create caches
    const sizeMatchCacheByBrand = {}
    const subCategoryCacheByBrand = {}

    brandsArray.forEach((brand) => {
      sizeMatchCacheByBrand[brand] = {}
      subCategoryCacheByBrand[brand] = new Map()
    })

    // Process each brand
    const processPromises = brandsArray.map(async (brand) => {
      const result = await processBrandProducts(
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
      )

      // Update tracking variables
      productsProcessed[brand] = result.productsProcessed
      nextSkipValues[brand] = result.nextSkip

      return result
    })

    // Wait for all brand processing to complete
    const brandResults = await Promise.all(processPromises)

    // Compile results
    const result = {}
    result[category] = []

    brandResults.forEach(({ products }) => {
      result[category].push(...products)
    })

    // Calculate response metadata
    const totalMatched = result[category].length
    const hasMoreForAnyBrand = Object.values(nextSkipValues).some((value) => value !== null)

    return res.status(StatusCodes.OK).json({
      pageSize: PAGE_SIZE,
      totalMatched,
      productsPerBrand,
      productsProcessed,
      nextSkip: hasMoreForAnyBrand ? nextSkipValues : null,
      data: result,
    })
  }),

  // searchProducts: asyncMiddleware(async (req, res) => {
  //   const { keyword, fitType = 'fitted' } = req.query
  //   const userId = req.decoded._id

  //   if (!keyword || !userId) {
  //     return res.status(StatusCodes.BAD_REQUEST).json({ message: 'keyword, category, and userId are required' })
  //   }

  //   const userMeasurements = await getUserMeasurements(userId)
  //   if (!userMeasurements) {
  //     return res.status(StatusCodes.NOT_FOUND).json({ message: 'User not found.' })
  //   }

  //   const { userBust, userWaist, userHip, userSleeves, unit, gender } = userMeasurements

  //   const matchingProducts = await Product.find({
  //     name: { $regex: keyword, $options: 'i' },
  //     gender,
  //   }).lean()

  //   if (!matchingProducts.length) {
  //     return res.status(StatusCodes.OK).json({ data: [], total: 0 })
  //   }
  //   // Get all unique brands
  //   const brands = [...new Set(matchingProducts.map((p) => p.brand))]

  //   const sizeChartMap = await getSizeCharts(brands, unit)
  //   const sizeMatchCacheByBrand = {}
  //   const subCategoryCacheByBrand = {}

  //   brands.forEach((brand) => {
  //     sizeMatchCacheByBrand[brand] = {}
  //     subCategoryCacheByBrand[brand] = new Map()
  //   })
  //   const results = []

  //   for (const product of matchingProducts) {
  //     const subCategory = product.category
  //     const isTopsCategory = subCategory === 'tops' || subCategory === 'outerwear' || subCategory === 'dresses'
  //     let categoryKey = isTopsCategory ? 'tops' : 'bottoms'

  //     const isJCrew = product.brand === 'J_Crew'
  //     if (isJCrew && gender === 'female' && product.category === 'denim') {
  //       categoryKey = 'denim'
  //     }

  //     const brandSizeChart =
  //       sizeChartMap[product.brand]?.[product.gender]?.[categoryKey] || sizeChartMap[product.brand]?.default || null

  //     if (!brandSizeChart) continue

  //     const matchingSizes = getMatchingSizes(
  //       product.brand,
  //       subCategory,
  //       brandSizeChart,
  //       sizeMatchCacheByBrand,
  //       userBust,
  //       userWaist,
  //       userHip,
  //       userSleeves,
  //       fitType
  //     )
  //     const filteredSizes = matchingSizes.filter((s) => s.fitType === fitType)
  //     const productSizeList = product.sizes?.map((s) => s.size) || []
  //     if (productSizeList?.length) {
  //       let bestMatch = filteredSizes.find(
  //         (s) =>
  //           productSizeList.includes(s.name) ||
  //           productSizeList.includes(s.numericalSize) ||
  //           productSizeList.includes(s.numericalValue)
  //       )
  //       if (!bestMatch && filteredSizes.length > 0) {
  //         bestMatch = [...filteredSizes].sort((a, b) => a.sizeDifference - b.sizeDifference)[0]
  //       }
  //       const alterationRequired = bestMatch?.alterationRequired ?? true
  //       const closestSizeDiff = bestMatch?.sizeDifference ?? Infinity
  //       const attributeDifferences = alterationRequired ? bestMatch?.attributeDifferences : null
  //       results.push({
  //         product,
  //         alterationRequired,
  //         closestSizeDiff,
  //         attributeDifferences: attributeDifferences,
  //       })
  //     }
  //   }
  //   // Sort: No alteration first, then by closest size diff
  //   results.sort((a, b) => {
  //     if (a.alterationRequired !== b.alterationRequired) {
  //       return a.alterationRequired ? 1 : -1
  //     }
  //     return a.closestSizeDiff - b.closestSizeDiff
  //   })
  //   return res.status(StatusCodes.OK).json({
  //     total: results.length,
  //     data: results.map(({ product, alterationRequired, attributeDifferences }) => ({
  //       product,
  //       alterationRequired,
  //       attributeDifferences,
  //     })),
  //   })
  // }),

  searchProducts: asyncMiddleware(async (req, res) => {
    const { keyword, fitType = 'fitted', category } = req.query
    const userId = req.decoded._id

    // Validate parameters
    if (!validateSearchParams(keyword, userId)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: 'keyword, category, and userId are required',
      })
    }
    const wishlistSet = await getWishlistProductIdSet(userId)

    // Get user measurements
    const userMeasurements = await getUserMeasurements(userId)
    if (!userMeasurements) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: 'User not found.' })
    }

    const { unit, gender } = userMeasurements

    // Search for matching products
    const matchingProducts = await findProductsByKeyword(keyword, gender, category)

    if (!matchingProducts.length) {
      return res.status(StatusCodes.OK).json({ data: [], total: 0 })
    }

    // Extract unique brands and get size charts
    const brands = extractUniqueBrands(matchingProducts)
    const sizeChartMap = await getSizeCharts(brands, unit)

    // Initialize caches
    const { sizeMatchCacheByBrand, subCategoryCacheByBrand } = initializeSearchCaches(brands)

    // Process all products
    const results = processAllSearchProducts(
      matchingProducts,
      sizeChartMap,
      sizeMatchCacheByBrand,
      userMeasurements,
      fitType,
      wishlistSet
    )

    // Sort results by alteration requirement and size difference
    const sortedResults = sortSearchResults(results)

    // Format and return response
    return res.status(StatusCodes.OK).json({
      total: sortedResults.length,
      data: formatSearchResponse(sortedResults),
    })
  }),

  clickProduct: asyncMiddleware(async (req, res) => {
    const { productId } = req.query
    if (!productId) {
      return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Product ID is required.' })
    }
    await ProductMetrics.findOneAndUpdate({ productId }, { $inc: { clickCount: 1 } }, { upsert: true, new: true })

    res.status(StatusCodes.OK).json({ message: 'Click recorded' })
  }),

  trendingProducts: asyncMiddleware(async (req, res) => {
    const userId = req.decoded._id
    const limit = parseInt(req.query.limit) || 6
    const wishlistSet = await getWishlistProductIdSet(userId)
    const userMeasurements = await getUserMeasurements(userId)

    const trending = await getTrendingProducts(limit, wishlistSet, userMeasurements.gender)

    res.status(StatusCodes.OK).json({ data: trending })
  }),

  getProductDetails: asyncMiddleware(async (req, res) => {
    const { productId } = req.query
    const userId = req.decoded._id

    if (!productId || !userId) {
      return res.status(StatusCodes.BAD_REQUEST).json({ message: 'productId and userId are required.' })
    }

    // Fetch product by ID
    const [product, wishlistSet, user] = await Promise.all([
      Product.findById(productId).lean(),
      getWishlistProductIdSet(userId),
      UserMeasurement.findOne({ userId }).lean(),
    ])

    if (!product) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: 'Product not found.' })
    }
    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: 'User not found.' })
    }

    const brand = product.brand
    const gender = product.gender
    const category = product.category
    const name = product.name || ''

    const userBust = user.upperBody?.bust?.value || user.upperBody?.chest?.value
    const userWaist = user.lowerBody?.waist?.value
    const userHip = user.lowerBody?.hip?.value
    const userSleeves = user.upperBody?.sleevesLength?.value
    const unit = user.lowerBody?.waist?.unit
    const fitType = user.fit

    // Determine sub-category if applicable
    const subCategory = category === 'denim' ? determineSubCategory(category, name) : category

    const isTopsCategory = ['tops', 'outerwear', 'dresses'].includes(subCategory)
    let categoryKey = isTopsCategory ? 'tops' : 'bottoms'
    const isJCrew = brand === 'J_Crew'
    if (isJCrew && gender === 'female' && category === 'denim') {
      categoryKey = 'denim'
    }
    // Fetch size chart for brand
    const [similarProducts, sizeChartDoc] = await Promise.all([
      getSimilarProducts(product, wishlistSet),
      SizeChart.findOne({ brand }, { brand: 1, [`sizeChart.${unit}`]: 1 }).lean(),
    ])

    const sizeChart =
      sizeChartDoc?.sizeChart?.[unit]?.[gender]?.[categoryKey] ||
      sizeChartDoc?.sizeChart?.[unit]?.[gender]?.default ||
      sizeChartDoc?.sizeChart?.[unit]?.default

    if (!sizeChart) {
      return res.status(404).json({
        message: `No size chart found for brand ${brand} and unit ${unit}.`,
      })
    }
    const measurementType = isTopsCategory ? 'bust' : 'waist'
    // Use the enhanced bust-based size matching for tops
    let bestFit
    bestFit = findBestFit(
      sizeChart,
      {
        bust: userBust,
        waist: userWaist,
        hip: userHip,
        sleeves: userSleeves,
      },
      fitType,
      measurementType
    )

    if (!bestFit) {
      return res.status(StatusCodes.OK).json({
        product,
        recommendedSize: null,
        alterationRequired: false,
        attributeDifferences: null,
        similarProducts,
        message: 'No size match found based on your measurements.',
      })
    }
    const sizeMatchCacheByBrand = {}
    sizeMatchCacheByBrand[brand] = {}
    console.log('bestfit', bestFit)
    const matchingSizes = getMatchingSizes(
      brand,
      subCategory,
      sizeChart,
      sizeMatchCacheByBrand, // empty cache since this is a one-time lookup
      userBust,
      userWaist,
      userHip,
      userSleeves,
      fitType,
      true
    )
    // console.log('matchingSizes', matchingSizes)

    const filteredSizes = matchingSizes.filter(
      (s) =>
        s.name === bestFit.name &&
        s.numericalSize === bestFit.numericalSize &&
        s.numericalValue === bestFit.numericalValue
    )
    const availableSizes = (product.sizes || []).map((s) => s.size)
    console.log('filteredSizes', filteredSizes)

    // Create size set for checking availability
    const sizeSet = new Set(
      filteredSizes.flatMap(({ name, numericalSize, numericalValue }) => [name, numericalSize, numericalValue])
    )

    // Check which sizes are available
    const matchingAvailableSizes = product.sizes?.filter((s) => {
      const sizeKey = isJCrew ? stripSuffix(s.size) : s.size
      return sizeSet.has(sizeKey)
    })

    if (!matchingAvailableSizes?.length) {
      return res.status(StatusCodes.OK).json({
        product,
        recommendedSize: null,
        alterationRequired: null,
        attributeDifferences: null,
        fitType: null,
        similarProducts,
        message: 'No matching sizes available for this product.',
      })
    }

    // Check if alteration is required
    const alterationRequired = checkAlterationRequired(matchingAvailableSizes, filteredSizes, isJCrew)

    // Calculate attribute differences if alteration is required
    let attributeDifferences = null
    if (alterationRequired) {
      attributeDifferences = calculateAttributeDifferences(matchingAvailableSizes, filteredSizes, category, isJCrew)
    }

    const sizeCandidates = [bestFit.numericalSize, bestFit.numericalValue, bestFit.name]

    // Find the first matching size that exists in product.sizes
    const recommendedSize = sizeCandidates.find((size) => availableSizes.includes(size)) || null
    return res.status(StatusCodes.OK).json({
      product,
      alterationRequired,
      attributeDifferences,
      recommendedSize,
      fitType: bestFit.fitMatch,
      similarProducts,
    })
  }),

  getSearchSuggestions: asyncMiddleware(async (req, res) => {
    const { searchText } = req.query

    if (!searchText || searchText.trim().length === 0) {
      return res.status(StatusCodes.BAD_REQUEST).json({ message: 'searchText param is required.' })
    }

    // Create case-insensitive regex for partial matching
    const regex = new RegExp(searchText, 'i')

    // Fetch up to 10 product suggestions, selecting only _id and name
    const suggestions = await Product.find({ name: regex, brand: { $ne: 'Sabo_Skirt' } })
      .limit(6)
      .select('name')
      .lean()

    return res.status(StatusCodes.OK).json({
      suggestions,
    })
  }),
}
