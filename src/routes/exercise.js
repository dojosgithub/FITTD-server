// * Libraries
import express, { Router } from 'express'

// * Controllers
import { CONTROLLER_EXERCISE } from '../controllers'

// * Utilities
// import { validateRegistration } from '../models/User'
// import { USER_PERMISSIONS, USER_ROLE } from '../utils/user'

// * Middlewares
import { validateMiddleware, permitMiddleware, Authenticate } from '../middlewares'
import { parser } from '../utils/cloudinary'
import { totpRateLimiter } from '../utils/rateLimiter'
import { USER_TYPES } from '../utils'

const router = Router()

// Zeal App User Routes

router.post(
  '/create-exercise',
  parser.fields([
    { name: 'icon', maxCount: 1 }, // New field for a single picture
    { name: 'demo', maxCount: 1 }, // New field for a short video/GIF
  ]),
  Authenticate(),
  permitMiddleware([USER_TYPES.SYS, USER_TYPES.USR]),
  CONTROLLER_EXERCISE.createExercise
)

router.get(
  '/get-all-exercise',
  Authenticate(),
  permitMiddleware([USER_TYPES.SYS, USER_TYPES.USR]),
  CONTROLLER_EXERCISE.getAllExercises
)
router.get(
  '/get-all-exercise-category',
  Authenticate(),
  permitMiddleware([USER_TYPES.SYS, USER_TYPES.USR]),
  CONTROLLER_EXERCISE.getAllExercisesCategory
)

export default router
