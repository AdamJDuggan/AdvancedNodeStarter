const mongoose = require('mongoose')
const redis = require('redis')
const util = require('util')
const redisUrl = 'redis://127.0.0.1:6379'

const client = redis.createClient(redisUrl)
client.get = util.promisify(client.get)

// get a ref to the existing default function which gets executed anytime we do a query search 
const exec = mongoose.Query.prototype.exec;

mongoose.Query.prototype.cache = function () {
    //this is equal to the query instance 
    this.useCache = true
    return this
}

// Arrow function messes around with this 
mongoose.Query.prototype.exec = async function () {
    // check to see if useCahce has been attached to the 
    if (!this.useCache) { return exec.apply(this, arguments) }
    // This adds the collection to the user id
    const key = JSON.stringify(Object.assign({}, this.getQuery(), { colletion: this.mongooseCollection.name }))

    // See if we have a value for key in Redis
    const cacheValue = await client.get(key)
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
    client.set(key, JSON.stringify(result))
    console.log('result ', result)
    return result
}

