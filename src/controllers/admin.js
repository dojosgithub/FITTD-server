import { StatusCodes } from 'http-status-codes'

export const CONTROLLER_ADMIN = {
  restartServer: asyncMiddleware(async (req, res) => {
    // Replace this with your real admin authentication logic

    res.status(StatusCodes.OK).json({
      message: 'Server is restarting...',
    })
    // Wait for response to be sent, then exit
    setTimeout(() => {
      console.log('Server is exiting for restart...')
      process.exit(0) // Heroku will restart the crashed dyno
    }, 1000)
  }),
}
