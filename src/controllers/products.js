// * Libraries
import { StatusCodes } from 'http-status-codes'
import dotenv from 'dotenv'
import { Product, SizeChart, UserMeasurement } from '../models'
import { asyncMiddleware } from '../middlewares'
import { determineSubCategory, getCategoriesName } from '../utils/categoryConfig'
import { aggregateProductsByBrandAndCategory, getCategoryCounts, getMatchingSizes } from '../utils'

dotenv.config()

export const CONTROLLER_PRODUCT = {

  getCategoryCountsAcrossBrands: asyncMiddleware(async (req, res) => {
    const categories = getCategoriesName();
    const brand = req.query.brand; // single brand string or undefined

    const categoryCounts = await getCategoryCounts(categories, brand);

    return res.status(200).json({
      data: categoryCounts,
    });
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

    // Convert array of { brand, categories } to object { brand: { categories } }
    const groupedByBrand = {}
    for (const item of groupedResults) {
      groupedByBrand[item.brand] = item.categories
    }

    // Count total number of matched products (without pagination)
    const totalCount = await Product.countDocuments({
      ...(brands.length && { brand: { $in: brands } }),
      ...(categories.length && { category: { $in: categories } }),
    })

    return res.status(200).json({
      results: totalCount,
      data: groupedByBrand,
    })
  }),

  getRecommendedProducts: asyncMiddleware(async (req, res) => {
    const BATCH_SIZE = 20 // Number of products to fetch in each database query
    const { brands, category, PAGE_SIZE = 10, fitType = 'fitted' } = req.query
    const userId = req.decoded._id

    // Parse skip values for each brand
    const skipParam = req.query.skip || '{}'
    const skipValues = typeof skipParam === 'string' ? JSON.parse(skipParam) : skipParam

    // Parse brands parameter (could be a single brand or an array)
    const brandsArray = Array.isArray(brands) ? brands : brands.split(',')

    if (!brands || !userId || !category) {
      return res.status(400).json({ message: 'brands, category, and userId are required' })
    }

    // Fetch user measurements
    const user = await UserMeasurement.findOne({ userId }).lean()

    if (!user) {
      return res.status(404).json({ message: 'User not found.' })
    }

    const userBust = user.upperBody?.bust?.value || user.upperBody?.chest?.value
    const userWaist = user.lowerBody?.waist?.value
    const userHip = user.lowerBody?.hip?.value
    const unit = user.lowerBody?.waist?.unit
    const userSleeves = user.upperBody?.sleevesLength?.value
    const gender = user.gender

    // Calculate products per brand - distribute evenly
    const numBrands = brandsArray.length
    const productsPerBrand = Math.ceil(PAGE_SIZE / numBrands)

    // Set up result structure
    const result = {}
    brandsArray.forEach((brand) => {
      result[brand] = { [category]: [] }
    })

    // Keep track of processed products per brand
    const productsProcessed = {}
    const nextSkipValues = {}

    // Initialize counters for each brand
    brandsArray.forEach((brand) => {
      productsProcessed[brand] = 0
      nextSkipValues[brand] = skipValues[brand] || 0
    })

    const sizeChartDocs = await SizeChart.find(
      { brand: { $in: brandsArray } },
      { brand: 1, [`sizeChart.${unit}`]: 1 }
    ).lean()
    const sizeChartMap = {}
    sizeChartDocs.forEach((doc) => {
      const chart = doc.sizeChart?.[unit]
      if (chart) {
        sizeChartMap[doc.brand] = chart // Keep entire unit-level chart
      }
    })

    // Create size match cache per brand
    const sizeMatchCacheByBrand = {}
    const subCategoryCacheByBrand = {}

    // Process each brand to find matching products
    const processPromises = brandsArray.map(async (brand) => {
      // Initialize caches for this brand
      sizeMatchCacheByBrand[brand] = {}
      subCategoryCacheByBrand[brand] = new Map()

      // Process products in batches until we have enough matches
      const matchedProducts = []
      let currentSkip = skipValues[brand] || 0
      let hasMoreProducts = true

      while (matchedProducts.length < productsPerBrand && hasMoreProducts) {
        const productsBatch = await Product.aggregate([
          {
            $match: {
              brand,
              category,
              gender
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
          productsProcessed[brand]++

          const name = product.name || ''
          const gender = product.gender
          const subCategoryCache = subCategoryCacheByBrand[brand]
          const subCategory =
            category === 'denim' ? subCategoryCache.get(name) || determineSubCategory(category, name) : category
          if (category === 'denim' && !subCategoryCache.has(name)) {
            subCategoryCache.set(name, subCategory)
          }

          const isTopsCategory = subCategory === 'tops' || subCategory === 'outerwear' || subCategory === 'dresses'
          const categoryKey = isTopsCategory ? 'tops' : 'bottoms'
          const sizeChart = sizeChartMap[brand]?.[gender]?.[categoryKey] || sizeChartMap[brand]?.default || null

          if (!sizeChart) {
            console.warn(`No sizeChart found for brand ${brand} with unit ${unit}`)
            continue
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
          const filteredSizes = matchingSizes.filter(s => s.fitType === fitType);
          const sizeSet = new Set(filteredSizes.flatMap(({ name, numericalSize }) => [name, numericalSize]))

          const availableSizes = product.sizes?.filter((s) => sizeSet.has(s.size) && s.inStock);

          if (availableSizes?.length) {
            const alterationRequired = !availableSizes.some(s => {
              const match = filteredSizes.find(m => m.name === s.size || m.numericalSize === s.size);
              return match?.alterationRequired === false;
            });

            matchedProducts.push({
              product,
              alterationRequired, // only this single flag returned now
            });
          }

          //  const sizeSet = new Set(matchingSizes.flatMap(({ name, numericalSize }) => [name, numericalSize]))

          // const availableSizes = product.sizes?.filter((s) => sizeSet.has(s.size) && s.inStock)
          // if (availableSizes?.length) {
          //   matchedProducts.push({
          //     product,
          //     matchedSizes: availableSizes.map((s) => s.size),
          //   })
          // }

          if (matchedProducts.length >= productsPerBrand) {
            nextSkipValues[brand] = currentSkip + i + 1
            break
          }
        }

        currentSkip += productsBatch.length
      }

      // If we didn't get enough products and there are no more, set nextSkip to null for this brand
      if (matchedProducts.length < productsPerBrand && !hasMoreProducts) {
        nextSkipValues[brand] = null
      }

      return { brand, products: matchedProducts }
    })

    // Wait for all brand processing to complete
    const brandResults = await Promise.all(processPromises)

    // Organize results by brand
    brandResults.forEach(({ brand, products }) => {
      result[brand][category] = products
    })

    // Calculate the total number of matched products across all brands
    const totalMatched = Object.values(result).reduce((total, brandData) => {
      return total + brandData[category].length
    }, 0)

    // Determine if there are more products for any brand
    const hasMoreForAnyBrand = Object.values(nextSkipValues).some((value) => value !== null)

    return res.status(200).json({
      pageSize: PAGE_SIZE,
      totalMatched,
      productsPerBrand,
      productsProcessed,
      nextSkip: hasMoreForAnyBrand ? nextSkipValues : null,
      data: result,
    })
  }),

  migrateProducts: asyncMiddleware(async (req, res) => {
    const flatProducts = await Product.find({})

    console.log(`🔁 Copying ${flatProducts.length} products to "products" collection...`)
    await Product.insertMany(flatProducts)
    console.log(`✅ Migrated ${flatProducts.length} products`)
  }),
}

// getRecommendedProducts: asyncMiddleware(async (req, res) => {
//   const BATCH_SIZE = 20 // Number of products to fetch in each database query
//   const { brands, category, PAGE_SIZE = 10 } = req.query
//   const userId = req.decoded._id

//   // Parse skip values for each brand
//   const skipParam = req.query.skip || '{}'
//   const skipValues = typeof skipParam === 'string' ? JSON.parse(skipParam) : skipParam

//   // Parse brands parameter (could be a single brand or an array)
//   const brandsArray = Array.isArray(brands) ? brands : brands.split(',')

//   if (!brands || !userId || !category) {
//     return res.status(400).json({ message: 'brands, category, and userId are required' })
//   }

//   // Fetch user measurements
//   const user = await UserMeasurement.findOne(
//     { userId },
//     {
//       'upperBody.bust.value': 1,
//       'upperBody.chest.value': 1,
//       'lowerBody.waist.value': 1,
//       'lowerBody.hip.value': 1,
//       'lowerBody.waist.unit': 1,
//       _id: 0,
//     }
//   ).lean()

//   if (!user) {
//     return res.status(404).json({ message: 'User not found.' })
//   }

//   const userBust = user.upperBody?.bust?.value || user.upperBody?.chest?.value
//   const userWaist = user.lowerBody?.waist?.value
//   const userHip = user.lowerBody?.hip?.value
//   const unit = user.lowerBody?.waist?.unit
//   // Calculate products per brand - distribute evenly
//   const numBrands = brandsArray.length
//   const productsPerBrand = Math.ceil(PAGE_SIZE / numBrands)

//   // Set up result structure
//   const result = {}
//   brandsArray.forEach((brand) => {
//     result[brand] = { [category]: [] }
//   })

//   // Keep track of processed products per brand
//   const productsProcessed = {}
//   const nextSkipValues = {}

//   // Initialize counters for each brand
//   brandsArray.forEach((brand) => {
//     productsProcessed[brand] = 0
//     nextSkipValues[brand] = skipValues[brand] || 0
//   })

//   const sizeChartDocs = await SizeChart.find(
//     { brand: { $in: brandsArray } },
//     { brand: 1, [`sizeChart.${unit}`]: 1 }
//   ).lean()
//   const sizeChartMap = {}
//   sizeChartDocs.forEach((doc) => {
//     const chart = doc.sizeChart?.[unit]
//     if (chart) {
//       sizeChartMap[doc.brand] = chart // Keep entire unit-level chart
//     }
//   })

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
//       // Fetch a batch of products using aggregation
//       const productsBatch = await Product.aggregate([
//         { $project: { [`products.${brand}.${category}`]: 1, _id: 0 } },
//         { $unwind: `$products.${brand}.${category}` },
//         { $skip: currentSkip },
//         { $limit: BATCH_SIZE },
//         {
//           $group: {
//             _id: null,
//             products: { $push: `$products.${brand}.${category}` },
//           },
//         },
//       ])

//       // If no products returned, we've reached the end
//       if (!productsBatch.length || !productsBatch[0].products || !productsBatch[0].products.length) {
//         hasMoreProducts = false
//         break
//       }

//       const batchProducts = productsBatch[0].products

//       // Process products in this batch
//       for (let i = 0; i < batchProducts.length; i++) {
//         const product = batchProducts[i]
//         productsProcessed[brand]++

//         const name = product.name || ''
//         const subCategoryCache = subCategoryCacheByBrand[brand]
//         const gender = product.gender
//         console.log('gender', gender)
//         const subCategory =
//           category === 'denim' ? subCategoryCache.get(name) || determineSubCategory(category, name) : category
//         if (category === 'denim' && !subCategoryCache.has(name)) {
//           subCategoryCache.set(name, subCategory)
//         }
//         const isTopsCategory = subCategory === 'tops' || subCategory === 'outerwear' || subCategory === 'dresses'
//         const categoryKey = isTopsCategory ? 'tops' : 'bottoms'
//         console.log('categoryKey', categoryKey)
//         const sizeChart = sizeChartMap[brand]?.[gender]?.[categoryKey] || sizeChartMap[brand]?.default || null
//         console.log('sizeChart', sizeChart)
//         if (!sizeChart) {
//           console.warn(`No sizeChart found for brand ${brand} with unit ${unit}`)
//           return []
//         }

//         const matchingSizes = getMatchingSizes(
//           brand,
//           subCategory,
//           sizeChart,
//           sizeMatchCacheByBrand,
//           userBust,
//           userWaist,
//           userHip
//         )
//         const sizeSet = new Set(matchingSizes.flatMap(({ name, numericalSize }) => [name, numericalSize]))

//         const availableSizes = product.sizes?.filter((s) => sizeSet.has(s.size) && s.inStock)
//         if (availableSizes?.length) {
//           matchedProducts.push({
//             product,
//             matchedSizes: availableSizes.map((s) => s.size),
//           })
//         }

//         // Stop processing once we have enough products for this brand
//         if (matchedProducts.length >= productsPerBrand) {
//           // Set the next skip value to continue from where we left off
//           nextSkipValues[brand] = currentSkip + i + 1
//           break
//         }
//       }

//       // Update skip for next batch
//       currentSkip += batchProducts.length
//     }

//     // If we didn't get enough products and there are no more, set nextSkip to null for this brand
//     if (matchedProducts.length < productsPerBrand && !hasMoreProducts) {
//       nextSkipValues[brand] = null
//     }

//     return { brand, products: matchedProducts }
//   })

//   // Wait for all brand processing to complete
//   const brandResults = await Promise.all(processPromises)

//   // Organize results by brand
//   brandResults.forEach(({ brand, products }) => {
//     result[brand][category] = products
//   })

//   // Calculate the total number of matched products across all brands
//   const totalMatched = Object.values(result).reduce((total, brandData) => {
//     return total + brandData[category].length
//   }, 0)

//   // Determine if there are more products for any brand
//   const hasMoreForAnyBrand = Object.values(nextSkipValues).some((value) => value !== null)

//   return res.status(200).json({
//     pageSize: PAGE_SIZE,
//     totalMatched,
//     productsPerBrand,
//     productsProcessed,
//     nextSkip: hasMoreForAnyBrand ? nextSkipValues : null,
//     data: result,
//   })
// }),
