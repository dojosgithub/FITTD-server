// * Libraries
import express, { Router } from 'express'

// * Controllers
import { CONTROLLER_USER } from '../controllers'

// * Utilities
// import { validateRegistration } from '../models/User'
// import { USER_PERMISSIONS, USER_ROLE } from '../utils/user'

// * Middlewares
import { permitMiddleware, Authenticate } from '../middlewares'

import { USER_TYPES } from '../utils'

const router = Router()

router.get('/profile', Authenticate(), permitMiddleware([USER_TYPES.SYS, USER_TYPES.USR]), CONTROLLER_USER.profile)

export default router
