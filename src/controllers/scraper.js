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

export const CONTROLLER_SCRAPER = {
  getHouseOfCBProducts: asyncMiddleware(async (req, res) => {
    res.status(StatusCodes.ACCEPTED).json({
      message: 'Scraping started. Run Get All Products Api to see the results',
    })
    try {
      await scrapeHouseOfCBProducts()
    } finally {
      await closeGlobalBrowser()
    }
  }),
  getEbDenimProducts: asyncMiddleware(async (req, res) => {
    res.status(StatusCodes.ACCEPTED).json({
      message: 'Scraping started. Run Get All Products Api to see the results',
    })
    try {
      await scrapeEbDenimProducts()
    } finally {
      await closeBrowser()
    }
  }),
  getLuluLemonProducts: asyncMiddleware(async (req, res) => {
    res.status(StatusCodes.ACCEPTED).json({
      message: 'Scraping started. Run Get All Products Api to see the results',
    })
    try {
      await scrapeLuluLemonProducts()
    } finally {
      await closeGlobalBrowser()
    }
  }),
  getAgoldeMenAndWomenProducts: asyncMiddleware(async (req, res) => {
    res.status(StatusCodes.ACCEPTED).json({
      message: 'Scraping started. Run Get All Products Api to see the results',
    })
    try {
      await scrapeAgoldeMenAndWomenProducts()
    } finally {
      await closeGlobalBrowser()
    }
  }),
  getTheReformationProducts: asyncMiddleware(async (req, res) => {
    res.status(StatusCodes.ACCEPTED).json({
      message: 'Scraping started. Run Get All Products Api to see the results',
    })
    try {
      await scrapeTheReformationProducts()
    } finally {
      await closeGlobalBrowser()
    }
  }),
  getSelfPotraitProducts: asyncMiddleware(async (req, res) => {
    res.status(StatusCodes.ACCEPTED).json({
      message: 'Scraping started. Run Get All Products Api to see the results',
    })
    try {
      await scrapeSelfPotraitProducts()
    } finally {
      await closeGlobalBrowser()
    }
  }),
  getJCrewProducts: asyncMiddleware(async (req, res) => {
    res.status(StatusCodes.ACCEPTED).json({
      message: 'Scraping started. Run Get All Products Api to see the results',
    })
    try {
      await scrapeJCrewProducts()
    } finally {
      await closeGlobalBrowser()
    }
  }),
  getSaboSkirtProducts: asyncMiddleware(async (req, res) => {
    res.status(StatusCodes.ACCEPTED).json({
      message: 'Scraping started. Run Get All Products Api to see the results',
    })
    try {
      await scrapeSaboSkirtProducts()
    } finally {
      await closeGlobalBrowser()
    }
  }),
}
