-- Clear old commands to reset state for testing
UPDATE commands SET status = 'ended', handled = true, handled_at = now() WHERE command = 'START_LIVE_VIEW' AND status = 'ack';