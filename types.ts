
export type Category = 'Attraction' | 'Restaurant' | 'Transport' | 'Stay' | 'Shopping' | 'Other';

export interface TripMember {
  id: string;
  name: string;
  avatar: string;
}

export interface ScheduleItem {
  id: string;
  dayIndex: number;
  time: string;
  endTime?: string; // Optional end time for duration calculation
  title: string;
  location: string;
  category: Category;
  notes?: string;
  photo?: string;
  distanceInfo?: string; // e.g. "2.4km, 15 min walk"
}

export interface Booking {
  id: string;
  type: 'Flight' | 'Hotel' | 'Car' | 'Restaurant' | 'Amusement' | 'Ticket';
  title: string;
  referenceNo?: string; // e.g. Booking Reference / PNR
  bookedBy?: string; // Member ID who booked this
  details: any;
  cost: number;
  imageUrl?: string;
  linkedScheduleId?: string; // ID of the related ScheduleItem
}

export interface Expense {
  id: string;
  amount: number;
  currency: string; // Dynamic currency
  category: string; // Used for icon/color logic (Food, Transport, etc.)
  title: string;    // Custom name of the expense (e.g. "7-11 Snacks")
  paidBy: string;   // Member ID
  splitWith: string[]; // Array of Member IDs involved in the cost
  settledBy?: string[]; // New: Array of Member IDs who have paid back their share
  date: string;
}

export interface PlanningItem {
  id: string;
  type: 'Packing' | 'Shopping';
  title: string;
  assignedTo: string; // 'All' or Member ID
  completed: boolean;
}

export interface TripConfig {
  startDate: string;
  duration: number;
  tripName: string;
  region: string;
}

export interface JournalPost {
  id: string;
  authorId: string;
  content: string;
  imageUrl?: string;
  date: string;
}
