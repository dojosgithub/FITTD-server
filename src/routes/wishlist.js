// * Libraries
import { Router } from 'express'

// * Controllers
import { CONTROLLER_WISHLIST } from '../controllers'
import { permitMiddleware, Authenticate } from '../middlewares'

const router = Router()

// Signup route
router.post('/add', Authenticate(), CONTROLLER_WISHLIST.addWishlist)
router.delete('/remove', Authenticate(), CONTROLLER_WISHLIST.removeWishlist)
router.get('/', Authenticate(), CONTROLLER_WISHLIST.getUserWishlist)

export default router
