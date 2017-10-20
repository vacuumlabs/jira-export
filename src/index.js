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
        ['dateStarted', (s) => s.substr(0, 10)],
        ['author.name'],
        ['issue.key', (k) => (!k.startsWith('VACA')) * worklog.timeSpentSeconds / 3600],
        ['issue.key', (k) => (k === 'VACA-3') * worklog.timeSpentSeconds / 3600],
      ].map(([path, f=_.identity]) => f(_.get(worklog, path)))
      )

    res.status(200).send(JSON.stringify(result))
  })()
}

function* payroll(req, res) {
  yield (async function() {
    const tempoPath = 'rest/tempo-timesheets/3/worklogs/'
    const url = new URL(c.jiraUrl)
    const year = parseInt(req.params.year)
    const month = parseInt(req.params.month) - 1

    function toISO(y, m, d) {
      return (new Date(Date.UTC(y, m, d))).toISOString().substr(0, 10)
    }

    const dateFrom = toISO(year, month, 1)
    const dateTo = toISO(year, month+1, 0)
    url.pathname = tempoPath
    url.searchParams.append('teamId', '4')
    url.searchParams.append('dateFrom', dateFrom)
    url.searchParams.append('dateTo', dateTo)

    const result = JSON.parse(await request(url.toString()))
      .map((worklog) => [
        ['timeSpentSeconds', (t) => t / 3600],
        ['dateStarted', (s) => s.substr(0, 10)],
        ['author.name'],
        ['issue.key', (k) => k.split('-')[0]],
      ].map(([path, f=_.identity]) => f(_.get(worklog, path)))
      )

    res.status(200).send(JSON.stringify(result))
  })()
}

const r = {
  vacations: '/vacations/:year',
  payroll: '/payroll/:year/:month',
}

register(app, 'get', r.vacations, vacations)
register(app, 'get', r.payroll, payroll)

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
