import { UserMeasurement } from '../models/UserMeasurements.js'
import { StatusCodes } from 'http-status-codes'
import { asyncMiddleware } from '../middlewares'
import { User } from '../models/User.js'
import { sendPushNotification } from '../utils/pushNotification.js'
import { isUserMeasurementComplete } from '../services/notification.js'

// Save or update user measurement
export const CONTROLLER_MEASUREMENT = {
  // Save or update user measurements
  saveOrUpdateMeasurement: asyncMiddleware(async (req, res) => {
    const userId = req.decoded._id
    const data = req.body

    if (!data) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: 'Measurement data is required.',
      })
    }

    const existingMeasurement = await UserMeasurement.findOne({ userId })
    const wasIncomplete = existingMeasurement ? !isUserMeasurementComplete(existingMeasurement) : true
    let result = null
    if (existingMeasurement) {
      result = await UserMeasurement.findOneAndUpdate({ userId }, { $set: data }, { new: true })
    } else {
      result = await new UserMeasurement({ userId, ...data }).save()
    }
    await User.findByIdAndUpdate(userId, {
      measurements: result._id,
    })
    const isNowComplete = isUserMeasurementComplete(result)

    if (wasIncomplete && isNowComplete) {
      const user = await User.findById(userId)
      if (user?.fcmToken) {
        sendPushNotification({
          token: user.fcmToken,
          userId,
          notification: {
            title: 'You’re a Style Pro!',
            body: `Congrats on completing your profile! Enjoy personalized recommendations tailored just for you.`,
          },
        })
      }
    }

    return res.status(StatusCodes.OK).json({
      data: result,
      message: 'Measurement saved successfully.',
    })
  }),

  // Get user measurements
  getUserMeasurement: asyncMiddleware(async (req, res) => {
    const userId = req.decoded._id

    const measurement = await UserMeasurement.findOne({ userId })

    if (!measurement) {
      return res.status(StatusCodes.NOT_FOUND).json({
        message: 'Measurement not found.',
      })
    }

    return res.status(StatusCodes.OK).json({
      data: measurement,
    })
  }),
}
