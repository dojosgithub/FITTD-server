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
router.post('/migrate-products', Authenticate(), CONTROLLER_PRODUCT.migrateProducts)

export default router
