// * Libraries
import { StatusCodes } from 'http-status-codes'
import dotenv from 'dotenv'
import { Product, SizeChart, UserMeasurement } from '../models'
import { asyncMiddleware } from '../middlewares'
import { determineSubCategory, getCategoriesName } from '../utils/categoryConfig'
import { aggregateProductsByBrandAndCategory, getCategoryCounts, getMatchingSizes } from '../utils'

dotenv.config()
function findGreatFitSize(productSizes, userMeasurements, fitType) {
  const { bust, waist, hip, sleeves } = userMeasurements;

  // First sort sizes by measurements to establish size order
  const sortedSizes = productSizes
    .filter(size => size.measurements && size.measurements.bust != null)
    .sort((a, b) => {
      // Parse measurements to numbers for comparison
      const bustA = parseFloat(a.measurements.bust);
      const bustB = parseFloat(b.measurements.bust);
      return bustA - bustB;
    });

  if (sortedSizes.length === 0) return null;

  // Find the index of the size that matches user's measurements
  let matchingIndex = sortedSizes.findIndex(sizeObj => {
    const measurements = sizeObj.measurements;
    const bustMatch = compareBaseMeasurement(measurements.bust, bust);
    const waistMatch = compareBaseMeasurement(measurements.waist, waist);

    // For tops/dresses, prioritize bust match
    return bustMatch && (waistMatch || !waist);
  });

  if (matchingIndex === -1) return null;

  // Adjust the size based on fitType
  switch (fitType) {
    case 'fitted':
      return sortedSizes[matchingIndex];
    case 'loose':
      // Return next larger size if available
      return sortedSizes[matchingIndex + 1] || sortedSizes[matchingIndex];
    case 'tight':
      // Return next smaller size if available
      return sortedSizes[matchingIndex - 1] || sortedSizes[matchingIndex];
    default:
      return sortedSizes[matchingIndex];
  }
}

// Helper function to compare measurements accounting for ranges
function compareBaseMeasurement(productMeasurement, userMeasurement) {
  if (!productMeasurement || !userMeasurement) return false;

  // Handle range measurements (e.g., "35-36")
  if (typeof productMeasurement === 'string' && productMeasurement.includes('-')) {
    const [min, max] = productMeasurement.split('-').map(Number);
    return userMeasurement >= min && userMeasurement <= max;
  }

  // Handle single measurements
  const measurement = parseFloat(productMeasurement);
  return Math.abs(measurement - userMeasurement) <= 0; // Allow 0.5 unit tolerance
}

