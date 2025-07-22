export const getCategoriesName = () => {
  return ['outerwear', 'denim', 'tops', 'bottoms', 'dresses', 'accessories', 'footwear']
}
export const createGroupedByType = () => ({
  denim: [],
  outerwear: [],
  tops: [],
  bottoms: [],
  dresses: [],
  accessories: [],
  footwear: [],
})

export const manualCategorizeProductByName = (name, ebDenim) => {
  const lower = name.toLowerCase()
  // Denim category
  const hasBoleroOrCorset = /(bolero|corset)/.test(lower)
  const hasDressOrTop = /(dress|sundress|gown|maxi|midi|mini|bridal|jumpsuit|top|skirt)/.test(lower)
  if (hasBoleroOrCorset && !hasDressOrTop) {
    return 'tops'
  }

  if (/denim|jean|jeans/.test(lower)) {
    return 'denim'
  }
  // Dresses category
  if (/(dress|bodysuit|sundress|gown|bridal|gown|jumpsuit|playsuit)/.test(lower)) {
    return 'dresses'
  }

  // Outerwear category
  if (
    /\b(cardigan|coat|jacket|blazer|hoodie|popover|vest|parka|anorak|windbreaker|half zip|half-zip|quarter zip|quarter-zip|full-zip|full zip)\b/.test(
      lower
    )
  ) {
    return 'outerwear'
  }
  // Footwear category
  if (
    /\b(heel|heels|boot|boots|shoe|shoes|sock|socks|footwear|sandal|sandals|loafer|loafers|mule|mules|sneaker|sneakers|platform|platforms|wedge|wedges|slipper|slippers|flat|flats|flop|flops|jogger|joggers|slide|slides|trainers)\b/.test(
      lower
    )
  ) {
    return 'footwear'
  }
  // Accessories category
  if (
    /\b(bag|belt|accessory|backpack|cap|veil|earring|necklace|scarf|hat|bracelet|glove|ring|headband|sunglasses|clutch|watch|wallet|keychain|beaded|brooch|headband|belted|jewelry|chain|handbag|purse|glasses|glove|gloves|sheet)\b/.test(
      lower
    )
  ) {
    return 'accessories'
  }
  // Tops category
  if (
    /\b(top|cape|workshirt|bustier|camisole|sweater|cover up|tank|t-shirt|shirt|bra|swimsuit|underwired|sweatshirt|bandeau|veil|tee|crewneck|henley|baselayer|mockneck|crew|pullover|long sleeve|blouse|jumper|tunic)\b/.test(
      lower
    )
  ) {
    return 'tops'
  }

  // Bottoms category
  const standardBottomsRegex =
    /(skirt|skort|bottom|trouser|short|capri|pant|legging|thong|brief|chino|cargo|rise|leg|fray|slung|waist|boxer|tight)/
  const ebDenimExtras = /(loose bowed|extra baggy|barrel|double knee|slim cigarette)/

  if (standardBottomsRegex.test(lower) || (ebDenim && ebDenimExtras.test(lower))) {
    return 'bottoms'
  }

  return 'accessories'
}

import OpenAI from 'openai'
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// export const categorizeProductByName = async (name) => {
//   const response = await openai.chat.completions.create({
//     model: 'gpt-3.5-turbo',
//     messages: [
//       {
//         role: 'system',
//         content: `You are an expert fashion product classifier.

// Categorize a given product into exactly one of the following categories:
// - outerwear
// - denim
// - tops
// - bottoms
// - dresses
// - accessories
// - footwear

// You must only respond with one of the above categories, based on the best fit. If it's not a perfect match, choose the closest one. Do not invent or suggest any other category.`,
//       },
//       {
//         role: 'user',
//         content: `Product Name: "${name}"\nCategory:`,
//       },
//     ],
//   })
//   console.log(`${name} category from chatgpt:`, response.choices[0].message.content.trim().toLowerCase())
//   return response.choices[0].message.content.trim().toLowerCase()
// }

// export const determineSubCategory = (category, productName) => {
//   const lower = productName.toLowerCase()

//   return category === 'denim'
//     ? /(dress|bodysuit|sundress|gown|bridal|jumpsuit|playsuit)/.test(lower)
//       ? 'dresses'
//       : /(cardigan|coat|jacket|blazer|hoodie|popover|zip|vest|parka|anorak|windbreaker)/.test(lower)
//       ? 'outerwear'
//       : /\b(top|bustier|camisole|sweater|workshirt|cover up|tank|t-shirt|shirt|bra|swimsuit|underwired|sweatshirt|bandeau|veil|tee|crewneck|henley|baselayer|mockneck|crew|pullover|long sleeve|blouse)\b/.test(
//           lower
//         )
//       ? 'tops'
//       : /(skirt|bottom|trouser|short|capri|pant|legging|jean|jeans|thong|brief|chino|cargo|rise|leg|fray|slung|waist|boxer|tight)/.test(
//           lower
//         )
//       ? 'bottoms'
//       : null
//     : category
// }
export const categorizeProductBatch = async (names) => {
  const formattedList = names.map((name, index) => `${index + 1}. ${name}`).join('\n')

  const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [
      {
        role: 'system',
        content: `You are an expert fashion product classifier.

Categorize each product into exactly one of the following categories:
- outerwear
- denim
- tops
- bottoms
- dresses
- accessories
- footwear
You must only respond with one of the above categories, based on the best fit. If it's not a perfect match, choose the closest one. Do not invent or suggest any other category.
Like if the product is swim shorts, it should be in bottoms category not swimwear or any other new category.
Return the result as a JSON object with index keys. Example:
{ "1": "tops", "2": "footwear", "3": "accessories" }`,
      },
      {
        role: 'user',
        content: `Do not invent or suggest any other category. Here are the product names:\n${formattedList}`,
      },
    ],
  })

  const result = response.choices[0].message.content.trim()
  try {
    return JSON.parse(result)
  } catch (e) {
    console.error('Failed to parse category response:', result)
    throw e
  }
}

export const determineSubCategory = async (category, productName) => {
  if (category !== 'denim') return category

  const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [
      {
        role: 'system',
        content: `You are a subcategory classifier for fashion products.

If the main category is "denim", classify the product into one of the following subcategories:
- dresses
- outerwear
- tops
- bottoms

Respond with only one subcategory.`,
      },
      {
        role: 'user',
        content: `Product Name: "${productName}"\nSubcategory:`,
      },
    ],
  })

  const subcategory = response.choices[0].message.content.trim().toLowerCase()
  console.log('subcategory from chatgpt:', subcategory)
  return subcategory
}
