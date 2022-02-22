const mongoose = require('mongoose')

// mongoose.set('debug', true)
mongoose.Promise = Promise
mongoose.connect(
    `mongodb+srv://admin:${process.env.MONGODB_PASSWORD}@cluster0.z00fa.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`,
    {
        keepAlive: true,
        useNewUrlParser: true,
    }
)

module.exports.User = require('./user')
