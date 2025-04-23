// * Libraries
import { StatusCodes } from 'http-status-codes'
import dotenv from 'dotenv'

dotenv.config()

// * Models

// * Middlewares
import { asyncMiddleware } from '../middlewares'

// * Services

// * Utilities

export const CONTROLLER_USER = {
  profile: asyncMiddleware(async (req, res) => {
    console.log('running profile')
    res.status(StatusCodes.OK).json({
      message: 'Profiles Fetched Successfully',
    })
  }),
}
