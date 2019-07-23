import c from './config'
import express from 'express'
import bodyParser from 'body-parser'
import {expressHelpers, run} from 'yacol'
import winston from 'winston'
import {URL} from 'url'
import _request from 'request-promise'
import _ from 'lodash'

const request = _request.defaults({
  headers: {Authorization: `Bearer ${c.jiraAuthorization}`},
})

const logger = winston.createLogger({
  level: c.logLevel,
  format: winston.format.simple(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({filename: 'error.log', level: 'error'}),
    new winston.transports.File({filename: 'combined.log'}),
  ],
})

const app = express()
app.use(bodyParser.urlencoded({extended: true}))

const {register, runApp} = expressHelpers

function* vacations(req, res) {
  yield (async function() {
    const tempoPath = 'core/3/worklogs/team/4'
    const url = new URL(c.jiraUrl)
    url.pathname = tempoPath
    url.searchParams.append('from', `${req.params.year}-01-01`)
    url.searchParams.append('to', `${req.params.year}-12-31`)
    url.searchParams.append('limit', 1000)

    let requestUrl = url.toString()
    let result = []

    while (requestUrl) {
      const response = JSON.parse(await request(requestUrl))
      result = result.concat(response.results
        .map((worklog) => [
          ['startDate'],
          ['author.accountId'],
          ['issue.key', (k) => (!k.startsWith('VACA')) * worklog.timeSpentSeconds / 3600],
          ['issue.key', (k) => (k === 'VACA-3') * worklog.timeSpentSeconds / 3600],
        ].map(([path, f = _.identity]) => f(_.get(worklog, path)))
        )
      )
      requestUrl = response.metadata.next
    }

    res.status(200).send(JSON.stringify(result))
  })()
}

function* payroll(req, res) {
  yield (async function() {
    const tempoPath = 'core/3/worklogs/team/4'
    const url = new URL(c.jiraUrl)
    const year = parseInt(req.params.year, 10)
    const month = parseInt(req.params.month, 10) - 1

    function toISO(y, m, d) {
      return (new Date(Date.UTC(y, m, d))).toISOString().substr(0, 10)
    }

    const dateFrom = toISO(year, month, 1)
    const dateTo = toISO(year, month + 1, 0)
    url.pathname = tempoPath
    url.searchParams.append('from', dateFrom)
    url.searchParams.append('to', dateTo)
    url.searchParams.append('limit', 1000)

    let requestUrl = url.toString()
    let result = []
    while (requestUrl) {
      const response = JSON.parse(await request(requestUrl))
      result = result.concat(response.results
        .map((worklog) => [
          ['timeSpentSeconds', (t) => t / 3600],
          ['startDate'],
          ['author.accountId'],
          ['issue.key', (k) => _.get(req.query, k, k.split('-')[0])],
        ].map(([path, f = _.identity]) => f(_.get(worklog, path)))
        )
      )
      requestUrl = response.metadata.next
    }

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
