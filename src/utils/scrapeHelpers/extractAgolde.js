export const transformProducts = (products) => {
  return products.map((product) => {
    const images = product.images || []
    const variants = product.variants || []

    return {
      name: product.title,
      url: `https://agolde.com/products/${product.handle}`,
      brand: product.vendor,
      gender: 'male',
      image: {
        primary: images.length > 0 ? images[0].src : null,
        secondary: images.slice(1).map((img) => img.src),
      },
      price: variants.length > 0 ? `$${variants[0].price}` : null,
      description: product.body_html,
      sizes: variants.map((variant) => ({
        size: variant.option1,
        inStock: variant.available,
      })),
      rating: null,
      reviewCount: null,
    }
  })
}
