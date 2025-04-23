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
import { comparePassword, generateOTToken, generatePassword, generateToken, verifyTOTPToken } from '../utils'
import { sendSMS } from '../utils/smsUtil'
import { getIO } from '../socket'
import { sendPushNotification } from '../utils/pushNotification'

const { ObjectId } = mongoose.Types

// const CLIENT_ID = process.env.GOOGLE_CLIENT_ID
// const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
// const REDIRECT_URI = 'http://localhost:3000/api/user/auth/google/callback'

export const CONTROLLER_CHALLENGE = {
  createChallenge: asyncMiddleware(async (req, res) => {
    let body = JSON.parse(req.body.body)

    body = {
      ...body,
      image: req.file && req.file.path,
    }

    if (body.challengeCreator) {
      body.challengeCreator = body.challengeCreator.toLowerCase()
    }

    const startDate = new Date(body.challengeStart)
    const endDate = new Date(body.challengeEnd)
    const days = body.days // array of days with dayName and isActive

    const activeDays = []
    let weekNumber = 1

    // Function to add active days
    const addActiveDays = (date, weekNumber) => {
      const dayName = date.toLocaleString('en-US', { weekday: 'long' })
      const day = days.find((d) => d.dayName.toLowerCase() === dayName.toLowerCase())

      if (day) {
        activeDays.push({
          dayName: dayName,
          isActive: day.isActive,
          date: new Date(date).toISOString().split('T')[0], // Create a new Date object to avoid mutation
          weekNumber: weekNumber,
        })
      }
    }

    // Add days from the start date to the end of the first week
    for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
      if (date.getDay() === 1 && date > startDate) {
        weekNumber++
      }
      addActiveDays(date, weekNumber)
    }

    body.activeDays = activeDays

    let exerciseType = ''
    if (body.exercise) {
      let timeBased = false
      let repsBased = false

      for (let exercise of body.exercise) {
        if (exercise._type === 'time') {
          timeBased = true
        } else if (exercise._type === 'reps') {
          repsBased = true
        }
      }
      if (timeBased && repsBased) {
        exerciseType = 'timeAndReps'
      } else if (timeBased) {
        exerciseType = 'time'
      } else if (repsBased) {
        exerciseType = 'reps'
      }
    }

    const newBody = {
      status: CHALLENGE_STATUS.LIV,
      exerciseType: exerciseType,
      ...body,
    }

    // console.log(newBody)

    let challenge = await createChallenge(newBody)

    if (challenge.type === 'zeal') {
      const users = await User.find({ fcmToken: { $exists: true, $ne: null } })
      for (const user of users) {
        if (user.fcmToken) {
          sendPushNotification({
            token: user.fcmToken,
            notification: {
              title: 'New Challenge',
              body: `New Challenge! ${challenge.name} has been created by Zeal Admin.`,
            },
          })
        }
      }
    }

    if (challenge.type === 'community') {
      const group = await Group.findById(challenge.group).select('groupMembers groupName')
      const memberIds = group.groupMembers.map((member) => member.memberId)
      const users = await User.find({
        _id: { $in: memberIds }, // User ID should be in the group members
        fcmToken: { $exists: true, $ne: null }, // fcmToken should exist and not be null
      })

      for (let user of users) {
        if (user.fcmToken) {
          sendPushNotification({
            token: user.fcmToken,
            notification: {
              title: 'New Challenge',
              body: `New Challenge! ${challenge.name} has been created by community ${group.groupName}.`,
            },
          })
        }
      }
    }

    if (challenge.type === 'friends') {
      const followers = await User.findById(challenge.challengeCreator)
      const followersIds = followers.followers.map((ids) => ids)
      const users = await User.find({
        _id: { $in: followersIds }, // User ID should be in the group members
        fcmToken: { $exists: true, $ne: null }, // fcmToken should exist and not be null
      })

      for (let user of users) {
        if (user.fcmToken) {
          sendPushNotification({
            token: user.fcmToken,
            notification: {
              title: 'New Challenge',
              body: `New Challenge! ${challenge.name} has been created by ${followers.firstName} ${followers.lastName}.`,
            },
          })
        }
      }
    }

    res.status(StatusCodes.OK).json({
      data: challenge,
      message: 'Challenge created successfully',
    })
  }),

  updateChallenge: asyncMiddleware(async (req, res) => {
    let id = req.query.id
    let body = JSON.parse(req.body.body)

    body = {
      ...body,
      image: req.file && req.file.path,
    }

    const currentChallenge = await Challenge.findById(id)

    if (currentChallenge.user.length >= 1) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: 'Cannot update challenge',
      })
    }

    if (body.days) {
      const startDate = new Date(body.challengeStart || currentChallenge.challengeStart)
      const endDate = new Date(body.challengeEnd || currentChallenge.challengeEnd)
      const days = body.days || currentChallenge.days // array of days with dayName and isActive

      const activeDays = []
      let weekNumber = 1

      // Function to add active days
      const addActiveDays = (date, weekNumber) => {
        const dayName = date.toLocaleString('en-US', { weekday: 'long' })
        const day = days.find((d) => d.dayName.toLowerCase() === dayName.toLowerCase())

        if (day) {
          activeDays.push({
            dayName: dayName,
            isActive: day.isActive,
            date: new Date(date), // Create a new Date object to avoid mutation
            weekNumber: weekNumber,
          })
        }
      }

      // Add days from the start date to the end date
      for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
        if (date.getDay() === 1 && date > startDate) {
          weekNumber++
        }
        addActiveDays(date, weekNumber)
      }

      body.activeDays = activeDays
    }

    // console.log('body', body)

    // Update the challenge with the new data
    let challenge = await Challenge.findByIdAndUpdate(id, body, { new: true })

    res.status(StatusCodes.OK).json({
      data: challenge,
      message: 'Challenge updated successfully',
    })
  }),

  getAllZealChalleges: asyncMiddleware(async (req, res) => {
    const query = req.query.query
    const badge = req.query.badge
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 10

    let searchQuery = { type: 'zeal', status: CHALLENGE_STATUS.LIV }

    if (badge) {
      searchQuery.badge = toObjectId(badge)
    }

    const paginateOptions = {
      page,
      limit,
      sort: { createdAt: -1 },
    }

    if (!isEmpty(query)) {
      const documentMatchKeys = ['name']
      const ORqueryArray = documentMatchKeys.map((key) => ({
        [key]: { $regex: new RegExp(escapeRegex(req.query.query), 'gi') },
      }))
      searchQuery = {
        ...searchQuery,
        $and: [
          {
            $or: ORqueryArray,
          },
        ],
      }
    }
    const pipeline = [
      { $match: searchQuery }, // Match based on searchQuery
      {
        $lookup: {
          from: 'badges', // Assuming 'badges' is the collection name for badges
          localField: 'badge',
          foreignField: '_id',
          as: 'badgeInfo',
        },
      },
      {
        $unwind: {
          path: '$badgeInfo',
          preserveNullAndEmptyArrays: true, // In case a challenge has no badge
        },
      },
      {
        $addFields: {
          badge: '$badgeInfo', // Add the badge name field
        },
      },
      {
        $project: {
          badgeInfo: 0, // Exclude the original badgeInfo array
          // Optionally exclude any other fields you don't want to return
        },
      },
    ]
    const list = await getAllZealAdminChallenges({ pipeline, paginateOptions })

    res.status(StatusCodes.OK).json({
      data: list,
      message: 'All Zeal Admin Challenges fetched successfully',
    })
  }),

  getFriendsChalleges: asyncMiddleware(async (req, res) => {
    const id = req.query.id

    const list = await getFriendsChallenges(id)

    res.status(StatusCodes.OK).json({
      data: list,
      message: 'All friends Challenges fetched successfully',
    })
  }),

  getUserAllCurrentChallenges: asyncMiddleware(async (req, res) => {
    const id = req.query.id

    const list = await getUserAllCurrentChallenges(id)

    res.status(StatusCodes.OK).json({
      data: list,
      message: 'Users all currently in progress challenges fetched successfully',
    })
  }),

  getAllFeaturedChallenges: asyncMiddleware(async (req, res) => {
    const id = req.query.id

    const list = await getAllFeaturedChallenges(id)

    res.status(StatusCodes.OK).json({
      data: list,
      message: 'features challenges fetched successfully',
    })
  }),

  getUserCreatedChallenges: asyncMiddleware(async (req, res) => {
    const id = req.query.id

    const list = await getUserCreatedChallenges(id)

    res.status(StatusCodes.OK).json({
      data: list,
      message: 'User created challenges fetched successfully',
    })
  }),

  getSpecificCommunityChallenges: asyncMiddleware(async (req, res) => {
    const id = req.query.id

    const list = await getSpecificCommunityChallenges(id)

    res.status(StatusCodes.OK).json({
      data: list,
      message: 'Challenges for specific community fetched successfully',
    })
  }),

  getAllPopularChallenges: asyncMiddleware(async (req, res) => {
    const list = await getAllPopularChallenges()

    res.status(StatusCodes.OK).json({
      data: list,
      message: 'Popular Challenges fetched successfully',
    })
  }),

  getCommunityChalleges: asyncMiddleware(async (req, res) => {
    const id = req.query.id

    const list = await getCommunityChallenges(id)

    res.status(StatusCodes.OK).json({
      data: list,
      message: 'All community Challenges of the user fetched successfully',
    })
  }),

  deleteChallenge: asyncMiddleware(async (req, res) => {
    const { id } = req.query

    const challenge = await Challenge.findById(id)

    if (challenge.user.length > 0) {
      res.status(StatusCodes.BAD_REQUEST).json({
        message: 'Cannot delete a challenge when a user joins the challenge.',
      })
    } else {
      await Challenge.deleteOne({ _id: id })
      res.status(StatusCodes.OK).json({
        message: 'Challenge deleted successfully',
      })
    }
  }),

  joinChallenge: asyncMiddleware(async (req, res) => {
    const { userId, challengeId } = req.body

    if (!userId || !challengeId) {
      return res.status(StatusCodes.BAD_REQUEST).json({ message: 'User ID and Challenge ID are required.' })
    }

    const challenge = await Challenge.findById(challengeId)
    if (!challenge) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: 'Challenge not found.' })
    }

    const user = await User.findById(userId)
    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: 'User not found.' })
    }

    if (challenge.user.includes(userId)) {
      return res.status(StatusCodes.CONFLICT).json({ message: 'User already joined the challenge.' })
    }

    // Add user to the challenge
    challenge.user.push(userId)
    await challenge.save()

    // Add challenge to the user's list of challenges
    user.challenges.push(challengeId)
    await user.save()

    // Extract and format exercises
    const formattedExercises = challenge.exercise.map((ex) => ({
      exerciseId: ex.exerciseId,
      isFinished: false, // default value
    }))

    // Filter active days and format dailyProgress
    const formattedDailyProgress = challenge.activeDays
      .filter((day) => day.isActive)
      .map((day) => ({
        exerciseStatus: formattedExercises,
        completionInPercent: 0, // Initialize with default value
        isAttempted: false,
        dayName: day.dayName,
        date: day.date.toISOString().split('T')[0],
      }))

    // Make progress document
    const progress = new UserChallengeProgress({
      challenge: challengeId,
      user: userId,
      dailyProgress: formattedDailyProgress,
      totalProgress: 0,
      points: 0,
      totalTime: '0:00:00',
      challengeType: challenge.type,
      startDateTime: new Date().toISOString(),
    })

    await progress.save()

    console.log('challenge', challenge)

    if (challenge.type !== 'zeal') {
      const creator = await User.findById(challenge.challengeCreator)
      if (creator.fcmToken) {
        sendPushNotification({
          token: creator.fcmToken,
          notification: {
            title: 'Challenge Update!',
            body: `${user.firstName} ${user.lastName} has joined the Challenge ${challenge.name}.`,
          },
        })
      }
    }

    res.status(StatusCodes.OK).json({
      message: 'User successfully joined the challenge.',
    })
  }),

  getChallengeDetails: asyncMiddleware(async (req, res) => {
    const id = req.query.id

    const data = await getChallengeDetails(id)

    res.status(StatusCodes.OK).json({
      data,
      message: 'Challenge details fetched successfully',
    })
  }),

  retrieveUserChallange: asyncMiddleware(async (req, res) => {
    const id = req.query.id
    const challengeId = req.query.challengeId

    const data = await retrieveUserChallange(id, challengeId)

    res.status(StatusCodes.OK).json({
      data,
      message: 'User challenge successfully',
    })
  }),
}
