export const getCategoriesName = () => {
  return ['outerwear', 'denim', 'tops', 'bottoms', 'dresses', 'accessories', 'footwear']
}
export const groupedByType = {
  denim: [],
  outerwear: [],
  tops: [],
  bottoms: [],
  dresses: [],
  accessories: [],
  footwear: [],
}

export const categorizeProductByName = (name, ebDenim) => {
  const lower = name.toLowerCase()
  // Denim category
  const hasBoleroOrCorset = /(bolero|corset)/.test(lower)
  const hasDressOrTop = /(dress|sundress|gown|maxi|midi|mini|bridal|jumpsuit|top|skirt)/.test(lower)
  if (hasBoleroOrCorset && !hasDressOrTop) {
    return 'tops'
  }

  if (/denim/.test(lower)) {
    return 'denim'
  }
  // Dresses category
  if (/(dress|bodysuit|sundress|gown|bridal|gown|jumpsuit|playsuit)/.test(lower)) {
    return 'dresses'
  }

  // Outerwear category
  if (/(cardigan|coat|jacket|blazer|jacket|hoodie|popover|zip|vest|parka|anorak|windbreaker)/.test(lower)) {
    return 'outerwear'
  }
  // Footwear category
  if (
    /\b(heel|heels|boot|boots|shoe|shoes|sock|socks|footwear|sandal|sandals|loafer|loafers|mule|mules|sneaker|sneakers|platform|platforms|wedge|wedges|slipper|slippers|flat|flats|flop|flops|jogger|joggers|slide|slides)\b/.test(
      lower
    )
  ) {
    return 'footwear'
  }
  // Accessories category
  if (
    /(bag|belt|accessory|cap|veil|earring|necklace|scarf|hat|bracelet|glove|ring|headband|sunglasses|clutch|watch|wallet|keychain|beaded|brooch|headband|belted|jewelry|chain|handbag|purse|glasses|glove|hair)/.test(
      lower
    )
  ) {
    return 'accessories'
  }
  // Tops category
  if (
    /\b(top|workshirt|bustier|camisole|sweater|cover up|tank|t-shirt|shirt|bra|swimsuit|underwired|sweatshirt|bandeau|veil|tee|crewneck|henley|baselayer|mockneck|crew|pullover|long sleeve|blouse)\b/.test(
      lower
    )
  ) {
    return 'tops'
  }

  // Bottoms category
  const standardBottomsRegex =
    /(skirt|bottom|trouser|short|capri|pant|legging|jean|thong|brief|chino|cargo|rise|leg|fray|slung|waist|boxer|tight)/
  const ebDenimExtras = /(loose bowed|extra baggy|barrel|double knee|slim cigarette)/

  if (standardBottomsRegex.test(lower) || (ebDenim && ebDenimExtras.test(lower))) {
    return 'bottoms'
  }

  return 'accessories'
}

export const determineSubCategory = (category, productName) => {
  const lower = productName.toLowerCase()

  return category === 'denim'
    ? /(dress|bodysuit|sundress|gown|bridal|jumpsuit|playsuit)/.test(lower)
      ? 'dresses'
      : /(cardigan|coat|jacket|blazer|hoodie|popover|zip|vest|parka|anorak|windbreaker)/.test(lower)
      ? 'outerwear'
      : /\b(top|bustier|camisole|sweater|workshirt|cover up|tank|t-shirt|shirt|bra|swimsuit|underwired|sweatshirt|bandeau|veil|tee|crewneck|henley|baselayer|mockneck|crew|pullover|long sleeve|blouse)\b/.test(
          lower
        )
      ? 'tops'
      : /(skirt|bottom|trouser|short|capri|pant|legging|jean|thong|brief|chino|cargo|rise|leg|fray|slung|waist|boxer|tight)/.test(
          lower
        )
      ? 'bottoms'
      : null
    : category
}
