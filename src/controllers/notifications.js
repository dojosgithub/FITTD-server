import { StatusCodes } from 'http-status-codes'
import { asyncMiddleware } from '../middlewares'
import { Notification } from '../models'

export const CONTROLLER_NOTIFICATION = {
  getUserNotifications: asyncMiddleware(async (req, res) => {
    const userId = req.decoded._id

    const notifications = await Notification.find({
      receivers: {
        $elemMatch: {
          userId,
        },
      },
    }).sort({ createdAt: -1 })

    return res.status(StatusCodes.OK).json({
      success: true,
      notifications,
    })
  }),
  markNotificationAsRead: asyncMiddleware(async (req, res) => {
    const userId = req.decoded._id
    const { notificationId } = req.query

    const result = await Notification.updateOne(
      {
        _id: notificationId,
        'receivers.userId': userId,
      },
      {
        $set: { 'receivers.$.isUnRead': false },
      }
    )

    if (result.modifiedCount === 0) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: 'Notification not found or already marked as read.',
      })
    }

    return res.status(StatusCodes.OK).json({
      success: true,
      message: 'Notification marked as read.',
    })
  }),
}
