const mongoose = require('mongoose')
const redis = require('redis')
const util = require('util')
const redisUrl = 'redis://127.0.0.1:6379'

const client = redis.createClient(redisUrl)
client.hget = util.promisify(client.hget)

// get a ref to the existing default function which gets executed anytime we do a query search 
const exec = mongoose.Query.prototype.exec;
// Default options obect to be empty if not passed. Options will be top level way of sorting caches
mongoose.Query.prototype.cache = function (options = {}) {
    //this is equal to the query instance 
    this.useCache = true
    // Hash key will be out top level property
    this.hashKey = JSON.stringify(options.key || '')
    return this
}

// Arrow function messes around with this by firing immediatly 
mongoose.Query.prototype.exec = async function () {
    // check to see if useCahce has been attached to the 
    if (!this.useCache) { return exec.apply(this, arguments) }
    // This adds the collection to the user id
    const key = JSON.stringify(Object.assign({}, this.getQuery(), { colletion: this.mongooseCollection.name }))

    // See if we have a value for key in Redis. Hget instead of get because we are using higher level property  to sort by user
    const cacheValue = await client.hget(this.hashKey)
    // If we do, return that 
    if (cacheValue) {
        console.log('came back from cache')
        // If we just return the cacheValue the blogs do not display because it is expecting a mongo Model format not just basic object 
        // So we need to create a new model 
        // But each blog post needs to be turned into a mongoose model. CacheValue will only work if one blog post. This is an array of 3 records
        //const doc = new this.model(JSON.parse(cacheValue))
        // We need to do somethig diferently depending if this is one or multiple records 
        const doc = JSON.parse(cacheValue)
        // Check if doc is an array of objects
        return Array.isArray(doc) ?
            // its an array so return a model for each one
            doc.map(d => new this.model(d))
            :
            // Its not an array
            new this.model(doc)
    }
    // Otherwise, issue the query and store the result in Redis 
    const result = await exec.apply(this, arguments)
    client.hset(this.hashKey, JSON.stringify(result), 'EX', 10)
    console.log('result ', result)
    return result
}

//sole function is to delete data nested on particular has key 
// Created as object in case we want to add more functions later
module.exports = {
    // We can pass clearHash anywhere in app now
    clearHash(hashKey) {
        client.del(JSON.stringify(hashKey))
    }
}

