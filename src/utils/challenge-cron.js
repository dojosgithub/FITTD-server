// Using ES6 module import syntax
import { schedule } from 'node-cron'
import {
  AUCTION_STATUS,
  CAR_STATUS,
  CHALLENGE_STATUS,
  convertTimeToSeconds,
  SYSTEM_STAFF_ROLE,
  USER_LEVELS,
  USER_TYPES,
} from './user'
import Email from './email'
import { Notification } from '../models/Notifications'
import { toObjectId } from './misc'
import { User, Badge, Challenge, UserChallengeProgress } from '../models'
import { sendPushNotification } from './pushNotification'
const admin = require('firebase-admin')

// "0 0 * * 0", Every sunday at 00:00 - Required
// "59 14 * * 1", Every monday at 14:59
// "* * * * * *", Every second
// "* * * * *", Every minute
// 0 0 0 * * *, Every Midnight
// 0 0 * * *, every 24 hour

// Define the task using ES6 arrow function syntax
export const challengeTask = schedule(
  '0 0 0 * * *', // Every Midnight
  // '* * * * *', // Every Midnight
  () => {
    // if (process.env.NODE_ENV) automatedEmails()
    console.log('CHALLENGE CRON JOB RUNNING!!!')
    changeChallangeStatus()
    changeUserLevels()
  },
  { timezone: 'America/New_York' }
)

async function changeChallangeStatus() {
  try {
    const today = new Date()

    const challenges = await Challenge.find({
      status: CHALLENGE_STATUS.LIV,
      challengeEnd: { $lt: today },
    })

    if (challenges.length > 0) {
      for (const challenge of challenges) {
        await Challenge.updateOne({ _id: challenge._id }, { $set: { status: CHALLENGE_STATUS.CLT } })
        const progress = await UserChallengeProgress.find({ challenge: toObjectId(challenge._id) }).populate({
          path: 'user',
          select: 'file firstName lastName',
        })
        // Sort progress based on totalTime in ascending order
        if (progress.length > 0) {
          progress.sort((a, b) => {
            // Handle the case where points are zero
            if (a.points === 0 && b.points !== 0) return 1
            if (b.points === 0 && a.points !== 0) return -1
            if (a.points === 0 && b.points === 0) return 0

            // First sort by points (higher points come first)
            if (a.points !== b.points) return b.points - a.points

            // If points are the same, sort by finishedAt date (earlier finish comes first)
            const finishedAtA = new Date(a.finishedAt)
            const finishedAtB = new Date(b.finishedAt)

            return finishedAtA - finishedAtB
          })
          const badge = await Badge.findById(challenge?.badge)
          if (challenge.badgeCriteria === 'Exclusive') {
            const userId = progress[0]?.user?._id
            const user = await User.findById(userId)
            const badgeExist = user?.badges?.findIndex((b) => b?.badgeId?.toString() == badge?._id?.toString())
            if (badgeExist != -1 && user?.badges?.length > 0) {
              user.badges[badgeExist].quantity += 1
              await user.save()
            } else {
              const newBadge = {
                badgeId: badge?._id,
                name: badge?.name,
                _type: badge?.type,
                image: badge?.image,
                quantity: 1,
              }
              user.badges.push(newBadge)
              await user.save()
            }
            if (user && user.fcmToken) {
              sendPushNotification({
                token: user.fcmToken,
                notification: {
                  title: 'Congratulations!',
                  body: `Congratulation! You’ve won the challenge: ${challenge?.name} and receive a badge: ${badge?.name}.`,
                },
              })
            }
          }
          if (challenge.badgeCriteria === 'Inclusive') {
            if (progress) {
              for (const prog of progress) {
                const IncUser = await User.findById(prog?.user?._id)
                const badgeExist = IncUser?.badges?.findIndex((b) => b?.badgeId?.toString() == badge?._id?.toString())
                if (badgeExist != -1 && IncUser?.badges.length > 0) {
                  IncUser.badges[badgeExist].quantity += 1
                  await IncUser.save()
                } else {
                  const newBadge = {
                    badgeId: badge?._id,
                    name: badge?.name,
                    _type: badge?.type,
                    image: badge?.image,
                    quantity: 1,
                  }
                  IncUser.badges.push(newBadge)
                  await IncUser.save()
                }
                if (IncUser && IncUser.fcmToken) {
                  sendPushNotification({
                    token: IncUser.fcmToken,
                    notification: {
                      title: 'Congratulations!',
                      body: `Congratulation! You’ve recived the badge: ${badge?.name} for the challenge: ${challenge?.name}.`,
                    },
                  })
                }
              }
            }
          }
        }
      }
    }
  } catch (e) {
    console.log('CHALLENGE CRON JOB ERROR:', e)
  }
}

async function changeUserLevels() {
  try {
    // Find users whose lastActive is within the last 24 hours
    const users = await User.find({})

    if (users.length > 0) {
      // Loop through the users and add or update the badge
      for (const user of users) {
        let newLevel

        if (user.points >= 0 && user.points <= 999) {
          newLevel = USER_LEVELS.BEG
        }
        if (user.points >= 1000 && user.points <= 1999) {
          newLevel = USER_LEVELS.INT
        }
        if (user.points >= 2000 && user.points <= 2999) {
          newLevel = USER_LEVELS.FN
        }
        if (user.points >= 3000 && user.points <= 3999) {
          newLevel = USER_LEVELS.FP
        }
        if (user.points >= 4000) {
          newLevel = USER_LEVELS.EV
        }

        if (newLevel && newLevel !== user.level) {
          user.level = newLevel
          await user.save()

          if (user.fcmToken) {
            sendPushNotification({
              token: user.fcmToken,
              notification: {
                title: 'Congratulations!',
                body: `Level up! you have reached to ${newLevel}.`,
              },
            })
          }
        }
      }
    } else {
      console.log('No users found')
    }
  } catch (e) {
    console.log('CRON JOB ERROR:', e)
  }
}
