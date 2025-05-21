// * Libraries
import { Router } from 'express'

// * Controllers
import { CONTROLLER_SIZECHART } from '../controllers'

// * Middlewares
import { Authenticate } from '../middlewares'

const router = Router()

router.post('/update-size-chart', Authenticate(), CONTROLLER_SIZECHART.updateSizeChart)
router.put('/migrate-size-chart', Authenticate(), CONTROLLER_SIZECHART.migrateSizeCharts)
router.delete('/remove-size-chart', Authenticate(), CONTROLLER_SIZECHART.removeSizeChartsFromProducts)
router.put('/append-size-chart', Authenticate(), CONTROLLER_SIZECHART.appendSizeChartSection)

export default router
