export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type AthleteRow = { id: string; strava_athlete_id: number; display_name: string; avatar_url: string; created_at: string; updated_at: string };
type ConnectionRow = { athlete_id: string; access_token_ciphertext: string; refresh_token_ciphertext: string; expires_at: string; granted_scopes: string[]; connected_at: string; revoked_at: string | null; updated_at: string };
type SyncJobRow = { id: string; athlete_id: string; status: string; next_page: number; processed: number; imported: number; updated: number; failed: number; error: string | null; retry_after: string | null; started_at: string; completed_at: string | null; locked_at: string | null; locked_by: string | null; attempts: number; last_heartbeat_at: string | null; last_page_processed_at: string | null };
type ActivityRow = { id: string; athlete_id: string; provider_activity_id: number; name: string; sport_type: string; start_time: string; distance_meters: number; moving_time_seconds: number; elapsed_time_seconds: number; elevation_gain_meters: number; manual: boolean; commute: boolean; trainer: boolean; country_code: string | null; geographic_resolution_status: string; last_seen_sync_id: string; fetched_at: string };
type PrivacyRow = { athlete_id: string; settings: Json; updated_at: string };
type InviteRow = { id: string; code_hash: string; status: string; expires_at: string | null; accepted_athlete_id: number | null; accepted_at: string | null; created_at: string; updated_at: string };
type ProviderRateLimitRow = { provider: string; retry_after: string | null; updated_at: string };
type PassportCountrySummaryRow = { athlete_id: string; country_code: string; first_visited_at: string; last_visited_at: string; activity_count: number; total_distance_meters: number; total_moving_time_seconds: number; total_elevation_gain_meters: number; sport_types: string[]; stamp_variant: string; updated_at: string };
type AthleteActivityTotalsRow = { athlete_id: string; activity_count: number; unresolved_activity_count: number; total_distance_meters: number; total_moving_time_seconds: number; total_elevation_gain_meters: number; updated_at: string };

export type Database = {
  public: {
    Tables: {
      athletes: {
        Row: AthleteRow;
        Insert: Partial<Pick<AthleteRow, "id" | "avatar_url" | "created_at" | "updated_at">> & Pick<AthleteRow, "strava_athlete_id" | "display_name">;
        Update: Partial<AthleteRow>;
        Relationships: [];
      };
      strava_connections: {
        Row: ConnectionRow;
        Insert: Partial<Pick<ConnectionRow, "granted_scopes" | "connected_at" | "revoked_at" | "updated_at">> & Pick<ConnectionRow, "athlete_id" | "access_token_ciphertext" | "refresh_token_ciphertext" | "expires_at">;
        Update: Partial<ConnectionRow>;
        Relationships: [];
      };
      sync_jobs: {
        Row: SyncJobRow;
        Insert: Partial<Omit<SyncJobRow, "athlete_id">> & Pick<SyncJobRow, "athlete_id">;
        Update: Partial<SyncJobRow>;
        Relationships: [];
      };
      activities: {
        Row: ActivityRow;
        Insert: Partial<Pick<ActivityRow, "id" | "fetched_at">> & Omit<ActivityRow, "id" | "fetched_at">;
        Update: Partial<ActivityRow>;
        Relationships: [];
      };
      privacy_settings: {
        Row: PrivacyRow;
        Insert: PrivacyRow;
        Update: Partial<PrivacyRow>;
        Relationships: [];
      };
      invites: {
        Row: InviteRow;
        Insert: Partial<Pick<InviteRow, "id" | "status" | "expires_at" | "accepted_athlete_id" | "accepted_at" | "created_at" | "updated_at">> & Pick<InviteRow, "code_hash">;
        Update: Partial<InviteRow>;
        Relationships: [];
      };
      provider_rate_limits: {
        Row: ProviderRateLimitRow;
        Insert: ProviderRateLimitRow;
        Update: Partial<ProviderRateLimitRow>;
        Relationships: [];
      };
      passport_country_summaries: {
        Row: PassportCountrySummaryRow;
        Insert: PassportCountrySummaryRow;
        Update: Partial<PassportCountrySummaryRow>;
        Relationships: [];
      };
      athlete_activity_totals: {
        Row: AthleteActivityTotalsRow;
        Insert: AthleteActivityTotalsRow;
        Update: Partial<AthleteActivityTotalsRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      claim_sync_jobs: {
        Args: { p_worker_id: string; p_limit: number; p_stale_before: string };
        Returns: SyncJobRow[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
