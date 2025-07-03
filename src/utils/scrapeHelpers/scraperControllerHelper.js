import { StatusCodes } from 'http-status-codes'
import { closeGlobalBrowser } from '../../utils'

const SCRAPING_STARTED_MSG = 'Scraping started. After few minutes run get all products api to see the results'

export function makeScraperHandler(scrapeFn) {
  return async (req, res) => {
    res.status(StatusCodes.ACCEPTED).json({ message: SCRAPING_STARTED_MSG })
    try {
      await scrapeFn()
    } finally {
      await closeGlobalBrowser()
    }
  }
}
