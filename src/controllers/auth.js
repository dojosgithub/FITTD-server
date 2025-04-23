// * Libraries
import { StatusCodes } from 'http-status-codes'
import { isEmpty, isUndefined, concat, cloneDeep } from 'lodash'
import speakeasy, { totp } from 'speakeasy'
import mongoose, { model } from 'mongoose'
const axios = require('axios')
import passport from 'passport'
import dotenv from 'dotenv'

const admin = require('firebase-admin')

dotenv.config()

// * Models
import { User, TOTP, Group, Post, Comment, Badge, Challenge, UserChallengeProgress } from '../models'

// * Middlewares
import { asyncMiddleware } from '../middlewares'

// * Services
import {
  addGroup,
  getGroupsPaginated,
  getGroupDetails,
  updateGroupDetails,
  getGroupMembersPaginated,
  createPost,
  getUserPostsPaginated,
  updatePost,
  getPostDetails,
  getgroupsPostsPaginated,
  getallPostsPaginated,
  getPostLike,
  getPostdisLike,
  createComment,
  updateComment,
  getAllComments,
  createExercise,
  getAllExercises,
  createBadge,
  getABadge,
  getAllBadge,
  updateBadge,
  createChallenge,
  updateChallenge,
  getAllZealAdminChallenges,
  getFriendsChallenges,
  getCommunityChallenges,
  getUserProgress,
  getUserExerciseLog,
  getChallengeHistory,
  getUserAllCurrentChallenges,
  getAllFeaturedChallenges,
  getUserCreatedChallenges,
  getSpecificCommunityChallenges,
  getAllPopularChallenges,
  getChallengeDetails,
  retrieveUserChallange,
  getAllExercisesCategory,
  getChallengeLeaderboard,
  authenticateGoogleUser,
  authenticateFacebookUser,
  signupOAuthUser,
  signinOAuthUser,
} from '../services'

// * Utilities
import {
  DEALERSHIP_STATUS,
  DEALERSHIP_STAFF_ROLE,
  DOC_STATUS,
  getRoleByValue,
  getRoleShortName,
  USER_ROLE,
  USER_TYPES,
  AUCTION_STATUS,
  CAR_STATUS,
  SYSTEM_STAFF_ROLE,
  BID_STATUS,
  getCurrentDayName,
  getDateForDay,
  getStartOfDayISO,
  getDayName,
  CHALLENGE_STATUS,
  USER_LEVELS,
  SYSTEM_USER_ROLE,
} from '../utils/user'
import { getLoginLinkByEnv, getSanitizeCompanyName, toObjectId } from '../utils/misc'
import { stripe } from '../utils/stripe'
import Email from '../utils/email'
import { escapeRegex } from '../utils/misc'
import { comparePassword, generateOTToken, generatePassword, generateToken, verifyTOTPToken } from '../utils'
import { sendSMS } from '../utils/smsUtil'
import { getIO } from '../socket'

const { ObjectId } = mongoose.Types

// const CLIENT_ID = process.env.GOOGLE_CLIENT_ID
// const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
// const REDIRECT_URI = 'http://localhost:3000/api/user/auth/google/callback'

