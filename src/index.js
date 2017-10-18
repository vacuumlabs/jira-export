import c from './config'
import express from 'express'
import bodyParser from 'body-parser'
import {expressHelpers, run} from 'yacol'
import logger from 'winston'
import {URL} from 'url'
import _request from 'request-promise'
import _ from 'lodash'

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
    url.searchParams.append('dateFrom', `${req.params.year}-01-01`)
    url.searchParams.append('dateTo', `${req.params.year}-12-31`)

    const result = JSON.parse(await request(url.toString()))
      .map((worklog) => [
        ['timeSpentSeconds'],
        ['dateStarted', (s) => s.substr(0, 10)],
        ['author.name'],
        ['issue.key'],
        ['issue.key', (k) => !k.startsWith('VACA')],
        ['issue.key', (k) => k === 'VACA-3'],
      ].map(([path, f=_.identity]) => f(_.get(worklog, path)))
      )

    res.status(200).send(JSON.stringify(result))
  })()
}

const r = {
  vacations: '/vacations/:year',
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
