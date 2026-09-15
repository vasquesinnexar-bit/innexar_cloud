export interface Ticket {
  id: number;
  subject: string;
  status: string;
  priority?: string;
  created_at: string;
  updated_at: string;
  message_count?: number;
}

export interface TicketMessage {
  id: number;
  ticket_id: number;
  author_type: string;
  body: string;
  created_at: string;
}
