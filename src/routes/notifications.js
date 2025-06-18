// * Libraries
import { Router } from 'express'

// * Controllers
import { permitMiddleware, Authenticate } from '../middlewares'
import { CONTROLLER_NOTIFICATION } from '../controllers'

const router = Router()

// Get measurements of the logged-in user
router.get('/', Authenticate(), CONTROLLER_NOTIFICATION.getUserNotifications)
router.put('/mark-as-read', Authenticate(), CONTROLLER_NOTIFICATION.markNotificationAsRead)

export default router
