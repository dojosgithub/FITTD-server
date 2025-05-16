// * Libraries
import { Router } from 'express'

// * Controllers
import { CONTROLLER_ADMIN } from '../controllers'
import { Authenticate } from '../middlewares'

const router = Router()

// Signup route

router.post('/server-restart', Authenticate(), CONTROLLER_ADMIN.restartServer)

// Get measurements of the logged-in user

export default router