export const CONTROLLER_AUTH = {
  // ZEAL FITNESS APP APIS

  getCode: asyncMiddleware(async (req, res) => {
    // console.log('INSIDE1')
    const { email } = req.body

    const user = await User.findOne({ email })

    // const name = user.firstName

    if (user) {
      return res.status(400).json({
        message: 'Email provided is already register',
      })
    } else {
      var secret = speakeasy.generateSecret({ length: 20 }).base32
      var token = speakeasy.totp({
        digits: 6,
        secret: secret,
        encoding: 'base32',
        window: 6,
      })

      // console.log('token', token)

      // await sendSMS(`Your time based one time login code is: ${token}`, phoneNumber) // UTL

      const TOTPToken = await generateOTToken({ secret })

      // Find if the document with the phoneNumber exists in the database
      let totp = await TOTP.findOneAndUpdate({ email }, { token: TOTPToken })

      if (isEmpty(totp)) {
        new TOTP({
          email,
          token: TOTPToken,
        }).save()
      }
      const sendEmail = await new Email({ email })
      const emailProps = { token }
      await sendEmail.registerAccount(emailProps)

      res.json({ message: 'Verification code sent' })
    }
  }),

  verifyAccount: asyncMiddleware(async (req, res) => {
    const { email, code } = req.body

    let totp = await TOTP.findOneAndDelete({ email })
    if (!totp) {
      return res.status(400).json({ message: 'No OTP record found or it has already been used.' })
    }

    let decoded = await verifyTOTPToken(totp.token)
    let verified = speakeasy.totp.verify({
      digits: 6,
      secret: decoded.secret,
      encoding: 'base32',
      token: code,
      window: 10,
    })

    if (verified) {
      // const hashedPassword = await generatePassword(newPassword)

      // await User.findOneAndUpdate({ email }, { password: hashedPassword }, { new: true })

      // console.log(`Password updated for ${email}`)
      res.json({ message: 'Account verified successfully' })
    } else {
      res.status(400).json({ message: 'Invalid verification code' })
    }
  }),

  signUp: asyncMiddleware(async (req, res) => {
    let { firstName, lastName, email, password, weight, height, location, fcmToken, age } = req.body

    const user = await User.findOne({
      email: email,
    })

    if (user)
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: 'Email already exists.',
      })

    const hasedPassword = await generatePassword(password)

    const newUser = new User({
      firstName,
      lastName,
      email,
      password: hasedPassword,
      weight,
      height,
      file: 'https://res.cloudinary.com/dojo-dev/image/upload/v1721912391/biddi-cars-dev/1721912406433.png',
      age,
      accountType: 'Zeal-Account',
      location,
      points: 0,
      fcmToken,
      userTypes: [USER_TYPES.USR],
      role: { name: SYSTEM_USER_ROLE.USR, shortName: getRoleShortName(USER_TYPES.USR, SYSTEM_USER_ROLE.USR) },
      level: USER_LEVELS.BEG,
    })

    await newUser.save()

    const tokenPayload = {
      _id: newUser._id,
      role: newUser.role,
      userTypes: newUser.userTypes,
    }

    const tokens = await generateToken(tokenPayload)

    // email temp here

    const sendEmail = await new Email({ email })
    const emailProps = { firstName }
    await sendEmail.welcomeToZeal(emailProps)

    res.status(StatusCodes.OK).json({
      data: {
        user: { ...newUser._doc },
        ...tokens,
      },
      message: 'User registered successfully',
    })
  }),

  signIn: asyncMiddleware(async (req, res) => {
    const { email, password, fcmToken } = req.body // Changed from req.query to req.body
    const user = await User.findOne({ email }).select('+password')

    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({
        message: 'User not found.',
      })
    }

    if (user.accountType === 'Google-Account') {
      return res.status(StatusCodes.FORBIDDEN).json({
        message: 'Not a Zeal fitness account try logging it with google',
      })
    }

    const isAuthenticated = await comparePassword(password, user.password)

    if (!isAuthenticated) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: 'Incorrect Password or Email.',
      })
    }

    if (fcmToken) {
      user.fcmToken = fcmToken
    }
    delete user.password

    const tokenPayload = {
      _id: user._id,
      role: user.role,
      userTypes: user.userTypes,
    }

    const tokens = await generateToken(tokenPayload)

    user.refreshTokens = [tokens.refreshToken]
    if (user && !user.accountType) {
      user.accountType = 'Zeal-Account'
    }
    await user.save()

    res.status(StatusCodes.OK).json({
      data: {
        user: { ...user._doc },
        ...tokens,
      },
      message: 'Logged In Successfully',
    })
  }),

  signOut: asyncMiddleware(async (req, res) => {
    const { userId } = req.body

    const user = await User.findById(userId)

    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: 'User not found' })
    }

    if (user) {
      ;(user.refreshTokens = ''), (user.accessToken = ''), (user.fcmToken = ''), await user.save()
    }

    res.status(StatusCodes.OK).json({ message: 'Logged out successfully' })
  }),

  forgotPassword: asyncMiddleware(async (req, res) => {
    // console.log('INSIDE1')
    const { email } = req.body

    const user = await User.findOne({ email })

    const name = user.firstName

    if (!user) {
      return res.status(400).json({
        message: 'Email provided is not valid',
      })
    }

    if (user.accountType === 'Google-Account') {
      return res.status(400).json({
        message: 'Not a Zeal Account',
      })
    }

    var secret = speakeasy.generateSecret({ length: 20 }).base32
    var token = speakeasy.totp({
      digits: 6,
      secret: secret,
      encoding: 'base32',
      window: 6,
    })

    // console.log('token', token)

    // await sendSMS(`Your time based one time login code is: ${token}`, phoneNumber) // UTL

    const TOTPToken = await generateOTToken({ secret })

    // Find if the document with the phoneNumber exists in the database
    let totp = await TOTP.findOneAndUpdate({ email }, { token: TOTPToken })

    if (isEmpty(totp)) {
      new TOTP({
        email,
        token: TOTPToken,
      }).save()
    }
    const sendEmail = await new Email({ email })
    const emailProps = { token, name }
    await sendEmail.sendForgotPassword(emailProps)

    res.json({ message: 'Verification code sent' })
  }),

  verifyUpdatePasswordCode: asyncMiddleware(async (req, res) => {
    const { email, code } = req.body

    let totp = await TOTP.findOneAndDelete({ email })
    if (!totp) {
      return res.status(400).json({ message: 'No TOTP record found or it has already been used.' })
    }

    let decoded = await verifyTOTPToken(totp.token)
    let verified = speakeasy.totp.verify({
      digits: 6,
      secret: decoded.secret,
      encoding: 'base32',
      token: code,
      window: 10,
    })

    if (verified) {
      res.json({ message: 'code verified' })
    } else {
      res.status(400).json({ message: 'Invalid verification code' })
    }
  }),

  forgotPasswordUpdate: asyncMiddleware(async (req, res) => {
    const { email, newPassword } = req.body

    const hashedPassword = await generatePassword(newPassword)

    const user = await User.findOneAndUpdate({ email }, { password: hashedPassword }, { new: true })

    if (!user) {
      return res.status(400).json({ message: 'User not found' })
    }
    // console.log(`Password updated for ${email}`)
    res.json({ message: 'Password updated successfully' })
  }),
  //   try {
  //     const { code } = req.query

  //     console.log('code', code)

  //     // Exchange code for tokens
  //     const { data } = await axios.post('https://oauth2.googleapis.com/token', {
  //       client_id: '674934457104-8jbpiopvjbrrba796h7lkl39jnqiv7qt.apps.googleusercontent.com',
  //       client_secret: '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',
  //       code,
  //       redirect_uri: 'YOUR_REDIRECT_URI', // replace with your actual redirect URI
  //       grant_type: 'authorization_code',
  //     })

  //     const { access_token } = data

  //     // Fetch user profile using access token
  //     const { data: profile } = await axios.get('https://www.googleapis.com/oauth2/v1/userinfo', {
  //       headers: { Authorization: `Bearer ${access_token}` },
  //     })

  //     console.log('User Profile:', profile)

  //     // Handle user authentication and retrieval using the profile data
  //     // Example: check if user exists in DB, if not, create a new user
  //     // Here you would typically interact with your user model to find or create a user

  //     // Redirect to profile or home page after successful login
  //     res.redirect('/profile')
  //   } catch (error) {
  //     console.error('Error during Google login:', error.response ? error.response.data : error.message)
  //     res.status(500).send('An error occurred during Google login.')
  //   }
  // }),

  sendNotification: asyncMiddleware(async (req, res) => {
    const { title, body } = req.body

    const token =
      'cJBKoZf7cUpdtPFhbQm5ZE:APA91bEHbnMMtpcvdNz6ZaCWuCvQVD-rwO_ps6xu4Il3ajnXR0g-oGCZAzIJP44upIu5BrUheUWJCRikQH_Vc5DZsx3kVG7pH8A2H1ZBcsX4-M7tYBttefi2Fo3Z4RcHuHq60Z4jEtZU'

    const message = {
      notification: {
        title: 'i am title',
        body: 'body is here',
      },
      token,
    }

    // admin.messaging().sendMulticast(message)
    admin.messaging().send(message)

    res.json({ message: 'notification sent successfully' })
  }),

  changePassword: asyncMiddleware(async (req, res) => {
    const id = req.query.id
    const { newPassword, oldPassword } = req.body

    const user = await User.findById(id).select('password')

    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    const isAuthenticated = await comparePassword(oldPassword, user.password)

    if (!isAuthenticated) {
      return res.status(400).json({ message: 'Password does not matched' })
    }

    // Check if the new password is the same as the old password
    const isSamePassword = await comparePassword(newPassword, user.password)
    if (isSamePassword) {
      return res.status(400).json({ message: 'New password cannot be the same as the old password' })
    }

    const hashedPassword = await generatePassword(newPassword)

    await User.findByIdAndUpdate(id, { password: hashedPassword }, { new: true })

    // console.log(`Password updated for ${email}`)
    res.json({ message: 'Password updated successfully' })
  }),

  OAuth: asyncMiddleware(async (req, res) => {
    const { auth_type, token_id, userID, access_token, fcmToken } = req.body
    const ipAddress = req.ip
    console.log('BODY:', req.body)
    let userData

    switch (auth_type) {
      case 'google':
        userData = await authenticateGoogleUser(token_id)
        if (isEmpty(userData))
          return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Error occurred during google OAUTH' })

        break

      case 'facebook':
        userData = await authenticateFacebookUser(access_token)
        console.log('FACEBOOK', userData)
        if (isEmpty(userData))
          return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Error occurred during facebook OAUTH' })

        break

      default:
        return res.status(StatusCodes.BAD_REQUEST).json({ auth_type: 'Please provide a valid auth type' })
        break
    }

    const { email } = userData

    let userExists = await User.findOne({ email: email }).lean()

    if (isEmpty(userExists)) userExists = await signupOAuthUser(userData, fcmToken)

    if (userExists) {
      if (userExists.accountType !== 'Google-Account') {
        return res.status(StatusCodes.FORBIDDEN).json({
          message: 'Not a Google account try logging it with Zeal fitness account',
        })
      } else {
        await User.findOneAndUpdate({ email: email }, { fcmToken, accountType: 'Google-Account' })
      }
      // userExists.fcmToken = fcmToken
    }
    const response = await signinOAuthUser(userExists, ipAddress, res)

    if (isEmpty(response)) return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Not able to login via OAuth' })
    // await USER_SERVICE.setTokenCookie(res, response.refreshToken)
    res.status(StatusCodes.ACCEPTED).json(response.data)
  }),
}
