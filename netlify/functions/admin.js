const { neon } = require('@neondatabase/serverless');
const { createAdminHandler } = require('../../server/admin.cjs');
exports.handler=createAdminHandler(()=>{
 if(!process.env.DATABASE_URL)throw Error('DATABASE_URL missing');
 return neon(process.env.DATABASE_URL);
});
