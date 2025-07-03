import { StatusCodes } from 'http-status-codes'
import { closeGlobalBrowser } from '../../utils'

export function makeScraperHandler(scrapeFn, message) {
  return async (req, res) => {
    res.status(StatusCodes.ACCEPTED).json({ message })
    try {
      await scrapeFn()
    } finally {
      await closeGlobalBrowser()
    }
  }
}
