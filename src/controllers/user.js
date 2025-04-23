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
  getUsersPaginated,
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

export const CONTROLLER_USER = {
  // ZEAL FITNESS APP APIS

  profile: asyncMiddleware(async (req, res) => {
    const { _id } = req.decoded
    const id = req.query.id
    // console.log('id', id)
    let userId
    if (id) {
      userId = id
    } else userId = _id

    const user = await User.findByIdAndUpdate(
      userId,
      { lastActive: new Date() }, // the update operation
      { new: true } // options for the update operation
    )
      .select('-password') // selecting fields to exclude
      .lean()

    if (!user)
      return res.status(StatusCodes.NOT_FOUND).json({
        message: 'User not found.',
      })

    res.status(StatusCodes.OK).json({
      data: {
        user,
      },
      message: 'Profiles Fetched Successfully',
    })
  }),

  updateProfile: asyncMiddleware(async (req, res) => {
    const id = req.query.id
    console.log(id)

    let body = JSON.parse(req.body.body)
    body = {
      file: req.file && req.file.path,
      ...body,
    }
    console.log(body)
    const user = await User.findByIdAndUpdate(id, body, { new: true }).select('-password -refreshToken').lean()

    if (!user)
      return res.status(StatusCodes.NOT_FOUND).json({
        message: 'User not found.',
      })

    res.status(StatusCodes.OK).json({
      data: user,
      message: 'Profile updated Successfully',
    })
  }),

  home: asyncMiddleware(async (req, res) => {
    const id = req.query.id

    const user = await User.findById(id).select('firstName lastName email file location')
    const popularGroups = await Group.aggregate([
      {
        $match: {
          $and: [{ groupMembers: { $nin: [ObjectId(id)] } }, { groupAdmin: { $nin: [ObjectId(id)] } }],
        },
      },
      {
        $addFields: {
          memberCount: { $size: '$groupMembers' },
        },
      },

      {
        $sort: {
          memberCount: -1,
        },
      },
      {
        $limit: 5,
      },
      {
        $project: {
          _id: 1,
          groupName: 1,
          files: 1,
          groupDescription: 1,
          groupMembers: 1,
        },
      },
    ])

    const zealChallenges = await Challenge.find({
      type: 'zeal',
      status: CHALLENGE_STATUS.LIV,
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('image name exercise')

    const currentChallenges = await Challenge.find({
      user: id,
      status: CHALLENGE_STATUS.LIV,
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('image name exercise')

    res.status(StatusCodes.OK).json({
      data: { user, popularGroups, zealChallenges, currentChallenges },
      message: 'home info fetched successfully',
    })
  }),

  userList: asyncMiddleware(async (req, res) => {
    const { _id } = req.decoded
    console.log('id', _id)
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 10

    let searchQuery = {}

    const paginateOptions = {
      page,
      limit,
      // sort: { createdAt: -1 },
    }
    let ORqueryArray = []
    if (!isEmpty(req.query.query)) {
      const documentMatchKeys = ['firstName', 'lastName']
      ORqueryArray = documentMatchKeys.map((key) => ({
        [key]: { $regex: new RegExp(escapeRegex(req.query.query), 'gi') },
      }))

      searchQuery = {
        $and: [
          {
            $or: ORqueryArray,
          },
        ],
      }
    }

    const pipeline = [
      {
        $match: {
          _id: { $ne: toObjectId(_id) }, // Always exclude the current user
          ...(ORqueryArray.length > 0 ? { $or: ORqueryArray } : {}), // Conditionally add $or if there are search terms
        },
      },
      {
        // Project the followers array and its size
        $project: {
          firstName: 1,
          lastName: 1,
          file: 1,
          followersCount: { $size: '$followers' }, // Assuming `followers` is the array of followers
        },
      },
      {
        // Sort by the followers count in descending order
        $sort: { followersCount: -1 },
      },
    ]

    const list = await getUsersPaginated({ pipeline, paginateOptions })

    res.status(StatusCodes.OK).json({
      data: list,
      message: 'User fetched successfully',
    })
  }),

  // googleLogin: asyncMiddleware(async (req, res) => {
  //   const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=profile email`
  //   return res.redirect(url)

  //   // res.status(StatusCodes.OK).json({
  //   //   message: 'Successfully',
  //   // })
  // }),

  // afterGoogleLogin: asyncMiddleware(async (req, res) => {
  //   const { code } = req.query

  //   // Exchange code for tokens
  //   const { data } = await axios.post('https://oauth2.googleapis.com/token', {
  //     client_id: '674934457104-8jbpiopvjbrrba796h7lkl39jnqiv7qt.apps.googleusercontent.com',
  //     client_secret: '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',
  //     code,
  //     redirect_uri: `http://localhost:3000/api/user/auth/google/callback`,
  //     grant_type: 'authorization_code',
  //   })

  //   const { access_token } = data

  //   // Fetch user profile using access token
  //   const { data: profile } = await axios.get('https://www.googleapis.com/oauth2/v1/userinfo', {
  //     headers: { Authorization: `Bearer ${access_token}` },
  //   })

  //   // Handle user authentication and retrieval using the profile data
  //   // Example: check if user exists in DB, if not, create a new user
  //   // Here you would typically interact with your user model to find or create a user

  //   console.log('User Profile:', profile)

  //   // Redirect to profile or home page after successful login
  //   res.redirect('/profile')
  // }),

  // afterGoogleLogin: asyncMiddleware(async (req, res) => {
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
}
