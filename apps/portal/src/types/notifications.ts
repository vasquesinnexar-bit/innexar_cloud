export interface NotificationItem {
  id: number;
  channel: string;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
}
