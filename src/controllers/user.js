// * Libraries
import { StatusCodes } from 'http-status-codes'
import dotenv from 'dotenv'

dotenv.config()

// * Models

// * Middlewares
import { asyncMiddleware } from '../middlewares'
import { User } from '../models'
import { generateOTP } from '../utils/generateOtp'
import Email from '../utils/email'

// * Services

// * Utilities

export const CONTROLLER_USER = {
  getProfile: asyncMiddleware(async (req, res) => {
    const { _id: userId } = req.decoded

    if (!userId) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: 'User id not found' })
    }
    const user = await User.findById(userId).populate('measurements')

    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: 'User not found' })
    }

    res.status(StatusCodes.OK).json({ data: user, message: 'Profile Fetched successfully' })
  }),
  verifyOrUpdateProfile: asyncMiddleware(async (req, res) => {
    const { _id: userId } = req.decoded
    const { email, mobile, isVerified } = req.body

    if (!userId) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: 'User ID not found' })
    }

    // Fetch current user
    const user = await User.findById(userId)
    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: 'User not found' })
    }

    // Check if email is provided and is different from the current one
    if (email && email !== user.email) {
      const emailExists = await User.findOne({ email })
      if (emailExists) {
        return res.status(StatusCodes.CONFLICT).json({ message: 'Email is already in use by another account' })
      }
      if (isVerified) {
        user.email = email
      }
    }

    // Check if mobile is provided and is different from the current one
    if (mobile && mobile !== user.mobile) {
      const mobileExists = await User.findOne({ mobile })
      if (mobileExists) {
        return res.status(StatusCodes.CONFLICT).json({ message: 'Mobile number is already in use by another account' })
      }
      if (isVerified) {
        user.mobile = mobile
      }
    }
    if (!isVerified) {
      const code = await generateOTP({ email })
      const sendEmail = await new Email({ email })
      const emailProps = { code, name: user.name }
      await sendEmail.sendForgotPassword(emailProps)
    }
    if (isVerified) {
      await user.save()
    }

    return res.status(StatusCodes.OK).json({
      data: user,
      message: isVerified
        ? 'Profile updated successfully'
        : 'Verification required. OTP has been sent to your new contact information.',
    })
  }),
  updateProfile: asyncMiddleware(async (req, res) => {
    const { _id: userId } = req.decoded
    const { name } = req.body

    if (!userId) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: 'User ID not found' })
    }

    const user = await User.findById(userId)
    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: 'User not found' })
    }

    // Update only fields that are provided
    if (name) user.name = name
    if (req.file) user.image = req.file.path

    await user.save()
    return res.status(StatusCodes.OK).json({
      data: user,
      message: 'Profile updated successfully',
    })
  }),
}
