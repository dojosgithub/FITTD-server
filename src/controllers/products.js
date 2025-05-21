// * Libraries
import { StatusCodes } from 'http-status-codes'
import dotenv from 'dotenv'
import { Product, ProductFlat, SizeChart, UserMeasurement } from '../models'
import { asyncMiddleware } from '../middlewares'
import { determineSubCategory } from '../utils/categoryConfig'
import { aggregateProductsByBrandAndCategory, getMatchingSizes } from '../utils'

dotenv.config()

export const CONTROLLER_PRODUCT = {
  // Get all wishlist items for user
  getProducts: asyncMiddleware(async (req, res) => {
    const { _id: userId } = req.decoded

    const items = await Product.find()

    return res.status(StatusCodes.OK).json({ data: items })
  }),

  // getByBrandsAndCategories: asyncMiddleware(async (req, res) => {
  //   let { brand, category } = req.query

  //   // Validate query params
  //   if (!brand && !category) {
  //     return res.status(400).json({ message: "At least one query param ('brand' or 'category') is required." })
  //   }

  //   // Parse query params to arrays
  //   const brands = brand?.split(',').map((b) => b.trim()) || []
  //   const categories = category?.split(',').map((c) => c.trim()) || []

  //   // Fetch product data
  //   const allProductsDoc = await Product.findOne()
  //   if (!allProductsDoc) {
  //     return res.status(404).json({ message: 'No products found.' })
  //   }

  //   const productsMap = allProductsDoc.products
  //   const result = {}

  //   // Case: Only category is provided → search across all brands for those categories
  //   if (!brands.length && categories.length) {
  //     for (const [brandName, brandData] of productsMap.entries()) {
  //       const matchedCategories = {}
  //       for (const cat of categories) {
  //         matchedCategories[cat] = Array.isArray(brandData[cat]) ? brandData[cat] : []
  //       }
  //       result[brandName] = matchedCategories
  //     }
  //   }

  //   // Case: Only brand is provided → return all categories for that brand
  //   else if (brands.length && !categories.length) {
  //     for (const b of brands) {
  //       const brandData = productsMap.get(b)
  //       if (!brandData) {
  //         result[b] = {} // Brand not found, still include empty object
  //         continue
  //       }

  //       const plainBrandData = brandData.toObject() // <-- Fix

  //       result[b] = {}
  //       for (const cat in plainBrandData) {
  //         result[b][cat] = Array.isArray(plainBrandData[cat]) ? plainBrandData[cat] : []
  //       }
  //     }
  //   }

  //   // Case: Both brand & category are provided → filter selected brands for selected categories
  //   else if (brands.length && categories.length) {
  //     for (const b of brands) {
  //       const brandData = productsMap.get(b)
  //       result[b] = {}

  //       for (const cat of categories) {
  //         result[b][cat] = brandData?.[cat] ?? []
  //       }
  //     }
  //   }

  //   let totalCount = 0

  //   // Calculate total number of products
  //   for (const brand in result) {
  //     for (const category in result[brand]) {
  //       totalCount += result[brand][category].length
  //     }
  //   }

  //   return res.status(StatusCodes.OK).json({
  //     results: totalCount,
  //     data: result,
  //   })
  // }),

  getByBrandsAndCategories: asyncMiddleware(async (req, res) => {
    const { brand, category, page = 1, limit = 10 } = req.query

    if (!brand && !category) {
      return res.status(400).json({
        message: "At least one query param ('brand' or 'category') is required.",
      })
    }

    const brands = brand?.split(',').map((b) => b.trim()) || []
    const categories = category?.split(',').map((c) => c.trim()) || []

    const aggregationPipeline = aggregateProductsByBrandAndCategory(brands, categories, page, limit)

    const groupedResults = await ProductFlat.aggregate(aggregationPipeline)

    if (!groupedResults.length) {
      return res.status(404).json({ message: 'No matching products found.' })
    }

    // Convert array of { brand, categories } to object { brand: { categories } }
    const groupedByBrand = {}
    for (const item of groupedResults) {
      groupedByBrand[item.brand] = item.categories
    }

    // Count total number of matched products (without pagination)
    const totalCount = await ProductFlat.countDocuments({
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
    const { brands, category, PAGE_SIZE = 10 } = req.query
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
    const user = await UserMeasurement.findOne(
      { userId },
      {
        'upperBody.bust.value': 1,
        'upperBody.chest.value': 1,
        'lowerBody.waist.value': 1,
        'lowerBody.hip.value': 1,
        'lowerBody.waist.unit': 1,
        _id: 0,
      }
    ).lean()

    if (!user) {
      return res.status(404).json({ message: 'User not found.' })
    }

    const userBust = user.upperBody?.bust?.value || user.upperBody?.chest?.value
    const userWaist = user.lowerBody?.waist?.value
    const userHip = user.lowerBody?.hip?.value
    const unit = user.lowerBody?.waist?.unit
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
        const productsBatch = await ProductFlat.aggregate([
          {
            $match: {
              brand,
              category,
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
            userHip
          )
          const sizeSet = new Set(matchingSizes.flatMap(({ name, numericalSize }) => [name, numericalSize]))

          const availableSizes = product.sizes?.filter((s) => sizeSet.has(s.size) && s.inStock)
          if (availableSizes?.length) {
            matchedProducts.push({
              product,
              matchedSizes: availableSizes.map((s) => s.size),
            })
          }

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
    const oldDoc = await Product.findOne() // Assuming only one document with all products
    console.log('oldDoc', oldDoc)
    if (!oldDoc || !oldDoc.products) {
      console.log('No products found.')
      return
    }

    const flatProducts = []

    for (const [brand, brandData] of oldDoc.products.entries()) {
      console.log(`Processing brand: ${brand}`)
      for (const category of Object.keys(brandData.toObject())) {
        if (category === '_id') continue
        const productList = brandData[category]
        if (Array.isArray(productList)) {
          console.log(`  → Category: ${category}, ${productList.length} products`)
          for (const product of productList) {
            flatProducts.push({
              brand,
              category,
              ...product.toObject(), // convert Mongoose doc to plain JS object
            })
          }
        }
      }
    }

    // Insert into new collection
    await ProductFlat.insertMany(flatProducts)
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
