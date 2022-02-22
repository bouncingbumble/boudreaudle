const mongoose = require('mongoose')

const userSchema = new mongoose.Schema({
    phone: {
        type: String,
        required: true,
        unique: false,
    },
    guesses: {
        type: Number,
        required: true,
        default: 0,
    },
    wordsTried: [String],
    hasWon: {
        type: Boolean,
        required: true,
        default: false,
    },
    streak: {
        type: Number,
        required: true,
        default: 0,
    },
})

const User = mongoose.model('User', userSchema)

module.exports = User
