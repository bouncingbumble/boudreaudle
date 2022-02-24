require('dotenv').config()
const express = require('express')
const app = express()
const server = require('http').createServer(app)
const cors = require('cors')
const port = process.env.PORT || 8080
const bodyParser = require('body-parser')
const errorHandler = require('./util/error')
var accountSid = process.env.TWILIO_ACCOUNT_SID // Your Account SID from www.twilio.com/console
var authToken = process.env.TWILIO_AUTH_TOKEN // Your Auth Token from www.twilio.com/console
const twilio = require('twilio', accountSid, authToken)
const MessagingResponse = require('twilio').twiml.MessagingResponse
var checkWord = require('check-word'),
    validWords = checkWord('en')
const db = require('./db')
const { words } = require('./words')
var CronJob = require('cron').CronJob

console.log('Before job instantiation')
const job = new CronJob(
    '00 00 08 * * *',
    async () => {
        const d = new Date()
        console.log('Midnight:', d)
        console.log('resetting users')
        const users = await db.User.find()

        for await (let user of users) {
            user.guesses = 0
            user.wordsTried = []
            user.hasWon = false
            await user.save()
        }
    },
    null,
    true
)

job.start()

console.log(new Date())

app.use(cors())
app.use(bodyParser.json({ limit: '50mb' }))
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }))

app.post('/api/v1/users', async (req, res, next) => {
    try {
        //create user
        await db.User.create({ phone: req.body.phone })

        //send back welcome message, thank you for playing boudreaudle or someth
        res.status(201).send
    } catch (error) {
        next(error)
    }
})

app.post('/api/v1/twilio', async (req, res, next) => {
    let user
    let response = new MessagingResponse()
    let todaysWord = getTodaysWord()
    let phone = req.body.From

    try {
        user = await db.User.findOne({ phone })
    } catch (error) {
        next(error)
    }

    if (user === null) {
        user = await db.User.create({ phone })

        response.message(
            `welcome to boudreaudle, ty for playing. come back each day for a new word.\nstart the game by making a 5 letter guess.`
        )
    } else {
        let guess = req.body.Body.toUpperCase().replace(/\s+/g, '')
        console.log(`The user guessed ${guess}`)

        if (user.hasWon) {
            response.message(
                `you already won! come back tomorrow (12:00am PST) to play again!`
            )
        } else {
            if (guess === 'WORD?' && user.guesses === 6) {
                response.message(`bummer, the word was ${todaysWord}`)
            } else {
                let winLossMessage = ''

                if (validWords.check(guess.toLowerCase())) {
                    if (guess.length === 5) {
                        try {
                            let guesses = user.guesses

                            if (!user.hasWon && user.guesses < 6) {
                                guesses = guesses + 1
                                user.guesses = guesses
                                user.wordsTried.push(guess)
                                await user.save()
                            }

                            let gameMessage = await isCorrectWord(
                                guess,
                                todaysWord,
                                user
                            )

                            if (guesses > 5 && guess !== todaysWord) {
                                guesses = 'X'
                                user.streak = 0
                                await user.save()
                                winLossMessage =
                                    'you lost!\nreply with "word?" to see solution. come back tomorrow (12:00am PST) to play again!'
                            }

                            if (guess === todaysWord) {
                                winLossMessage = 'you win!'
                            }
                            response.message(
                                `boudreaudle ${getBoudreaudleDay()} ${guesses}/6\n${gameMessage} \n ${winLossMessage}`
                            )
                        } catch (error) {
                            console.log(error)
                            next(error)
                        }
                    } else if (guess.length !== 5) {
                        response.message(
                            `sorry, that is not a 5 letter word, please try again`
                        )
                    }
                } else {
                    response.message(
                        'sorry, that is not a real word, please try again'
                    )
                }
            }
        }
    }
    res.set('Content-Type', 'text/xml')
    res.send(response.toString())
})

app.use((req, res, next) => {
    let err = new Error('Not Found')
    err.status = 404
    next(err)
})

const getBoudreaudleDay = () => {
    const oneDay = 24 * 60 * 60 * 1000 // hours*minutes*seconds*milliseconds
    const firstDate = new Date(2022, 2, 21)
    const currentDay = new Date()
    const secondDate = new Date(
        currentDay.getFullYear(),
        currentDay.getMonth() + 1,
        currentDay.getDate()
    )

    const dayOfBoudreaudle = Math.round(
        Math.abs((secondDate - firstDate) / oneDay) + 1
    )
    return dayOfBoudreaudle
}

const getTodaysWord = () => {
    return words[getBoudreaudleDay() - 1]
}

const isCorrectWord = async (guess, todaysWord, user) => {
    let wordsTried = user.wordsTried
    let msg = '\n'

    if (guess === todaysWord) {
        if (!user.hasWon) {
            user.hasWon = true
            user.streak = user.streak + 1
            await user.save()
        }

        msg = msg + `Streak ${user.streak}\n`
    }

    wordsTried.map((word) => {
        for (var i = 0; i < word.length; i++) {
            let letter = word.charAt(i)

            if (letter === todaysWord.charAt(i)) {
                msg = msg + '🟩 '
            } else if (todaysWord.includes(letter)) {
                msg = msg + '🟨 '
            } else {
                msg = msg + '⬛️ '
            }
        }
        msg = msg + '\n'
    })

    return msg
}

app.use(errorHandler)

server.listen(port, () => {
    console.log('App is running on port ' + port)
})
