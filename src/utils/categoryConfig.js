export const categoryStructure = {
  tops: [],
  bottoms: [],
  knitwear: [],
  swimwear: [],
  sweaters: [],
  // sweatsuits: [],
  playsuitsJumpsuits: [],
  sleep: [],
  heels: [],
  mules: [],
  sandals: [],
  hair: [],
  belts: [],
  bracelets: [],
  sunglasses: [],
  rings: [],
  earrings: [],
  necklaces: [],
  anklets: [],
  bags: [],
  hats: [],
  socks: [],
  resortWear: [],
  backless: [],
  restocking: [],
  beauty: [],
  dresses: [], // ✅ Add this
  Others: [], // ✅ Add this
}

// Define category keywords
export const categoryKeywords = {
  swimwear: ['swimsuit', 'bikini', 'swim'],
  sandals: ['sandals'],
  heels: ['heels'],
  mules: ['mules'],
  accessories: {
    sunglasses: ['sunglasses'],
    bags: ['bag', 'baguette', 'tote', 'purse', 'wet bag'],
    belts: ['belt'],
    earrings: ['earrings', 'huggie', 'stud'],
    hair: ['claw clip', 'hair', 'scrunchie', 'clip'],
    necklaces: ['necklace'],
    anklets: ['anklet'],
    rings: ['ring'],
    bracelets: ['bracelet', 'bangle'],
    hats: ['cap', 'hat'],
    socks: ['socks'],
  },
  sleep: ['pj set', 'robe', 'bra'],
  // sweatsuits: ['track pants', 'sweatpants', 'athletic shorts', 'bike shorts', 'hoodie'],
  sweaters: ['sweater'],
  resortWear: [
    'beach',
    'shoreline',
    'paradise',
    'cove',
    'shore',
    'isla',
    'sea',
    'tropical',
    'oceano',
    'seaview',
    'santorini',
    'milos',
    'amalfi',
    'rhodes',
    'greece',
    'villagio',
  ],
  knitwear: ['knit', 'fleece', 'cable knit', 'jumper', 'waffle'],
  playsuitsJumpsuits: ['playsuit', 'jumpsuit'],
  tops: [
    'top',
    'tee',
    'shirt',
    'blouse',
    'cardi',
    'cardigan',
    'blazer',
    'bodysuit',
    'corset',
    'halter',
    'puff',
    'crew',
    'jumper',
  ],
  bottoms: ['pants', 'bottom', 'leggings', 'draw skirt', 'shorts', 'skirt', 'skort'],
  dresses: ['dress'],
  backless: ['backless'],
  beauty: ['shampoo', 'wand', 'face pads', 'cotton', 'g-string', 'underwear'],
  restocking: ['sample-'],
}

export function categorizeProducts(products) {
  const categorized = JSON.parse(JSON.stringify(categoryStructure))

  products.forEach((product) => {
    const productName = product.name.toLowerCase()

    // Helper to push and return true if matched
    const assign = (key) => {
      categorized[key].push(product)
      return true
    }

    // Sample products
    if (productName.includes('sample-')) return assign('restocking')

    // Check for beauty products
    if (categoryKeywords.beauty.some((keyword) => productName.includes(keyword))) return assign('beauty')

    // Shoes
    if (categoryKeywords.heels.some((keyword) => productName.includes(keyword))) return assign('heels')
    if (categoryKeywords.sandals.some((keyword) => productName.includes(keyword))) return assign('sandals')
    if (categoryKeywords.mules.some((keyword) => productName.includes(keyword))) return assign('mules')
    // Accessories
    for (const [category, keywords] of Object.entries(categoryKeywords.accessories)) {
      if (keywords.some((keyword) => new RegExp(`\\b${keyword}\\b`).test(productName))) return assign(category)
    }

    // Swimwear
    if (categoryKeywords.swimwear.some((keyword) => productName.includes(keyword))) return assign('swimwear')

    // Resort wear
    if (categoryKeywords.resortWear.some((keyword) => productName.includes(keyword))) return assign('resortWear')

    // Knitwear
    if (categoryKeywords.knitwear.some((keyword) => productName.includes(keyword))) return assign('knitwear')
    if (categoryKeywords.sweaters.some((keyword) => productName.includes(keyword))) return assign('sweaters')

    // Playsuits/jumpsuits
    if (categoryKeywords.playsuitsJumpsuits.some((keyword) => productName.includes(keyword)))
      return assign('playsuitsJumpsuits')

    // Tops
    if (categoryKeywords.tops.some((keyword) => productName.includes(keyword))) return assign('tops')

    // Bottoms
    if (categoryKeywords.bottoms.some((keyword) => productName.includes(keyword))) return assign('bottoms')

    // Dresses
    if (categoryKeywords.dresses.some((keyword) => productName.includes(keyword))) {
      if (productName.includes('backless')) return assign('backless')
      return assign('dresses')
    }

    // Backless
    if (categoryKeywords.backless.some((keyword) => productName.includes(keyword))) return assign('backless')

    if (categoryKeywords.sleep.some((keyword) => productName.includes(keyword))) return assign('sleep')

    // Fallback: backIn as new arrivals
    return assign('Others')
  })

  return categorized
}
