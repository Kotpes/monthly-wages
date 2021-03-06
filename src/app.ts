import express, { Request, Response } from 'express'
import createError from 'http-errors'
import logger from 'morgan'
import path from 'path'

import indexRouter from './routes/index'
import { NextFunction } from 'express-serve-static-core';
import { Function } from 'babel-types';

const app = express()

// view engine setup
app.set('views', path.join(__dirname, '/../views'))
app.set('view engine', 'pug')

app.use(logger('dev'))
app.use(express.json())
app.use(express.urlencoded({extended: false}))
app.use(express.static(path.join(__dirname, '/../public')))

app.use('/', indexRouter)

// catch 404 and forward to error handler
app.use((req, res, next) => {
  next(createError(404))
})


type Res = NextFunction & {
  locals?: {
    message?: string,
    error?: object,
  },
  status?: any,
  render?: any
}

type Error = Request & {
  message?: string,
  status?: number
}


// error handler
app.use((err: Error, req, res: Res) => {
  // set locals, only providing error in development
  res.locals.message = err.message
  res.locals.error = req.app.get('env') === 'development' ? err : {}

  // render the error page
  res.status(err.status || 500)
  res.render('error')
})

export default app

app.listen(3000, () => console.log('App is running on port 3000!'))
