require('dotenv/config');
const {Client}=require('pg');
const statements=[
['inventory','inventory_valid_stock','CHECK ("quantity">=0 AND "reserved_quantity">=0 AND "reserved_quantity"<="quantity")'],
['cart_items','cart_items_positive_quantity','CHECK ("quantity">0)'],
['discounts','discount_redemption_valid','CHECK ("redeemed_count">=0 AND "redeemed_count"<="max_redeemed")'],
['vouchers','voucher_redemption_valid','CHECK ("redeemed_count">=0 AND "redeemed_count"<="max_redeemed")']
];
(async()=>{const client=new Client({connectionString:process.env.DATABASE_URL});await client.connect();try{await client.query('BEGIN');await client.query("SELECT pg_advisory_xact_lock(1467092401)");for(const [table,name,check] of statements){const exists=await client.query('SELECT 1 FROM pg_constraint WHERE conname=$1 AND conrelid=$2::regclass',[name,table]);if(!exists.rowCount)await client.query('ALTER TABLE "'+table+'" ADD CONSTRAINT "'+name+'" '+check);}await client.query('CREATE UNIQUE INDEX IF NOT EXISTS addresses_one_primary_per_user ON addresses(user_id) WHERE is_primary');await client.query('COMMIT');console.log('Database constraints ready');}catch(e){await client.query('ROLLBACK');throw e;}finally{await client.end();}})().catch(()=>{console.error('Database constraints failed');process.exit(1);});