function parseMeasurementRange(measurement) {
  if (!measurement) return [];

  const measurementStr = measurement.toString().trim();

  // Handle range format like "35-36"
  if (measurementStr.includes('-')) {
    const [start, end] = measurementStr.split('-').map(num => parseFloat(num.trim()));
    return [start, end];
  }

  // Handle comma-separated format like "35,36,37,38" or quoted values like "35", "36", "37", "38"
  if (measurementStr.includes(',')) {
    return measurementStr
      .split(',')
      .map(num => parseFloat(num.trim().replace(/['"]/g, ''))) // Remove quotes and trim
      .filter(num => !isNaN(num)); // Filter out invalid numbers
  }

  // Handle single value like "35" or 35
  const singleValue = parseFloat(measurementStr.replace(/['"]/g, ''));
  return isNaN(singleValue) ? [] : [singleValue];
}

// Helper function to get the primary measurement value for sorting
function getPrimaryMeasurement(measurement) {
  const values = parseMeasurementRange(measurement);
  return values.length > 0 ? Math.min(...values) : 0;
}

// Helper function to determine the best fit based on user measurement and fit type
function getBestFitForMeasurement(userMeasurement, sizeMeasurement, fitType) {
  const measurementValues = parseMeasurementRange(sizeMeasurement);

  if (measurementValues.length === 0) return { fits: false, score: Infinity };

  switch (fitType) {
    // case 'fitted':
    //   // For fitted, look for exact match only
    //   if (measurementValues.includes(userMeasurement)) {
    //     return { fits: true, score: 0, matchType: 'fitted' };
    //   }
    //   // Find closest value for scoring
    //   const closestFitted = measurementValues.reduce((closest, val) =>
    //     Math.abs(val - userMeasurement) < Math.abs(closest - userMeasurement) ? val : closest
    //   );
    //   return { fits: false, score: Math.abs(closestFitted - userMeasurement), matchType: 'fitted' };
    case 'fitted':
      // For fitted, look for exact match only
      if (measurementValues.includes(userMeasurement)) {
        return { fits: true, score: 0, matchType: 'fitted' };
      }
      // If no exact match, do NOT return closest — just no fit
      return { fits: false, score: Infinity, matchType: 'fitted' };
    case 'tight':
      // For tight fit, prefer sizes smaller than user measurement (not equal)
      const smallerValues = measurementValues.filter(val => val < userMeasurement);
      if (smallerValues.length > 0) {
        const bestTight = Math.max(...smallerValues); // Closest smaller value
        return { fits: true, score: userMeasurement - bestTight, matchType: 'tight' };
      }
      // If no smaller values, find closest for fallback
      const closestTight = measurementValues.reduce((closest, val) =>
        Math.abs(val - userMeasurement) < Math.abs(closest - userMeasurement) ? val : closest
      );
      return { fits: false, score: Math.abs(closestTight - userMeasurement), matchType: 'tight' };

    case 'loose':
      // For loose fit, prefer sizes larger than user measurement (not equal)
      const largerValues = measurementValues.filter(val => val > userMeasurement);
      if (largerValues.length > 0) {
        const bestLoose = Math.min(...largerValues); // Closest larger value
        return { fits: true, score: bestLoose - userMeasurement, matchType: 'loose' };
      }
      // If no larger values, find closest for fallback
      const closestLoose = measurementValues.reduce((closest, val) =>
        Math.abs(val - userMeasurement) < Math.abs(closest - userMeasurement) ? val : closest
      );
      return { fits: false, score: Math.abs(closestLoose - userMeasurement), matchType: 'loose' };

    default:
      return { fits: false, score: Infinity, matchType: 'fitted' };
  }
}

// Enhanced function to find best fit based on bust measurements
function findBestFitByBust(sizeChart, userMeasurements, fitType) {
  const { bust: userBust } = userMeasurements;

  if (!userBust || !sizeChart) return null;

  // Convert size chart to array and sort by bust measurement
  const sortedSizes = sizeChart
    .map(size => ({
      name: size.name,
      measurements: size.measurements,
      bustValue: getPrimaryMeasurement(size.measurements.bust),
      numericalSize: size.numericalSize,
      numericalValue: size.numericalValue
    }))
    .filter(size => size.measurements?.bust)  // ensure bust exists
    .sort((a, b) => a.bustValue - b.bustValue);


  // Find best fit based on fit type
  let bestFit = null;
  let bestScore = Infinity;
  const selectedLabels = new Set();
  for (const size of sortedSizes) {
    const bustMeasurement = size.measurements.bust;
    const fitResult = getBestFitForMeasurement(userBust, bustMeasurement, fitType);
    // Prioritize exact fits, then best scores
    if (fitResult.fits && fitResult.score === 0) {
      // Perfect match found
      return {
        name: size.name,
        numericalSize: size.numericalSize,
        numericalValue: size.numericalValue,
        measurements: size.measurements,
        fitMatch: fitType
      };
    }

    if (fitResult.fits) {
      // If this label already selected with the same score, skip this one
      if (selectedLabels.has(size.name)) {
        continue; // skip this duplicate label with same score
      }

      // If this candidate is better score or bestFit not set yet
      if (fitResult.score < bestScore || !bestFit) {
        bestScore = fitResult.score;
        bestFit = {
          name: size.name,
          numericalSize: size.numericalSize,
          numericalValue: size.numericalValue,
          measurements: size.measurements,
          fitMatch: fitType,
          difference: fitResult.score
        };
        selectedLabels.add(size.name);
      }
    } else {
      // If not fit, but better score and no fit found yet
      if (fitResult.score < bestScore && !bestFit) {
        bestScore = fitResult.score;
        bestFit = {
          name: size.name,
          numericalSize: size.numericalSize,
          numericalValue: size.numericalValue,
          measurements: size.measurements,
          fitMatch: fitType,
          difference: fitResult.score
        };
        selectedLabels.add(size.name);
      }
    }
  }

  return bestFit;
}

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
  // getProductDetails: asyncMiddleware(async (req, res) => {
  //   const { productId } = req.query;
  //   const userId = req.decoded._id;

  //   if (!productId || !userId) {
  //     return res.status(400).json({ message: 'productId and userId are required.' });
  //   }

  //   // Fetch product by ID
  //   const product = await Product.findById(productId).lean();
  //   if (!product) {
  //     return res.status(404).json({ message: 'Product not found.' });
  //   }

  //   const brand = product.brand;
  //   const gender = product.gender;
  //   const category = product.category;
  //   const name = product.name || '';

  //   // Fetch user measurements
  //   const user = await UserMeasurement.findOne({ userId }).lean();
  //   if (!user) {
  //     return res.status(404).json({ message: 'User not found.' });
  //   }

  //   const userBust = user.upperBody?.bust?.value || user.upperBody?.chest?.value;
  //   const userWaist = user.lowerBody?.waist?.value;
  //   const userHip = user.lowerBody?.hip?.value;
  //   const userSleeves = user.upperBody?.sleevesLength?.value;
  //   const unit = user.lowerBody?.waist?.unit;
  //   const fitType = user.fit;

  //   // Determine sub-category if applicable
  //   const subCategory = category === 'denim'
  //     ? determineSubCategory(category, name)
  //     : category;

  //   const isTopsCategory = ['tops', 'outerwear', 'dresses'].includes(subCategory);
  //   const categoryKey = isTopsCategory ? 'tops' : 'bottoms';

  //   // Fetch size chart for brand
  //   const sizeChartDoc = await SizeChart.findOne(
  //     { brand },
  //     { brand: 1, [`sizeChart.${unit}`]: 1 }
  //   ).lean();

  //   const sizeChart = sizeChartDoc?.sizeChart?.[unit]?.[gender]?.[categoryKey]
  //     || sizeChartDoc?.sizeChart?.[unit]?.default;

  //   if (!sizeChart) {
  //     return res.status(404).json({ message: `No size chart found for brand ${brand} and unit ${unit}.` });
  //   }

  //   // Use the findGreatFitSize function to find the best fitting size
  //   // Inside getProductDetails controller:
  //   const bestFit = findGreatFitSize(sizeChart, {
  //     bust: userBust,
  //     waist: userWaist,
  //     hip: userHip,
  //     sleeves: userSleeves
  //   }, fitType);

  //   if (!bestFit) {
  //     return res.status(200).json({
  //       product,
  //       recommendedSize: null,
  //       message: 'No size match found based on your measurements.'
  //     });
  //   }

  //   const isSizeAvailable = product.sizes?.some(s =>
  //     (s.size === bestFit.name || s.size === bestFit.numericalSize) && s.inStock
  //   );

  //   return res.status(200).json({
  //     product,
  //     recommendedSize: bestFit.name || bestFit.numericalSize,
  //     measurements: bestFit.measurements,
  //     fitType,
  //     alterationRequired: bestFit.alterationRequired,
  //     isSizeAvailable
  //   });
  // })
  // Helper function to parse measurement ranges like "35-36", "35,36,37,38", or single values like "35"

  // Main controller function
  getProductDetails: asyncMiddleware(async (req, res) => {
    const { productId } = req.query;
    const userId = req.decoded._id;

    if (!productId || !userId) {
      return res.status(400).json({ message: 'productId and userId are required.' });
    }

    // Fetch product by ID
    const product = await Product.findById(productId).lean();
    if (!product) {
      return res.status(404).json({ message: 'Product not found.' });
    }

    const brand = product.brand;
    const gender = product.gender;
    const category = product.category;
    const name = product.name || '';

    // Fetch user measurements
    const user = await UserMeasurement.findOne({ userId }).lean();
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const userBust = user.upperBody?.bust?.value || user.upperBody?.chest?.value;
    const userWaist = user.lowerBody?.waist?.value;
    const userHip = user.lowerBody?.hip?.value;
    const userSleeves = user.upperBody?.sleevesLength?.value;
    const unit = user.lowerBody?.waist?.unit;
    const fitType = user.fit;

    // Determine sub-category if applicable
    const subCategory = category === 'denim'
      ? determineSubCategory(category, name)
      : category;

    const isTopsCategory = ['tops', 'outerwear', 'dresses'].includes(subCategory);
    const categoryKey = isTopsCategory ? 'tops' : 'bottoms';

    // Fetch size chart for brand
    const sizeChartDoc = await SizeChart.findOne(
      { brand },
      { brand: 1, [`sizeChart.${unit}`]: 1 }
    ).lean();

    const sizeChart = sizeChartDoc?.sizeChart?.[unit]?.[gender]?.[categoryKey]
      || sizeChartDoc?.sizeChart?.[unit]?.default;

    if (!sizeChart) {
      return res.status(404).json({
        message: `No size chart found for brand ${brand} and unit ${unit}.`
      });
    }

    // Use the enhanced bust-based size matching for tops
    let bestFit;
    if (isTopsCategory && userBust) {
      bestFit = findBestFitByBust(sizeChart, {
        bust: userBust,
        waist: userWaist,
        hip: userHip,
        sleeves: userSleeves
      }, fitType);
    } else {
      // Fall back to original function for bottoms or when bust is not available
      bestFit = findGreatFitSize(sizeChart, {
        bust: userBust,
        waist: userWaist,
        hip: userHip,
        sleeves: userSleeves
      }, fitType);
    }

    if (!bestFit) {
      return res.status(200).json({
        product,
        recommendedSize: null,
        message: 'No size match found based on your measurements.'
      });
    }

    // Check if recommended size is available in product
    const isSizeAvailable = product.sizes?.some(s => {
      const sizeToCheck = bestFit.name || bestFit.numericalSize || bestFit.numericalValue;
      return (s.size === sizeToCheck ||
        s.size === bestFit.name ||
        s.size === bestFit.numericalSize ||
        s.size === bestFit.numericalValue) && s.inStock;
    });

    return res.status(200).json({
      product,
      recommendedSize: bestFit.name || bestFit.numericalSize || bestFit.numericalValue,
      measurements: bestFit.measurements,
      isSizeAvailable,
      difference: bestFit.difference || 0
    });
  })


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
