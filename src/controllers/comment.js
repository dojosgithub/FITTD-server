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
import {
  comparePassword,
  generateOTToken,
  generatePassword,
  generateToken,
  sendPushNotification,
  verifyTOTPToken,
} from '../utils'
import { sendSMS } from '../utils/smsUtil'
import { getIO } from '../socket'

const { ObjectId } = mongoose.Types

// const CLIENT_ID = process.env.GOOGLE_CLIENT_ID
// const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
// const REDIRECT_URI = 'http://localhost:3000/api/user/auth/google/callback'

export const CONTROLLER_COMMENT = {
  // ZEAL FITNESS APP APIS

  addComment: asyncMiddleware(async (req, res) => {
    let body = req.body
    console.log('body', body)
    const post = await Post.findById(body.post)
    console.log(post)

    let user = await User.findById(post.postOwner)
    let commentOwnerName = await User.findById(body.commentOwner)

    let comment = await createComment({ body })

    if (user.fcmToken) {
      sendPushNotification({
        token: user.fcmToken,
        notification: {
          title: 'New Comment',
          body: `${commentOwnerName.firstName} ${commentOwnerName.lastName} commented on your post.`,
        },
      })
    }

    res.status(StatusCodes.OK).json({
      data: comment,
      message: 'comment added successfully',
    })
  }),

  updateComment: asyncMiddleware(async (req, res) => {
    let id = req.query.id
    let body = req.body

    let post = await updateComment({ id, body })

    res.status(StatusCodes.OK).json({
      data: post,
      message: 'comment updated successfully',
    })
  }),

  allComments: asyncMiddleware(async (req, res) => {
    const id = req.query.id

    const list = await getAllComments({ id })

    res.status(StatusCodes.OK).json({
      data: list,
      message: 'comments fetched successfully',
    })
  }),

  deleteComments: asyncMiddleware(async (req, res) => {
    const { id } = req.query
    console.log(id)
    const post = await Comment.findByIdAndDelete(id)
    res.status(StatusCodes.OK).json({
      message: 'comment deleted successfully',
    })
  }),
}
