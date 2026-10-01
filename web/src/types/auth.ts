export type StaffId = string;

export interface DoctorUser {
  id: string;
  staffId: string;
  fullName: string;
  specialization: string;
  phone?: string;
  email?: string;
  picture?: string; // data URL or URL
  role?: 'doctor' | 'nurse' | 'admin';
}

export interface AuthState {
  user: DoctorUser | null;
  isAuthenticated: boolean;
  loading: boolean;
}

export interface AuthService {
  /**
   * Clinic staff (doctor/nurse) sign in passwordlessly with a Staff ID.
   * Admins sign in with an identifier (email) plus a password; the password is
   * only sent when one was actually supplied, so a bad Staff ID never produces
   * a misleading error.
   */
  signIn(staffId: string, password?: string): Promise<DoctorUser | null>;
  signUp(data: {
    staffId: string;
    fullName: string;
    specialization: string;
    phone?: string;
    email?: string;
    picture?: string;
  }): Promise<DoctorUser>;
  signOut(): Promise<void>;
  getCurrentUser(): Promise<DoctorUser | null>;
}
