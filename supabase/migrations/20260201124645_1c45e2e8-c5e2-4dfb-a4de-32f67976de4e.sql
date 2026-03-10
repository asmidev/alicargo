-- Delete duplicate forecasts, keeping only the latest one for each type+date
DELETE FROM marketplace_forecasts a
USING marketplace_forecasts b
WHERE a.forecast_type = b.forecast_type
  AND a.forecast_date = b.forecast_date
  AND a.generated_at < b.generated_at;

-- Now add the unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS marketplace_forecasts_type_date_unique 
ON marketplace_forecasts(forecast_type, forecast_date);