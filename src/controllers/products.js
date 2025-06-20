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
  getAvailableSizes,
  getBestFitForMeasurement,
  getBrandSizeChart,
  getCategoryCounts,
  getMatchingSizes,
  getSimilarProducts,
  getSizeCharts,
  getTrendingOrRandomProducts,
  getTrendingProducts,
  getUserMeasurements,
  getWishlistProductIdSet,
  initializeBrandState,
  initializeSearchCaches,
  parseBrandsArray,
  parseSkipValues,
  processAllSearchProducts,
  processBrandProducts,
  processProduct,
  sortSearchResults,
  stripSuffix,
  validateRequiredParams,
  validateSearchParams,
} from '../utils'

dotenv.config()

export const CONTROLLER_PRODUCT = {
  getCategoryCountsAcrossBrands: asyncMiddleware(async (req, res) => {
    const userId = req.decoded._id
    const categories = getCategoriesName()
    const brand = req.query.brand // single brand string or undefined
    const user = await UserMeasurement.findOne({ userId }).lean()
    if (!user) {
      return res.status(404).json({ message: 'User not found.' })
    }
    const categoryCounts = await getCategoryCounts(categories, brand, user.gender)

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

  //   // Parse and validate parameters
  //   const skipValues = parseSkipValues(req.query.skip)
  //   const brandsArray = parseBrandsArray(brands)

  //   if (!validateRequiredParams(brands, userId, category)) {
  //     return res.status(StatusCodes.BAD_REQUEST).json({
  //       message: 'brands, category, and userId are required',
  //     })
  //   }

  //   // Get user data
  //   const wishlistSet = await getWishlistProductIdSet(userId)
  //   const userMeasurements = await getUserMeasurements(userId)

  //   if (!userMeasurements) {
  //     return res.status(StatusCodes.NOT_FOUND).json({ message: 'User not found.' })
  //   }

  //   const { unit, gender } = userMeasurements

  //   // Calculate products per brand
  //   const numBrands = brandsArray.length
  //   const productsPerBrand = Math.ceil(PAGE_SIZE / numBrands)

  //   // Initialize state
  //   const { productsProcessed, nextSkipValues } = initializeBrandState(brandsArray, skipValues)
  //   const sizeChartMap = await getSizeCharts(brandsArray, unit)

  //   // Create caches
  //   const sizeMatchCacheByBrand = {}
  //   const subCategoryCacheByBrand = {}

  //   brandsArray.forEach((brand) => {
  //     sizeMatchCacheByBrand[brand] = {}
  //     subCategoryCacheByBrand[brand] = new Map()
  //   })

  //   // Process each brand
  //   const processPromises = brandsArray.map(async (brand) => {
  //     const result = await processBrandProducts(
  //       brand,
  //       category,
  //       gender,
  //       productsPerBrand,
  //       skipValues,
  //       sizeChartMap,
  //       sizeMatchCacheByBrand,
  //       subCategoryCacheByBrand,
  //       userMeasurements,
  //       fitType,
  //       wishlistSet,
  //       unit,
  //       BATCH_SIZE
  //     )

  //     // Update tracking variables
  //     productsProcessed[brand] = result.productsProcessed
  //     nextSkipValues[brand] = result.nextSkip

  //     return result
  //   })

  //   // Wait for all brand processing to complete
  //   const brandResults = await Promise.all(processPromises)

  //   // Compile results
  //   const result = {}
  //   result[category] = []

  //   brandResults.forEach(({ products }) => {
  //     result[category].push(...products)
  //   })

  //   // Calculate response metadata
  //   const totalMatched = result[category].length
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

    if (!validateRequiredParams(brands, userId)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: 'brands and userId are required',
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
    let currentBrandIndex = 0
    let allResults = []
    let remainingSlots = PAGE_SIZE
    // Process brands until we fill PAGE_SIZE or run out of brands/products
    while (remainingSlots > 0 && currentBrandIndex < brandsArray.length) {
      const remainingBrands = brandsArray.length - currentBrandIndex
      const productsPerBrand = Math.ceil(remainingSlots / remainingBrands)

      const brand = brandsArray[currentBrandIndex]
      const brandResult = await processBrandProducts(
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
      productsProcessed[brand] = brandResult.productsProcessed
      nextSkipValues[brand] = brandResult.nextSkip

      // Add products to results
      allResults.push(...brandResult.products)

      // Update remaining slots
      remainingSlots -= brandResult.products.length
      currentBrandIndex++
    }

    // Prepare final results object
    // const result = {}
    // result[category] = allResults.slice(0, PAGE_SIZE) // Ensure we don't exceed PAGE_SIZE

    // const totalMatched = result[category].length
    const finalResults = allResults.slice(0, PAGE_SIZE)
    const totalMatched = finalResults.length
    const hasMoreForAnyBrand = Object.values(nextSkipValues).some((value) => value !== null)

    return res.status(StatusCodes.OK).json({
      pageSize: PAGE_SIZE,
      totalMatched,
      productsPerBrand,
      productsProcessed,
      nextSkip: hasMoreForAnyBrand ? nextSkipValues : null,
      data: {
        products: finalResults,
      },
      // data: result,
    })
  }),

  searchProducts: asyncMiddleware(async (req, res) => {
    const { keyword, fitType, category, brand } = req.query
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
    const matchingProducts = await findProductsByKeyword(keyword, gender, category, brand)

    if (!matchingProducts.length) {
      return res.status(StatusCodes.OK).json({ data: [], total: 0 })
    }
    if (!fitType) {
      const basicResults = matchingProducts.map((product) => ({
        product: {
          _id: product._id,
          name: product.name,
          price: product.price,
          image: { primary: product.image?.primary },
        },
        alterationRequired: null,
        isWishlist: wishlistSet.has(product._id.toString()),
      }))

      return res.status(StatusCodes.OK).json({
        total: basicResults.length,
        data: basicResults,
      })
    }

    // Extract unique brands and get size charts
    const brands = extractUniqueBrands(matchingProducts)
    const sizeChartMap = await getSizeCharts(brands, unit)

    // Initialize caches
    const { sizeMatchCacheByBrand } = initializeSearchCaches(brands)

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

    const trending = await getTrendingOrRandomProducts(limit, wishlistSet, userMeasurements.gender)
    res.status(StatusCodes.OK).json({ data: trending })
  }),

  getProductDetails: asyncMiddleware(async (req, res) => {
    const { productId, userId } = req.query

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
    let gender = product.gender
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
    console.log('subCategory', subCategory)
    if (isJCrew && subCategory === 'bottoms' && category === 'denim') {
      gender = 'female'
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
    console.log('sizeChart', sizeChart, unit, gender, categoryKey)
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
      measurementType,
      product.sizes,
      isJCrew
    )
    console.log('bestFit', bestFit)
    if (!bestFit) {
      return res.status(StatusCodes.OK).json({
        product,
        recommendedSize: null,
        alterationRequired: null,
        attributeDifferences: null,
        similarProducts,
        message: 'No size match found based on your measurements.',
      })
    }
    const sizeMatchCacheByBrand = {}
    sizeMatchCacheByBrand[brand] = {}
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

    const filteredSizes = matchingSizes.filter(
      (s) =>
        s.name === bestFit.name &&
        s.numericalSize === bestFit.numericalSize &&
        s.numericalValue === bestFit.numericalValue
    )

    // Create size set for checking availability
    const sizeSet = new Set(
      filteredSizes.flatMap(({ name, numericalSize, numericalValue }) => [name, numericalSize, numericalValue])
    )

    const matchingAvailableSizes = getAvailableSizes(product, sizeSet, isJCrew)

    console.log('matchingAvailableSizes', matchingAvailableSizes)
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
    console.log('matchingAvailableSizes', matchingAvailableSizes)
    // Find the first matching size that exists in product.sizes
    const recommendedSizeObj =
      matchingAvailableSizes.find((s) => {
        const sizeKey = isJCrew ? stripSuffix(s.size) : s.size
        return sizeCandidates.includes(sizeKey)
      }) || null

    const recommendedSize = recommendedSizeObj?.size || null

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
    const { searchText, category, brand } = req.query
    const userId = req.decoded._id

    if (!searchText || searchText.trim().length === 0) {
      return res.status(StatusCodes.BAD_REQUEST).json({ message: 'searchText param is required.' })
    }
    const user = await UserMeasurement.findOne({ userId }).lean()
    if (!user) {
      return res.status(404).json({ message: 'User not found.' })
    }
    // Create case-insensitive regex for partial matching
    const regex = new RegExp(searchText, 'i')

    // Build query object
    const query = {
      name: regex,
      gender: user.gender,
    }
    if (brand) {
      query.brand = brand
    } else {
      query.brand = { $ne: 'Sabo_Skirt' }
    }
    // Add category only if it exists and is non-empty
    if (category && category.trim() !== '') {
      query.category = category
    }

    const suggestions = await Product.find(query).limit(6).select('name').lean()

    return res.status(StatusCodes.OK).json({
      suggestions,
    })
  }),
}
