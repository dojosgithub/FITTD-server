// * Libraries
import express, { Router } from 'express'

// * Controllers
import { CONTROLLER_CHALLENGE } from '../controllers'

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
  '/create-challenge',
  Authenticate(),
  permitMiddleware([USER_TYPES.SYS, USER_TYPES.USR]),
  parser.single('image'),
  CONTROLLER_CHALLENGE.createChallenge
)

router.put(
  '/update-challenge',
  Authenticate(),
  permitMiddleware([USER_TYPES.SYS, USER_TYPES.USR]),
  parser.single('image'),
  CONTROLLER_CHALLENGE.updateChallenge
)

router.get(
  '/all-zeal-challenge',
  Authenticate(),
  permitMiddleware([USER_TYPES.SYS, USER_TYPES.USR]),
  CONTROLLER_CHALLENGE.getAllZealChalleges
)

router.delete(
  '/delete-challenge',
  Authenticate(),
  permitMiddleware([USER_TYPES.SYS, USER_TYPES.USR]),
  CONTROLLER_CHALLENGE.deleteChallenge
)

router.post(
  '/join-challenge',
  Authenticate(),
  permitMiddleware([USER_TYPES.SYS, USER_TYPES.USR]),
  CONTROLLER_CHALLENGE.joinChallenge
)

router.get(
  '/GetFriendsChallenges',
  Authenticate(),
  permitMiddleware([USER_TYPES.SYS, USER_TYPES.USR]),
  CONTROLLER_CHALLENGE.getFriendsChalleges
)

router.get(
  '/getAllCurrentChallenges',
  Authenticate(),
  permitMiddleware([USER_TYPES.SYS, USER_TYPES.USR]),
  CONTROLLER_CHALLENGE.getUserAllCurrentChallenges
)

router.get(
  '/get-all-featured-challenges',
  Authenticate(),
  permitMiddleware([USER_TYPES.SYS, USER_TYPES.USR]),
  CONTROLLER_CHALLENGE.getAllFeaturedChallenges
)

router.get(
  '/get-user-created-challenges',
  Authenticate(),
  permitMiddleware([USER_TYPES.SYS, USER_TYPES.USR]),
  CONTROLLER_CHALLENGE.getUserCreatedChallenges
)

router.get(
  '/get-challenges-for-community',
  Authenticate(),
  permitMiddleware([USER_TYPES.SYS, USER_TYPES.USR]),
  CONTROLLER_CHALLENGE.getSpecificCommunityChallenges
)

router.get(
  '/get-popular-challenge',
  Authenticate(),
  permitMiddleware([USER_TYPES.SYS, USER_TYPES.USR]),
  CONTROLLER_CHALLENGE.getAllPopularChallenges
)

router.get(
  '/GetCommunityChallenges',
  Authenticate(),
  permitMiddleware([USER_TYPES.SYS, USER_TYPES.USR]),
  CONTROLLER_CHALLENGE.getCommunityChalleges
)

router.get(
  '/get-challenge-details',
  Authenticate(),
  permitMiddleware([USER_TYPES.SYS, USER_TYPES.USR]),
  CONTROLLER_CHALLENGE.getChallengeDetails
)

router.get(
  '/retrieve-challenge',
  Authenticate(),
  permitMiddleware([USER_TYPES.SYS, USER_TYPES.USR]),
  CONTROLLER_CHALLENGE.retrieveUserChallange
)

export default router
