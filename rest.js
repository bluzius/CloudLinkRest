var urljoin = require('url-join');
var request = require('request');
var Promise = require('bluebird');
var moment = require('moment');
var _ = require('underscore');

var logger = require('./logger');
logger.level = 'error';

/**
 * Module containing function to connect to the Mi5 REST interface
 * @param host {string} Host address of the CloudLink Server (http(s)://x.y.com/)
 * @param user {string} User name for basic authentication
 * @param password {string} Password for basic authentication
 * @constructor
 */
function MI5REST(host, user, password){
  this.host = host;
  this.user = user;
  this.password = password;

  this.rejectUnauthorized = false; // Default param
  this.verbose = true; // log or not
}
module.exports = MI5REST;

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Connection
/**
 * Test whether the CloudLink server is online
 * @returns {Boolean} Is the server online?
 */
MI5REST.prototype.isOnline = function(){
  var options = this._options({
    target: 'helloWorld'
  });

  console.log('/checkConnection');
  //logger.debug(options);

  return this._GetRequest(options)
    .then(function(body){
      if ( body == 'Hello World!'){
        return true;
      } else {
        return false;
      }
    });
};

/**
 * Update machine status
 * @param status {string} Machine status ['out of order','working']
 */
MI5REST.prototype.reportMachineStatus = function(status){
  var options = this._options({
    target: 'reportMachineStatus',
    form: {status: status}
  });

  logger.info('/reportMachineStatus', status);
  //logger.debug(options);

  return this._PostRequest(options)
    .then(this._safeJsonParse);
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Orders
/**
 * Returns the orders with the given status
 * @param status {string} pending / in progress / done / delivered / rejected / failure / aborted
 * @return {JSON} Orders
 */
MI5REST.prototype.getOrdersByStatus = function(status){
  var options = this._options({
    target: 'getOrdersByStatus',
    form: {status: status}
  });

  logger.info('/getOrdersByStatus', status);
  //logger.debug(options);

  return this._PostRequest(options)
    .then(this._safeJsonParse);
};

/**
 * Return all orders filtered by??
 * @todo not correctly implemented
 * @param status {string} Order status [pending / in progress / done / delivered / rejected / failure / aborted]
 */
MI5REST.prototype.getOrdersFiltered = function(status){
  var filter = {
    status: status
  };
  var options = this._options({
    target: 'getOrdersFiltered',
    form: {filter: JSON.stringify(filter)}
  });

  logger.info('/getOrdersFiltered', status);
  ////logger.debug(options);

  return this._PostRequest(options)
    .then(this._safeJsonParse);
};

/**
 * Place an order online
 * @param order {JSON} Order details
 * @return status {JSON} Order status [pending / in progress / done / delivered / rejected / failure / aborted]
 */
MI5REST.prototype.placeOrder = function(order){
  var options = this._options({
    target: 'placeOrder',
    form: {order: JSON.stringify(order)}
  });

  logger.info('/placeOrder', order);
  //logger.debug(options);

  return this._PostRequest(options)
    .then(this._safeJsonParse);
};

/**
 * @todo fix. currently fails in test
 * @param order
 */
MI5REST.prototype.placeOrderGet = function(order){
  var options = this._options({
    target: 'placeOrder/'+order.recipeId+'/'+JSON.stringify(order.parameters)+'/'+order.marketPlaceId
  });

  logger.info('/placeOrderGet', order);
  //logger.debug(options);

  return this._GetRequest(options);
};

/**
 * Update the status of an order
 * @param orderid {Int}  ID of the order
 * @param status {String} Order status [pending / in progress / done / delivered / rejected / failure / aborted]
 * @return {JSON} Update status
 */
MI5REST.prototype.updateOrderStatus = function(orderid, status){
  var options = this._options({
    target: 'updateOrderStatus',
    form: {id: orderid, status: status}
  });

  logger.info('/updateOrderStatus', orderid, status);
  //logger.debug(options);

  return this._PostRequest(options)
    .then(this._safeJsonParse);
};

/**
 * Update an order
 * @param order {JSON} Order details
 * @return {JSON} Update status
 */
MI5REST.prototype.updateOrder = function(order){
  var options = this._options({
    target: 'updateOrder',
    form: {order: JSON.stringify(order)}
  });

  logger.info('/updateOrder', order);
  //logger.debug(options);

  return this._PostRequest(options)
    .then(this._safeJsonParse);
};

/**
 * Set the barcode for an order
 * @param orderId {Int} Order ID
 * @param barcode {Int} Barcode number
 * @return {JSON} Update status
 */
MI5REST.prototype.setBarcode = function(orderId, barcode){
  var options = this._options({
    target: 'setBarcode',
    form: {
      id: orderId,
      barcode : barcode
    }
  });

  logger.info('/setBarcode', orderId, barcode);
  //logger.debug(options);

  return this._PostRequest(options)
    .then(this._safeJsonParse);
};

/**
 * Experimental - makes orders appear multiple times
 */
MI5REST.prototype.reloadJobboardHack = function(){
  var self = this;

  var ordersPromise = [];

  self.getOrdersFiltered(['in progress', 'accepted'])
    .then(function(orders){
      _.each(orders, function(order){
        var orderForm = {orderId: order.orderId, date: moment().utc().format()};
        var options = self._options({
          target: 'updateOrder',
          form: {order: JSON.stringify(orderForm)}
        });

        console.log('update', options);

        var pro = self._PostRequest(options).then(self._safeJsonParse);
        ordersPromise.push(pro);
      });
    });

  return Promise.all(ordersPromise);
};

/**
 * Reload the order on the JobBoard
 * @param orderId {Int} Order ID
 */
MI5REST.prototype.reloadOrderInJobboard = function(orderId){
  return this.updateOrder({orderId: orderId, date: moment().utc().format()});
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Orders / Jobboard
/**
 * Returns all orders since the given time
 * @param timestamp
 */
MI5REST.prototype.getOrdersSince = function(timestamp){
  if(typeof timestamp == 'undefined') {
    timestamp = moment().subtract(1,'m').utc().format(); // 1 min ago in UTC
  }
  
  var options = this._options({
    target: 'getOrdersSince',
    form: {
      timestamp: timestamp
    }
  });

  logger.info('/getOrdersSince', timestamp);
  //logger.debug(options);

  return this._PostRequest(options)
    .then(this._safeJsonParse);
};

/**
 * Return all orders updated recently
 * @param {float} [seconds=60] Time window
 * @return {JSON} Orders
 */
MI5REST.prototype.getOrdersUpdatedSince = function(seconds){
  if(typeof seconds == 'undefined') {
    seconds = 60;
  }
  var timestamp = moment().subtract(seconds,'s').utc().format(); // 1 min ago in UTC

  var options = this._options({
    target: 'getOrdersUpdatedSince',
    form: {
      timestamp: timestamp
    }
  });

  logger.info('/getOrdersUpdatedSince', timestamp);
  //logger.debug(options);

  return this._PostRequest(options)
    .then(this._safeJsonParse);
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Recipes
/**
 * Get a list of recipes
 * @return {JSON} Recipes
 */
MI5REST.prototype.getRecipes = function(){
  var options = this._options({
    target: 'getRecipes'
  });

  logger.info('/getRecipes');
  //logger.debug(options);

  return this._GetRequest(options)
    .then(this._safeJsonParse);
};

/**
 * Loads the default recipes on the CloudLink server
 * @return {JSON} Status information and recipes
 */
MI5REST.prototype.loadDefaultRecipes = function(){
  var options = this._options({
    target: 'loadDefaultRecipes'
  });

  logger.info('/loadDefaultRecipes');
  //logger.debug(options);

  return this._GetRequest(options)
    .then(this._safeJsonParse);
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Feedback

/**
 * Give customer feedback on an order. Negative feedback will trigger an operator push notification.
 * @param {Int} orderId ID of the order to be reviewed
 * @param {Boolean} like Positive or negative feedback
 * @param {String} feedbackText Feedback text
 * @return {JSON} status
 */
MI5REST.prototype.giveFeedback = function(orderId, like, feedbackText){
  var feedback = {
    productId:  orderId,
    like:       like,
    feedback:   feedbackText
  };
  var options = this._options({
    target: 'giveFeedback',
    form: { feedback: JSON.stringify(feedback) }
  });

  logger.info('/giveFeedback', orderId, like, feedbackText);
  //logger.debug(options);

  return this._PostRequest(options)
    .then(this._safeJsonParse);
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Devices GCM
/**
 * Get a list of devices for the GCM push service
 * @return {JSON} IDs of registered devices
 */
MI5REST.prototype.getRegisteredDevices = function(){
  var options = this._options({
    target: 'getRegIds'
  });

  logger.info('/getRegIds - get all registered devices');
  //logger.debug(options);

  return this._GetRequest(options)
    .then(this._safeJsonParse)
    .then(this._safeJsonParse); // do it twice, because it returns a string of regids '["regid1", "regId2", ....]'
};

/**
 * Register a GCM device online
 * @param {String} regId ID of the device
 * @return {JSON} Status
 */
MI5REST.prototype.registerDevice = function(regId){
  var options = this._options({
    target: 'register',
    form: {regId:  regId }
  });

  logger.info('/register - register a gcm device online', regId);
  //logger.debug(options);

  return this._PostRequest(options)
    .then(this._safeJsonParse);
};


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////// Helper ////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

MI5REST.prototype._url = function(target){
  return urljoin(this.host, target);
};

MI5REST.prototype._options = function(options){
  options.url = this._url(options.target);
  options.auth = {
    user :      this.user,
    password :  this.password
  };
  options.rejectUnauthorized = this.rejectUnauthorized;

  return options;
};

MI5REST.prototype._GetRequest = function(options){
  return new Promise(function(resolve, reject){
    request.get(options, function(err, res, body){
      if(err) reject(err);
      resolve(body);
    })
  }).bind(this);
};

MI5REST.prototype._PostRequest = function(options){
  return new Promise(function(resolve, reject){
    request.post(options, function(err, res, body){
      if(err) reject(err);
      resolve(body);
    })
  }).bind(this);
};

MI5REST.prototype._safeJsonParse = function(body){
  try {
    var body = JSON.parse(body);
    return new Promise(function(res){ res(body);}).bind(this);
    //return body;
  } catch (err){
    logger.error(body);
    throw new Error('could not parse body json');
    //return err
    return new Promise(function(res, rej){ rej(err);}).bind(this);
  }
};