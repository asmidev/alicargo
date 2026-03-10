-- Phase 1 & 2: Delete all marketplace data and drop tables/triggers

-- Step 1: Drop all triggers on marketplace_listings table
DROP TRIGGER IF EXISTS marketplace_listing_stock_sync ON marketplace_listings;
DROP TRIGGER IF EXISTS on_marketplace_stock_change ON marketplace_listings;

-- Step 2: Drop the function with CASCADE to remove all dependent triggers
DROP FUNCTION IF EXISTS trigger_marketplace_stock_sync() CASCADE;

-- Step 3: Truncate tables that exist (safer than DELETE)
TRUNCATE TABLE marketplace_sync_logs CASCADE;
TRUNCATE TABLE marketplace_listings CASCADE;
TRUNCATE TABLE marketplace_orders CASCADE;
TRUNCATE TABLE marketplace_reviews CASCADE;
TRUNCATE TABLE marketplace_questions CASCADE;
TRUNCATE TABLE marketplace_competitor_prices CASCADE;
TRUNCATE TABLE marketplace_competitors CASCADE;
TRUNCATE TABLE top_sellers CASCADE;
TRUNCATE TABLE price_gap_alerts CASCADE;
TRUNCATE TABLE marketplace_stores CASCADE;

-- Step 4: Drop all marketplace-related tables
DROP TABLE IF EXISTS marketplace_sync_logs CASCADE;
DROP TABLE IF EXISTS marketplace_listings CASCADE;
DROP TABLE IF EXISTS marketplace_orders CASCADE;
DROP TABLE IF EXISTS marketplace_reviews CASCADE;
DROP TABLE IF EXISTS marketplace_questions CASCADE;
DROP TABLE IF EXISTS marketplace_competitor_prices CASCADE;
DROP TABLE IF EXISTS marketplace_competitors CASCADE;
DROP TABLE IF EXISTS top_sellers CASCADE;
DROP TABLE IF EXISTS price_gap_alerts CASCADE;
DROP TABLE IF EXISTS ai_price_recommendations CASCADE;
DROP TABLE IF EXISTS ai_competitor_prices CASCADE;
DROP TABLE IF EXISTS marketplace_stores CASCADE;