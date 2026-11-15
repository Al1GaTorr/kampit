CREATE TABLE kampit.identity_links (
  supabase_user_id text PRIMARY KEY,
  profile_id text NOT NULL UNIQUE REFERENCES kampit.profiles(id),
  verified_at timestamptz NOT NULL,
  verification_note text NOT NULL
);

CREATE FUNCTION kampit.award_checkin() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, kampit AS $$
DECLARE used integer; bonus integer; award integer;
BEGIN
  IF current_setting('kampit.scoring_lock',true) IS DISTINCT FROM 'held' THEN
    RAISE EXCEPTION 'Use the scoring transaction adapter; lock profile BEFORE INSERT';
  END IF;
  IF NEW.base_points < 0 OR NEW.base_points > 100 THEN RAISE EXCEPTION 'Invalid base points'; END IF;
  SELECT COALESCE(SUM(points),0)::integer INTO used FROM kampit.score_events
    WHERE user_id=NEW.user_id AND local_date=NEW.local_date;
  bonus := CASE WHEN EXISTS(SELECT 1 FROM kampit.daily_checkins
      WHERE user_id=NEW.user_id AND local_date=((NEW.local_date::date - 1)::text))
    AND NOT EXISTS(SELECT 1 FROM kampit.score_events
      WHERE user_id=NEW.user_id AND local_date=NEW.local_date)
    THEN 5 ELSE 0 END;
  award := LEAST(GREATEST(0,100-used),NEW.base_points+bonus);
  INSERT INTO kampit.score_events(id,user_id,checkin_id,local_date,season_id,requested,points,streak_bonus,created_at)
  VALUES(NEW.id,NEW.user_id,NEW.id,NEW.local_date,NEW.season_id,NEW.base_points+bonus,
    award,CASE WHEN bonus>0 THEN LEAST(5,GREATEST(0,100-NEW.base_points-used)) ELSE 0 END,NEW.created_at);
  RETURN NEW;
END $$;
CREATE TRIGGER checkins_award_points AFTER INSERT ON kampit.daily_checkins
  FOR EACH ROW EXECUTE FUNCTION kampit.award_checkin();

-- The browser uses Supabase Auth only. Game data goes through verified server APIs.
-- No broad Data API policy. Pooler credentials stay in Vercel server environment.
DO $$ DECLARE item record; role_name text;
BEGIN
  FOR item IN SELECT tablename FROM pg_tables WHERE schemaname='kampit' LOOP
    EXECUTE format('ALTER TABLE kampit.%I ENABLE ROW LEVEL SECURITY',item.tablename);
    EXECUTE format('REVOKE ALL ON TABLE kampit.%I FROM PUBLIC',item.tablename);
    FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
      IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
        EXECUTE format('REVOKE ALL ON TABLE kampit.%I FROM %I',item.tablename,role_name);
      END IF;
    END LOOP;
  END LOOP;
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
      EXECUTE format('REVOKE ALL ON SCHEMA kampit FROM %I',role_name);
    END IF;
  END LOOP;
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA kampit FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA kampit REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA kampit REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
