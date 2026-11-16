const { neon } = require('@neondatabase/serverless');
const { deliverNotification } = require('../../server/notifications.cjs');
const { createHandler } = require('../../server/orders.cjs');
exports.handler = createHandler(() => {
 if(!process.env.DATABASE_URL)throw Error('DATABASE_URL missing');
 return neon(process.env.DATABASE_URL);
}, deliverNotification);
