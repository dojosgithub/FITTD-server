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

export const CONTROLLER_SCRAPER = {
  getHouseOfCBProducts: asyncMiddleware(makeScraperHandler(scrapeHouseOfCB)),
  getEbDenimProducts: asyncMiddleware(makeScraperHandler(scrapeEbDenim)),
  getLuluLemonProducts: asyncMiddleware(makeScraperHandler(scrapeLuluLemon)),
  getAgoldeMenAndWomenProducts: asyncMiddleware(makeScraperHandler(scrapeAgolde)),
  getTheReformationProducts: asyncMiddleware(makeScraperHandler(scrapeTheReformation)),
  getSelfPotraitProducts: asyncMiddleware(makeScraperHandler(scrapeSelfPotrait)),
  getJCrewProducts: asyncMiddleware(makeScraperHandler(scrapeJCrew)),
  getSaboSkirtProducts: asyncMiddleware(makeScraperHandler(scrapeSaboSkirt)),
}
