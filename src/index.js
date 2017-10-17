import c from './config'
import express from 'express'
import bodyParser from 'body-parser'
import {expressHelpers, run} from 'yacol'
import logger from 'winston'
import {URL} from 'url'
import _request from 'request-promise'

const request = _request.defaults({
  headers: {Authorization: `Basic ${c.jiraAuthorization}`},
})

logger.cli()
logger.level = c.logLevel
logger.setLevels(logger.config.npm.levels)


const app = express()
app.use(bodyParser.urlencoded())

const {register, runApp} = expressHelpers

function* vacations(req, res) {
  yield (async function() {
    const tempoPath = 'rest/tempo-timesheets/3/worklogs/'
    const url = new URL(c.jiraUrl)
    url.pathname = tempoPath
    url.searchParams.append('teamId', '4')
    url.searchParams.append('dateFrom', '2017-10-01')
    url.searchParams.append('dateTo', '2017-12-31')
    const result = await request(url.toString())
    res.status(200).send(result)
  })()
}

const r = {
  vacations: '/vacations',
}

register(app, 'get', r.vacations, vacations)

// eslint-disable-next-line require-await
;(async function() {
  run(runApp)
  app.listen(c.port, () =>
    logger.log('info', `App started on localhost:${c.port}.`)
  )

})().catch((e) => {
  logger.log('error', e)
  process.exit(1)
})
