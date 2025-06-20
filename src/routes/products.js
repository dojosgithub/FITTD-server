// * Libraries
import { Router } from 'express'

// * Controllers
import { CONTROLLER_PRODUCT } from '../controllers'

// * Middlewares
import { Authenticate } from '../middlewares'

const router = Router()

router.get('/get-categories-count', Authenticate(), CONTROLLER_PRODUCT.getCategoryCountsAcrossBrands)
router.get('/brands-and-categories', Authenticate(), CONTROLLER_PRODUCT.getByBrandsAndCategories)
router.get('/recommended', Authenticate(), CONTROLLER_PRODUCT.getRecommendedProducts)
router.get('/get-product-details', CONTROLLER_PRODUCT.getProductDetails)
router.get('/search', Authenticate(), CONTROLLER_PRODUCT.searchProducts)
router.post('/click', Authenticate(), CONTROLLER_PRODUCT.clickProduct)
router.get('/trending', Authenticate(), CONTROLLER_PRODUCT.trendingProducts)
router.get('/suggestion', Authenticate(), CONTROLLER_PRODUCT.getSearchSuggestions)

export default router
