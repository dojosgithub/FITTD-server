export const groupedByType = {
  denim: [],
  outerwear: [],
  tops: [],
  bottoms: [],
  dresses: [],
  accessories: [],
  footwear: [],
}

export const categorizeProductByName = (name) => {
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
  // Outerwear category
  if (/(cardigan|coat|jacket|blazer|jacket|hoodie|popover|zip)/.test(lower)) {
    return 'outerwear'
  }
  // Dresses category
  if (/(dress|bodysuit|sundress|gown|bridal|gown|jumpsuit)/.test(lower)) {
    return 'dresses'
  }

  // Tops category
  if (
    /(top|bustier|camisole|sweater|cover up|tank|shirt|bra|swimsuit|underwired|sweatshirt|bandeau|veil|tee|crewneck|henley)/.test(
      lower
    )
  ) {
    return 'tops'
  }

  // Bottoms category
  if (
    /(skirt|bottom|trouser|short|capri|pant|playsuit|legging|jean|thong|brief|chino|cargo|rise|leg|fray|slung|waist)/.test(
      lower
    )
  ) {
    return 'bottoms'
  }

  // Footwear category
  if (/(heel|boot|shoe|footwear|sandal|loafers|mules|sneakers|platforms|wedges|slippers|boots|flat|flop)/.test(lower)) {
    return 'footwear'
  }
  // Accessories category
  if (
    /(bag|belt|accessory|cap|earring|necklace|scarf|hat|bracelet|glove|ring|headband|sunglasses|clutch|watch|wallet|keychain|beaded|brooch|headband|belted|jewelry|chain|handbag|purse|glasses|glove|hair)/.test(
      lower
    )
  ) {
    return 'accessories'
  }

  return 'accessories'
}
