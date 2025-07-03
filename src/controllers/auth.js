import { asyncMiddleware } from '../middlewares'
import { TOTP, User, UserMeasurement, UserWishlist } from '../models'
import { StatusCodes } from 'http-status-codes'
import dotenv from 'dotenv'
import {
  comparePassword,
  generateOTToken,
  generatePassword,
  generateToken,
  sendPushNotification,
  verifyTOTPToken,
} from '../utils'
import speakeasy, { totp } from 'speakeasy'
import { isEmpty } from 'lodash'
import Email from '../utils/email'
import { generateOTP } from '../utils/generateOtp'
import { authenticateGoogleUser, signinOAuthUser, signupOAuthUser } from '../services'

dotenv.config()

export const CONTROLLER_AUTH = {
  signup: asyncMiddleware(async (req, res) => {
    const { name, email, password, fcmToken } = req.body

    // Check if user already exists
    const existingUser = await User.findOne({ email })
    // const existingUser = await User.findOne({ $or: [{ email }, { mobile }] })
    if (existingUser) {
      return res.status(StatusCodes.CONFLICT).json({
        message: 'User with this email already exists.',
      })
    }
    const hashedPassword = await generatePassword(password)
    // Create new user
    const user = new User({
      name,
      email,
      // mobile,
      password: hashedPassword, // You should hash this before saving in production!
    })
    user.fcmToken = fcmToken
    await user.save()
    const code = await generateOTP({ email })
    const sendEmail = await new Email({ email })
    const emailProps = { code, name: user.name }
    await sendEmail.registerAccount(emailProps)

    const userObj = user.toObject()
    delete userObj.password

    res.status(StatusCodes.CREATED).json({
      message: 'User registered successfully',
      data: userObj,
    })
  }),

  forgotPassword: asyncMiddleware(async (req, res) => {
    const { email } = req.body
    if (!email) {
      return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Email is required.' })
    }

    // Find the user based on email or mobile
    const user = await User.findOne({ email })
    if (!user) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: 'No user found with the provided email.',
      })
    }

    // Generate OTP and TOTP token
    const code = await generateOTP({ email })
    const sendEmail = await new Email({ email })
    const emailProps = { code, name: user.name }
    await sendEmail.sendForgotPassword(emailProps)
    return res.status(StatusCodes.OK).json({ message: 'Verification code sent.' })
  }),
  verifyOtp: asyncMiddleware(async (req, res) => {
    const { email, code, isVerification } = req.body

    // Check at least one identifier is provided
    if (!email) {
      return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Email is required for verification.' })
    }

    // Fetch and delete the stored TOTP token
    const totp = await TOTP.findOne({ email })

    if (!totp) {
      return res.status(400).json({ message: 'No OTP record found or it has already been used.' })
    }

    // Decode and verify the TOTP
    const decoded = await verifyTOTPToken(totp.token)
    const verified = speakeasy.totp.verify({
      digits: 6,
      secret: decoded.secret,
      encoding: 'base32',
      token: code,
      window: 10,
    })

    if (verified) {
      await TOTP.deleteOne({ _id: totp._id })
      const user = await User.findOne({ email })
      if (!user) {
        return res.status(StatusCodes.NOT_FOUND).json({ message: 'User not found.' })
      }
      if (isVerification) {
        user.isVerified = true
        await sendPushNotification({
          token: user.fcmToken,
          userId: user._id,
          notification: {
            title: 'Welcome to FITTD!',
            body: `Thanks for joining us! Start by adding your body measurements to get personalized recommendations just for you.`,
          },
        })
      }
      await user.save()
      return res.status(StatusCodes.OK).json({ message: 'OTP verified successfully.' })
    }

    res.status(StatusCodes.BAD_REQUEST).json({ message: 'Invalid verification code.' })
  }),

  signIn: asyncMiddleware(async (req, res) => {
    const { email, password, fcmToken } = req.body

    // Search by email or mobile
    // const user = await User.findOne({
    //   $or: [{ email }, { mobile }],
    // }).select('+password')
    const user = await User.findOne({ email }).select('+password').populate('measurements')

    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({
        message: 'User not found.',
      })
    }

    const isAuthenticated = await comparePassword(password, user.password)

    if (!isAuthenticated) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: 'Incorrect password or email.',
      })
    }
    if (!user.isVerified) {
      const code = await generateOTP({ email: user.email })
      const sendEmail = new Email({ email: user.email })
      const emailProps = { code, name: user.name }
      await sendEmail.registerAccount(emailProps)

      return res.status(StatusCodes.UNAUTHORIZED).json({
        message: 'Account not verified. Verification code resent to email.',
      })
    }
    const tokenPayload = {
      _id: user._id,
    }

    const tokens = await generateToken(tokenPayload)
    user.fcmToken = fcmToken
    await user.save()
    const userObj = user.toObject()
    delete userObj.password
    res.status(StatusCodes.OK).json({
      data: {
        user: userObj,
        tokens,
      },
      message: 'Logged In Successfully',
    })
  }),
  OAuth: asyncMiddleware(async (req, res) => {
    const { auth_type, token_id, fcmToken } = req.body
    console.log('BODY:', req.body)
    let userData
    switch (auth_type) {
      case 'google':
        userData = await authenticateGoogleUser(token_id)
        if (isEmpty(userData))
          return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Error occurred during google OAUTH' })
        break
      // case 'facebook':
      //   userData = await authenticateFacebookUser(access_token)
      //   console.log('FACEBOOK', userData)
      //   if (isEmpty(userData))
      //     return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Error occurred during facebook OAUTH' })
      //   break
      default:
        return res.status(StatusCodes.BAD_REQUEST).json({ auth_type: 'Please provide a valid auth type' })
    }
    console.log('userData', userData)
    const { email } = userData
    let userExists = await User.findOne({ email: email }).populate('measurements')
    if (isEmpty(userExists)) {
      userExists = await signupOAuthUser(userData, fcmToken)
      await sendPushNotification({
        token: fcmToken,
        userId: userExists._id,
        notification: {
          title: 'Welcome to FITTD!',
          body: `Thanks for joining us! Start by adding your body measurements to get personalized recommendations just for you.`,
        },
      })
    }
    console.log('userExists', userExists)
    if (userExists) {
      if (userExists.accountType !== 'Google') {
        return res.status(StatusCodes.FORBIDDEN).json({
          message: 'Not a Google account try logging it with FITTD account',
        })
      } else {
        await User.findOneAndUpdate(
          { email: email },
          {
            fcmToken,
            accountType: 'Google',
          }
        )
      }
      userExists.fcmToken = fcmToken
    }
    const response = await signinOAuthUser(userExists)
    console.log('response', response)

    if (isEmpty(response)) return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Not able to login via OAuth' })
    res.status(StatusCodes.ACCEPTED).json(response.data)
  }),

  changePassword: asyncMiddleware(async (req, res) => {
    const { email, oldPassword, password } = req.body
    if (!email) {
      return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Email or mobile is required' })
    }

    const user = await User.findOne({ email }).select('+password')
    console.log('user', user)
    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: 'User not found' })
    }
    if (oldPassword) {
      const isAuthenticated = await comparePassword(oldPassword, user.password)

      if (!isAuthenticated) {
        return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Password does not matched' })
      }

      // Check if the new password is the same as the old password
      const isSamePassword = await comparePassword(password, user.password)
      if (isSamePassword) {
        return res
          .status(StatusCodes.BAD_REQUEST)
          .json({ message: 'New password cannot be the same as the old password' })
      }
    }
    const hashedPassword = await generatePassword(password)
    console.log('Generated password:', password)
    await User.findByIdAndUpdate(user._id, { password: hashedPassword }, { new: true })

    // console.log(`Password updated for ${email}`)
    res.json({ message: 'Password updated successfully' })
  }),

  signOut: asyncMiddleware(async (req, res) => {
    const { _id: userId } = req.decoded

    if (!userId) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: 'User id not found' })
    }
    const user = await User.findById(userId)

    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: 'User not found' })
    }
    user.fcmToken = null
    res.status(StatusCodes.OK).json({ message: 'Logged out successfully' })
  }),

  deleteAccount: asyncMiddleware(async (req, res) => {
    const { _id: userId } = req.decoded // Decoded userId from JWT token
    const { password } = req.body
    if (!userId) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: 'User ID not found' })
    }

    // 1. Find the user in the database
    const user = await User.findById(userId).select('+password')
    if (user.accountType === 'FITTD' && !password) {
      return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Password is required for FITTD account deletion' })
    }
    console.log('user', user)
    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: 'User not found' })
    }
    if (password) {
      const isAuthenticated = await comparePassword(password, user.password)

      if (!isAuthenticated) {
        return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Password does not matched' })
      }
    }

    // 2. Delete associated user measurements (if exists)
    await UserMeasurement.deleteOne({ userId })
    await UserWishlist.deleteMany({ userId })

    // 4. Delete the user
    await User.findByIdAndDelete(userId)

    // 5. Send response
    res.status(StatusCodes.OK).json({
      message: 'Account and associated data deleted successfully',
    })
  }),
}
