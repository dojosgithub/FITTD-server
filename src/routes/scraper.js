import { Router } from 'express'
import { CONTROLLER_SCRAPER } from '../controllers'
import { Authenticate } from '../middlewares'

const router = Router()

router.get('/get-saboskirt-products', Authenticate(), CONTROLLER_SCRAPER.getSaboSkirtProducts)
router.get('/get-ebdenim-products', Authenticate(), CONTROLLER_SCRAPER.getEbDenimProducts)
router.get('/get-agolde-products', Authenticate(), CONTROLLER_SCRAPER.getAgoldeMenAndWomenProducts)
router.get('/get-house-of-cb-products', Authenticate(), CONTROLLER_SCRAPER.getHouseOfCBProducts)
router.get('/get-jcrew-products', Authenticate(), CONTROLLER_SCRAPER.getJCrewProducts)
router.get('/get-lululemon-products', Authenticate(), CONTROLLER_SCRAPER.getLuluLemonProducts)
router.get('/get-the-reformation-products', Authenticate(), CONTROLLER_SCRAPER.getTheReformationProducts)
router.get('/get-self-potrait-products', Authenticate(), CONTROLLER_SCRAPER.getSelfPotraitProducts)

export default router
