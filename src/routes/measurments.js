// * Libraries
import { Router } from 'express'

// * Controllers
import { permitMiddleware, Authenticate } from '../middlewares'
import { CONTROLLER_MEASUREMENT } from '../controllers'

const router = Router()

// Signup route

router.post('/measurements', Authenticate(), CONTROLLER_MEASUREMENT.saveOrUpdateMeasurement)

// Get measurements of the logged-in user
router.get('/measurements', Authenticate(), CONTROLLER_MEASUREMENT.getUserMeasurement)

export default router
