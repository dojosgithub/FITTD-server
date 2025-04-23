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
  getUserStats,
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

export const CONTROLLER_PROGRESS = {
  updateProgress: asyncMiddleware(async (req, res) => {
    let id = req.query.id
    const { challengeId, exerciseId, timeTaken, finishedAt } = req.body

    const challenge = await Challenge.findById(challengeId)

    const userChallengeProgress = await UserChallengeProgress.findOne({
      challenge: challengeId,
      user: id,
    })

    if (!userChallengeProgress) {
      return res.status(404).json({ message: 'User challenge progress not found' })
    }

    const currentDate = getStartOfDayISO(new Date())
    const currentDayName = getDayName(new Date())

    console.log(`Current Date: ${currentDate}, Current Day Name: ${currentDayName}`)

    // Find and update the specific exercise's isFinished field if the date and day match
    let exerciseUpdated = false
    let dayChanged = false
    let totalTimeInSeconds = 0 // Initialize total time

    userChallengeProgress.dailyProgress.forEach((day) => {
      if (getStartOfDayISO(new Date(day.date)) === currentDate && day.dayName.toLowerCase() === currentDayName) {
        const totalExercises = day.exerciseStatus.length
        const partPerExercise = 100 / totalExercises

        day.exerciseStatus.forEach((exercise) => {
          if (exercise.exerciseId.toString() === exerciseId) {
            const preUpdateDate = getStartOfDayISO(new Date())

            exercise.isFinished = true
            exercise.timeTaken = timeTaken
            exercise.caloriesBurnt = timeTaken * 0.08
            exerciseUpdated = true

            const postUpdateDate = getStartOfDayISO(new Date())

            if (preUpdateDate !== postUpdateDate) {
              dayChanged = true
              exercise.isFinished = false // Revert the change
            }
          }
        })

        // Calculate completionInPercent
        if (!dayChanged) {
          let completedExercises = day.exerciseStatus.filter((ex) => ex.isFinished).length
          day.completionInPercent = completedExercises * partPerExercise
        }

        // Set isAttempted to true if any exercise is performed
        if (exerciseUpdated) {
          day.isAttempted = true
          day.attemptedAt = new Date()
        }
      }

      // Add timeTaken for each exercise to totalTimeInSeconds
      day.exerciseStatus.forEach((exercise) => {
        if (exercise.timeTaken) {
          totalTimeInSeconds += exercise.timeTaken
        }
      })
    })

    if (!exerciseUpdated) {
      return res.status(404).json({ message: 'Exercise not found or date/day mismatch' })
    }

    if (dayChanged) {
      return res.status(400).json({ message: 'Day changed during the update. Operation aborted.' })
    }

    // Calculate total progress only if challenge type is 'community' or 'friends'
    let totalPoints = 0
    userChallengeProgress.dailyProgress.forEach((day) => {
      totalPoints += day.completionInPercent
    })

    let totalProgress = totalPoints / userChallengeProgress.dailyProgress.length
    totalProgress = totalProgress.toFixed(2) // Format to 2 decimal places

    userChallengeProgress.totalProgress = totalProgress
    const user = await User.findById(id)

    let pointsAwarded = 0
    if (challenge.type === 'community' && user) {
      // Calculate the new progress by subtracting already awarded points
      const pointsInDB = userChallengeProgress.points / 3
      const newPoints = userChallengeProgress.totalProgress - pointsInDB
      // Only award points for the new progress
      if (newPoints > 0) {
        // Multiply the new progress points by 3 for community challenge
        const multipliedPoints = newPoints * 3
        userChallengeProgress.points = userChallengeProgress.totalProgress * 3
        pointsAwarded = multipliedPoints

        // Update user points with the multiplied points
        user.points = user.points + multipliedPoints

        await User.findByIdAndUpdate(id, { $inc: { points: multipliedPoints } })
      } else {
        console.log('No new points to award')
      }
    }

    // if (challenge.type === 'community' && user) {
    //   const totalProgress = userChallengeProgress.totalProgress
    //   const alreadyAwardedPoints = userChallengeProgress.points

    //   // Calculate new points
    //   const newProgress = totalProgress - alreadyAwardedPoints

    //   if (newProgress > 0) {
    //     // Multiply new progress points by 3 for the community challenge
    //     const multipliedPoints = newProgress * 3

    //     // Update user challenge progress points
    //     userChallengeProgress.points += newProgress * 3
    //     pointsAwarded = multipliedPoints
    //     console.log('pointsAwarded', pointsAwarded)

    //     // Update user points with multiplied points
    //     user.points += multipliedPoints

    //     // Update points in the database
    //     await User.findByIdAndUpdate(id, { $inc: { points: multipliedPoints } })

    //     console.log('user.points', user.points)
    //   } else {
    //     console.log('No new points to award')
    //   }
    // }

    if (challenge.type === 'friends' && user) {
      // Calculate the new progress by subtracting already awarded points
      const newPoints = userChallengeProgress.totalProgress - userChallengeProgress.points

      // Only award points for the new progress
      if (newPoints > 0) {
        userChallengeProgress.points = userChallengeProgress.totalProgress
        pointsAwarded = newPoints
        console.log('pointsAwarded', pointsAwarded)

        // Update user points only for the new progress
        user.points = user.points + newPoints

        // You might want to update this in the database too
        await User.findByIdAndUpdate(id, { $inc: { points: newPoints } })

        console.log('user.points ', user.points)
      } else {
        console.log('No new points to award')
      }
    }

    if (challenge.type === 'zeal') {
      userChallengeProgress.points = 0
    }

    // Convert totalTimeInSeconds to HH:MM:SS format and update totalTime
    const totalHours = Math.floor(totalTimeInSeconds / 3600)
    const totalMinutes = Math.floor((totalTimeInSeconds % 3600) / 60)
    const totalSeconds = totalTimeInSeconds % 60
    userChallengeProgress.totalTime = `${totalHours}:${totalMinutes}:${totalSeconds}`

    // Save the updated UserChallengeProgress document
    userChallengeProgress.finishedAt = finishedAt
    await userChallengeProgress.save()

    // Update user's total points
    const cal = totalTimeInSeconds * 0.08

    if (user) {
      user.totalTimeInSeconds += totalTimeInSeconds
      user.totalCaloriesBurnt += cal
      await user.save()
    }

    await userChallengeProgress.save()
    res.status(StatusCodes.OK).json({
      message: 'User Challenge progress updated successfully',
    })
  }),

  getUserProgress: asyncMiddleware(async (req, res) => {
    const id = req.query.id
    const challengeId = req.query.challengeId

    const data = await getUserProgress(id, challengeId)

    res.status(StatusCodes.OK).json({
      data,
      message: 'User progress fetched successfully',
    })
  }),

  getUserExerciseLog: asyncMiddleware(async (req, res) => {
    const id = req.query.id
    const challengeId = req.query.challengeId

    const data = await getUserExerciseLog(id, challengeId)

    res.status(StatusCodes.OK).json({
      data,
      message: 'User Exercise Log fetched successfully',
    })
  }),

  getChallengeHistory: asyncMiddleware(async (req, res) => {
    const id = req.query.id
    const dateFromFrontend = req.query.dateFromFrontend

    const data = await getChallengeHistory(id, dateFromFrontend)

    res.status(StatusCodes.OK).json({
      data,
      message: 'Challenge history fetched successfully',
    })
  }),

  getLeaderBoard: asyncMiddleware(async (req, res) => {
    const id = req.query.id

    const challenge = await Challenge.findOne({ _id: id, status: CHALLENGE_STATUS.CLT })
    if (!challenge) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: 'Challenge is currently in progress',
      })
    }

    const data = await getChallengeLeaderboard(challenge)

    res.status(StatusCodes.OK).json({
      data,
      message: 'Challenge leaderboard fetched successfully',
    })
  }),

  getUserStats: asyncMiddleware(async (req, res) => {
    const id = req.query.id

    const completedChallenges = await Challenge.find({
      user: id,
      status: 'completed',
    })

    const data = await getUserStats(id, completedChallenges)

    res.status(StatusCodes.OK).json({
      data,
      message: 'User Stats fetched successfully',
    })
  }),
}
