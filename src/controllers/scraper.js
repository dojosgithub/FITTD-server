import { asyncMiddleware } from '../middlewares'
import {
  scrapeAgolde,
  scrapeEbDenim,
  scrapeHouseOfCB,
  scrapeJCrew,
  scrapeLuluLemon,
  scrapeSaboSkirt,
  scrapeSelfPotrait,
  scrapeTheReformation,
} from '../services'
import { makeScraperHandler } from '../utils'

const SCRAPING_STARTED_MSG = 'Scraping started. After few minutes run get all products api to see the results'

export const CONTROLLER_SCRAPER = {
  getHouseOfCBProducts: asyncMiddleware(makeScraperHandler(scrapeHouseOfCB, SCRAPING_STARTED_MSG)),
  getEbDenimProducts: asyncMiddleware(makeScraperHandler(scrapeEbDenim, SCRAPING_STARTED_MSG)),
  getLuluLemonProducts: asyncMiddleware(makeScraperHandler(scrapeLuluLemon, SCRAPING_STARTED_MSG)),
  getAgoldeMenAndWomenProducts: asyncMiddleware(makeScraperHandler(scrapeAgolde, SCRAPING_STARTED_MSG)),
  getTheReformationProducts: asyncMiddleware(makeScraperHandler(scrapeTheReformation, SCRAPING_STARTED_MSG)),
  getSelfPotraitProducts: asyncMiddleware(makeScraperHandler(scrapeSelfPotrait, SCRAPING_STARTED_MSG)),
  getJCrewProducts: asyncMiddleware(makeScraperHandler(scrapeJCrew, SCRAPING_STARTED_MSG)),
  getSaboSkirtProducts: asyncMiddleware(makeScraperHandler(scrapeSaboSkirt, SCRAPING_STARTED_MSG)),
}
