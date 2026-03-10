-- Drop marketplace-related tables
DROP TABLE IF EXISTS marketplace_ai_event_analysis CASCADE;
DROP TABLE IF EXISTS marketplace_category_mappings CASCADE;
DROP TABLE IF EXISTS marketplace_chat_messages CASCADE;
DROP TABLE IF EXISTS marketplace_chats CASCADE;
DROP TABLE IF EXISTS marketplace_listings CASCADE;
DROP TABLE IF EXISTS marketplace_orders CASCADE;
DROP TABLE IF EXISTS marketplace_price_rules CASCADE;
DROP TABLE IF EXISTS marketplace_questions CASCADE;
DROP TABLE IF EXISTS marketplace_returns CASCADE;
DROP TABLE IF EXISTS marketplace_reviews CASCADE;
DROP TABLE IF EXISTS marketplace_stores CASCADE;
DROP TABLE IF EXISTS marketplace_sync_logs CASCADE;
DROP TABLE IF EXISTS marketplace_sync_schedules CASCADE;
DROP TABLE IF EXISTS marketplace_webhook_events CASCADE;

-- Drop AI marketplace-related tables
DROP TABLE IF EXISTS ai_competitor_monitors CASCADE;
DROP TABLE IF EXISTS ai_competitor_prices CASCADE;
DROP TABLE IF EXISTS ai_demand_forecasts CASCADE;
DROP TABLE IF EXISTS ai_generated_content CASCADE;
DROP TABLE IF EXISTS ai_listing_analysis CASCADE;
DROP TABLE IF EXISTS ai_price_alerts CASCADE;
DROP TABLE IF EXISTS ai_price_experiments CASCADE;
DROP TABLE IF EXISTS ai_price_history CASCADE;
DROP TABLE IF EXISTS ai_price_recommendations CASCADE;
DROP TABLE IF EXISTS ai_return_decisions CASCADE;

-- Drop marketplace_type enum if exists
DROP TYPE IF EXISTS marketplace_type CASCADE;