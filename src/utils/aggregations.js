// utils.js
import { Product, ProductMetrics } from '../models'

// export const aggregateProductsByBrandAndCategory = (
//   brands = [],
//   categories = [],
//   gender = 'male',
//   page = 1,
//   limit = 10
// ) => {
//   const match = {}
//   if (brands.length) match.brand = { $in: brands }
//   if (categories.length) match.category = { $in: categories }
//   if (gender) match.gender = gender

//   const ITEMS_PER_GROUP = Number(limit)
//   const skip = (Number(page) - 1) * ITEMS_PER_GROUP

//   return [
//     { $match: match },
//     {
//       $group: {
//         _id: { brand: '$brand', category: '$category' },
//         products: { $push: '$$ROOT' },
//       },
//     },
//     {
//       $project: {
//         brand: '$_id.brand',
//         category: '$_id.category',
//         products: { $slice: ['$products', skip, ITEMS_PER_GROUP] },
//       },
//     },
//     {
//       $group: {
//         _id: '$brand',
//         categories: {
//           $push: {
//             k: '$category',
//             v: '$products',
//           },
//         },
//       },
//     },
//     {
//       $project: {
//         _id: 0,
//         brand: '$_id',
//         categories: { $arrayToObject: '$categories' },
//       },
//     },
//   ]
// }

export const aggregateProductsByBrandAndCategory = (
  brands = [],
  categories = [],
  gender = 'male',
  page = 1,
  limit = 10
) => {
  const match = {}
  if (brands.length) match.brand = { $in: brands }
  if (categories.length) match.category = { $in: categories }
  if (gender) match.gender = gender

  const ITEMS_PER_GROUP = Number(limit)
  const skip = (Number(page) - 1) * ITEMS_PER_GROUP

  return [
    { $match: match },
    // Add this $project stage to include only needed fields
    {
      $project: {
        _id: 1,
        name: 1,
        price: 1,
        'image.primary': 1,
        brand: 1,
        category: 1,
      },
    },
    {
      $group: {
        _id: '$category',
        products: { $push: '$$ROOT' }, // products will contain only the projected fields now
      },
    },
    {
      $project: {
        _id: 0,
        category: '$_id',
        products: { $slice: ['$products', skip, ITEMS_PER_GROUP] },
      },
    },
  ]
}

export const getCategoryCounts = async (categories, brand, ProductModel) => {
  const matchCriteria = {
    category: { $in: categories },
  }

  if (brand) {
    matchCriteria.brand = brand // single brand string, no array
  }

  const counts = await Product.aggregate([
    { $match: matchCriteria },
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 },
      },
    },
    {
      $project: {
        _id: 0,
        category: '$_id',
        count: 1,
      },
    },
  ])

  const categoryCounts = {}
  for (const cat of categories) {
    const found = counts.find((c) => c.category === cat)
    categoryCounts[cat] = found ? found.count : 0
  }

  return categoryCounts
}

export const getTrendingProducts = async (limit, wishlistSet, gender) => {
  const trending = await ProductMetrics.aggregate([
    {
      $lookup: {
        from: 'products', // MongoDB collection name for products
        localField: 'productId',
        foreignField: '_id',
        as: 'product',
      },
    },
    { $unwind: '$product' },
    {
      $match: {
        'product.gender': gender,
      },
    },
    { $sort: { clickCount: -1 } },
    { $limit: limit },
    {
      $project: {
        clickCount: 1,
        _id: '$product._id',
        name: '$product.name',
        price: '$product.price',
        image: { primary: '$product.image.primary' },
      },
    },
  ])
  return trending.map((item) => ({
    _id: item._id,
    name: item.name,
    price: item.price,
    image: item.image,
    clickCount: item.clickCount,
    isWishlist: wishlistSet.has(item._id.toString()),
  }))
}

export const getTrendingOrRandomProducts = async (limit, wishlistSet, gender) => {
  const trending = await getTrendingProducts(limit, wishlistSet, gender)
  const trendingIds = trending.map((item) => item._id)
  const remaining = limit - trending.length

  let random = []
  if (remaining > 0) {
    random = await Product.aggregate([
      {
        $match: {
          gender: gender,
          _id: { $nin: trendingIds },
          brand: { $ne: 'Sabo_Skirt' },
        },
      },
      { $sample: { size: remaining } },
      {
        $project: {
          _id: 1,
          name: 1,
          price: 1,
          image: { primary: '$image.primary' },
        },
      },
    ])

    random = random.map((item) => ({
      _id: item._id,
      name: item.name,
      price: item.price,
      image: item.image,
      clickCount: 0,
      isWishlist: wishlistSet.has(item._id.toString()),
    }))
  }

  return [...trending, ...random]
}

export const getSimilarProducts = async (product, wishlistSet) => {
  if (!product || !product._id || !product.category || !product.brand || !product.gender) {
    throw new Error('Invalid product object passed to getSimilarProducts.')
  }

  const similarProducts = await Product.aggregate([
    {
      $match: {
        _id: { $ne: product._id },
        category: product.category,
        brand: product.brand,
        gender: product.gender,
      },
    },
    { $sample: { size: 4 } },
    {
      $project: {
        name: 1,
        price: 1,
        primaryImage: '$image.primary',
      },
    },
  ])

  // Add isWishlist field to each product
  return similarProducts.map((product) => ({
    ...product,
    isWishlist: wishlistSet.has(String(product._id)),
  }))
}
