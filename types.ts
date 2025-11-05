export interface Patient {
  id: string;
  name: string;
  email: string;
  phone: string;
  dob: string; // Date of Birth
  address: string;
  gender: 'Male' | 'Female' | 'Other';
  medicalHistory: string;
  allergies: string;
}

export enum AppointmentStatus {
  Scheduled = 'Scheduled',
  Completed = 'Completed',
  Cancelled = 'Cancelled',
  NoShow = 'No-Show',
}

export enum PaymentStatus {
  Paid = 'Paid',
  PartiallyPaid = 'Partially Paid',
  Unpaid = 'Unpaid',
}

export interface Payment {
  id: string;
  date: string; // ISO string
  amount: number;
  method: 'Cash' | 'Card' | 'Online' | 'Other';
}

export interface Appointment {
  id: string;
  patientId: string;
  date: string; // ISO string for datetime
  duration: number; // in minutes
  reason: string;
  notes: string;
  status: AppointmentStatus;
  totalFee: number;
  paymentHistory: Payment[];
  paymentStatus: PaymentStatus;
  vitals?: {
    temp: string; // e.g. "36 C"
    bp: string; // e.g. "120/80 mmHg"
  };
  adviceGiven?: string;
  followUpDate?: string; // ISO date string
}

export interface MedicationItem {
  id: string;
  medication: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
}

export interface Prescription {
  id: string;
  patientId: string;
  appointmentId: string;
  medications: MedicationItem[];
  dateIssued: string; // ISO string
}