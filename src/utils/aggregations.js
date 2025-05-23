// utils.js
export const aggregateProductsByBrandAndCategory = (brands = [], categories = [], gender = "male", page = 1, limit = 10) => {
  const match = {}
  if (brands.length) match.brand = { $in: brands }
  if (categories.length) match.category = { $in: categories }
  if (gender) match.gender = gender

  const ITEMS_PER_GROUP = Number(limit)
  const skip = (Number(page) - 1) * ITEMS_PER_GROUP

  return [
    { $match: match },
    {
      $group: {
        _id: { brand: '$brand', category: '$category' },
        products: { $push: '$$ROOT' },
      },
    },
    {
      $project: {
        brand: '$_id.brand',
        category: '$_id.category',
        products: { $slice: ['$products', skip, ITEMS_PER_GROUP] },
      },
    },
    {
      $group: {
        _id: '$brand',
        categories: {
          $push: {
            k: '$category',
            v: '$products',
          },
        },
      },
    },
    {
      $project: {
        _id: 0,
        brand: '$_id',
        categories: { $arrayToObject: '$categories' },
      },
    },
  ]
}
