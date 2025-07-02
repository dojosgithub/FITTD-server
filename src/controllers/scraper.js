import { StatusCodes } from 'http-status-codes'
import { asyncMiddleware } from '../middlewares'
import {
  scrapeAgoldeMenAndWomenProducts,
  scrapeEbDenimProducts,
  scrapeHouseOfCBProducts,
  scrapeJCrewProducts,
  scrapeLuluLemonProducts,
  scrapeSaboSkirtProducts,
  scrapeSelfPotraitProducts,
  scrapeTheReformationProducts,
} from '../services'
import { closeGlobalBrowser } from '../utils'

const SCRAPING_STARTED_MSG = 'Scraping started. After few minutes run get all products api to see the results'

export const CONTROLLER_SCRAPER = {
  getHouseOfCBProducts: asyncMiddleware(async (req, res) => {
    res.status(StatusCodes.ACCEPTED).json({
      message: SCRAPING_STARTED_MSG,
    })
    try {
      await scrapeHouseOfCBProducts()
    } finally {
      await closeGlobalBrowser()
    }
  }),
  getEbDenimProducts: asyncMiddleware(async (req, res) => {
    res.status(StatusCodes.ACCEPTED).json({
      message: SCRAPING_STARTED_MSG,
    })
    try {
      await scrapeEbDenimProducts()
    } finally {
      await closeGlobalBrowser()
    }
  }),
  getLuluLemonProducts: asyncMiddleware(async (req, res) => {
    res.status(StatusCodes.ACCEPTED).json({
      message: SCRAPING_STARTED_MSG,
    })
    try {
      await scrapeLuluLemonProducts()
    } finally {
      await closeGlobalBrowser()
    }
  }),
  getAgoldeMenAndWomenProducts: asyncMiddleware(async (req, res) => {
    res.status(StatusCodes.ACCEPTED).json({
      message: SCRAPING_STARTED_MSG,
    })
    try {
      await scrapeAgoldeMenAndWomenProducts()
    } finally {
      await closeGlobalBrowser()
    }
  }),
  getTheReformationProducts: asyncMiddleware(async (req, res) => {
    res.status(StatusCodes.ACCEPTED).json({
      message: SCRAPING_STARTED_MSG,
    })
    try {
      await scrapeTheReformationProducts()
    } finally {
      await closeGlobalBrowser()
    }
  }),
  getSelfPotraitProducts: asyncMiddleware(async (req, res) => {
    res.status(StatusCodes.ACCEPTED).json({
      message: SCRAPING_STARTED_MSG,
    })
    try {
      await scrapeSelfPotraitProducts()
    } finally {
      await closeGlobalBrowser()
    }
  }),
  getJCrewProducts: asyncMiddleware(async (req, res) => {
    res.status(StatusCodes.ACCEPTED).json({
      message: SCRAPING_STARTED_MSG,
    })
    try {
      await scrapeJCrewProducts()
    } finally {
      await closeGlobalBrowser()
    }
  }),
  getSaboSkirtProducts: asyncMiddleware(async (req, res) => {
    res.status(StatusCodes.ACCEPTED).json({
      message: SCRAPING_STARTED_MSG,
    })
    try {
      await scrapeSaboSkirtProducts()
    } finally {
      await closeGlobalBrowser()
    }
  }),
}
