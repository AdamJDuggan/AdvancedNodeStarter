const { clearHash } = require('../services/cache')


module.exports = async (req, res, next) => {
    // Usually middlewae gets called before req is processed. However, we only want this 
    // middleware to run if the post request successfuly updates 
    //allow req handler to run then fire the middleware. Await next is a neat way of doing this 
    await next()
    console.log('cleared Hash')
    clearHash(req.user.id)

}