// * Libraries
import { Router } from 'express'

// * Controllers
import { CONTROLLER_AUTH } from '../controllers'
import { Authenticate } from '../middlewares'

const router = Router()

// Signup route
router.post('/signup', CONTROLLER_AUTH.signup)
router.post('/oauth', CONTROLLER_AUTH.OAuth)
router.post('/signin', CONTROLLER_AUTH.signIn)
router.post('/signout', Authenticate(), CONTROLLER_AUTH.signOut)
router.post('/verify-otp', CONTROLLER_AUTH.verifyOtp)
router.post('/forgot-password', CONTROLLER_AUTH.forgotPassword)
router.post('/change-password', Authenticate(), CONTROLLER_AUTH.changePassword)
router.delete('/delete-account', Authenticate(), CONTROLLER_AUTH.deleteAccount)

export default router
